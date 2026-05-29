# Raid UI Renovation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Renovate the raid battle UI into a party-formation layout where every player (including the local "you") sees their own 3D avatar, replace the emoji boss with a procedural 3D demon, and add a header-launched character customizer whose choices persist (backend for signed-in users, localStorage for guests) and are visible to teammates.

**Architecture:** Character config is a small cosmetic object (the existing 5 `avatarConfig` knobs). It is (a) persisted per signed-in user in a new nullable `users.character` TEXT column via a `PATCH /api/me/character` endpoint, (b) kept in localStorage for guests, and (c) carried to teammates by adding it to the raid WebSocket `join` message body → stored on the server `PlayerState` → echoed in `room_state`/`player_joined` broadcasts. Because it is purely cosmetic, the server trusts it from the message body (identity still comes from the validated URL params). All avatar rendering resolves through `resolveAvatarConfig(userId, savedConfig)` which returns the saved config if valid, else the deterministic `avatarConfigFromSeed(userId)`.

**Tech Stack:** Frontend React 19 + Vite + Tailwind + @react-three/fiber/three; Backend Hono + Cloudflare Workers (Durable Object) + D1 + Drizzle + zod; bun + vitest everywhere.

**Branch:** Work on `dev` (commit directly to `dev`; final PR is `dev` → `main`). `origin/main` has diverged (a Leaderboard feature) — do not touch it.

**Cross-cutting sync rule (new):** The allowed character values in `backend/src/core/character.ts` MUST stay in sync with the arrays in `frontend/src/utils/avatarConfig.ts` (`BODY_SHAPES`, `BODY_COLORS`, `EYE_STYLES`, `ACCESSORIES`, `ACCESSORY_COLORS`). A comment in each file points at the other.

**Testing convention (established in this repo):** vitest runs in the **node** environment (no jsdom). Component tests use `renderToString` from `react-dom/server` with `@react-three/fiber` Canvas components mocked (see `RaidLobbyScreen.test.tsx`). Pure logic is unit-tested directly. Do NOT introduce jsdom or `@testing-library` interaction tests — interaction states go in the manual-QA checklist.

---

## File Structure

**New files**
- `backend/src/core/character.ts` — zod schema + `parseCharacterConfig()` for the cosmetic config (shared by the endpoint and the raid room).
- `frontend/src/components/RaidBoss3D.tsx` — procedural 3D demon boss (Canvas in `memo`).
- `frontend/src/context/characterContext.ts` — React context object + value type.
- `frontend/src/context/CharacterProvider.tsx` — loads/saves the local user's character config.
- `frontend/src/hooks/useCharacter.ts` — `useContext` accessor.
- `frontend/src/components/CharacterCustomizer.tsx` — modal with 5 knob pickers + live preview.
- Test files alongside each as specified per task.

**Modified files**
- `backend/src/db/schema.ts` — add `character` column to `users`.
- `backend/drizzle/` — generated migration (via `bun run db:gen`).
- `backend/src/handlers/user.ts` — add `updateCharacter` handler.
- `backend/src/index.ts` — register `PATCH /me/character`.
- `backend/src/rooms/RaidRoom.ts` — thread `characterConfig` through join + broadcasts.
- `frontend/src/utils/avatarConfig.ts` — add `isValidAvatarConfig`, `resolveAvatarConfig`, `parseStoredAvatarConfig`.
- `frontend/src/hooks/useRaidSocket.ts` — add `characterConfig` to `RaidPlayer` + messages.
- `frontend/src/hooks/useRaidState.ts` — carry `characterConfig` in `player_joined`.
- `frontend/src/hooks/useApi.ts` — add `updateCharacter`.
- `frontend/src/components/RaidAvatar.tsx` — `isLocal` highlight prop.
- `frontend/src/components/RaidGame.tsx` — new layout (boss top + party row incl. local).
- `frontend/src/components/RaidView.tsx` — send `characterConfig` in join.
- `frontend/src/components/RaidLobbyScreen.tsx` (+ `.test.tsx`) — resolve avatar config.
- `frontend/src/main.tsx` — mount `CharacterProvider`.

---

## Task 1: Avatar config validation + resolution utilities

**Files:**
- Modify: `frontend/src/utils/avatarConfig.ts`
- Test: `frontend/src/utils/avatarConfig.test.ts`

- [ ] **Step 1: Write failing tests** — append to `frontend/src/utils/avatarConfig.test.ts`:

```ts
import {
  avatarConfigFromSeed,
  isValidAvatarConfig,
  resolveAvatarConfig,
  parseStoredAvatarConfig,
  BODY_SHAPES,
  EYE_STYLES,
  ACCESSORIES,
} from './avatarConfig';

const valid = {
  bodyShape: 'round',
  bodyColor: '#38bdf8',
  eyeStyle: 'wide',
  accessory: 'crown',
  accessoryColor: '#fde047',
};

describe('isValidAvatarConfig', () => {
  it('accepts a fully valid config', () => {
    expect(isValidAvatarConfig(valid)).toBe(true);
  });
  it('rejects null/undefined/non-objects', () => {
    expect(isValidAvatarConfig(null)).toBe(false);
    expect(isValidAvatarConfig(undefined)).toBe(false);
    expect(isValidAvatarConfig('x')).toBe(false);
  });
  it('rejects unknown knob values', () => {
    expect(isValidAvatarConfig({ ...valid, bodyShape: 'triangle' })).toBe(false);
    expect(isValidAvatarConfig({ ...valid, bodyColor: '#000000' })).toBe(false);
  });
  it('rejects configs missing a key', () => {
    const { accessory: _omit, ...partial } = valid;
    expect(isValidAvatarConfig(partial)).toBe(false);
  });
});

describe('resolveAvatarConfig', () => {
  it('returns the saved config when valid', () => {
    expect(resolveAvatarConfig('user_x', valid)).toEqual(valid);
  });
  it('falls back to the seed when saved is null/invalid', () => {
    expect(resolveAvatarConfig('user_2abc', null)).toEqual(
      avatarConfigFromSeed('user_2abc')
    );
    expect(resolveAvatarConfig('user_2abc', { bad: true } as never)).toEqual(
      avatarConfigFromSeed('user_2abc')
    );
  });
});

describe('parseStoredAvatarConfig', () => {
  it('parses a valid JSON string', () => {
    expect(parseStoredAvatarConfig(JSON.stringify(valid))).toEqual(valid);
  });
  it('returns null for null, empty, malformed, or invalid JSON', () => {
    expect(parseStoredAvatarConfig(null)).toBeNull();
    expect(parseStoredAvatarConfig('')).toBeNull();
    expect(parseStoredAvatarConfig('{not json')).toBeNull();
    expect(parseStoredAvatarConfig(JSON.stringify({ bodyShape: 'round' }))).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd frontend && bun x vitest run src/utils/avatarConfig.test.ts`
Expected: FAIL — `isValidAvatarConfig`/`resolveAvatarConfig`/`parseStoredAvatarConfig` not exported.

- [ ] **Step 3: Implement** — append to `frontend/src/utils/avatarConfig.ts` (after `avatarConfigFromSeed`):

