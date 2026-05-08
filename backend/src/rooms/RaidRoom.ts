import { DurableObject } from 'cloudflare:workers';
import { verifyToken } from '@clerk/backend';
import { createDbClient } from '../db';
import { raidSessions, raidPlayers } from '../db/schema';

type PlayerState = {
  userId: string;
  username: string;
  hp: number;
  maxHp: number;
  isHost: boolean;
  isAlive: boolean;
  wordsTyped: number;
  wordsCorrect: number;
  damageDealt: number;
};

type RoomPhase = 'lobby' | 'playing' | 'finished';

type RaidRoomState = {
  phase: RoomPhase;
  players: Map<WebSocket, PlayerState>;
  bossHp: number;
  bossMaxHp: number;
  bossBaseHp: number;
  finalBossHp: number;
  texts: Map<string, string>;
  roomId: string;
  createdAt: number;
  startedAt: number | null;
  attackTimer: ReturnType<typeof setInterval> | null;
  graceTimer: ReturnType<typeof setTimeout> | null;
};

const BASE_HP_PER_PLAYER = 125;
const WORD_DAMAGE = 6;
const BOSS_ATTACK_INTERVAL_MS = 5000;
const BOSS_ATTACK_DAMAGE = 12;
const MAX_PLAYERS = 3;
const GRACE_PERIOD_MS = 30000;

function generateRoomId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

function generateText(wordCount: number = 25): string {
  const words = [
    'the','quick','brown','fox','jumps','over','lazy','dog','hello','world',
    'typing','is','fun','raid','boss','battle','fight','together','win','defeat',
    'monster','sword','shield','health','damage','critical','hit','streak'
  ];
  const out = [];
  for (let i = 0; i < wordCount; i++) {
    out.push(words[Math.floor(Math.random() * words.length)]);
  }
  return out.join(' ');
}

export class RaidRoom extends DurableObject {
  state: RaidRoomState;

