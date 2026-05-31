# Raid Boss System — Technical Design

**Status:** Draft
**Date:** 2025-05-08
**Stack:** Cloudflare Workers, Durable Objects, D1, React

---

## Overview

Multiplayer co-op raid boss battle. 2-4 players join a shared room, each with their own typing lane, fighting a single boss together. Combined typing speed damages the boss. The boss periodically attacks all players. Individual mistakes damage only that player.

---

## Architecture

```
Frontend (React)                    Cloudflare Workers
  │                                       │
  │ WebSocket                             │
  ├─── HTTP Upgrade ──► DO: RaidRoom     │
  │                          │            │
  │   - boss HP (memory)       │            │
  │   - player states (memory)  │            │
  │   - broadcast loop         │            │
  │                          │            │
  │                          ▼            │
  │                       D1 (persist)   │
  │                    - room registry   │
  │                    - raid history   │
  │                    - player results │
  │                                       │
  └───────────────────────────────────────► HTTP API
                                              - POST /raid/rooms
                                              - GET  /raid/rooms
                                              - POST /raid/rooms/:code/join
```

### Real-time Protocol (WebSocket)

**Client → Server:**
```typescript
{ type: 'join', roomCode: string }
{ type: 'word_done', wordIndex: number }      // Player completed a word
{ type: 'start_raid' }                         // Host only
```

**Server → Client (broadcast to all room members):**
```typescript
{ type: 'player_joined', player: { id, username, hp } }
{ type: 'raid_started', boss: { hp, maxHp }, players: Player[] }
{ type: 'boss_damaged', bossHp: number }
{ type: 'boss_attacked', damage: number }     // All players attacked
{ type: 'player_hit', playerId: string, damage: number }  // One player hit by mistake
{ type: 'player_dead', playerId: string }
{ type: 'raid_ended', victory: boolean, stats: RaidStats }
{ type: 'player_left', playerId: string }
{ type: 'error', message: string }
```

---

## Game Loop

```
1. Room created via HTTP POST /raid/rooms
   → D1: insert raid_rooms (status: waiting)
   → DO: RaidRoom spawned with roomCode
   → 5-minute timeout starts

2. Players join:
   → HTTP GET /raid/rooms (browse available)
   → HTTP POST /raid/rooms/:code/join
   → WebSocket upgrade, join DO
   → Broadcast 'player_joined' to all

3. Host triggers 'start_raid' (requires 2-4 players)
   → All players receive 'raid_started'
   → Each player gets unique text for their lane
   → Boss attack timer starts

4. During raid:
   a. Player completes a word correctly:
      - boss HP -= 1
      - broadcast 'boss_damaged'
   
   b. Boss attacks (every 6 seconds):
      - ALL alive players take 10 damage
      - broadcast 'boss_attacked'
      - ALL players show ATTACK! popup
   
   c. Player makes a mistake (types word wrong):
      - ONLY that player takes 5-15 damage (random)
      - broadcast 'player_hit' (only that player's lane shows HIT)

5. Player HP reaches 0:
   → Mark player as dead
   → Disable their typing lane
   → broadcast 'player_dead'

6. Victory/Defeat:
   - If boss HP = 0: victory = true
   - If ALL players dead: victory = false
   → broadcast 'raid_ended'
   → Persist to D1 (raid_sessions, raid_player_results)
   → DO destroyed after persistence

7. Timeout (5 min no start, or raid ended):
   → Clean up room from D1
   → Destroy DO
```

---

## Data Model

### Existing Tables (unchanged)
- `users` — Clerk user data
- `game_sessions` — Single-player sessions

### New D1 Tables