```ts
// Runtime guard for configs arriving from storage, the network, or teammates.
// IMPORTANT: keep the allowed values in sync with backend/src/core/character.ts.
export function isValidAvatarConfig(x: unknown): x is PlayerAvatarConfig {
  if (!x || typeof x !== 'object') return false;
  const c = x as Record<string, unknown>;
  return (
    typeof c.bodyShape === 'string' &&
    (BODY_SHAPES as string[]).includes(c.bodyShape) &&
    typeof c.bodyColor === 'string' &&
    BODY_COLORS.includes(c.bodyColor) &&
    typeof c.eyeStyle === 'string' &&
    (EYE_STYLES as string[]).includes(c.eyeStyle) &&
    typeof c.accessory === 'string' &&
    (ACCESSORIES as string[]).includes(c.accessory) &&
    typeof c.accessoryColor === 'string' &&
    ACCESSORY_COLORS.includes(c.accessoryColor)
  );
}

// Resolve the config to render for a player: prefer a valid saved/received
// config, else fall back to the deterministic per-user seed.
export function resolveAvatarConfig(
  userId: string,
  saved?: PlayerAvatarConfig | null
): PlayerAvatarConfig {
  return saved && isValidAvatarConfig(saved)
    ? saved
    : avatarConfigFromSeed(userId);
}

// Parse + validate a JSON string from storage or an API field. Null on any
// failure so callers can treat "no custom config" uniformly.
export function parseStoredAvatarConfig(
  raw: string | null | undefined
): PlayerAvatarConfig | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return isValidAvatarConfig(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `cd frontend && bun x vitest run src/utils/avatarConfig.test.ts`
Expected: PASS (all suites).

- [ ] **Step 5: Lint/format/typecheck**

Run: `cd frontend && bun run lint && bun run format:check && bunx tsc --noEmit`
Expected: 0 errors (3 pre-existing warnings in `PixelArtBackground.tsx`/`useCompletionDetection.ts` are allowed).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/utils/avatarConfig.ts frontend/src/utils/avatarConfig.test.ts
git commit -m "feat(raid): add avatar config validation + resolution helpers"
```

---

## Task 2: Backend — users.character column, migration, PATCH endpoint

**Files:**
- Create: `backend/src/core/character.ts`
- Create: `backend/src/core/character.test.ts`
- Modify: `backend/src/db/schema.ts:10-20` (users table)
- Modify: `backend/src/handlers/user.ts`
- Modify: `backend/src/index.ts:70-71` (route registration)
- Generated: `backend/drizzle/0006_*.sql`

- [ ] **Step 1: Write failing test** — create `backend/src/core/character.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseCharacterConfig } from './character';

const valid = {
  bodyShape: 'square',
  bodyColor: '#a78bfa',
  eyeStyle: 'sleepy',
  accessory: 'horn',
  accessoryColor: '#c4b5fd',
};

describe('parseCharacterConfig', () => {
  it('returns the config for valid input', () => {
    expect(parseCharacterConfig(valid)).toEqual(valid);
  });
  it('returns null for missing/invalid/extra-typed input', () => {
    expect(parseCharacterConfig(null)).toBeNull();
    expect(parseCharacterConfig(undefined)).toBeNull();
    expect(parseCharacterConfig({ ...valid, bodyShape: 'blob' })).toBeNull();
    expect(parseCharacterConfig({ ...valid, accessoryColor: '#123456' })).toBeNull();
    const { eyeStyle: _o, ...partial } = valid;
    expect(parseCharacterConfig(partial)).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `cd backend && bun x vitest run src/core/character.test.ts`
Expected: FAIL — module `./character` not found.

- [ ] **Step 3: Implement `backend/src/core/character.ts`:**

```ts
// Cosmetic player avatar config persisted on users.character and echoed in raid
// presence. Purely cosmetic — safe to accept from the WS message body.
// IMPORTANT: keep these allowed values in sync with the arrays in
// frontend/src/utils/avatarConfig.ts.
import { z } from 'zod';

export const characterConfigSchema = z
  .object({
    bodyShape: z.enum(['round', 'square']),
    bodyColor: z.enum([
      '#38bdf8',
      '#34d399',
      '#a78bfa',
      '#fbbf24',
      '#f472b6',
      '#22d3ee',
      '#fb923c',
      '#4ade80',
    ]),
    eyeStyle: z.enum(['dot', 'wide', 'sleepy']),
    accessory: z.enum(['none', 'antenna', 'horn', 'crown']),
    accessoryColor: z.enum(['#f8fafc', '#fde047', '#fca5a5', '#c4b5fd']),
  })
  .strict();

export type CharacterConfig = z.infer<typeof characterConfigSchema>;

