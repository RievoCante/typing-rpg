import { DurableObject } from 'cloudflare:workers';
import { createDbClient } from '../db';
import { raidSessions, raidPlayers, raidRooms, users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { calculateRaidXp, applyXp } from '../core/xp';
import { isGuestId } from '../core/guestIdentity';
import { parseCharacterConfig, type CharacterConfig } from '../core/character';
import english1k from '../static/english_1k.json';

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
  characterConfig: CharacterConfig | null;
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
  endedAt: number | null;
  attackTimer: ReturnType<typeof setInterval> | null;
  graceTimer: ReturnType<typeof setTimeout> | null;
  idleTimer: ReturnType<typeof setTimeout> | null;
  dbRoomCreated: boolean;
};

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 3;
const BOSS_MAX_HP = 100;
const WORD_DAMAGE = 1;
const WORDS_PER_PLAYER = 75;
const BOSS_ATTACK_INTERVAL_MS = 6000;
const BOSS_ATTACK_DAMAGE = 10;
const MISTAKE_DAMAGE_MIN = 5;
const MISTAKE_DAMAGE_MAX = 15;
const PLAYER_MAX_HP = 100;
const ROOM_IDLE_TIMEOUT_MS = 300_000;
const GRACE_PERIOD_MS = 30_000;

const WORDS: string[] = (english1k as { words: string[] }).words;

function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

