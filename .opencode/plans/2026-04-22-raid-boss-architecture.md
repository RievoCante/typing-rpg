# Raid Boss Multiplayer Architecture Spec

**Date:** 2026-04-22  
**Status:** Approved by user  
**Scope:** Phase 1 MVP — multiplayer co-op raid boss (2–3 players, WebSocket, Durable Objects)

---

## 1. Goals

Build a real-time multiplayer co-op raid boss mode where 1–3 players type simultaneously to deplete a shared boss HP bar. This is the product differentiator that makes Typing RPG stand out from MonkeyType/Keybr.

**MVP success criteria:**
- Public lobby with discoverable rooms
- 1–3 players per room (host starts game)
- Real-time typing sync via WebSocket
- Shared boss HP bar, individual player HP bars
- Boss attacks one random alive player every 5s for 12 dmg
- 6 HP damage dealt per correct word
- Victory/Defeat states with stats persistence to D1
- Dead players enter spectator mode (others keep fighting)

---

## 2. Premises (Locked Decisions)

1. **WebSocket over polling** — User chose better UX despite complexity.
2. **Hybrid mechanic** — Individual typing texts + shared boss HP.
3. **Public lobby** — Discoverable rooms via KV-backed lobby index.
4. **3 players max** — Optimal for typing game pacing.
5. **Boss HP scales with player count** — `bossMaxHp = 125 * playerCount`.
6. **Individual death = spectator mode** — Dead player can watch, others keep fighting.

---

## 3. Backend Architecture

### 3.1 Durable Object: `RaidRoom`

**File:** `backend/src/rooms/RaidRoom.ts`

Each DO instance represents one active raid room. The DO manages in-memory game state and WebSocket connections.

**State shape:**
```ts
type RaidRoomState = {
  phase: 'lobby' | 'playing' | 'finished';
  players: Map<WebSocket, PlayerState>;
  bossHp: number;
  bossMaxHp: number;
  bossBaseHp: number;
  attackTimer: number | null; // interval ID for setInterval in DO
  texts: Map<string, string>; // userId -> generated text
  createdAt: number;
  startedAt: number | null;
};

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
```

**Lifecycle:**
1. Room created via `POST /api/raid/rooms` → DO spawned with `idFromName(roomId)`.
2. Players connect via WebSocket at `/api/raid/rooms/:id/ws`.
3. DO validates Clerk JWT from `?token=` query param in `fetch()`.
4. On successful validation, DO accepts WebSocket and sends `room_state` to all clients.
5. Host sends `start_game` → DO transitions to `playing`, generates texts, starts boss attack timer.
6. Players send `word_complete` → DO validates, decrements boss HP by 6, increments player stats, broadcasts `word_hit`.
7. Boss attack timer fires → DO picks random alive player, deals 12 dmg, broadcasts `boss_attacked`.
8. When player HP reaches 0 → client sends `player_dead` → DO marks `isAlive: false`, broadcasts `player_died`.
9. If boss HP ≤ 0 → `victory`. If all players `isAlive: false` → `defeat`.
10. On game end → DO persists stats to D1 via `c.env.DB`, broadcasts `victory`/`defeat`, then closes connections after 30s grace period.

**Disconnect handling:**
- If a player disconnects mid-game, DO marks them as disconnected but preserves their state.
- If the host disconnects in lobby, DO assigns a new host (first connected player).
- If host disconnects during game, game continues; first remaining alive player becomes new host implicitly (can still start nothing since game already started).
- If all players disconnect, DO persists any incomplete session and hibernates (Cloudflare handles cleanup).

**Broadcast strategy:**
- Send `room_state` to all connected clients after every mutation.
- Payload is small (< 1KB for 3 players). Do this imperatively via `ws.send()` over all connections.

### 3.2 Worker Entrypoint Routing

**File:** `backend/src/index.ts`

Hono handles all HTTP routes under `/api`. WebSocket upgrade requests bypass Hono and route directly to the DO.