// Returns the validated config, or null if input is missing/invalid.
export function parseCharacterConfig(input: unknown): CharacterConfig | null {
  const r = characterConfigSchema.safeParse(input);
  return r.success ? r.data : null;
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd backend && bun x vitest run src/core/character.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the schema column** — in `backend/src/db/schema.ts`, add to the `users` table (after `updatedAt`, line ~19), keeping it nullable (no default) so existing rows are unaffected:

```ts
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
  // JSON-encoded cosmetic avatar config (see core/character.ts). Null until the
  // user customizes their character.
  character: text('character'),
});
```

- [ ] **Step 6: Generate the migration**

Run: `cd backend && bun run db:gen`
Expected: a new file `backend/drizzle/0006_*.sql` containing `ALTER TABLE \`users\` ADD \`character\` text;` (and an updated `drizzle/meta/` snapshot). Open the generated `.sql` and confirm it is exactly that single ALTER (no destructive statements).

- [ ] **Step 7: Add the `updateCharacter` handler** — append to `backend/src/handlers/user.ts`:

```ts
import { parseCharacterConfig } from '../core/character';

// PATCH /me/character — persist the signed-in user's cosmetic avatar config.
export const updateCharacter = async (c: AppContext) => {
  const auth = getAuth(c);
  if (!auth?.userId) return jsonError(c, 401, 'Unauthorized');

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return jsonError(c, 400, 'Invalid JSON body');
  }
  const config = parseCharacterConfig(body);
  if (!config) return jsonError(c, 400, 'Invalid character config');

  const db = c.get('db');
  await db
    .update(users)
    .set({ character: JSON.stringify(config), updatedAt: new Date() })
    .where(eq(users.userId, auth.userId));

  return c.json({ success: true, character: config });
};
```

Add the needed import at the top of `user.ts` (alongside existing imports):

```ts
import { eq } from 'drizzle-orm';
```

(`getUser` already returns the full `user` row, so the new `character` column is automatically included in `GET /me` — no change needed there.)

- [ ] **Step 8: Register the route** — in `backend/src/index.ts`, update the user-routes block (lines ~69-71):

```ts
// user routes
app.get("/me", authMiddleware, limiter, getUser);
app.post("/me", authMiddleware, limiter, createUser);
app.patch("/me/character", authMiddleware, limiter, updateCharacter);
```

And extend the import on line 8:

```ts
import { getUser, createUser, updateCharacter } from "./handlers/user";
```

- [ ] **Step 9: Typecheck + full backend tests**

Run: `cd backend && bunx tsc --noEmit && bun test`
Expected: 0 type errors; all existing tests + the new `character.test.ts` pass.

- [ ] **Step 10: Verify migration applies cleanly**

Run: `cd backend && bunx wrangler d1 migrations apply typing-rpg-db --local`
Expected: reports the new migration applied with no error. (If wrangler local is unavailable in this environment, instead re-confirm the generated SQL is a single non-destructive `ALTER TABLE ... ADD character text;` and note it in the task report.)

- [ ] **Step 11: Commit**

```bash
git add backend/src/core/character.ts backend/src/core/character.test.ts \
  backend/src/db/schema.ts backend/drizzle backend/src/handlers/user.ts backend/src/index.ts
git commit -m "feat(backend): persist user character config (users.character + PATCH /me/character)"
```

---

## Task 3: Backend raid — thread characterConfig through join + broadcasts

**Files:**
- Modify: `backend/src/rooms/RaidRoom.ts` (PlayerState type, join handler, broadcasts)
- Test: `backend/src/rooms/RaidRoom.test.ts`

- [ ] **Step 1: Write failing tests** — append cases to `backend/src/rooms/RaidRoom.test.ts` inside the `describe('RaidRoom', ...)` block:

```ts
  it('stores a valid characterConfig on join and includes it in room_state', () => {
    const ws = { send: vi.fn() } as any;
    const cfg = {
      bodyShape: 'round',
      bodyColor: '#34d399',
      eyeStyle: 'dot',
      accessory: 'antenna',
      accessoryColor: '#fde047',
    };
    (room as any).handlePlayerJoin(ws, { userId: 'u1', username: 'Alice' }, cfg);
    const stored = (room as any).state.players.get(ws);
    expect(stored.characterConfig).toEqual(cfg);

    const sent = JSON.parse(ws.send.mock.calls.at(-2)[0]); // room_state precedes player_joined
    const me = sent.players.find((p: any) => p.userId === 'u1');
    expect(me.characterConfig).toEqual(cfg);
  });

  it('defaults characterConfig to null when absent or invalid', () => {
    const ws = { send: vi.fn() } as any;
    (room as any).handlePlayerJoin(ws, { userId: 'u2', username: 'Bob' });
    expect((room as any).state.players.get(ws).characterConfig).toBeNull();

    const ws2 = { send: vi.fn() } as any;
    (room as any).handlePlayerJoin(
      ws2,
      { userId: 'u3', username: 'Cara' },
      { bodyShape: 'triangle' }
    );
    expect((room as any).state.players.get(ws2).characterConfig).toBeNull();
  });
```

- [ ] **Step 2: Run, verify fail**

Run: `cd backend && bun x vitest run src/rooms/RaidRoom.test.ts`
Expected: FAIL — `characterConfig` undefined on stored player / not in broadcast.

- [ ] **Step 3: Implement** — in `backend/src/rooms/RaidRoom.ts`:

(a) Import the validator (top of file, after existing imports):

```ts
import { parseCharacterConfig, type CharacterConfig } from '../core/character';
```

(b) Extend `PlayerState` (line ~9):

```ts
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
```

(c) Pass the config from the `join` message (the `webSocketMessage` `case 'join'`, line ~217). Identity still comes from `creds`; only the cosmetic config comes from the body:

```ts
      case 'join': {
        const creds = this.wsCredentials.get(ws);
        if (!creds) return;
        const characterConfig = parseCharacterConfig(data.characterConfig);
        this.handlePlayerJoin(ws, creds, characterConfig);
        break;
      }
```

(d) Update `handlePlayerJoin` signature + player object (line ~241):

```ts
  handlePlayerJoin(
    ws: WebSocket,
    data: { userId: string; username: string },
    characterConfig: CharacterConfig | null = null
  ) {
    if (this.state.phase !== 'lobby') {
      return;
    }
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
      characterConfig,
    };
    this.state.players.set(ws, player);
```

(e) Include it in `broadcastRoomState` player mapping (line ~631):

```ts
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
```

(f) Include it in the `player_joined` broadcast (line ~268):

```ts
    this.broadcast({
      type: 'player_joined',
      userId: data.userId,
      username: data.username,
      characterConfig,
    });
```

- [ ] **Step 4: Run, verify pass**

Run: `cd backend && bun x vitest run src/rooms/RaidRoom.test.ts`
Expected: PASS (new + existing cases; existing 2-arg `handlePlayerJoin` calls still work because the 3rd arg defaults to `null`).

- [ ] **Step 5: Typecheck + full backend tests**

Run: `cd backend && bunx tsc --noEmit && bun test`
Expected: 0 type errors; all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/rooms/RaidRoom.ts backend/src/rooms/RaidRoom.test.ts
git commit -m "feat(raid): carry player characterConfig through join + presence broadcasts"
```

---

## Task 4: Frontend raid socket/state — characterConfig field

**Files:**
- Modify: `frontend/src/hooks/useRaidSocket.ts` (RaidPlayer + message types)
- Modify: `frontend/src/hooks/useRaidState.ts` (player_joined reducer)
- Test: `frontend/src/hooks/useRaidState.test.ts`

- [ ] **Step 1: Write failing test** — append to `frontend/src/hooks/useRaidState.test.ts` (follow the file's existing import of `applyRaidMessage`, `initialRaidState`):

```ts
  it('carries characterConfig from room_state players', () => {
    const cfg = {
      bodyShape: 'round',
      bodyColor: '#38bdf8',
      eyeStyle: 'wide',
      accessory: 'crown',
      accessoryColor: '#fde047',
    };
    const next = applyRaidMessage(
      initialRaidState,
      {
        type: 'room_state',
        phase: 'lobby',
        players: [
          {
            userId: 'u1',
            username: 'Alice',
            hp: 100,
            maxHp: 100,
            isHost: true,
            isAlive: true,
            wordsTyped: 0,
            wordsCorrect: 0,
            damageDealt: 0,
            characterConfig: cfg,
          },
        ],
        bossHp: 100,
        bossMaxHp: 100,
      } as never,
      'u1'
    );
    expect(next.players[0].characterConfig).toEqual(cfg);
  });

  it('carries characterConfig on incremental player_joined', () => {
    const cfg = {
      bodyShape: 'square',
      bodyColor: '#f472b6',
      eyeStyle: 'sleepy',
      accessory: 'none',
      accessoryColor: '#f8fafc',
    };
    const next = applyRaidMessage(
      initialRaidState,
      { type: 'player_joined', userId: 'u9', username: 'Zed', characterConfig: cfg } as never,
      'u1'
    );
    expect(next.players.find(p => p.userId === 'u9')?.characterConfig).toEqual(cfg);
  });
```

(If these assertions reference fields not present in the message-type union, that is expected — the next steps add them. Use `as never` casts as shown so the test compiles before implementation.)

- [ ] **Step 2: Run, verify fail**

Run: `cd frontend && bun x vitest run src/hooks/useRaidState.test.ts`
Expected: FAIL — `characterConfig` missing on joined player (undefined).

- [ ] **Step 3: Implement** — in `frontend/src/hooks/useRaidSocket.ts`:

(a) Import the type and extend `RaidPlayer` (line ~9):

```ts
import type { PlayerAvatarConfig } from '../utils/avatarConfig';

export type RaidPlayer = {
  userId: string;
  username: string;
  hp: number;
  maxHp: number;
  isHost: boolean;
  isAlive: boolean;
  wordsTyped: number;
  wordsCorrect: number;
  damageDealt: number;
  characterConfig?: PlayerAvatarConfig | null;
};
```

(b) Extend the `player_joined` message variant in `RaidServerMessage` (line ~65):

```ts
  | {
      type: 'player_joined';
      userId: string;
      username: string;
      characterConfig?: PlayerAvatarConfig | null;
    }
```

(`room_state` already uses `players: RaidPlayer[]`, so it inherits the new field automatically.)

(c) In `frontend/src/hooks/useRaidState.ts`, the `player_joined` case (line ~141) — add `characterConfig` to the constructed player:

```ts
      return {
        ...prev,
        players: [
          ...prev.players,
          {
            userId: msg.userId,
            username: msg.username,
            hp: 100,
            maxHp: 100,
            isHost: false,
            isAlive: true,
            wordsTyped: 0,
            wordsCorrect: 0,
            damageDealt: 0,
            characterConfig: msg.characterConfig ?? null,
          },
        ],
      };
```

- [ ] **Step 4: Run, verify pass**

Run: `cd frontend && bun x vitest run src/hooks/useRaidState.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `cd frontend && bunx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/hooks/useRaidSocket.ts frontend/src/hooks/useRaidState.ts frontend/src/hooks/useRaidState.test.ts
git commit -m "feat(raid): add characterConfig to RaidPlayer + raid message types"
```

---

## Task 5: Frontend character config provider + API method

**Files:**
- Modify: `frontend/src/hooks/useApi.ts` (add `updateCharacter`)
- Create: `frontend/src/context/characterContext.ts`
- Create: `frontend/src/context/CharacterProvider.tsx`
- Create: `frontend/src/hooks/useCharacter.ts`
- Modify: `frontend/src/main.tsx` (mount provider)

> No new test file here: the load/save plumbing depends on Clerk + fetch + localStorage, which the node test env can't exercise cleanly. The pure pieces it relies on (`parseStoredAvatarConfig`, `resolveAvatarConfig`) are already tested in Task 1, and the provider is covered by typecheck/build + manual QA. Mirror the existing `context/ThemeProvider.tsx` + `hooks/useThemeContext.ts` structure for consistency (read those first).

- [ ] **Step 1: Add the API method** — in `frontend/src/hooks/useApi.ts`, add inside `useApi` (after `createMe`) and export it in the returned object:

```ts
  const updateCharacter = useCallback(
    (config: import('../utils/avatarConfig').PlayerAvatarConfig) =>
      authFetch('/me/character', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      }),
    [authFetch]
  );
```

Add `updateCharacter` to the `return { ... }` object.

- [ ] **Step 2: Create the context object** — `frontend/src/context/characterContext.ts`:

```ts
import { createContext } from 'react';
import type { PlayerAvatarConfig } from '../utils/avatarConfig';

export type CharacterContextValue = {
  // The user's saved custom config, or null if they have not customized.
  config: PlayerAvatarConfig | null;
  // Persist a new config (backend if signed in, else localStorage).
  save: (config: PlayerAvatarConfig) => Promise<void>;
  // True once the initial load has settled.
  ready: boolean;
};

export const CharacterContext = createContext<CharacterContextValue | null>(
  null
);

export const CHARACTER_STORAGE_KEY = 'raid:character';
```

- [ ] **Step 3: Create the provider** — `frontend/src/context/CharacterProvider.tsx`:

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useApi } from '../hooks/useApi';
import {
  parseStoredAvatarConfig,
  type PlayerAvatarConfig,
} from '../utils/avatarConfig';
import { CharacterContext, CHARACTER_STORAGE_KEY } from './characterContext';