function generateText(wordCount: number): string {
  const out: string[] = [];
  for (let i = 0; i < wordCount; i++) {
    out.push(WORDS[Math.floor(Math.random() * WORDS.length)]);
  }
  return out.join(' ');
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export class RaidRoom extends DurableObject {
  state: RaidRoomState;
  // Credentials extracted from the WebSocket upgrade URL. Worker.fetch has
  // already validated these (Clerk token for authed users, accepted at face
  // value for guests). The `join` message looks them up here instead of
  // trusting whatever userId the client puts in the message body.
  private wsCredentials: Map<WebSocket, { userId: string; username: string }>;
  private initialized: boolean;

  constructor(ctx: DurableObjectState, env: Record<string, unknown>) {
    super(ctx, env);
    this.initialized = false;
    this.wsCredentials = new Map();
    this.state = {
      phase: 'lobby',
      players: new Map(),
      bossHp: 0,
      bossMaxHp: 0,
      bossBaseHp: BOSS_MAX_HP,
      finalBossHp: 0,
      texts: new Map(),
      roomId: crypto.randomUUID(),
      createdAt: Date.now(),
      startedAt: null,
      endedAt: null,
      attackTimer: null,
      graceTimer: null,
      idleTimer: null,
      dbRoomCreated: false,
    };
  }

  private async ensureInitialized() {
    if (this.initialized) return;
    try {
      const persistedRoomId = await this.ctx.storage.get<string>('roomId');
      const persistedDbCreated = await this.ctx.storage.get<boolean>('dbRoomCreated');
      if (persistedRoomId) {
        this.state.roomId = persistedRoomId;
      }
      if (persistedDbCreated !== undefined) {
        this.state.dbRoomCreated = persistedDbCreated;
      }
    } catch {
      // If no persisted state, use defaults
    }
    this.initialized = true;
  }

  private async persistState() {
    try {
      await this.ctx.storage.put('roomId', this.state.roomId);
      await this.ctx.storage.put('dbRoomCreated', this.state.dbRoomCreated);
    } catch {
      // Best-effort persistence
    }
  }

  private startIdleTimer() {
    if (this.state.idleTimer) clearTimeout(this.state.idleTimer);
    this.state.idleTimer = setTimeout(() => {
      if (this.state.phase !== 'lobby') return;
      // Idle timeout: destroy the room.
      for (const [ws] of this.state.players) {
        try { ws.close(); } catch {
          // Best-effort
        }
      }
      this.state.players.clear();
      if (this.state.dbRoomCreated) {
        this.deleteRoomFromDb();
      } else {
        // HTTP handler may have inserted; attempt anyway.
        this.deleteRoomFromDb();
      }
    }, ROOM_IDLE_TIMEOUT_MS);
  }

  private clearIdleTimer() {
    if (this.state.idleTimer) {
      clearTimeout(this.state.idleTimer);
      this.state.idleTimer = null;
    }
  }

  async fetch(request: Request): Promise<Response> {
    await this.ensureInitialized();

    const url = new URL(request.url);

    // Worker.fetch has already validated userId/username (and any token).
    // The DO trusts these values as the player's identity for this connection.
    const userId = url.searchParams.get('userId');
    const username = url.searchParams.get('username');
    if (!userId || !username) {
      return new Response('Missing credentials', { status: 400 });
    }

    // Extract roomCode from URL path: /raid/XXXXXX
    const pathParts = url.pathname.split('/');
    const roomCode = pathParts[pathParts.length - 1]; // Last part is the roomCode

    // Ensure DO's internal roomId always matches the actual room code from URL
    if (this.state.roomId !== roomCode) {
      this.state.roomId = roomCode;
      await this.persistState();
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
    this.wsCredentials.set(server, { userId, username });

    // Arm the idle timer on first websocket open (lobby phase only).
    if (this.state.phase === 'lobby' && !this.state.idleTimer) {
      this.startIdleTimer();
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
    let data: { type?: string; [k: string]: unknown };
    try {
      data = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message));
    } catch {
      return;
    }

    switch (data.type) {
      case 'join': {
        // Source credentials from the validated URL params, not the message
        // body. A malicious client cannot impersonate another user by
        // sending a different userId in the join payload.
        const creds = this.wsCredentials.get(ws);
        if (!creds) return;
        const characterConfig = parseCharacterConfig(data.characterConfig);
        this.handlePlayerJoin(ws, creds, characterConfig);
        break;
      }
      case 'start_game':
        this.handleStartGame(ws);
        break;
      case 'word_complete':
        this.handleWordComplete(ws, data as { wordIndex: number });
        break;
      case 'mistake':
        this.handleMistake(ws);
        break;
      case 'player_dead':
        this.handlePlayerDead(ws);
        break;
    }
  }

  handlePlayerJoin(
    ws: WebSocket,
    data: { userId: string; username: string },
    characterConfig: CharacterConfig | null = null
  ) {
    if (this.state.phase !== 'lobby') {
      return;
    }
    const config = parseCharacterConfig(characterConfig);
    const isHost = this.state.players.size === 0;
    const player: PlayerState = {
      userId: data.userId,
      username: data.username,
      hp: PLAYER_MAX_HP,
      maxHp: PLAYER_MAX_HP,
      isHost,
      isAlive: true,
      wordsTyped: 0,
      wordsCorrect: 0,
      damageDealt: 0,
      characterConfig: config,
    };
    this.state.players.set(ws, player);

    // If this is the first player (host), create room in DB
    if (isHost && !this.state.dbRoomCreated) {
      this.createRoomInDb(data.userId, data.username);
    } else {
      // Room already tracked in DB — sync the live player count
      this.syncPlayerCountToDb(this.state.players.size);
    }

    this.broadcastRoomState();
    this.broadcast({ type: 'player_joined', userId: data.userId, username: data.username, characterConfig: config });
  }

  async createRoomInDb(hostId: string, hostUsername: string) {
    try {
      const env = this.env as { DB: D1Database };
      if (!env.DB) {
        console.error('DB binding not found');
        return;
      }
      const db = createDbClient(env.DB);
      await db.insert(raidRooms).values({
        roomCode: this.state.roomId,
        hostId,
        hostUsername,
        status: 'waiting',
        playerCount: 1,
        maxPlayers: MAX_PLAYERS,
        createdAt: new Date(),
      });
      this.state.dbRoomCreated = true;
      await this.persistState();
    } catch (err: unknown) {
      // If insert fails because row already exists (HTTP handler created it),
      // treat it as success — the room record is already there.
      const e = err as { message?: string; cause?: { message?: string } };
      const msg = e?.message ?? '';
      const causeMsg = e?.cause?.message ?? '';
      const isDuplicate = msg.includes('UNIQUE') || msg.includes('PRIMARY KEY') || msg.includes('SQLITE_CONSTRAINT') ||
                          causeMsg.includes('UNIQUE') || causeMsg.includes('PRIMARY KEY') || causeMsg.includes('SQLITE_CONSTRAINT');
      if (isDuplicate) {
        this.state.dbRoomCreated = true;
        await this.persistState();
        // HTTP handler may have inserted with different guest credentials — overwrite with actual host
        await this.syncPlayerCountToDb(1, 'waiting', hostId, hostUsername);
      } else {
        console.error('Failed to create room in DB:', err);
      }
    }
  }

  async deleteRoomFromDb() {
    try {
      const env = this.env as { DB: D1Database };
      if (!env.DB) return;
      const db = createDbClient(env.DB);
      await db.delete(raidRooms).where(eq(raidRooms.roomCode, this.state.roomId));
      this.state.dbRoomCreated = false;
      await this.persistState();
    } catch (err) {
      console.error('Failed to delete room from DB:', err);
    }
  }

  private async syncPlayerCountToDb(
    count: number,
    status?: 'waiting' | 'active',
    hostId?: string,
    hostUsername?: string
  ) {
    try {
      const env = this.env as { DB: D1Database };
      if (!env.DB) return;
      const db = createDbClient(env.DB);
      const updates: Record<string, unknown> = { playerCount: count };
      if (status) updates.status = status;
      if (hostId) updates.hostId = hostId;
      if (hostUsername) updates.hostUsername = hostUsername;
      await db.update(raidRooms).set(updates).where(eq(raidRooms.roomCode, this.state.roomId));
    } catch (err) {
      console.error('Failed to sync player count:', err);
    }
  }

  handleStartGame(ws: WebSocket) {
    const player = this.state.players.get(ws);
    if (!player || !player.isHost) return;
    if (this.state.phase !== 'lobby') return;

    const playerCount = this.state.players.size;
    if (playerCount < MIN_PLAYERS) {
      try { ws.send(JSON.stringify({ type: 'error', message: `Need at least ${MIN_PLAYERS} players to start` })); } catch {
        // Best-effort
      }
      return;
    }
    if (playerCount > MAX_PLAYERS) {
      try { ws.send(JSON.stringify({ type: 'error', message: `Max ${MAX_PLAYERS} players allowed` })); } catch {
        // Best-effort
      }
      return;
    }

    this.clearIdleTimer();

    this.state.bossMaxHp = BOSS_MAX_HP;
    this.state.bossHp = BOSS_MAX_HP;
    this.state.phase = 'playing';
    this.state.startedAt = Date.now();

    for (const [, p] of this.state.players) {
      this.state.texts.set(p.userId, generateText(WORDS_PER_PLAYER));
    }

    const texts: Record<string, string> = {};
    for (const [uid, text] of this.state.texts) {
      texts[uid] = text;
    }

    this.broadcast({ type: 'game_started', texts });
    this.broadcastRoomState();

    // Sync final player count and mark room as active so it disappears from lobby
    this.syncPlayerCountToDb(playerCount, 'active');

    this.state.attackTimer = setInterval(() => this.bossAttack(), BOSS_ATTACK_INTERVAL_MS);
  }

  handleWordComplete(ws: WebSocket, _data: { wordIndex: number }) {
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

  handleMistake(ws: WebSocket) {
    if (this.state.phase !== 'playing') return;
    const player = this.state.players.get(ws);
    if (!player || !player.isAlive) return;

    const damage = randInt(MISTAKE_DAMAGE_MIN, MISTAKE_DAMAGE_MAX);
    player.hp = Math.max(0, player.hp - damage);

    this.broadcast({
      type: 'player_hit',
      playerId: player.userId,
      damage,
      newHp: player.hp,
    });

    if (player.hp <= 0) {
      player.isAlive = false;
      this.broadcast({ type: 'player_died', playerId: player.userId });
    }

    this.broadcastRoomState();

    const anyAlive = Array.from(this.state.players.values()).some(p => p.isAlive);
    if (!anyAlive) {
      this.endGame('defeat');
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

    const hitResults: { playerId: string; newHp: number; isAlive: boolean }[] = [];
    const newlyDead: string[] = [];

    for (const p of alivePlayers) {
      p.hp = Math.max(0, p.hp - BOSS_ATTACK_DAMAGE);
      if (p.hp <= 0 && p.isAlive) {
        p.isAlive = false;
        newlyDead.push(p.userId);
      }
      hitResults.push({ playerId: p.userId, newHp: p.hp, isAlive: p.isAlive });
    }

    this.broadcast({
      type: 'boss_attacked',
      damage: BOSS_ATTACK_DAMAGE,
      players: hitResults,
    });

    for (const playerId of newlyDead) {
      this.broadcast({ type: 'player_died', playerId });
    }

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
    this.clearIdleTimer();

    this.state.phase = 'finished';
    this.state.finalBossHp = this.state.bossHp;
    this.state.endedAt = Date.now();

    // Persist session and compute XP awards. Builds the xpByUserId map so we
    // can broadcast personalized XP in the stats payload.
    const xpByUserId = await this.persistSessionAndAwardXp(status);
    const stats = this.buildStats(xpByUserId);

    // Broadcast the terminal result and a room_state that carries result+stats
    // so clients that coalesce these two messages (React 18 auto-batching) still
    // end up with a populated result screen.
    this.broadcast({ type: status, stats });
    this.broadcastRoomState({ result: status, stats });

    this.state.graceTimer = setTimeout(() => {
      for (const [ws] of this.state.players) {
        try { ws.close(); } catch {
          // Best-effort
        }
      }
      // Delete room from DB after grace period
      if (this.state.dbRoomCreated) {
        this.deleteRoomFromDb();
      }
    }, GRACE_PERIOD_MS);
  }

  private async persistSessionAndAwardXp(
    status: 'victory' | 'defeat'
  ): Promise<Map<string, number>> {
    const xpByUserId = new Map<string, number>();
    try {
      const env = this.env as { DB?: D1Database };
      if (!env.DB) return xpByUserId;
      const db = createDbClient(env.DB);
      const [session] = await db
        .insert(raidSessions)
        .values({
          roomId: this.state.roomId,
          startedAt: new Date(this.state.startedAt ?? Date.now()),
          endedAt: new Date(this.state.endedAt ?? Date.now()),
          playerCount: this.state.players.size,
          bossBaseHp: this.state.bossBaseHp,
          bossMaxHp: this.state.bossMaxHp,
          finalBossHp: this.state.finalBossHp,
          status,
        })
        .returning({ id: raidSessions.id });

      const playerStates = Array.from(this.state.players.values());

      // Compute XP awards: victory + authenticated only (non-guest userIds).
      for (const p of playerStates) {
        const isAuthed = !isGuestId(p.userId);
        if (status === 'victory' && isAuthed) {
          xpByUserId.set(p.userId, calculateRaidXp(p.damageDealt));
        } else {
          xpByUserId.set(p.userId, 0);
        }
      }

      const playerRows = playerStates.map(p => ({
        sessionId: session.id,
        userId: p.userId,
        username: p.username,
        damageDealt: p.damageDealt,
        wordsTyped: p.wordsTyped,
        wordsCorrect: p.wordsCorrect,
        survived: p.isAlive,
        xpAwarded: xpByUserId.get(p.userId) ?? 0,
      }));
      if (playerRows.length > 0) {
        await db.insert(raidPlayers).values(playerRows);
      }

      // Apply XP to user rows. Sequential per user to keep level math correct.
      for (const p of playerStates) {
        const xp = xpByUserId.get(p.userId) ?? 0;
        if (xp <= 0) continue;
        try {
          const [u] = await db
            .select({ level: users.level, xp: users.xp })
            .from(users)
            .where(eq(users.userId, p.userId))
            .limit(1);
          if (!u) continue; // No user row (e.g. account deleted) — skip XP grant.
          const next = applyXp(u.level, u.xp, xp);
          await db
            .update(users)
            .set({ level: next.level, xp: next.xp, updatedAt: new Date() })
            .where(eq(users.userId, p.userId));
        } catch (e) {
          console.error('Failed to award raid XP for user', p.userId, e);
        }
      }
    } catch (e) {
      console.error('Failed to persist raid session:', e);
    }
    return xpByUserId;
  }

  buildStats(xpByUserId?: Map<string, number>) {
    const players = Array.from(this.state.players.values());
    const totalWords = players.reduce((sum, p) => sum + p.wordsCorrect, 0);

    const startedAt = this.state.startedAt ?? Date.now();
    const endedAt = this.state.endedAt ?? Date.now();
    const durationMs = Math.max(0, endedAt - startedAt);
    const durationMinutes = durationMs / 60_000;

    const avgWpm = durationMinutes > 0
      ? Math.round(((totalWords * 5) / durationMinutes / Math.max(1, players.length)) * 10) / 10
      : 0;

    const perPlayer = players.map(p => ({
      userId: p.userId,
      username: p.username,
      damageDealt: p.damageDealt,
      wordsCorrect: p.wordsCorrect,
      wordsTyped: p.wordsTyped,
      survived: p.isAlive,
      wpm: durationMinutes > 0
        ? Math.round(((p.wordsCorrect * 5) / durationMinutes) * 10) / 10
        : 0,
      xpAwarded: xpByUserId?.get(p.userId) ?? 0,
    }));

    return { totalWords, avgWpm, durationMs, players: perPlayer };
  }

  broadcastRoomState(extra?: { result?: 'victory' | 'defeat'; stats?: ReturnType<RaidRoom['buildStats']> }) {
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
      characterConfig: p.characterConfig,
    }));

    const state: Record<string, unknown> = {
      type: 'room_state',
      phase: this.state.phase,
      players,
      bossHp: this.state.bossHp,
      bossMaxHp: this.state.bossMaxHp,
    };
    if (extra?.result) state.result = extra.result;
    if (extra?.stats) state.stats = extra.stats;

    for (const [ws] of this.state.players) {
      try { ws.send(JSON.stringify(state)); } catch {
        // Best-effort
      }
    }
  }

  broadcast(msg: object) {
    const data = JSON.stringify(msg);
    for (const [ws] of this.state.players) {
      try { ws.send(data); } catch {
        // Best-effort
      }
    }
  }

  webSocketError(ws: WebSocket) {
    this.webSocketClose(ws);
  }

  webSocketClose(ws: WebSocket) {
    const player = this.state.players.get(ws);
    this.state.players.delete(ws);
    this.wsCredentials.delete(ws);

    if (this.state.graceTimer) {
      clearTimeout(this.state.graceTimer);
      this.state.graceTimer = null;
    }
    let newHostId: string | undefined;
    let newHostUsername: string | undefined;

    if (player) {
      this.broadcast({ type: 'player_left', userId: player.userId });
      if (player.isHost && this.state.phase === 'lobby') {
        for (const [, p] of this.state.players) {
          p.isHost = true;
          newHostId = p.userId;
          newHostUsername = p.username;
          break;
        }
      }
    }
    this.broadcastRoomState();

    // Sync remaining player count (and new host info) to DB
    const remaining = this.state.players.size;
    if (remaining > 0) {
      this.syncPlayerCountToDb(remaining, undefined, newHostId, newHostUsername);
    }

    if (remaining === 0 && this.state.phase === 'playing') {
      this.endGame('defeat');
    }

    // Delete room when last player leaves.
    // During lobby: always delete — the HTTP handler may have created the row
    // even if the DO never successfully set dbRoomCreated = true.
    if (remaining === 0) {
      this.clearIdleTimer();
      if (this.state.phase === 'lobby') {
        this.deleteRoomFromDb();
      } else if (this.state.dbRoomCreated) {
        this.deleteRoomFromDb();
      }
    }
  }
}

export { generateRoomId };