```sql
-- Room registry (matchmaking)
CREATE TABLE raid_rooms (
  room_code TEXT PRIMARY KEY,           -- 6-char alphanumeric
  host_id TEXT NOT NULL,
  host_username TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting',  -- waiting | active | ended
  max_players INTEGER NOT NULL DEFAULT 4,
  created_at INTEGER NOT NULL
);

-- Persisted raid history
CREATE TABLE raid_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_code TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  boss_hp_start INTEGER NOT NULL,
  boss_hp_end INTEGER NOT NULL,
  victory INTEGER NOT NULL             -- 1 = win, 0 = lose
);

-- Per-player results
CREATE TABLE raid_player_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES raid_sessions(id),
  player_id TEXT NOT NULL,
  player_username TEXT NOT NULL,
  words_completed INTEGER NOT NULL DEFAULT 0,
  damage_dealt INTEGER NOT NULL DEFAULT 0,
  hp_remaining INTEGER NOT NULL DEFAULT 0,
  is_dead INTEGER NOT NULL DEFAULT 0
);

-- Indexes
CREATE INDEX idx_raid_rooms_status ON raid_rooms(status);
CREATE INDEX idx_raid_sessions_room ON raid_sessions(room_code);
CREATE INDEX idx_raid_results_session ON raid_player_results(session_id);
```

### Durable Object State (in-memory)

```typescript
interface RaidRoomState {
  roomCode: string;
  bossHp: number;
  bossMaxHp: number;
  players: Map<string, RaidPlayer>;
  status: 'waiting' | 'active' | 'ended';
  attackTimer: number | null;
  createdAt: number;
}

interface RaidPlayer {
  id: string;          // Clerk userId
  username: string;
  hp: number;
  maxHp: number;
  wordsCompleted: number;
  damageDealt: number;
  isDead: boolean;
  ws: WebSocket;
}
```

---

## API Endpoints

### POST /raid/rooms
Create a new raid room.

**Request:**
```json
{ }
```

**Response:** `201 Created`
```json
{
  "roomCode": "ABC123",
  "expiresAt": 1746739200000
}
```

### GET /raid/rooms
List available rooms.

**Response:** `200 OK`
```json
{
  "rooms": [
    {
      "roomCode": "ABC123",
      "hostUsername": "PlayerOne",
      "playerCount": 2,
      "maxPlayers": 4,
      "status": "waiting",
      "createdAt": 1746735600000
    }
  ]
}
```

### POST /raid/rooms/:code/join
Get WebSocket connection info for a room.

**Response:** `200 OK`
```json
{
  "wsUrl": "wss://..."  // WebSocket URL to connect
}
```

---

## Frontend Changes

### New Routes
- `/raid` — Lobby page (create room, browse rooms)
- `/raid/:code` — In-game (WebSocket connection, typing lanes)

### Components

| Component | Purpose |
|---|---|
| `RaidLobby` | Create/join rooms, room list |
| `RaidRoom` | In-game container |
| `BossDisplay` | Shared boss HP bar and visual |
| `PlayerLane` | Individual player's typing interface |
| `RaidResults` | Post-raid stats modal |

### Context

`RaidContext` — manages WebSocket state, raid state, player list, boss HP.

### Shared Boss Display (top of screen)
- Boss HP bar (shared across all players)
- Boss visual (reuse existing `Monster` component)
- Attack animation (all players see same attack cycle)

### Individual Player Lanes (below boss)
- Each player has their own typing lane
- Shows player HP bar (individual)
- Shows player username
- TypingInterface with own text
- HIT popup on mistake (per-lane)
- ATTACK popup on boss attack (per-lane)

---

## Boss Configuration

| Setting | Value |
|---|---|
| Boss HP | 100 (static) |
| Attack interval | 6 seconds |
| Attack damage (to each player) | 10 HP |
| Mistake damage | 5-15 HP (random) |
| Player max HP | 100 |

---

## MVP Exclusions

- Multiple boss types (one static boss only)
- XP rewards from raids
- Cosmetic items
- Spectating
- Raid leaderboards
- Per-player text generation variations
- Boss phases or enrage mechanics

---

## Implementation Order

1. Database migrations (D1)
2. HTTP API endpoints (create/list/join room)
3. Durable Object: room lifecycle
4. WebSocket handshake and authentication
5. WebSocket message handling
6. Boss attack loop
7. Frontend: Lobby page
8. Frontend: Raid game page
9. Frontend: WebSocket integration
10. Integration: Boss display
11. Integration: Player lanes
12. Victory/defeat flow + results
13. Room cleanup + timeout handling