export function CharacterProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { getMe, updateCharacter } = useApi();
  const [config, setConfig] = useState<PlayerAvatarConfig | null>(null);
  const [ready, setReady] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || loadedRef.current) return;
    loadedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        if (isSignedIn) {
          const res = await getMe();
          if (res.ok) {
            const data = await res.json();
            const raw = data?.user?.character ?? null;
            if (!cancelled) setConfig(parseStoredAvatarConfig(raw));
          }
        } else {
          const raw = localStorage.getItem(CHARACTER_STORAGE_KEY);
          if (!cancelled) setConfig(parseStoredAvatarConfig(raw));
        }
      } catch {
        if (!cancelled) setConfig(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getMe]);

  const save = useCallback(
    async (next: PlayerAvatarConfig) => {
      setConfig(next);
      if (isSignedIn) {
        await updateCharacter(next);
      } else {
        localStorage.setItem(CHARACTER_STORAGE_KEY, JSON.stringify(next));
      }
    },
    [isSignedIn, updateCharacter]
  );

  return (
    <CharacterContext.Provider value={{ config, save, ready }}>
      {children}
    </CharacterContext.Provider>
  );
}
```

- [ ] **Step 4: Create the hook** — `frontend/src/hooks/useCharacter.ts`:

```ts
import { useContext } from 'react';
import { CharacterContext } from '../context/characterContext';

export function useCharacter() {
  const ctx = useContext(CharacterContext);
  if (!ctx) {
    throw new Error('useCharacter must be used within a CharacterProvider');
  }
  return ctx;
}
```

- [ ] **Step 5: Mount the provider** — in `frontend/src/main.tsx`, wrap inside `GameProvider`:

```tsx
import { CharacterProvider } from './context/CharacterProvider';
// ...
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
      <ThemeProvider>
        <GameProvider>
          <CharacterProvider>
            <RouterProvider router={router} />
          </CharacterProvider>
        </GameProvider>
      </ThemeProvider>
    </ClerkProvider>
```

- [ ] **Step 6: Lint/format/typecheck**

Run: `cd frontend && bun run lint && bun run format:check && bunx tsc --noEmit`
Expected: 0 errors (no new warnings; the provider file should export only the component to satisfy `react-refresh/only-export-components`).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/hooks/useApi.ts frontend/src/context/characterContext.ts \
  frontend/src/context/CharacterProvider.tsx frontend/src/hooks/useCharacter.ts frontend/src/main.tsx
git commit -m "feat(raid): add CharacterProvider (load/save custom avatar) + updateCharacter API"
```

---

## Task 6: RaidBoss3D procedural demon component

**Files:**
- Create: `frontend/src/components/RaidBoss3D.tsx`
- Create: `frontend/src/components/RaidBoss3D.test.tsx`

Model the structure on `PlayerAvatar3D.tsx`: a `<Canvas>` wrapping a model component that animates inside `useFrame`, the whole thing wrapped in `memo`. The boss is a menacing demon: large dark-red sphere/box body, two cone horns, glowing eyes, fanged mouth (small boxes), floating slightly. It is intentionally much larger than players — it fills its parent box, and in Task 7 that box is far bigger than the player boxes.

- [ ] **Step 1: Write the smoke test** — `frontend/src/components/RaidBoss3D.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

// @react-three/fiber Canvas cannot server-render in the node test env; stub it.
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children?: unknown }) => (
    <div data-boss-canvas="true">{children as never}</div>
  ),
  useFrame: () => {},
}));

import RaidBoss3D from './RaidBoss3D';

describe('RaidBoss3D', () => {
  it('renders a canvas without crashing across states', () => {
    const html = renderToString(
      <RaidBoss3D hpPercent={100} isHit={false} isDefeated={false} />
    );
    expect(html).toContain('data-boss-canvas');
  });
  it('renders when defeated', () => {
    const html = renderToString(
      <RaidBoss3D hpPercent={0} isHit isDefeated />
    );
    expect(html).toContain('data-boss-canvas');
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `cd frontend && bun x vitest run src/components/RaidBoss3D.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `frontend/src/components/RaidBoss3D.tsx`:**