  constructor(ctx: DurableObjectState, env: Record<string, unknown>) {
    super(ctx, env);
    this.state = {
      phase: 'lobby',
      players: new Map(),
      bossHp: 0,
      bossMaxHp: 0,
      bossBaseHp: BASE_HP_PER_PLAYER,
      finalBossHp: 0,
      texts: new Map(),
      roomId: crypto.randomUUID(),
      createdAt: Date.now(),
      startedAt: null,
      attackTimer: null,
      graceTimer: null,
    };
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    if (!token) {
      return new Response('Missing token', { status: 401 });
    }

    try {
      const env = this.env as { CLERK_SECRET_KEY: string };
      await verifyToken(token, { secretKey: env.CLERK_SECRET_KEY });
    } catch {
      return new Response('Unauthorized', { status: 401 });
    }

    if (this.state.players.size >= MAX_PLAYERS) {
      return new Response('Room full', { status: 403 });
    }

    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected websocket', { status: 400 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
    let data: any;
    try {
      data = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message));
    } catch {
      return;
    }

    switch (data.type) {
      case 'join':
        this.handlePlayerJoin(ws, data);
        break;
      case 'start_game':
        this.handleStartGame(ws);
        break;
      case 'word_complete':
        this.handleWordComplete(ws, data);
        break;
      case 'player_dead':
        this.handlePlayerDead(ws);
        break;
    }
  }

  handlePlayerJoin(ws: WebSocket, data: { userId: string; username: string }) {
    if (this.state.phase !== 'lobby') return;
    const isHost = this.state.players.size === 0;
    const player: PlayerState = {
      userId: data.userId,
      username: data.username,
      hp: 100,
      maxHp: 100,
      isHost,
      isAlive: true,
      wordsTyped: 0,
      wordsCorrect: 0,
      damageDealt: 0,
    };
    this.state.players.set(ws, player);
    this.broadcastRoomState();
    this.broadcast({ type: 'player_joined', userId: data.userId, username: data.username });
  }

  handleStartGame(ws: WebSocket) {
    const player = this.state.players.get(ws);
    if (!player || !player.isHost) return;
    if (this.state.phase !== 'lobby') return;

    const playerCount = this.state.players.size;
    this.state.bossMaxHp = BASE_HP_PER_PLAYER * playerCount;
    this.state.bossHp = this.state.bossMaxHp;
    this.state.phase = 'playing';
    this.state.startedAt = Date.now();

    for (const [sock, p] of this.state.players) {
      this.state.texts.set(p.userId, generateText(25));
    }

    const texts: Record<string, string> = {};
    for (const [uid, text] of this.state.texts) {
      texts[uid] = text;
    }

    this.broadcast({ type: 'game_started', texts });
    this.broadcastRoomState();

    this.state.attackTimer = setInterval(() => this.bossAttack(), BOSS_ATTACK_INTERVAL_MS);
  }

  handleWordComplete(ws: WebSocket, data: { wordIndex: number }) {
    if (this.state.phase !== 'playing') return;
    const player = this.state.players.get(ws);
    if (!player || !player.isAlive) return;

    player.wordsTyped++;
    player.wordsCorrect++;
    player.damageDealt += WORD_DAMAGE;
    this.state.bossHp = Math.max(0, this.state.bossHp - WORD_DAMAGE);

    this.broadcast({ type: 'word_hit', playerId: player.userId, newBossHp: this.state.bossHp });
    this.broadcastRoomState();

    if (this.state.bossHp <= 0) {
      this.endGame('victory');
    }
  }

  handlePlayerDead(ws: WebSocket) {
    const player = this.state.players.get(ws);
    if (!player) return;
    if (!player.isAlive) return;

    player.hp = 0;
    player.isAlive = false;

    this.broadcast({ type: 'player_died', playerId: player.userId });
    this.broadcastRoomState();

    const anyAlive = Array.from(this.state.players.values()).some(p => p.isAlive);
    if (!anyAlive) {
      this.endGame('defeat');
    }
  }

  bossAttack() {
    if (this.state.phase !== 'playing') return;
    const alivePlayers = Array.from(this.state.players.values()).filter(p => p.isAlive);
    if (alivePlayers.length === 0) {
      this.endGame('defeat');
      return;
    }

    const target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
    target.hp = Math.max(0, target.hp - BOSS_ATTACK_DAMAGE);
    if (target.hp <= 0) {
      target.isAlive = false;
      for (const [ws, p] of this.state.players) {
        if (p.userId === target.userId) {
          this.broadcast({ type: 'player_died', playerId: target.userId });
          break;
        }
      }
    }

    this.broadcast({ type: 'boss_attacked', targetId: target.userId, damage: BOSS_ATTACK_DAMAGE, newBossHp: this.state.bossHp });
    this.broadcastRoomState();

    const anyAlive = Array.from(this.state.players.values()).some(p => p.isAlive);
    if (!anyAlive) {
      this.endGame('defeat');
    }
  }

  async endGame(status: 'victory' | 'defeat') {
    if (this.state.phase === 'finished') return;
    if (this.state.graceTimer) {
      clearTimeout(this.state.graceTimer);
      this.state.graceTimer = null;
    }
    if (this.state.attackTimer) {
      clearInterval(this.state.attackTimer);
      this.state.attackTimer = null;
    }
    this.state.phase = 'finished';
    this.state.finalBossHp = this.state.bossHp;

    this.broadcast({ type: status, stats: this.buildStats() });
    this.broadcastRoomState();

    this.state.graceTimer = setTimeout(() => {
      for (const [ws] of this.state.players) {
        try { ws.close(); } catch {}
      }
    }, GRACE_PERIOD_MS);

    this.persistSession(status).catch(() => {});
  }

  private async persistSession(status: 'victory' | 'defeat') {
    try {
      const db = createDbClient((this.env as any).DB);
      const [session] = await db
        .insert(raidSessions)
        .values({
          roomId: this.state.roomId,
          startedAt: new Date(this.state.startedAt ?? Date.now()),
          endedAt: new Date(),
          playerCount: this.state.players.size,
          bossBaseHp: this.state.bossBaseHp,
          bossMaxHp: this.state.bossMaxHp,
          finalBossHp: this.state.finalBossHp,
          status,
        })
        .returning({ id: raidSessions.id });

      const playerRows = Array.from(this.state.players.values()).map(p => ({
        sessionId: session.id,
        userId: p.userId,
        username: p.username,
        damageDealt: p.damageDealt,
        wordsTyped: p.wordsTyped,
        wordsCorrect: p.wordsCorrect,
        survived: p.isAlive,
      }));
      if (playerRows.length > 0) {
        await db.insert(raidPlayers).values(playerRows);
      }
    } catch (e) {
      console.error('Failed to persist raid session:', e);
    }
  }

  buildStats() {
    const players = Array.from(this.state.players.values());
    const totalWords = players.reduce((sum, p) => sum + p.wordsCorrect, 0);
    const avgWpm = 0; // TODO: calculate from timestamps if needed
    const durationMs = this.state.startedAt ? Date.now() - this.state.startedAt : 0;
    return { totalWords, avgWpm, durationMs };
  }

  broadcastRoomState() {
    const players = Array.from(this.state.players.values()).map(p => ({
      userId: p.userId,
      username: p.username,
      hp: p.hp,
      maxHp: p.maxHp,
      isHost: p.isHost,
      isAlive: p.isAlive,
      wordsTyped: p.wordsTyped,
      wordsCorrect: p.wordsCorrect,
      damageDealt: p.damageDealt,
    }));

    const state = {
      type: 'room_state',
      phase: this.state.phase,
      players,
      bossHp: this.state.bossHp,
      bossMaxHp: this.state.bossMaxHp,
    };

    for (const [ws] of this.state.players) {
      try { ws.send(JSON.stringify(state)); } catch {}
    }
  }

  broadcast(msg: object) {
    const data = JSON.stringify(msg);
    for (const [ws] of this.state.players) {
      try { ws.send(data); } catch {}
    }
  }

  webSocketClose(ws: WebSocket) {
    const player = this.state.players.get(ws);
    this.state.players.delete(ws);
    if (player) {
      this.broadcast({ type: 'player_left', userId: player.userId });
      if (player.isHost && this.state.phase === 'lobby') {
        for (const [, p] of this.state.players) {
          p.isHost = true;
          break;
        }
      }
    }
    this.broadcastRoomState();

    if (this.state.players.size === 0 && this.state.phase === 'playing') {
      this.endGame('defeat');
    }
  }
}

export { generateRoomId };