**Routing logic:**
```ts
export default {
  async fetch(req: Request, env: Bindings, executionCtx: ExecutionContext) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/raid/rooms/') && url.pathname.endsWith('/ws')) {
      const roomId = url.pathname.split('/')[4];
      const doId = env.RAID_ROOMS.idFromName(roomId);
      const room = env.RAID_ROOMS.get(doId);
      return room.fetch(req);
    }
    return app.fetch(req, env, executionCtx);
  },
};
```

**JWT validation in WebSocket upgrade:**
- Clerk JWT passed as query param `?token=__clerk_jwt__`.
- DO `fetch()` validates token using `@clerk/backend` `verifyToken()` before calling `this.ctx.acceptWebSocket(request)`.
- If invalid → return `new Response('Unauthorized', { status: 401 })`.

### 3.3 REST API Routes (Hono)

**File:** `backend/src/handlers/raid.ts`

- `GET /api/raid/rooms`
  - Reads KV lobby index prefix `lobby:`.
  - Returns array of active rooms: `{ roomId, hostName, playerCount, status, createdAt }`.
  - Rooms auto-expire from KV after 10 minutes of inactivity (using KV TTL or manual cleanup).

- `POST /api/raid/rooms`
  - Authenticated via `authMiddleware`.
  - Generates random 6-char alphanumeric `roomId` (e.g., `ABC123`).
  - Creates DO instance via `env.RAID_ROOMS.idFromName(roomId)`.
  - Writes lobby entry to KV with 10-minute TTL.
  - Returns `{ roomId }`.

- `POST /api/raid/rooms/:id/join`
  - Authenticated.
  - Validates room exists (optional DO fetch for player count).
  - Returns `{ wsUrl: 'wss://.../api/raid/rooms/ABC123/ws?token=...' }`.

- `GET /api/raid/sessions`
  - Authenticated.
  - Queries D1 `raid_sessions` + `raid_players` for the requesting user.
  - Returns paginated session history.

### 3.4 D1 Schema

**File:** `backend/src/db/schema.ts` (additions)

```ts
export const raidSessions = sqliteTable('raid_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  roomId: text('room_id').notNull(),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  endedAt: integer('ended_at', { mode: 'timestamp' }),
  playerCount: integer('player_count').notNull(),
  bossBaseHp: integer('boss_base_hp').notNull(),
  bossMaxHp: integer('boss_max_hp').notNull(),
  finalBossHp: integer('final_boss_hp').notNull(),
  status: text('status', { enum: ['victory', 'defeat'] }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .default(sql`(strftime('%s', 'now'))`)
    .notNull(),
}, table => [
  index('idx_raid_sessions_room').on(table.roomId),
  index('idx_raid_sessions_created').on(table.createdAt),
]);

export const raidPlayers = sqliteTable('raid_players', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id')
    .notNull()
    .references(() => raidSessions.id),
  userId: text('user_id').notNull(),
  username: text('username').notNull(),
  damageDealt: integer('damage_dealt').notNull(),
  wordsTyped: integer('words_typed').notNull(),
  wordsCorrect: integer('words_correct').notNull(),
  survived: integer('survived', { mode: 'boolean' }).notNull(),
}, table => [
  index('idx_raid_players_user').on(table.userId),
  index('idx_raid_players_session').on(table.sessionId),
]);
```

**Migration:** Run `bun run db:gen` after schema change, then `bun run dev` to apply locally.

---

## 4. WebSocket Message Protocol

All messages are JSON strings.

### Client → Server

| Message | Payload | Sent When |
|---|---|---|
| `join` | `{ userId: string, username: string }` | Auto-sent after successful WebSocket connection. |
| `start_game` | `{}` | Sent by host in lobby to begin the raid. |
| `word_complete` | `{ wordIndex: number }` | After player correctly completes a word and presses space. |
| `player_dead` | `{}` | When client detects local player HP reached 0. |

### Server → Client