```tsx
import { memo, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Group, Color, MeshPhongMaterial } from 'three';

const BODY_COLOR = new Color('#7f1d1d'); // dark blood red
const HIT_COLOR = new Color('#fca5a5');
const DEAD_COLOR = new Color('#3f3f46');
const HIT_DURATION = 200; // ms — matches RaidGame bossShake timing

interface ModelProps {
  isHit: boolean;
  isDefeated: boolean;
}

function BossModel({ isHit, isDefeated }: ModelProps) {
  const groupRef = useRef<Group>(null);
  const bodyMatRef = useRef<MeshPhongMaterial | null>(null);
  const hitTimeRef = useRef(0);

  useEffect(() => {
    if (isHit) hitTimeRef.current = Date.now();
  }, [isHit]);

  useFrame(state => {
    const g = groupRef.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const now = Date.now();

    let posY = 0;
    let rotZ = 0;
    let scale = 1;

    if (isDefeated) {
      posY = -0.6;
      rotZ = 0.5; // topple
      scale = 0.9;
    } else {
      posY = Math.sin(t * 1.5) * 0.12; // heavy idle hover
      const hEl = now - hitTimeRef.current;
      if (hitTimeRef.current > 0 && hEl < HIT_DURATION) {
        const k = 1 - hEl / HIT_DURATION;
        rotZ = Math.sin(now * 0.08) * 0.12 * k; // shudder
        scale = 1 - 0.06 * k; // flinch
      }
    }

    g.position.set(0, posY, 0);
    g.rotation.set(0, 0, rotZ);
    g.scale.setScalar(scale);

    const mat = bodyMatRef.current;
    if (mat) {
      const hEl = now - hitTimeRef.current;
      const hitting =
        !isDefeated && hitTimeRef.current > 0 && hEl < HIT_DURATION;
      if (isDefeated) {
        mat.color.copy(DEAD_COLOR);
        mat.emissive.set('#000000');
        mat.emissiveIntensity = 0;
      } else if (hitting) {
        const k = 1 - hEl / HIT_DURATION;
        mat.color.copy(BODY_COLOR).lerp(HIT_COLOR, k);
        mat.emissive.copy(HIT_COLOR);
        mat.emissiveIntensity = 0.5 * k;
      } else {
        mat.color.copy(BODY_COLOR);
        mat.emissive.set('#330000');
        mat.emissiveIntensity = 0.25;
      }
    }
  });

  const eyeColor = isDefeated ? '#52525b' : '#fde047';

  return (
    <group ref={groupRef}>
      {/* Body */}
      <mesh>
        <sphereGeometry args={[1.1, 32, 32]} />
        <meshPhongMaterial
          ref={bodyMatRef}
          color="#7f1d1d"
          shininess={30}
          specular="#552222"
        />
        {/* Eyes */}
        <mesh position={[-0.4, 0.2, 0.95]}>
          <sphereGeometry args={[0.16, 16, 16]} />
          <meshPhongMaterial
            color={eyeColor}
            emissive={eyeColor}
            emissiveIntensity={isDefeated ? 0 : 0.9}
          />
        </mesh>
        <mesh position={[0.4, 0.2, 0.95]}>
          <sphereGeometry args={[0.16, 16, 16]} />
          <meshPhongMaterial
            color={eyeColor}
            emissive={eyeColor}
            emissiveIntensity={isDefeated ? 0 : 0.9}
          />
        </mesh>
        {/* Fangs */}
        <mesh position={[-0.18, -0.45, 0.9]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.08, 0.25, 8]} />
          <meshPhongMaterial color="#f8fafc" />
        </mesh>
        <mesh position={[0.18, -0.45, 0.9]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.08, 0.25, 8]} />
          <meshPhongMaterial color="#f8fafc" />
        </mesh>
      </mesh>
      {/* Horns */}
      <mesh position={[-0.6, 1.0, 0]} rotation={[0, 0, 0.4]}>
        <coneGeometry args={[0.22, 0.7, 12]} />
        <meshPhongMaterial color="#1c1917" />
      </mesh>
      <mesh position={[0.6, 1.0, 0]} rotation={[0, 0, -0.4]}>
        <coneGeometry args={[0.22, 0.7, 12]} />
        <meshPhongMaterial color="#1c1917" />
      </mesh>
    </group>
  );
}

export interface RaidBoss3DProps {
  hpPercent: number;
  isHit?: boolean;
  isDefeated?: boolean;
}

// Self-contained boss: fills its parent box (give the parent a width/height).
function RaidBoss3D({ isHit = false, isDefeated = false }: RaidBoss3DProps) {
  return (
    <Canvas
      camera={{ position: [0, 0.3, 4.2], fov: 50 }}
      gl={{ alpha: true, antialias: true }}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.5} />
      <pointLight position={[3, 4, 5]} intensity={1} />
      <pointLight position={[-3, -2, -3]} intensity={0.3} color="#ff6666" />
      <BossModel isHit={isHit} isDefeated={isDefeated} />
    </Canvas>
  );
}

export default memo(RaidBoss3D);
```

Note: `hpPercent` is accepted in props for future use (e.g. enrage at low HP) and to keep the call-site contract stable; it is intentionally not yet read by the model. Keep it in the props type.

- [ ] **Step 4: Run, verify pass**

Run: `cd frontend && bun x vitest run src/components/RaidBoss3D.test.tsx`
Expected: PASS.

- [ ] **Step 5: Lint/format/typecheck**

