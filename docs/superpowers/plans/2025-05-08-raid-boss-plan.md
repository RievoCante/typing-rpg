# Raid Boss System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement multiplayer co-op raid boss battle. 2-4 players join a room, each with their own typing lane, fighting a shared boss. Combined typing damages boss. Boss attacks all players. Mistakes damage only individual players.

**Architecture:** Durable Objects for room state + WebSocket for real-time. HTTP API for room creation/matchmaking. Hybrid persistence: transient state in DO memory, critical state in D1.

**Tech Stack:** Cloudflare Workers, Durable Objects, D1, React

---

## File Map

### Backend (Cloudflare Workers)
- `backend/src/db/schema.ts` — Add raid tables
- `backend/src/handlers/raid.ts` — HTTP endpoints (create/list/join)
- `backend/src/durable/raid-room.ts` — Durable Object class
- `backend/src/index.ts` — Register raid routes + DO binding
- `backend/drizzle/` — New migration files

### Frontend (React)
- `frontend/src/pages/RaidLobbyPage.tsx` — Lobby (create/browse rooms)
- `frontend/src/pages/RaidGamePage.tsx` — In-game (typing lanes + boss)
- `frontend/src/components/RaidBossDisplay.tsx` — Shared boss HP bar
- `frontend/src/components/PlayerLane.tsx` — Individual typing lane
- `frontend/src/components/RaidResults.tsx` — Post-raid stats modal
- `frontend/src/context/RaidContext.tsx` — WebSocket + raid state
- `frontend/src/hooks/useRaidWebSocket.ts` — WebSocket hook
- `frontend/src/App.tsx` — Add /raid routes

---

## Part 1: Database Migrations

### Task 1: Add Raid Tables to Schema

**Files:**
- Modify: `backend/src/db/schema.ts`

- [ ] **Step 1: Read existing schema**

Read `backend/src/db/schema.ts` to understand existing table patterns.

- [ ] **Step 2: Add raid tables**

Add to the end of `backend/src/db/schema.ts`:

```typescript
/**
 * Raid room registry for matchmaking.
 */
export const raidRooms = sqliteTable('raid_rooms', {
  roomCode: text('room_code').primaryKey(),
  hostId: text('host_id').notNull(),
  hostUsername: text('host_username').notNull(),
  status: text('status', { enum: ['waiting', 'active', 'ended'] }).default('waiting').notNull(),
  maxPlayers: integer('max_players').default(4).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .default(sql`(strftime('%s', 'now'))`)
    .notNull(),
});

/**
 * Persisted raid session history.
 */
export const raidSessions = sqliteTable('raid_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  roomCode: text('room_code').notNull(),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  endedAt: integer('ended_at', { mode: 'timestamp' }).notNull(),
  bossHpStart: integer('boss_hp_start').notNull(),
  bossHpEnd: integer('boss_hp_end').notNull(),
  victory: integer('victory').notNull(), // 1 = win, 0 = lose
});

/**
 * Per-player results within a raid.
 */
export const raidPlayerResults = sqliteTable('raid_player_results', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id').notNull().references(() => raidSessions.id),
  playerId: text('player_id').notNull(),
  playerUsername: text('player_username').notNull(),
  wordsCompleted: integer('words_completed').default(0).notNull(),
  damageDealt: integer('damage_dealt').default(0).notNull(),
  hpRemaining: integer('hp_remaining').default(0).notNull(),
  isDead: integer('is_dead').default(0).notNull(), // 1 = dead, 0 = alive
});
```

- [ ] **Step 3: Generate migration**

Run: `cd backend && bun run db:gen`
Expected: New migration file in `backend/drizzle/`

- [ ] **Step 4: Apply migration locally**

Run: `cd backend && bun run dev`
Expected: Migration applied to local D1

- [ ] **Step 5: Commit**

```bash
git add backend/src/db/schema.ts backend/drizzle/
git commit -m "feat(raid): add raid tables to database schema"
```

---

## Part 2: HTTP API Endpoints

### Task 2: Create Raid HTTP Handler

**Files:**
- Create: `backend/src/handlers/raid.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Create raid.ts handler**

Create `backend/src/handlers/raid.ts`:

```typescript
import { AppContext } from '../core/types';
import { getAuth } from '@hono/clerk-auth';
import { raidRooms, raidSessions, raidPlayerResults } from '../db/schema';
import { eq, desc } from 'drizzle-orm';

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_CODE_LENGTH = 6;

function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

// POST /raid/rooms — Create a new room
export const createRaidRoom = async (c: AppContext) => {
  const auth = getAuth(c);
  const userId = auth?.userId;
  const username = auth?.publicMetadata?.username as string | undefined;
  
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  // Generate unique room code
  const db = c.get('db');
  let roomCode = generateRoomCode();
  let attempts = 0;
  while (attempts < 10) {
    const existing = await db.query.raidRooms.findFirst({
      where: (r, { eq }) => eq(r.roomCode, roomCode),
    });
    if (!existing) break;
    roomCode = generateRoomCode();
    attempts++;
  }

  const createdAt = new Date();
  const expiresAt = createdAt.getTime() + 5 * 60 * 1000; // 5 minutes

  await db.insert(raidRooms).values({
    roomCode,
    hostId: userId,
    hostUsername: username || 'Unknown',
    status: 'waiting',
    maxPlayers: 4,
    createdAt,
  });

  return c.json({ roomCode, expiresAt }, 201);
};

// GET /raid/rooms — List available rooms
export const listRaidRooms = async (c: AppContext) => {
  const db = c.get('db');
  
  const rooms = await db.query.raidRooms.findMany({
    where: (r, { eq }) => eq(r.status, 'waiting'),
    orderBy: (r, { desc }) => [desc(r.createdAt)],
  });

  // For each room, we'd need to track player count from DO
  // For MVP, return static player count from a known set
  // Player count will be provided by the DO in future iteration
  const roomsWithCount = rooms.map(room => ({
    roomCode: room.roomCode,
    hostUsername: room.hostUsername,
    playerCount: 1, // Will be updated via real-time
    maxPlayers: room.maxPlayers,
    status: room.status,
    createdAt: room.createdAt instanceof Date ? room.createdAt.getTime() : Number(room.createdAt) * 1000,
  }));

  return c.json({ rooms: roomsWithCount });
};