| Message | Payload | Sent When |
|---|---|---|
| `room_state` | `{ phase, players: [...], bossHp, bossMaxHp }` | On join, and after every mutation. |
| `player_joined` | `{ userId, username }` | New player connects. |
| `player_left` | `{ userId }` | Player disconnects (or times out). |
| `game_started` | `{ texts: Record<userId, string> }` | Phase changed to `playing`. Each player gets their own text. |
| `boss_attacked` | `{ targetId: string, damage: number, newBossHp: number }` | Boss timer fires. |
| `word_hit` | `{ playerId: string, newBossHp: number }` | A player completed a correct word. |
| `player_died` | `{ playerId: string }` | Player HP reached 0. |
| `victory` | `{ sessionId?: number, stats: { totalWords, avgWpm, durationMs } }` | Boss defeated. |
| `defeat` | `{ sessionId?: number, stats: { totalWords, avgWpm, durationMs } }` | All players dead. |

---

## 5. Frontend Architecture

### 5.1 Routing

**File:** `frontend/src/App.tsx` (modified)

Add React Router (`react-router-dom` is already in dependencies):
```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <GameProvider>
          <Routes>
            <Route path="/" element={<GameContent />} />
            <Route path="/raid" element={<RaidLobbyPage />} />
            <Route path="/raid/:roomId" element={<RaidRoomPage />} />
          </Routes>
        </GameProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
```

### 5.2 Pages

**`frontend/src/pages/RaidLobbyPage.tsx`**
- Fetches active rooms from `GET /api/raid/rooms`.
- Displays room list as cards: room ID, host name, player count (e.g., "2/3").
- "Create Room" button → calls `POST /api/raid/rooms` → redirects to `/raid/:roomId`.
- "Join" button on each room card → calls `POST /api/raid/rooms/:id/join` → redirects to `/raid/:roomId`.
- Auto-refreshes room list every 5 seconds while on the page.

**`frontend/src/pages/RaidRoomPage.tsx`**
- Reads `roomId` from URL params.
- Manages `useRaidSocket` hook for WebSocket lifecycle.
- Manages `useRaidState` hook for game state.
- Renders either:
  - `RaidLobbyScreen` (phase === 'lobby'): shows connected players, host sees "Start Game" button (disabled unless >= 1 player, host can start solo).
  - `RaidGame` (phase === 'playing'): the actual raid gameplay.
  - `RaidResultScreen` (phase === 'finished'): victory/defeat summary, stats, "Play Again" button.

### 5.3 Components

**`frontend/src/components/RaidGame.tsx`**
- Top section: Boss HP bar (full width, large), boss visual (reuse `Monster` component with `boss` type, larger scale, distinct color).
- Middle section: 3-column grid (`grid-cols-1 md:grid-cols-3`). Each column is a `RaidPlayerLane`.
- The local player's lane is highlighted with a border glow.
- Hit effects: when any player finishes a word, show `HIT` popup near the boss (reusing existing hit popup logic from `TypingInterface`).
- Attack effects: when boss attacks, show `ATTACK!` popup near the targeted player's lane.

**`frontend/src/components/RaidPlayerLane.tsx`**
- Displays player username and HP bar at top of lane.
- Shows `TypingText` component for the player's text.
- For the local player: captures keyboard input via `useTypingMechanics`, handles `handleSpaceBar` to lock words and send `word_complete` to server.
- For remote players: displays their typing progress synced from server (cursor position + charStatus).
- If player is dead: show translucent overlay with "SPECTATOR MODE" and disable input.
- If player slot is empty: show "Waiting for player..." placeholder.

**`frontend/src/components/RaidBoss.tsx`**
- Reuses existing `Monster` component but forces:
  - Family: always `'golem'` (thematically a boss).
  - Type: always `'boss'`.
  - Scale: fixed largest size.
  - Color: distinct boss color (e.g., crimson or gold).
- Adds health bar overlay above the monster.

### 5.4 Hooks

**`frontend/src/hooks/useRaidSocket.ts`**
- Manages `WebSocket` lifecycle: connect, reconnect on unexpected close, heartbeat (ping/pong every 30s).
- Sends messages via `send(message: object)`.
- Exposes `lastMessage: object | null` for consumers to react to.
- Handles connection errors gracefully (max 3 retries, then show error UI).