Run: `cd frontend && bun run lint && bun run format:check && bunx tsc --noEmit`
Expected: 0 errors. (If lint flags the unused `hpPercent` param, prefix-destructure it as used or add an eslint-disable-next-line with a reason; prefer keeping it in the public props type regardless.)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/RaidBoss3D.tsx frontend/src/components/RaidBoss3D.test.tsx
git commit -m "feat(raid): add procedural 3D demon RaidBoss3D component"
```

---

## Task 7: RaidGame + RaidAvatar layout renovation

**Files:**
- Modify: `frontend/src/components/RaidAvatar.tsx` (add `isLocal` highlight)
- Modify: `frontend/src/components/RaidGame.tsx` (boss-top + party-row layout)
- Test: `frontend/src/components/RaidGame.test.tsx` (new)

**Layout goal:** Boss section on top (title, HP bar, big `RaidBoss3D`). Below it, a single party row containing ALL players (local + others) each as a `RaidAvatar`, with the local player highlighted (ring + "(you)"). Below that, the typing box (keep the critical-HP red ring and spectator overlay). Remove the now-redundant bottom local status strip and the local damage-popup overlay (the local player's hits now show on their avatar in the row).

- [ ] **Step 1: Add `isLocal` to RaidAvatar** — in `frontend/src/components/RaidAvatar.tsx`:

(a) Extend `Props`:

```ts
interface Props {
  player: RaidPlayer;
  config: PlayerAvatarConfig;
  lastHit: RaidHitEvent | null;
  lastWordHit: RaidWordHit | null;
  isLocal?: boolean;
}
```

(b) Destructure `isLocal = false` and apply a highlight to the outer wrapper + a "(you)" tag on the name:

```tsx
function RaidAvatar({ player, config, lastHit, lastWordHit, isLocal = false }: Props) {
```

Outer wrapper className (line ~57) — add a ring + padding when local:

```tsx
    <div
      className={`relative flex flex-col items-center w-32 rounded-lg ${
        isLocal ? 'ring-2 ring-blue-400 bg-blue-500/5 px-1 py-1' : ''
      } ${!isAlive ? 'opacity-50' : ''}`}
    >
```

Username line (line ~77):

```tsx
      <p className="mt-1 text-xs font-semibold text-gray-200 truncate max-w-full">
        {player.username}
        {isLocal && <span className="text-blue-400 text-[10px]"> (you)</span>}
      </p>
```

- [ ] **Step 2: Write the RaidGame smoke test** — `frontend/src/components/RaidGame.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

// 3D + typing internals can't server-render here; stub them.
vi.mock('./PlayerAvatar3D', () => ({ default: () => <i data-avatar="true" /> }));
vi.mock('./RaidBoss3D', () => ({ default: () => <i data-boss="true" /> }));
vi.mock('./TypingText', () => ({ default: () => <span data-typing="true" /> }));
vi.mock('../hooks/useTypingMechanics', () => ({
  useTypingMechanics: () => ({
    charStatus: [],
    typedChars: [],
    cursorPosition: 0,
    handleSpaceBar: () => {},
    handleBackspace: () => {},
    handleWordDeletion: () => {},
    handleCharacterInput: () => {},
    resetTypingState: () => {},
  }),
}));

import RaidGame from './RaidGame';
import type { RaidPlayer } from '../hooks/useRaidState';

const mk = (userId: string, username: string): RaidPlayer => ({
  userId,
  username,
  hp: 100,
  maxHp: 100,
  isHost: false,
  isAlive: true,
  wordsTyped: 0,
  wordsCorrect: 0,
  damageDealt: 0,
});

const baseProps = {
  bossHp: 100,
  bossMaxHp: 100,
  localText: 'hello world',
  isLocalAlive: true,
  lastHit: null,
  lastWordHit: null,
  onWordComplete: () => {},
  onMistake: () => {},
};

describe('RaidGame layout', () => {
  it('renders the boss and one avatar per player including the local player', () => {
    const players = [mk('me', 'Me'), mk('u2', 'Bob'), mk('u3', 'Cara')];
    const html = renderToString(
      <RaidGame {...baseProps} players={players} localUserId="me" />
    );
    expect(html).toContain('data-boss');
    expect((html.match(/data-avatar/g) ?? []).length).toBe(3);
    expect(html).toContain('Me');
    expect(html).toContain('Bob');
    expect(html).toContain('(you)');
  });

  it('still renders the boss HP readout', () => {
    const html = renderToString(
      <RaidGame {...baseProps} players={[mk('me', 'Me')]} localUserId="me" />
    );
    expect(html).toContain('100 / 100 HP');
  });
});
```

- [ ] **Step 3: Run, verify fail**

Run: `cd frontend && bun x vitest run src/components/RaidGame.test.tsx`
Expected: FAIL — current layout has no `RaidBoss3D` (no `data-boss`), and the local player is not rendered as an avatar (count/`(you)` mismatch).

- [ ] **Step 4: Rewrite RaidGame layout** — in `frontend/src/components/RaidGame.tsx`:

(a) Update imports:

```ts
import RaidAvatar from './RaidAvatar';
import RaidBoss3D from './RaidBoss3D';
import {
  resolveAvatarConfig,
  type PlayerAvatarConfig,
} from '../utils/avatarConfig';
import { hpColorClass, isCriticalHp } from '../utils/raidHp';
```

(b) Replace the `avatarConfigs` memo to resolve saved configs:

```ts
  const avatarConfigs = useMemo(() => {
    const m = new Map<string, PlayerAvatarConfig>();
    for (const p of players)
      m.set(p.userId, resolveAvatarConfig(p.userId, p.characterConfig));
    return m;
  }, [players]);
```

(c) Replace the JSX `return (...)` (lines ~137-249) with the new layout. Keep all existing hooks/handlers above it unchanged (`localPlayer`, `otherPlayers`, `localHpPercent`, `localCritical`, `bossShake`, etc. all stay). `otherPlayers` is no longer used for rendering — remove its `useMemo` (lines ~52-55) if it becomes unused to satisfy lint, OR keep if still referenced; verify with lint. The `localPopups` state + its effect (lines ~47, ~114-129) become unused after removing the local popup overlay — remove them too (and the `LocalPopup` type) to keep lint clean.

New return:

```tsx
  return (
    <div className="min-h-screen p-4 flex flex-col items-center">
      {/* Boss */}
      <div className="w-full max-w-3xl mx-auto text-center">
        <h2 className="text-xl font-bold text-red-500 mb-2 tracking-wider">
          RAID BOSS
        </h2>
        <div className="h-5 bg-gray-700 rounded overflow-hidden mb-1">
          <div
            className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-300"
            style={{ width: `${bossHpPercent}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mb-2">
          {bossHp} / {bossMaxHp} HP
        </p>
        <div
          className={`mx-auto h-56 w-56 sm:h-64 sm:w-64 ${bossShake ? 'animate-pixel-shake' : ''}`}
        >
          <RaidBoss3D
            hpPercent={bossHpPercent}
            isHit={bossShake}
            isDefeated={bossHp <= 0}
          />
        </div>
      </div>

      {/* Party row — all players, local highlighted */}
      <div className="flex flex-wrap items-end justify-center gap-6 mb-6 min-h-[160px]">
        {players.map(p => (
          <RaidAvatar
            key={p.userId}
            player={p}
            config={avatarConfigs.get(p.userId)!}
            lastHit={lastHit}
            lastWordHit={lastWordHit}
            isLocal={p.userId === localUserId}
          />
        ))}
      </div>

      {/* Local typing area */}
      <div className="relative w-full max-w-3xl mx-auto">
        <div
          ref={containerRef}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          className={`p-6 bg-gray-800 rounded-lg shadow-xl focus:outline-none ${!isLocalAlive ? 'opacity-50' : ''} ${localCritical ? 'ring-2 ring-red-500' : 'focus:ring-2 focus:ring-blue-500'}`}
        >
          <TypingText
            text={localText}
            charStatus={typingMechanics.charStatus}
            typedChars={typingMechanics.typedChars}
            cursorPosition={typingMechanics.cursorPosition}
            hasStartedTyping={hasStarted}
          />
        </div>

        {/* Spectator overlay when local is dead */}
        {!isLocalAlive && (
          <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-400 mb-1">
                SPECTATOR MODE
              </p>
              <p className="text-sm text-gray-300">Watch your team!</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
```

(d) After editing, remove any now-unused symbols flagged by lint: `localPopups`/`setLocalPopups`, the `LocalPopup` type, the local-popup `useEffect`, and `otherPlayers` if unused. Keep `localPlayer`/`localHpPercent`/`localCritical` (still used by the critical ring). The `hpColorClass` import may become unused (the bottom status strip is gone) — remove it from the import if so; `isCriticalHp` is still used for `localCritical`.

- [ ] **Step 5: Run tests, verify pass**

Run: `cd frontend && bun x vitest run src/components/RaidGame.test.tsx`
Expected: PASS.

- [ ] **Step 6: Lint/format/typecheck + full frontend tests**

Run: `cd frontend && bun run lint && bun run format:check && bunx tsc --noEmit && bun x vitest run`
Expected: 0 lint errors (no NEW warnings), 0 type errors, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/RaidGame.tsx frontend/src/components/RaidAvatar.tsx frontend/src/components/RaidGame.test.tsx
git commit -m "feat(raid): party-row battle layout with 3D boss + local self-avatar"
```

---

## Task 8: RaidView sends characterConfig + lobby resolves config

**Files:**
- Modify: `frontend/src/components/RaidView.tsx` (join message)
- Modify: `frontend/src/components/RaidLobbyScreen.tsx` (resolve config)
- Test: `frontend/src/components/RaidLobbyScreen.test.tsx` (keep green; add config case)

- [ ] **Step 1: Send config in the join message** — in `frontend/src/components/RaidView.tsx`:

(a) Import + consume the character config:

```ts
import { useCharacter } from '../hooks/useCharacter';
```

Inside `RaidView`, near the other hooks:

```ts
  const { config: characterConfig } = useCharacter();
```

(b) Update the auto-join effect (lines ~89-94) to include the config and depend on it:

```ts
  useEffect(() => {
    if (isConnected && username && localUserId && !hasJoined.current) {
      hasJoined.current = true;
      send({ type: 'join', characterConfig });
    }
  }, [isConnected, username, localUserId, send, characterConfig]);
```

(Sending `null` is fine — the server stores null and teammates fall back to the seed.)

- [ ] **Step 2: Resolve config in the lobby** — in `frontend/src/components/RaidLobbyScreen.tsx`:

(a) Update imports + props type:

```ts
import { resolveAvatarConfig } from '../utils/avatarConfig';
import type { PlayerAvatarConfig } from '../utils/avatarConfig';
import PlayerAvatar3D from './PlayerAvatar3D';

interface Props {
  roomCode: string;
  players: {
    userId: string;
    username: string;
    isHost: boolean;
    characterConfig?: PlayerAvatarConfig | null;
  }[];
  isHost: boolean;
  onStartGame: () => void;
  onLeaveRoom: () => void;
  error?: string | null;
}
```

(b) Replace the avatar render (line ~64) to use the resolver:

```tsx
                    <PlayerAvatar3D
                      config={resolveAvatarConfig(p.userId, p.characterConfig)}
                      isAlive
                      hpPercent={100}
                    />
```

(Remove the now-unused `avatarConfigFromSeed` import if it is no longer referenced.)

- [ ] **Step 3: Add a lobby test case** — append to `frontend/src/components/RaidLobbyScreen.test.tsx`:

```ts
  it('still renders one avatar per player when configs are provided', () => {
    const html = renderToString(
      <RaidLobbyScreen
        {...baseProps}
        players={[
          {
            userId: 'u1',
            username: 'Alice',
            isHost: true,
            characterConfig: {
              bodyShape: 'round',
              bodyColor: '#38bdf8',
              eyeStyle: 'wide',
              accessory: 'crown',
              accessoryColor: '#fde047',
            },
          },
          { userId: 'u2', username: 'Bob', isHost: false },
        ]}
        isHost={true}
      />
    );
    expect((html.match(/data-avatar/g) ?? []).length).toBe(2);
    expect(html).toContain('Alice');
    expect(html).toContain('Bob');
  });
```

- [ ] **Step 4: Run lobby tests, verify pass**

Run: `cd frontend && bun x vitest run src/components/RaidLobbyScreen.test.tsx`
Expected: PASS (existing + new).

- [ ] **Step 5: Lint/format/typecheck**

Run: `cd frontend && bun run lint && bun run format:check && bunx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/RaidView.tsx frontend/src/components/RaidLobbyScreen.tsx frontend/src/components/RaidLobbyScreen.test.tsx
git commit -m "feat(raid): send custom characterConfig on join; resolve it in lobby"
```

---

## Task 9: Character customizer modal + header entry button

**Files:**
- Create: `frontend/src/components/CharacterCustomizer.tsx`
- Create: `frontend/src/components/CharacterCustomizer.test.tsx`
- Modify: `frontend/src/components/Header.tsx` (add launch button + render modal)

The modal lets the player mix & match the 5 knobs with a live `PlayerAvatar3D` preview, then Save (calls `useCharacter().save`) or Cancel. Available to everyone (guests + signed-in). Editing state initializes from `useCharacter().config` if set, else `avatarConfigFromSeed` of a stable seed — for guests there is no stable userId in the header, so seed from a constant like `'preview'` for the initial unsaved state; once the user picks values, those are what get saved.

- [ ] **Step 1: Write the smoke test** — `frontend/src/components/CharacterCustomizer.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

vi.mock('./PlayerAvatar3D', () => ({ default: () => <i data-avatar="true" /> }));
vi.mock('../hooks/useCharacter', () => ({
  useCharacter: () => ({ config: null, save: async () => {}, ready: true }),
}));

import CharacterCustomizer from './CharacterCustomizer';

describe('CharacterCustomizer', () => {
  it('renders the preview, all knob group labels, and Save', () => {
    const html = renderToString(<CharacterCustomizer onClose={() => {}} />);
    expect(html).toContain('data-avatar'); // live preview
    expect(html).toContain('Body');
    expect(html).toContain('Color');
    expect(html).toContain('Eyes');
    expect(html).toContain('Accessory');
    expect(html).toContain('Save');
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `cd frontend && bun x vitest run src/components/CharacterCustomizer.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `frontend/src/components/CharacterCustomizer.tsx`:**

```tsx
import { useState } from 'react';
import { X } from 'lucide-react';
import {
  avatarConfigFromSeed,
  BODY_SHAPES,
  BODY_COLORS,
  EYE_STYLES,
  ACCESSORIES,
  ACCESSORY_COLORS,
  type PlayerAvatarConfig,
} from '../utils/avatarConfig';
import { useCharacter } from '../hooks/useCharacter';
import { useThemeContext } from '../hooks/useThemeContext';
import PlayerAvatar3D from './PlayerAvatar3D';

interface Props {
  onClose: () => void;
}

export default function CharacterCustomizer({ onClose }: Props) {
  const { config, save } = useCharacter();
  const { theme } = useThemeContext();
  const [draft, setDraft] = useState<PlayerAvatarConfig>(
    config ?? avatarConfigFromSeed('preview')
  );
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof PlayerAvatarConfig>(
    key: K,
    value: PlayerAvatarConfig[K]
  ) => setDraft(d => ({ ...d, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await save(draft);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const panel =
    theme === 'dark' ? 'bg-[#2A2C3C] text-gray-100' : 'bg-white text-gray-900';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`relative w-full max-w-md rounded-lg shadow-2xl p-6 ${panel}`}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 p-1 rounded hover:bg-gray-500/20"
        >
          <X size={18} />
        </button>
        <h2 className="text-lg font-bold mb-4">Customize Character</h2>

        <div className="mx-auto mb-4 h-40 w-40">
          <PlayerAvatar3D config={draft} isAlive hpPercent={100} />
        </div>

        <Knob label="Body">
          {BODY_SHAPES.map(s => (
            <Choice
              key={s}
              active={draft.bodyShape === s}
              onClick={() => set('bodyShape', s)}
            >
              {s}
            </Choice>
          ))}
        </Knob>

        <Knob label="Body Color">
          {BODY_COLORS.map(c => (
            <Swatch
              key={c}
              color={c}
              active={draft.bodyColor === c}
              onClick={() => set('bodyColor', c)}
            />
          ))}
        </Knob>

        <Knob label="Eyes">
          {EYE_STYLES.map(s => (
            <Choice
              key={s}
              active={draft.eyeStyle === s}
              onClick={() => set('eyeStyle', s)}
            >
              {s}
            </Choice>
          ))}
        </Knob>

        <Knob label="Accessory">
          {ACCESSORIES.map(a => (
            <Choice
              key={a}
              active={draft.accessory === a}
              onClick={() => set('accessory', a)}
            >
              {a}
            </Choice>
          ))}
        </Knob>

        <Knob label="Accessory Color">
          {ACCESSORY_COLORS.map(c => (
            <Swatch
              key={c}
              color={c}
              active={draft.accessoryColor === c}
              onClick={() => set('accessoryColor', c)}
            />
          ))}
        </Knob>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-gray-500/20 hover:bg-gray-500/30"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Knob({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70 mb-1">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Choice({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded text-sm capitalize border ${
        active
          ? 'border-blue-500 bg-blue-500/20'
          : 'border-gray-500/30 hover:bg-gray-500/10'
      }`}
    >
      {children}
    </button>
  );
}

function Swatch({
  color,
  active,
  onClick,
}: {
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={color}
      style={{ backgroundColor: color }}
      className={`h-7 w-7 rounded-full border-2 ${
        active ? 'border-blue-500 scale-110' : 'border-transparent'
      } transition-transform`}
    />
  );
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd frontend && bun x vitest run src/components/CharacterCustomizer.test.tsx`
Expected: PASS.

- [ ] **Step 5: Add the header launch button** — in `frontend/src/components/Header.tsx`:

(a) Add imports (extend the lucide import; add the modal + state):

```ts
import { Sun, Moon, User, X, UserPen } from 'lucide-react';
import CharacterCustomizer from './CharacterCustomizer';
```

(b) Add state inside the component (next to `showDialog`):

```ts
  const [showCustomizer, setShowCustomizer] = useState(false);
```

(c) Add the button in the top-right cluster (place it just before the theme-toggle `<button>` at line ~133), available to everyone:

```tsx
          <button
            onClick={() => setShowCustomizer(true)}
            className={`p-2 rounded-full transition-colors ${
              theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}
            aria-label="Customize character"
          >
            <UserPen size={20} className={theme === 'dark' ? 'text-white' : ''} />
          </button>
```

(d) Render the modal conditionally (just before the closing `</header>` or right after it, inside the fragment):

```tsx
      {showCustomizer && (
        <CharacterCustomizer onClose={() => setShowCustomizer(false)} />
      )}
```

- [ ] **Step 6: Lint/format/typecheck + full frontend tests**

Run: `cd frontend && bun run lint && bun run format:check && bunx tsc --noEmit && bun x vitest run`
Expected: 0 lint errors (no NEW warnings), 0 type errors, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/CharacterCustomizer.tsx frontend/src/components/CharacterCustomizer.test.tsx frontend/src/components/Header.tsx
git commit -m "feat(raid): add character customizer modal launched from header"
```

---

## Task 10: Full verification + PR

**Files:** none (verification + PR only).

- [ ] **Step 1: Frontend full gate (CI order)**

Run:
```bash
cd frontend && bun install && bun run lint && bun run format:check && bunx tsc --noEmit && bun x vitest run && bun run build
```
Expected: lint 0 errors (only the 3 pre-existing warnings), format clean, 0 type errors, all vitest files pass, build exits 0 (`✓ built`). Capture the test count and build line as evidence.

- [ ] **Step 2: Backend full gate**

Run:
```bash
cd backend && bun install && bunx tsc --noEmit && bun test
```
Expected: 0 type errors; all tests pass. Capture the pass/fail count.

- [ ] **Step 3: Confirm migration once more**

Run: `cd backend && bunx wrangler d1 migrations apply typing-rpg-db --local`
Expected: applied cleanly (or, if wrangler-local unavailable, confirm the `0006_*.sql` is a single `ALTER TABLE users ADD character text;`). Note the result.

- [ ] **Step 4: Push the branch**

```bash
git push -u origin dev
```

- [ ] **Step 5: Open the PR (dev → main, do NOT merge)**

```bash
gh pr create --base main --head dev --title "Raid UI renovation: party layout, 3D boss, character customizer" --body "<see body below>"
```

PR body must include:
- **Summary** of the three features (party-row battle layout with self-avatar; procedural 3D demon boss; header character customizer with backend/localStorage persistence + raid-presence propagation).
- **Gate evidence** — the captured outputs from Steps 1–3.
- **Manual-QA checklist** (live 2-player raid required):
  - [ ] Battle shows YOUR own highlighted avatar in the party row (with "(you)").
  - [ ] Boss is a 3D demon, clearly much bigger than players; emoji gone.
  - [ ] Boss hit-flash fires when players land hits; boss death animation on 0 HP.
  - [ ] Customizer opens from the top-right header button; live preview updates as knobs change.
  - [ ] Save persists across reload (signed-in: across devices; guest: same browser).
  - [ ] Teammates see each other's customized looks (and seeded look when not customized).
  - [ ] Guest custom look shows to teammates; guest with no custom look shows seeded avatar.
  - [ ] Low-HP states intact: red typing-box ring during play, avatar wobble + desaturate, death droop.
  - [ ] Cosmetic check: boss horns/eyes/fangs read as intentional.

- [ ] **Step 6: Confirm PR is open and unmerged**

Run: `gh pr view --json number,state,baseRefName,headRefName,mergeable`
Expected: state OPEN, base `main`, head `dev`, not merged.

---

## Self-Review (completed by plan author)

- **Spec coverage:** (1) battle layout incl. self-avatar → Tasks 6,7; (2) 3D boss → Tasks 6,7; (3) customizer + persistence + teammate visibility → Tasks 1–5,8,9. Guest fallback → Tasks 1,5,8. Migration → Task 2. ✓
- **Type consistency:** `PlayerAvatarConfig` (frontend) / `CharacterConfig` (backend) are structurally identical; `characterConfig` field name used consistently across `PlayerState`, `RaidPlayer`, messages, and broadcasts. `resolveAvatarConfig(userId, saved)` signature consistent at all call sites (RaidGame, RaidLobbyScreen). `parseCharacterConfig` (backend) / `parseStoredAvatarConfig` + `isValidAvatarConfig` (frontend) named distinctly per side. ✓
- **No placeholders:** every step has concrete code/commands. ✓
- **Ambiguity:** Character config travels via the WS `join` message body (not URL params) — stated explicitly. Local status strip + local popup overlay are removed (not kept) — stated explicitly. ✓