// POST /raid/rooms/:code/join — Get WebSocket URL for room
export const joinRaidRoom = async (c: AppContext) => {
  const auth = getAuth(c);
  const userId = auth?.userId;
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const roomCode = c.req.param('code').toUpperCase();
  const db = c.get('db');

  const room = await db.query.raidRooms.findFirst({
    where: (r, { eq }) => eq(r.roomCode, roomCode),
  });

  if (!room) return c.json({ error: 'Room not found' }, 404);
  if (room.status !== 'waiting') return c.json({ error: 'Room is not accepting players' }, 400);

  // WebSocket URL: the DO binding + room code as ID
  const wsUrl = `wss://${c.req.header('host')}/raid/${roomCode}`;
  
  return c.json({ wsUrl });
};
```

- [ ] **Step 2: Register routes in index.ts**

Add to `backend/src/index.ts`:

```typescript
import { createRaidRoom, listRaidRooms, joinRaidRoom } from "./handlers/raid";

// ... existing routes ...

// raid routes (auth required for create/join, public for list)
app.post("/raid/rooms", authMiddleware, limiter, createRaidRoom);
app.get("/raid/rooms", limiter, listRaidRooms);
app.post("/raid/rooms/:code/join", authMiddleware, limiter, joinRaidRoom);
```

- [ ] **Step 3: Test the endpoints**

Start the dev server: `cd backend && bun run dev`

Test in another terminal:
```bash
curl http://localhost:8787/api/raid/rooms
# Expected: {"rooms":[]}

# With auth header (get from Clerk dashboard):
curl -X POST http://localhost:8787/api/raid/rooms \
  -H "Authorization: Bearer <token>"
# Expected: {"roomCode":"ABC123","expiresAt":1746739200000}
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/handlers/raid.ts backend/src/index.ts
git commit -m "feat(raid): add HTTP API endpoints for room management"
```

---

## Part 3: Durable Object

### Task 3: Implement RaidRoom Durable Object

**Files:**
- Create: `backend/src/durable/raid-room.ts`
- Modify: `backend/wrangler.toml` (add DO binding)

- [ ] **Step 1: Read wrangler.toml**

Read `backend/wrangler.toml` to see existing bindings.

- [ ] **Step 2: Add DO binding to wrangler.toml**

Add to end of `backend/wrangler.toml`:

```toml
[[ Durable Objects ]]
name = "RAID_ROOM"
class_name = "RaidRoom"
```

- [ ] **Step 3: Create RaidRoom Durable Object**

Create `backend/src/durable/raid-room.ts`:

```typescript
import { DurableObjectState } from '@cloudflare/workers-types';

interface RaidPlayer {
  id: string;
  username: string;
  hp: number;
  maxHp: number;
  wordsCompleted: number;
  damageDealt: number;
  isDead: boolean;
  ws: WebSocket;
}

interface RaidState {
  roomCode: string;
  bossHp: number;
  bossMaxHp: number;
  players: Map<string, RaidPlayer>;
  status: 'waiting' | 'active' | 'ended';
  attackTimer: number | null;
  createdAt: number;
  hostId: string;
}

const BOSS_MAX_HP = 100;
const BOSS_ATTACK_INTERVAL_MS = 6000;
const BOSS_ATTACK_DAMAGE = 10;
const MISTAKE_DAMAGE_MIN = 5;
const MISTAKE_DAMAGE_MAX = 15;

export class RaidRoom implements DurableObject {
  private state: DurableObjectState;
  private room: RaidState;
  private storage: DurableObjectStorage;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.storage = state.storage;
    