**`frontend/src/hooks/useRaidState.ts`**
- Takes `lastMessage` from `useRaidSocket`.
- Maintains local state synced with server:
  ```ts
  type RaidState = {
    phase: 'lobby' | 'playing' | 'finished';
    players: RaidPlayer[];
    bossHp: number;
    bossMaxHp: number;
    localText: string;
    text: string;
    isHost: boolean;
    result: 'victory' | 'defeat' | null;
  };
  ```
- Processes incoming messages and updates state accordingly.
- For `game_started`: sets `localText` for the current user.
- For `boss_attacked`: decrements local HP copy for the targeted player.
- For `word_hit`: decrements `bossHp`.
- For `player_died`: marks player as dead in local state, triggers spectator mode if local player.

---

## 6. Game Mechanics (MVP)

### Boss
- **Base HP:** 125 per player.
- **Max HP:** `125 * playerCount`.
- **Attack interval:** 5 seconds.
- **Attack target:** One random alive player.
- **Attack damage:** 12 HP.

### Player
- **Max HP:** 100 (same as single-player).
- **Damage dealt per correct word:** 6 HP to boss.
- **Mistake penalty:** None for MVP (to keep it simple and fun). In single-player, mistakes damage the player. In raid, we ONLY have boss attacks for player damage.
- **Solo mode:** Allowed. Host can start alone. Boss HP = 125. This serves as "raid practice".

### Text Generation
- Each player gets their own text via existing `generateText()`.
- All players use the same `endlessWordCount` (default 25) and same `endlessDifficulty` (default 'beginner').
- Texts may differ between players.
- Generated on the server (DO) when `start_game` is called.

### Victory / Defeat
- **Victory:** Boss HP reaches ≤ 0.
- **Defeat:** All alive players' HP reaches ≤ 0.
- **Spectator mode:** Dead players remain connected and receive state updates but cannot type. They see "SPECTATOR MODE" overlay on their lane.

### Potions
- **MVP:** No potions in raid mode. Keeps complexity low. Single-player potion system remains untouched.

---

## 7. Wrangler Configuration

**File:** `backend/wrangler.toml` (modifications)

```toml
# Update for DO WebSocket hibernation support
compatibility_date = "2025-04-01"

# Existing D1 and KV bindings stay
[[d1_databases]]
binding = "DB"
database_name = "typing-rpg-db"
database_id = "d1c1d295-2035-4109-9c2b-f5693c835cd5"
migrations_dir = "drizzle"

[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "0e8f22caff7a40f596a9bcded20f2f6f"

# Add Durable Object binding
[[durable_objects.bindings]]
name = "RAID_ROOMS"
class_name = "RaidRoom"

# Add DO migration entry
[[migrations]]
tag = "v2-add-raid-rooms"
new_classes = ["RaidRoom"]

[observability.logs]
enabled = true
```

**Compatibility date bump required:** DO WebSocket hibernation API requires a recent compatibility date. Change from `2024-05-12` to `2025-04-01`.

---

## 8. Security & Rate Limiting

- **Auth:** All raid HTTP routes and WebSocket upgrades require Clerk JWT.
- **Rate limiting:** `POST /api/raid/rooms` limited to 5 creations per user per minute via existing KV rate limiter.
- **Room capacity:** DO enforces max 3 connections. Rejects 4th connection with `403`.
- **KV TTL:** Lobby entries auto-expire after 10 minutes. DO internal state is independent; if DO hibernates and KV entry expires, the room disappears from the lobby but the DO can still be reached by direct URL. This is acceptable for MVP (players share room IDs directly if needed).

---

## 9. Decomposition

This spec covers ONLY the multiplayer raid boss MVP. Future work (not in this spec):
- Cosmetics / skins
- Sponsorship integration
- Analytics dashboard
- Leaderboard for raid mode
- Discord/Twitch integration
- Spectator chat

---

## 10. Open Questions (Resolved)

1. **Boss attack pattern:** Random single-target (confirmed).
2. **Damage per word:** 6 HP (confirmed).
3. **Auto-expire lobby rooms:** Yes, 10-minute KV TTL (confirmed).

---

**END OF SPEC.**