    // Initialize or load state
    this.room = {
      roomCode: 'UNKNOWN',
      bossHp: BOSS_MAX_HP,
      bossMaxHp: BOSS_MAX_HP,
      players: new Map(),
      status: 'waiting',
      attackTimer: null,
      createdAt: Date.now(),
      hostId: '',
    };
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request);
    }

    return new Response('RaidRoom DO active', { status: 200 });
  }

  private async handleWebSocket(request: Request): Promise<Response> {
    const roomCode = this.room.roomCode;
    
    // Extract player info from headers (set by Worker on upgrade)
    const playerId = request.headers.get('X-Player-Id') || '';
    const username = request.headers.get('X-Username') || 'Unknown';
    const isHost = request.headers.get('X-Is-Host') === 'true';

    if (this.room.status !== 'waiting') {
      return new Response('Raid already in progress', { status: 400 });
    }

    const { 0: clientWebSocket, 1: serverWebSocket } = new WebSocketPair();
    this.state.acceptWebSocket(serverWebSocket);

    // If this is the host and hostId not set, set it
    if (isHost && !this.room.hostId) {
      this.room.hostId = playerId;
    }

    // Add player
    const player: RaidPlayer = {
      id: playerId,
      username,
      hp: 100,
      maxHp: 100,
      wordsCompleted: 0,
      damageDealt: 0,
      isDead: false,
      ws: serverWebSocket,
    };
    this.room.players.set(playerId, player);

    // Broadcast player joined to all
    this.broadcast({
      type: 'player_joined',
      player: {
        id: playerId,
        username,
        hp: 100,
        maxHp: 100,
        isDead: false,
      },
    });

    // Send current room state to new player
    this.sendToPlayer(serverWebSocket, {
      type: 'room_state',
      roomCode,
      playerCount: this.room.players.size,
      maxPlayers: 4,
      hostId: this.room.hostId,
      players: Array.from(this.room.players.values()).map(p => ({
        id: p.id,
        username: p.username,
        hp: p.hp,
        maxHp: p.maxHp,
        isDead: p.isDead,
      })),
    });

    // Handle messages
    serverWebSocket.addEventListener('message', async (event) => {
      try {
        const data = JSON.parse(event.data as string);
        await this.handleMessage(playerId, data);
      } catch (e) {
        console.error('Error handling message:', e);
      }
    });

    serverWebSocket.addEventListener('close', () => {
      this.handlePlayerLeave(playerId);
    });

    return new Response(null, { status: 101, webSocket: clientWebSocket });
  }

  private async handleMessage(playerId: string, data: any): Promise<void> {
    switch (data.type) {
      case 'start_raid':
        if (playerId !== this.room.hostId) {
          this.sendError(playerId, 'Only host can start the raid');
          return;
        }
        if (this.room.players.size < 2) {
          this.sendError(playerId, 'Need at least 2 players to start');
          return;
        }
        await this.startRaid();
        break;

      case 'word_done':
        await this.handleWordDone(playerId);
        break;

      case 'player_hit':
        await this.handlePlayerHit(playerId, data.damage);
        break;
    }
  }

  private async startRaid(): Promise<void> {
    this.room.status = 'active';
    this.room.bossHp = BOSS_MAX_HP;

    // Start boss attack timer
    this.startBossAttacks();

    // Broadcast raid started
    this.broadcast({
      type: 'raid_started',
      boss: {
        hp: this.room.bossHp,
        maxHp: this.room.bossMaxHp,
      },
      players: Array.from(this.room.players.values()).map(p => ({
        id: p.id,
        username: p.username,
        hp: p.hp,
        maxHp: p.maxHp,
        isDead: p.isDead,
      })),
    });

    // Update room status in D1
    // This will be done via HTTP call to the API
  }

  private startBossAttacks(): void {
    if (this.room.attackTimer) {
      this.state.global.clearTimeout(this.room.attackTimer);
    }

    const tick = async () => {
      if (this.room.status !== 'active') return;

      // Damage ALL alive players
      let allDead = true;
      for (const player of this.room.players.values()) {
        if (!player.isDead) {
          player.hp = Math.max(0, player.hp - BOSS_ATTACK_DAMAGE);
          if (player.hp <= 0) {
            player.isDead = true;
            player.ws.close();
          } else {
            allDead = false;
          }
        }
      }

      // Broadcast boss attack to all
      this.broadcast({
        type: 'boss_attacked',
        damage: BOSS_ATTACK_DAMAGE,
        players: Array.from(this.room.players.values()).map(p => ({
          id: p.id,
          hp: p.hp,
          isDead: p.isDead,
        })),
      });

      // Check for defeat
      if (allDead) {
        await this.endRaid(false);
        return;
      }

      // Schedule next attack
      this.room.attackTimer = this.state.global.setTimeout(tick, BOSS_ATTACK_INTERVAL_MS);
    };

    this.room.attackTimer = this.state.global.setTimeout(tick, BOSS_ATTACK_INTERVAL_MS);
  }

  private async handleWordDone(playerId: string): Promise<void> {
    const player = this.room.players.get(playerId);
    if (!player || player.isDead) return;

    player.wordsCompleted++;
    player.damageDealt++;
    this.room.bossHp = Math.max(0, this.room.bossHp - 1);

    this.broadcast({
      type: 'boss_damaged',
      bossHp: this.room.bossHp,
      byPlayer: playerId,
    });

    // Check for victory
    if (this.room.bossHp <= 0) {
      await this.endRaid(true);
    }
  }

  private async handlePlayerHit(playerId: string, damage: number): Promise<void> {
    const player = this.room.players.get(playerId);
    if (!player || player.isDead) return;

    player.hp = Math.max(0, player.hp - damage);

    if (player.hp <= 0) {
      player.isDead = true;
      player.ws.close();
    }

    this.broadcast({
      type: 'player_hit',
      playerId,
      damage,
      hp: player.hp,
      isDead: player.isDead,
    });

    // Check if all dead
    let allDead = true;
    for (const p of this.room.players.values()) {
      if (!p.isDead) {
        allDead = false;
        break;
      }
    }
    if (allDead) {
      await this.endRaid(false);
    }
  }

  private async endRaid(victory: boolean): Promise<void> {
    this.room.status = 'ended';

    if (this.room.attackTimer) {
      this.state.global.clearTimeout(this.room.attackTimer);
      this.room.attackTimer = null;
    }

    const stats = {
      type: 'raid_ended' as const,
      victory,
      bossHpStart: this.room.bossMaxHp,
      bossHpEnd: this.room.bossHp,
      players: Array.from(this.room.players.values()).map(p => ({
        id: p.id,
        username: p.username,
        wordsCompleted: p.wordsCompleted,
        damageDealt: p.damageDealt,
        hpRemaining: p.hp,
        isDead: p.isDead,
      })),
    };

    this.broadcast(stats);

    // Persist to D1 via API
    // TODO: Make HTTP call to persist raid results
  }

  private handlePlayerLeave(playerId: string): void {
    const player = this.room.players.get(playerId);
    if (!player) return;

    this.room.players.delete(playerId);

    this.broadcast({
      type: 'player_left',
      playerId,
    });

    // If host left, assign new host
    if (playerId === this.room.hostId && this.room.players.size > 0) {
      const newHost = this.room.players.values().next().value;
      this.room.hostId = newHost.id;
      this.broadcast({
        type: 'new_host',
        hostId: newHost.id,
      });
    }

    // If all players left, clean up
    if (this.room.players.size === 0) {
      this.state.storage.deleteAll();
    }
  }

  private broadcast(message: any): void {
    const data = JSON.stringify(message);
    for (const player of this.room.players.values()) {
      try {
        player.ws.send(data);
      } catch {
        // Player disconnected, will be cleaned up
      }
    }
  }

  private sendToPlayer(ws: WebSocket, message: any): void {
    try {
      ws.send(JSON.stringify(message));
    } catch {
      // Ignore
    }
  }

  private sendError(playerId: string, message: string): void {
    const player = this.room.players.get(playerId);
    if (!player) return;
    this.sendToPlayer(player.ws, { type: 'error', message });
  }
}
```

- [ ] **Step 4: Add environment types**

Add to `backend/src/core/types.ts`:

```typescript
interface Env {
  DB: D1Database;
  RATE_LIMIT_KV: KVNamespace;
  RAID_ROOM: DurableObjectNamespace;
}
```

- [ ] **Step 5: Update index.ts to route DO requests**

Modify the WebSocket upgrade handling in `backend/src/index.ts`. Add a route that handles WebSocket upgrades to Durable Objects:

```typescript
// Add DO route for raid WebSocket
app.use('/raid/:roomCode', async (c, next) => {
  if (c.req.header('Upgrade') === 'websocket') {
    const roomCode = c.req.param('roomCode');
    const auth = getAuth(c);
    const playerId = auth?.userId || '';
    const username = (auth?.publicMetadata?.username as string) || 'Unknown';
    
    // Check if this player is the host
    // For now, first player to join is host
    const isHost = false; // Will be determined by DO

    const id = c.env.RAID_ROOM.idFromName(roomCode);
    const stub = c.env.RAID_ROOM.get(id);

    const wsUrl = new URL(c.req.url);
    wsUrl.pathname = `/raid/${roomCode}`;

    const headers = new Headers();
    headers.set('Upgrade', 'websocket');
    headers.set('X-Player-Id', playerId);
    headers.set('X-Username', username);
    headers.set('X-Is-Host', isHost.toString());

    return stub.fetch(new Request(wsUrl, {
      method: 'GET',
      headers,
    }));
  }
  await next();
});
```

- [ ] **Step 6: Test DO locally**

Run: `cd backend && bun run dev`

Test WebSocket connection (use a tool like `wscat`):
```bash
npm install -g wscat
wscat -c ws://localhost:8787/raid/ABC123 \
  -H "Authorization: Bearer <token>" \
  -H "X-Player-Id: user123" \
  -H "X-Username: TestPlayer"
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/durable/raid-room.ts backend/wrangler.toml backend/src/core/types.ts backend/src/index.ts
git commit -m "feat(raid): implement RaidRoom Durable Object for real-time state"
```

---

## Part 4: Frontend — Lobby Page

### Task 4: Create Raid Lobby Page

**Files:**
- Create: `frontend/src/pages/RaidLobbyPage.tsx`
- Create: `frontend/src/hooks/useRaidApi.ts`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create useRaidApi hook**

Create `frontend/src/hooks/useRaidApi.ts`:

```typescript
import { useState, useCallback } from 'react';

interface RaidRoom {
  roomCode: string;
  hostUsername: string;
  playerCount: number;
  maxPlayers: number;
  status: string;
  createdAt: number;
}

interface CreateRoomResponse {
  roomCode: string;
  expiresAt: number;
}

interface JoinRoomResponse {
  wsUrl: string;
}

const API_BASE = '/api';

export function useRaidApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createRoom = useCallback(async (): Promise<CreateRoomResponse | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/raid/rooms`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create room');
      }
      return await res.json();
    } catch (e: any) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const listRooms = useCallback(async (): Promise<RaidRoom[]> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/raid/rooms`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to list rooms');
      }
      const data = await res.json();
      return data.rooms;
    } catch (e: any) {
      setError(e.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const joinRoom = useCallback(async (roomCode: string): Promise<JoinRoomResponse | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/raid/rooms/${roomCode}/join`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to join room');
      }
      return await res.json();
    } catch (e: any) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { createRoom, listRooms, joinRoom, loading, error };
}
```

- [ ] **Step 2: Create RaidLobbyPage**

Create `frontend/src/pages/RaidLobbyPage.tsx`:

```typescript
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRaidApi } from '../hooks/useRaidApi';
import { Sword, Users, RefreshCw } from 'lucide-react';

export default function RaidLobbyPage() {
  const navigate = useNavigate();
  const { createRoom, listRooms, joinRoom, loading, error } = useRaidApi();
  const [rooms, setRooms] = useState<any[]>([]);
  const [joinCode, setJoinCode] = useState('');

  const fetchRooms = useCallback(async () => {
    const roomList = await listRooms();
    setRooms(roomList);
  }, [listRooms]);

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, [fetchRooms]);

  const handleCreateRoom = async () => {
    const result = await createRoom();
    if (result) {
      navigate(`/raid/${result.roomCode}`);
    }
  };

  const handleJoinRoom = async (roomCode: string) => {
    const result = await joinRoom(roomCode);
    if (result) {
      navigate(`/raid/${roomCode}`);
    }
  };

  const handleJoinByCode = () => {
    if (joinCode.trim().length === 6) {
      handleJoinRoom(joinCode.trim().toUpperCase());
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 flex items-center justify-center gap-3">
            <Sword className="w-8 h-8" />
            Raid Boss Battle
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Team up with 2-4 players to defeat the boss!
          </p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <button
            onClick={handleCreateRoom}
            disabled={loading}
            className="p-6 rounded-lg bg-gradient-to-br from-red-600 to-red-800 text-white font-bold text-lg hover:from-red-500 hover:to-red-700 transition disabled:opacity-50"
          >
            <Sword className="w-6 h-6 mx-auto mb-2" />
            Create Room
          </button>

          <div className="p-6 rounded-lg bg-gray-100 dark:bg-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Join with code</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                placeholder="ABC123"
                className="flex-1 px-4 py-2 rounded border dark:bg-gray-700 dark:border-gray-600 font-mono text-lg text-center"
              />
              <button
                onClick={handleJoinByCode}
                disabled={joinCode.length !== 6 || loading}
                className="px-6 py-2 rounded bg-blue-600 text-white font-bold hover:bg-blue-500 disabled:opacity-50"
              >
                Join
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Room List */}
        <div className="rounded-lg bg-white dark:bg-gray-800 shadow">
          <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Users className="w-5 h-5" />
              Available Rooms
            </h2>
            <button
              onClick={fetchRooms}
              className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>

          <div className="divide-y dark:divide-gray-700">
            {rooms.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                No rooms available. Create one to start!
              </div>
            ) : (
              rooms.map(room => (
                <div
                  key={room.roomCode}
                  className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <div>
                    <div className="font-bold">{room.roomCode}</div>
                    <div className="text-sm text-gray-500">
                      Hosted by {room.hostUsername}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500">
                      {room.playerCount}/{room.maxPlayers} players
                    </span>
                    <button
                      onClick={() => handleJoinRoom(room.roomCode)}
                      disabled={loading || room.playerCount >= room.maxPlayers}
                      className="px-4 py-2 rounded bg-green-600 text-white font-bold hover:bg-green-500 disabled:opacity-50"
                    >
                      Join
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add route to App.tsx**

Add to `frontend/src/App.tsx`:

```typescript
import RaidLobbyPage from './pages/RaidLobbyPage';

// Add to routes:
// <Route path="/raid" element={<RaidLobbyPage />} />
```

- [ ] **Step 4: Test lobby page**

Run: `cd frontend && bun run dev`

Navigate to `/raid` and verify:
- Create room button works
- Room list displays
- Join by code works

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/RaidLobbyPage.tsx frontend/src/hooks/useRaidApi.ts frontend/src/App.tsx
git commit -m "feat(raid): add lobby page for creating and joining rooms"
```

---

## Part 5: Frontend — Raid Game Page

### Task 5: Create Raid Game Page with WebSocket Integration

**Files:**
- Create: `frontend/src/context/RaidContext.tsx`
- Create: `frontend/src/hooks/useRaidWebSocket.ts`
- Create: `frontend/src/pages/RaidGamePage.tsx`
- Create: `frontend/src/components/RaidBossDisplay.tsx`
- Create: `frontend/src/components/PlayerLane.tsx`
- Create: `frontend/src/components/RaidResults.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create RaidContext**

Create `frontend/src/context/RaidContext.tsx`:

```typescript
import { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';

interface Player {
  id: string;
  username: string;
  hp: number;
  maxHp: number;
  isDead: boolean;
  wordsCompleted: number;
}

interface RaidState {
  roomCode: string | null;
  status: 'connecting' | 'waiting' | 'active' | 'ended';
  bossHp: number;
  bossMaxHp: number;
  players: Player[];
  hostId: string | null;
  victory: boolean | null;
  stats: RaidStats | null;
}

interface RaidStats {
  bossHpStart: number;
  bossHpEnd: number;
  players: {
    id: string;
    username: string;
    wordsCompleted: number;
    hpRemaining: number;
    isDead: boolean;
  }[];
}

type RaidAction =
  | { type: 'SET_ROOM_CODE'; roomCode: string }
  | { type: 'SET_STATUS'; status: RaidState['status'] }
  | { type: 'SET_BOSS_HP'; hp: number; maxHp?: number }
  | { type: 'SET_PLAYERS'; players: Player[] }
  | { type: 'PLAYER_JOINED'; player: Player }
  | { type: 'PLAYER_LEFT'; playerId: string }
  | { type: 'PLAYER_HP_UPDATE'; playerId: string; hp: number; isDead: boolean }
  | { type: 'PLAYER_DEAD'; playerId: string }
  | { type: 'RAID_STARTED'; boss: { hp: number; maxHp: number }; players: Player[] }
  | { type: 'RAID_ENDED'; victory: boolean; stats: RaidStats }
  | { type: 'SET_HOST'; hostId: string };

const initialState: RaidState = {
  roomCode: null,
  status: 'connecting',
  bossHp: 100,
  bossMaxHp: 100,
  players: [],
  hostId: null,
  victory: null,
  stats: null,
};

function raidReducer(state: RaidState, action: RaidAction): RaidState {
  switch (action.type) {
    case 'SET_ROOM_CODE':
      return { ...state, roomCode: action.roomCode };
    case 'SET_STATUS':
      return { ...state, status: action.status };
    case 'SET_BOSS_HP':
      return { ...state, bossHp: action.hp, bossMaxHp: action.maxHp ?? state.bossMaxHp };
    case 'SET_PLAYERS':
      return { ...state, players: action.players };
    case 'PLAYER_JOINED':
      return { ...state, players: [...state.players, action.player] };
    case 'PLAYER_LEFT':
      return { ...state, players: state.players.filter(p => p.id !== action.playerId) };
    case 'PLAYER_HP_UPDATE':
      return {
        ...state,
        players: state.players.map(p =>
          p.id === action.playerId ? { ...p, hp: action.hp, isDead: action.isDead } : p
        ),
      };
    case 'PLAYER_DEAD':
      return {
        ...state,
        players: state.players.map(p =>
          p.id === action.playerId ? { ...p, isDead: true, hp: 0 } : p
        ),
      };
    case 'RAID_STARTED':
      return {
        ...state,
        status: 'active',
        bossHp: action.boss.hp,
        bossMaxHp: action.boss.maxHp,
        players: action.players,
      };
    case 'RAID_ENDED':
      return { ...state, status: 'ended', victory: action.victory, stats: action.stats };
    case 'SET_HOST':
      return { ...state, hostId: action.hostId };
    default:
      return state;
  }
}

interface RaidContextType {
  state: RaidState;
  dispatch: React.Dispatch<RaidAction>;
  currentPlayerId: string | null;
}

const RaidContext = createContext<RaidContextType | null>(null);

export function RaidProvider({ children, roomCode, wsUrl, currentPlayerId }: {
  children: ReactNode;
  roomCode: string;
  wsUrl: string;
  currentPlayerId: string;
}) {
  const [state, dispatch] = useReducer(raidReducer, { ...initialState, roomCode });

  return (
    <RaidContext.Provider value={{ state, dispatch, currentPlayerId }}>
      {children}
    </RaidContext.Provider>
  );
}

export function useRaidContext() {
  const context = useContext(RaidContext);
  if (!context) throw new Error('useRaidContext must be used within RaidProvider');
  return context;
}
```

- [ ] **Step 2: Create useRaidWebSocket hook**

Create `frontend/src/hooks/useRaidWebSocket.ts`:

```typescript
import { useEffect, useRef, useCallback } from 'react';
import { useRaidContext } from '../context/RaidContext';

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export function useRaidWebSocket(wsUrl: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const { dispatch } = useRaidContext();
  const reconnectTimeoutRef = useRef<number>();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      dispatch({ type: 'SET_STATUS', status: 'waiting' });
    };

    ws.onmessage = (event) => {
      const message: WebSocketMessage = JSON.parse(event.data);
      handleMessage(message);
    };

    ws.onclose = () => {
      wsRef.current = null;
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [wsUrl, dispatch]);

  const handleMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'room_state':
        dispatch({ type: 'SET_HOST', hostId: message.hostId });
        dispatch({ type: 'SET_PLAYERS', players: message.players });
        break;

      case 'player_joined':
        dispatch({ type: 'PLAYER_JOINED', player: message.player });
        break;

      case 'player_left':
        dispatch({ type: 'PLAYER_LEFT', playerId: message.playerId });
        break;

      case 'raid_started':
        dispatch({
          type: 'RAID_STARTED',
          boss: message.boss,
          players: message.players,
        });
        break;

      case 'boss_damaged':
        dispatch({ type: 'SET_BOSS_HP', hp: message.bossHp });
        break;

      case 'boss_attacked':
        message.players.forEach((p: any) => {
          dispatch({
            type: 'PLAYER_HP_UPDATE',
            playerId: p.id,
            hp: p.hp,
            isDead: p.isDead,
          });
        });
        // Dispatch event for UI to show ATTACK!
        window.dispatchEvent(new CustomEvent('raid-boss-attack'));
        break;

      case 'player_hit':
        dispatch({
          type: 'PLAYER_HP_UPDATE',
          playerId: message.playerId,
          hp: message.hp,
          isDead: message.isDead,
        });
        // Dispatch event for that player's lane to show HIT
        window.dispatchEvent(new CustomEvent('raid-player-hit', { detail: { playerId: message.playerId } }));
        break;

      case 'player_dead':
        dispatch({ type: 'PLAYER_DEAD', playerId: message.playerId });
        break;

      case 'raid_ended':
        dispatch({ type: 'RAID_ENDED', victory: message.victory, stats: message });
        break;

      case 'error':
        console.error('Raid error:', message.message);
        break;
    }
  }, [dispatch]);

  const send = useCallback((message: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const startRaid = useCallback(() => {
    send({ type: 'start_raid' });
  }, [send]);

  const sendWordDone = useCallback(() => {
    send({ type: 'word_done' });
  }, [send]);

  const sendPlayerHit = useCallback((damage: number) => {
    send({ type: 'player_hit', damage });
  }, [send]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  return { send, startRaid, sendWordDone, sendPlayerHit };
}
```

- [ ] **Step 3: Create RaidBossDisplay component**

Create `frontend/src/components/RaidBossDisplay.tsx`:

```typescript
import { useRaidContext } from '../context/RaidContext';
import Monster from './Monster';

export default function RaidBossDisplay() {
  const { state } = useRaidContext();
  const { bossHp, bossMaxHp } = state;

  const hpPercent = (bossHp / bossMaxHp) * 100;

  return (
    <div className="flex flex-col items-center gap-4 mb-8">
      {/* Boss HP Bar */}
      <div className="w-full max-w-xl">
        <div className="flex justify-between text-sm mb-1">
          <span className="font-bold text-red-500">RAID BOSS</span>
          <span>{bossHp} / {bossMaxHp}</span>
        </div>
        <div className="h-6 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-300"
            style={{ width: `${hpPercent}%` }}
          />
        </div>
      </div>

      {/* Boss Visual */}
      <div className="relative">
        <Monster type="boss" />
        {state.status === 'active' && (
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-2xl animate-bounce">
            ⚔️
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create PlayerLane component**

Create `frontend/src/components/PlayerLane.tsx`:

```typescript
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRaidContext } from '../context/RaidContext';
import { generateText } from '../utils/textGenerator';
import HealthBar from './HealthBar';

interface PlayerLaneProps {
  playerId: string;
  isCurrentPlayer: boolean;
  onWordDone: () => void;
  onMistake: (damage: number) => void;
}

export default function PlayerLane({
  playerId,
  isCurrentPlayer,
  onWordDone,
  onMistake,
}: PlayerLaneProps) {
  const { state } = useRaidContext();
  const player = state.players.find(p => p.id === playerId);
  
  const [text, setText] = useState('');
  const [typedChars, setTypedChars] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [charStatus, setCharStatus] = useState<string[]>([]);
  const [hasStarted, setHasStarted] = useState(false);
  
  const hitIdRef = useRef(0);
  const [hitVisible, setHitVisible] = useState(false);
  const [attackVisible, setAttackVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Generate text when raid starts
  useEffect(() => {
    if (state.status === 'active') {
      const newText = generateText('endless', undefined, 50, 'beginner');
      setText(newText);
      setTypedChars('');
      setCurrentIndex(0);
      setCharStatus(new Array(newText.length).fill('pending'));
      setHasStarted(false);
    }
  }, [state.status]);

  // Listen for player hit events
  useEffect(() => {
    const handleHit = (e: CustomEvent) => {
      if (e.detail.playerId === playerId) {
        showHit();
      }
    };
    window.addEventListener('raid-player-hit', handleHit as EventListener);
    return () => window.removeEventListener('raid-player-hit', handleHit as EventListener);
  }, [playerId]);

  // Listen for boss attack events
  useEffect(() => {
    const handleAttack = () => {
      if (!player?.isDead) {
        showAttack();
      }
    };
    window.addEventListener('raid-boss-attack', handleAttack);
    return () => window.removeEventListener('raid-boss-attack', handleAttack);
  }, [player?.isDead]);

  const showHit = () => {
    setHitVisible(true);
    setTimeout(() => setHitVisible(false), 600);
  };

  const showAttack = () => {
    setAttackVisible(true);
    setTimeout(() => setAttackVisible(false), 600);
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isCurrentPlayer || player?.isDead || state.status !== 'active') return;

    const key = e.key;
    if (key === ' ') {
      e.preventDefault();
      // Word completed
      const wordEnd = text.indexOf(' ', currentIndex);
      const endIndex = wordEnd === -1 ? text.length : wordEnd;
      
      // Check if all chars up to end are correct
      const wordChars = charStatus.slice(currentIndex, endIndex);
      const hasMistake = wordChars.some(s => s === 'incorrect');
      
      if (!hasMistake) {
        // Word done correctly
        setTypedChars(prev => prev + ' ');
        setCurrentIndex(endIndex + 1);
        onWordDone();
      } else {
        // Mistake - damage only this player
        const damage = Math.floor(Math.random() * 11) + 5; // 5-15
        onMistake(damage);
      }
    } else if (key === 'Backspace') {
      e.preventDefault();
      // Can't go back past word start
      const wordStart = text.lastIndexOf(' ', currentIndex - 1) + 1;
      if (currentIndex > wordStart) {
        setCurrentIndex(prev => prev - 1);
        setCharStatus(prev => {
          const updated = [...prev];
          updated[currentIndex - 1] = 'pending';
          return updated;
        });
      }
    } else if (key.length === 1) {
      e.preventDefault();
      if (!hasStarted) setHasStarted(true);
      
      const expected = text[currentIndex];
      const isCorrect = key === expected;
      
      setCharStatus(prev => {
        const updated = [...prev];
        updated[currentIndex] = isCorrect ? 'correct' : 'incorrect';
        return updated;
      });
      setTypedChars(prev => prev + key);
      setCurrentIndex(prev => prev + 1);
      
      if (!isCorrect) {
        const damage = Math.floor(Math.random() * 11) + 5;
        onMistake(damage);
      }
    }
  }, [isCurrentPlayer, player?.isDead, state.status, text, currentIndex, charStatus, hasStarted, onWordDone, onMistake]);

  if (!player) return null;

  return (
    <div
      ref={containerRef}
      tabIndex={isCurrentPlayer ? 0 : -1}
      onKeyDown={handleKeyDown as any}
      className={`p-4 rounded-lg ${
        player.isDead
          ? 'opacity-50 bg-gray-800'
          : isCurrentPlayer
          ? 'bg-purple-900/30 border-2 border-purple-500'
          : 'bg-gray-800/50'
      }`}
    >
      {/* Player Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-bold">{player.username}</span>
          {isCurrentPlayer && <span className="text-xs px-2 py-0.5 rounded bg-purple-600">YOU</span>}
          {player.isDead && <span className="text-xs px-2 py-0.5 rounded bg-red-600">DEAD</span>}
        </div>
        <HealthBar current={player.hp} max={player.maxHp} />
      </div>

      {/* Typing Area */}
      {!player.isDead && (
        <div className="font-mono text-sm leading-relaxed">
          {text.split('').map((char, i) => {
            let className = 'text-gray-500';
            if (i < currentIndex) {
              className = charStatus[i] === 'correct' ? 'text-green-500' : 'text-red-500';
            } else if (i === currentIndex) {
              className = 'text-white bg-purple-500/50';
            }
            return <span key={i} className={className}>{char}</span>;
          })}
        </div>
      )}

      {/* HIT Popup */}
      {hitVisible && isCurrentPlayer && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-red-500 font-bold text-2xl animate-pulse">
          HIT!
        </div>
      )}

      {/* ATTACK Popup */}
      {attackVisible && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-purple-500 font-bold text-2xl animate-pulse">
          ATTACK!
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create RaidResults component**

Create `frontend/src/components/RaidResults.tsx`:

```typescript
import { useRaidContext } from '../context/RaidContext';

interface RaidResultsProps {
  onClose: () => void;
}

export default function RaidResults({ onClose }: RaidResultsProps) {
  const { state } = useRaidContext();
  const { victory, stats } = state;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-8 max-w-lg w-full mx-4">
        <div className={`text-center mb-6 ${victory ? 'text-green-500' : 'text-red-500'}`}>
          <div className="text-6xl mb-2">{victory ? '🏆' : '💀'}</div>
          <h2 className="text-4xl font-bold">
            {victory ? 'VICTORY!' : 'DEFEAT'}
          </h2>
        </div>

        {stats && (
          <div className="space-y-4">
            <div className="text-center text-gray-400">
              Boss HP: {stats.bossHpEnd} / {stats.bossHpStart}
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-lg">Players</h3>
              {stats.players.map(player => (
                <div
                  key={player.id}
                  className={`flex justify-between p-2 rounded ${
                    player.isDead ? 'bg-red-900/30' : 'bg-green-900/30'
                  }`}
                >
                  <span>{player.username}</span>
                  <div className="flex gap-4 text-sm">
                    <span>Words: {player.wordsCompleted}</span>
                    <span>HP: {player.hpRemaining}</span>
                    {player.isDead && <span className="text-red-500">DEAD</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full mt-6 py-3 rounded bg-blue-600 hover:bg-blue-500 font-bold"
        >
          Back to Lobby
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create RaidGamePage**

Create `frontend/src/pages/RaidGamePage.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RaidProvider, useRaidContext } from '../context/RaidContext';
import { useRaidWebSocket } from '../hooks/useRaidWebSocket';
import { useRaidApi } from '../hooks/useRaidApi';
import RaidBossDisplay from '../components/RaidBossDisplay';
import PlayerLane from '../components/PlayerLane';
import RaidResults from '../components/RaidResults';
import { Sword } from 'lucide-react';

function RaidGameContent() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const { state } = useRaidContext();
  const { joinRoom } = useRaidApi();
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);

  // Get current player ID from Clerk
  useEffect(() => {
    // This would come from Clerk auth context
    // For now, assume it's stored in session or we get it from API
    const getPlayerId = async () => {
      const res = await fetch('/api/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCurrentPlayerId(data.user?.userId || 'anonymous');
      }
    };
    getPlayerId();
  }, []);

  // Get WebSocket URL
  useEffect(() => {
    if (!roomCode) return;
    const getWsUrl = async () => {
      const result = await joinRoom(roomCode);
      if (result) {
        setWsUrl(result.wsUrl);
      } else {
        navigate('/raid');
      }
    };
    getWsUrl();
  }, [roomCode, joinRoom, navigate]);

  if (!wsUrl || !currentPlayerId || !roomCode) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Connecting to raid...</div>
      </div>
    );
  }

  return (
    <RaidInner wsUrl={wsUrl} roomCode={roomCode} currentPlayerId={currentPlayerId} />
  );
}

function RaidInner({ wsUrl, roomCode, currentPlayerId }: {
  wsUrl: string;
  roomCode: string;
  currentPlayerId: string;
}) {
  const { state } = useRaidContext();
  const { sendWordDone, sendPlayerHit, startRaid } = useRaidWebSocket(wsUrl);

  const handleWordDone = () => {
    sendWordDone();
  };

  const handleMistake = (damage: number) => {
    sendPlayerHit(damage);
  };

  const handleClose = () => {
    window.location.href = '/raid';
  };

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
        {/* Waiting Room */}
        {state.status === 'waiting' && (
          <div className="text-center py-16">
            <h2 className="text-3xl font-bold mb-4">Waiting for Players...</h2>
            <div className="mb-8">
              <p className="text-gray-500 mb-2">Room Code: <span className="font-mono text-2xl">{roomCode}</span></p>
              <p className="text-gray-400">{state.players.length} / 4 players joined</p>
            </div>

            <div className="mb-8">
              {state.players.map(player => (
                <div key={player.id} className="p-3 bg-gray-800 rounded mb-2">
                  <span className="font-bold">{player.username}</span>
                  {player.id === state.hostId && <span className="ml-2 text-xs text-yellow-500">HOST</span>}
                </div>
              ))}
            </div>

            {currentPlayerId === state.hostId && (
              <button
                onClick={startRaid}
                disabled={state.players.length < 2}
                className="px-8 py-4 rounded-lg bg-green-600 hover:bg-green-500 font-bold text-xl disabled:opacity-50"
              >
                <Sword className="w-6 h-6 inline mr-2" />
                Start Raid
              </button>
            )}

            {currentPlayerId !== state.hostId && (
              <p className="text-gray-500">Waiting for host to start...</p>
            )}
          </div>
        )}

        {/* Active Raid */}
        {state.status === 'active' && (
          <div className="space-y-6">
            <RaidBossDisplay />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {state.players.map(player => (
                <PlayerLane
                  key={player.id}
                  playerId={player.id}
                  isCurrentPlayer={player.id === currentPlayerId}
                  onWordDone={handleWordDone}
                  onMistake={handleMistake}
                />
              ))}
            </div>
          </div>
        )}

        {/* Raid Ended */}
        {state.status === 'ended' && <RaidResults onClose={handleClose} />}
      </div>
    </div>
  );
}

export default function RaidGamePage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  
  if (!roomCode) {
    return <div>Invalid room</div>;
  }

  return (
    <RaidProvider roomCode={roomCode} wsUrl="" currentPlayerId="">
      <RaidGameContent />
    </RaidProvider>
  );
}
```

- [ ] **Step 7: Add route to App.tsx**

Add to `frontend/src/App.tsx`:

```typescript
import RaidGamePage from './pages/RaidGamePage';

// Add to routes:
// <Route path="/raid/:roomCode" element={<RaidGamePage />} />
```

- [ ] **Step 8: Test the complete flow**

Run: `cd frontend && bun run dev`

1. Go to `/raid`
2. Create a room
3. Open another browser tab, go to `/raid`
4. Join the room
5. Host clicks "Start Raid"
6. Both players should see the boss and typing lanes
7. Complete words, see boss take damage
8. Watch for attack popups

- [ ] **Step 9: Commit**

```bash
git add frontend/src/context/RaidContext.tsx frontend/src/hooks/useRaidWebSocket.ts
git add frontend/src/pages/RaidGamePage.tsx
git add frontend/src/components/RaidBossDisplay.tsx frontend/src/components/PlayerLane.tsx frontend/src/components/RaidResults.tsx
git add frontend/src/App.tsx
git commit -m "feat(raid): add raid game page with WebSocket integration"
```

---

## Part 6: Integration & Polish

### Task 6: Wire Up DO with HTTP Room Creation

**Files:**
- Modify: `backend/src/handlers/raid.ts`
- Modify: `backend/src/durable/raid-room.ts`

- [ ] **Step 1: Update createRoom to initialize DO**

Modify `createRaidRoom` in `backend/src/handlers/raid.ts` to also initialize the DO:

```typescript
export const createRaidRoom = async (c: AppContext) => {
  const auth = getAuth(c);
  const userId = auth?.userId;
  const username = (auth?.publicMetadata?.username as string) || 'Unknown';
  
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const db = c.get('db');
  
  // Generate unique room code
  let roomCode = generateRoomCode();
  let attempts = 0;
  while (attempts < 10) {
    const existing = await db.query.raidRooms.findFirst({
      where: (r, { eq }) => eq(r.roomCode, roomCode),
    });
    if (!existing) break;
    roomCode = generateRoomCode();
    attempts++;
  }

  const createdAt = new Date();
  const expiresAt = createdAt.getTime() + 5 * 60 * 1000;

  await db.insert(raidRooms).values({
    roomCode,
    hostId: userId,
    hostUsername: username,
    status: 'waiting',
    maxPlayers: 4,
    createdAt,
  });

  // Initialize Durable Object for this room
  const doId = c.env.RAID_ROOM.idFromName(roomCode);
  const doStub = c.env.RAID_ROOM.get(doId);
  
  // Call DO to set room code
  await doStub.fetch(new Request(`http://localhost/raid/${roomCode}/init`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Room-Code': roomCode,
      'X-Host-Id': userId,
    },
  }));

  return c.json({ roomCode, expiresAt }, 201);
};
```

- [ ] **Step 2: Update RaidRoom DO to handle init**

Add `init` handling in `RaidRoom.fetch`:

```typescript
if (request.method === 'POST' && path.endsWith('/init')) {
  this.room.roomCode = request.headers.get('X-Room-Code') || 'UNKNOWN';
  this.room.hostId = request.headers.get('X-Host-Id') || '';
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

- [ ] **Step 3: Update room status on raid start/end**

Add to `backend/src/durable/raid-room.ts`:

```typescript
// After starting raid, update D1 status
const updateRoomStatus = async () => {
  // Make internal API call or use D1 directly
  // For now, skip - will be added in final integration
};

// After ending raid
const persistResults = async () => {
  // Persist raid results to D1
  // raid_sessions and raid_player_results
};
```

- [ ] **Step 4: Test full integration**

Test: Create room → Join → Start → Play → Victory/Defeat

- [ ] **Step 5: Commit**

```bash
git add backend/src/handlers/raid.ts backend/src/durable/raid-room.ts
git commit -m "feat(raid): wire up DO initialization with room creation"
```

---

### Task 7: Room Timeout & Cleanup

**Files:**
- Modify: `backend/src/durable/raid-room.ts`

- [ ] **Step 1: Add room timeout in DO**

Add to `RaidRoom` constructor or `fetch`:

```typescript
// Set up 5-minute timeout for waiting rooms
this.state.storage.setAlarm(Date.now() + 5 * 60 * 1000);
```

Add `alarm()` method:

```typescript
async alarm(): Promise<void> {
  if (this.room.status === 'waiting') {
    // Room timed out without starting
    // Clean up
    await this.state.storage.deleteAll();
  }
}
```

- [ ] **Step 2: Cancel alarm when raid starts**

In `startRaid()`, cancel the alarm:

```typescript
await this.state.storage.setAlarm(null);
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/durable/raid-room.ts
git commit -m "feat(raid): add room timeout and cleanup"
```

---

## Verification Checklist

After all tasks:

- [ ] Run `cd backend && bun test`
- [ ] Run `cd frontend && bun run lint && bun run format:check && bunx tsc --noEmit`
- [ ] Test full flow:
  1. Create room
  2. Join from another tab/browser
  3. Host starts raid
  4. Complete words, verify boss takes damage
  5. Wait for boss attack, verify all players take damage
  6. Make mistake, verify only one player takes damage
  7. Win or lose, verify results modal

---

## Spec Coverage Check

| Spec Section | Task |
|---|---|
| Architecture: DO + WebSocket | Task 3 |
| WebSocket protocol | Task 3 |
| Game loop (boss attack all, mistake solo) | Task 3, Task 5 |
| HTTP API (create/list/join) | Task 2 |
| Data model (D1 tables) | Task 1 |
| Lobby page | Task 4 |
| Raid game page | Task 5 |
| Boss display | Task 5 |
| Player lanes | Task 5 |
| Results modal | Task 5 |
| Room timeout | Task 7 |

All spec sections covered.

---

**Plan complete.** Saved to `docs/superpowers/plans/2025-05-08-raid-boss-plan.md`.
