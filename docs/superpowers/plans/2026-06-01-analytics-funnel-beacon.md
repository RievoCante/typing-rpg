# Analytics Funnel Beacon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Instrument a homepage→game funnel using a public Cloudflare Worker beacon (`reached_game` + `started_typing` events into D1) and ship ready-to-run SQL to derive finished-battle and 7-day-return from existing data.

**Architecture:** A new public `POST /api/events` route (no `authMiddleware`, keeps IP `limiter`) inserts rows into a new D1 `analytics_events` table. A tiny frontend `trackEvent` util (fire-and-forget fetch with per-page-load dedup) is called from `TypingInterface` (daily/endless) and `RaidGame` (raid) at screen-load and first-keystroke. Signed-in/finished/return metrics are derived from the existing `gameSessions` table via committed SQL — no new event code.

**Tech Stack:** Hono + Cloudflare Workers + Drizzle + D1 (backend, vitest); React 19 + Vite (frontend, vitest); Bun everywhere.

**Spec:** `docs/superpowers/specs/2026-06-01-analytics-funnel-beacon-design.md`

**Conventions:**
- Run backend scripts from `backend/`, frontend scripts from `frontend/`, via `bun run <script>`.
- Backend CI order: install → typecheck → test. Frontend CI order: install → lint → format:check → typecheck → test → build.
- Commit after each task. Branch is already the feature worktree.

---

### Task 1: Add `analytics_events` table to the Drizzle schema

**Files:**
- Modify: `backend/src/db/schema.ts` (append new table; reuse existing `sqliteTable`, `text`, `integer`, `index`, `sql` imports already present for `gameSessions`)

- [ ] **Step 1: Append the table definition**

Add at the end of `backend/src/db/schema.ts` (mirror the `gameSessions` column/timestamp style already in the file):

```typescript
export const analyticsEvents = sqliteTable(
  'analytics_events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    event: text('event', { enum: ['reached_game', 'started_typing'] }).notNull(),
    anonId: text('anon_id').notNull(),
    userId: text('user_id'),
    mode: text('mode', { enum: ['daily', 'endless', 'raid'] }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .default(sql`(strftime('%s', 'now'))`)
      .notNull(),
  },
  (table) => ({
    eventCreatedIdx: index('idx_analytics_events').on(table.event, table.createdAt),
  }),
);
```

> If `sql` is not already imported in this file, add `import { sql } from 'drizzle-orm';` (it is used by `gameSessions.createdAt`, so it should already be present — verify before adding a duplicate).

- [ ] **Step 2: Typecheck**

Run (from `backend/`): `bun run typecheck`
Expected: PASS (no type errors).

- [ ] **Step 3: Generate the migration**

Run (from `backend/`): `bun run db:gen`
Expected: a new `NNNN_*.sql` file appears in `backend/drizzle/` containing `CREATE TABLE \`analytics_events\`` and `CREATE INDEX \`idx_analytics_events\``. Confirm with `git status backend/drizzle/`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/db/schema.ts backend/drizzle/
git commit -m "feat(analytics): add analytics_events table + migration"
```

---

### Task 2: Event-body validation schema (TDD — pure unit)

**Files:**
- Create: `backend/src/handlers/events.ts`
- Test: `backend/src/handlers/events.test.ts`

This isolates the validatable logic (a Zod schema) so it can be unit-tested in the repo's established pure-unit style (cf. `backend/src/core/guestIdentity.test.ts`). The Hono handler in Task 3 reuses it.

- [ ] **Step 1: Write the failing test**

Create `backend/src/handlers/events.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { eventSchema } from './events';

describe('eventSchema', () => {
  it('accepts a valid anonymous reached_game event', () => {
    const r = eventSchema.safeParse({ event: 'reached_game', anonId: 'abc-123', mode: 'daily' });
    expect(r.success).toBe(true);
  });

  it('accepts started_typing without a mode', () => {
    const r = eventSchema.safeParse({ event: 'started_typing', anonId: 'abc-123' });
    expect(r.success).toBe(true);
  });

  it('rejects an unknown event name', () => {
    const r = eventSchema.safeParse({ event: 'finished', anonId: 'abc-123' });
    expect(r.success).toBe(false);
  });

  it('rejects a missing anonId', () => {
    const r = eventSchema.safeParse({ event: 'reached_game' });
    expect(r.success).toBe(false);
  });

  it('rejects an over-long anonId', () => {
    const r = eventSchema.safeParse({ event: 'reached_game', anonId: 'x'.repeat(65) });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test — verify it fails**

Run (from `backend/`): `bun run test -- events`
Expected: FAIL — `events.ts` / `eventSchema` does not exist yet.

- [ ] **Step 3: Write the minimal schema**

Create `backend/src/handlers/events.ts`:

```typescript
import { z } from 'zod';

export const eventSchema = z.object({
  event: z.enum(['reached_game', 'started_typing']),
  anonId: z.string().min(1).max(64),
  mode: z.enum(['daily', 'endless', 'raid']).optional(),
});

export type EventBody = z.infer<typeof eventSchema>;
```

> `zod` is already a backend dependency (used by `sessions.ts`). Confirm the import style matches `sessions.ts`.

- [ ] **Step 4: Run the test — verify it passes**

Run (from `backend/`): `bun run test -- events`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/handlers/events.ts backend/src/handlers/events.test.ts
git commit -m "feat(analytics): event-body validation schema with tests"
```

---

### Task 3: `recordEvent` handler + public route

**Files:**
- Modify: `backend/src/handlers/events.ts` (add the handler beneath the schema)
- Modify: `backend/src/index.ts` (register the route — no `authMiddleware`)

- [ ] **Step 1: Add the handler to `events.ts`**

Append to `backend/src/handlers/events.ts` (mirror imports from `backend/src/handlers/sessions.ts` — `AppContext` from `../core/types`, `getAuth` from `@hono/clerk-auth`, `analyticsEvents` from `../db/schema`):

```typescript
import { getAuth } from '@hono/clerk-auth';
import type { AppContext } from '../core/types';
import { analyticsEvents } from '../db/schema';

export const recordEvent = async (c: AppContext) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.body(null, 204); // analytics is best-effort; never error the beacon
  }

  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) return c.body(null, 204);

  // Opportunistic: if a Clerk token rode along, capture the userId. Anonymous → null.
  const userId = getAuth(c)?.userId ?? null;

  try {
    const db = c.get('db');
    await db.insert(analyticsEvents).values({
      event: parsed.data.event,
      anonId: parsed.data.anonId,
      mode: parsed.data.mode ?? null,
      userId,
    });
  } catch {
    // swallow — a failed analytics write must not surface to the client
  }

  return c.body(null, 204);
};
```

- [ ] **Step 2: Register the public route in `index.ts`**

In `backend/src/index.ts`, add an import alongside the other handler imports:

```typescript
import { recordEvent } from './handlers/events';
```

Then register the route immediately after the `app.post("/sessions", ...)` line (around line 81), **without `authMiddleware`** so anonymous visitors are recorded — keep only `limiter`:

```typescript
app.post('/events', limiter, recordEvent);
```

> `limiter` is already imported and used by the other routes in this file. Do not add `authMiddleware` here — that is the intentional deviation from `/sessions`.

- [ ] **Step 3: Typecheck**

Run (from `backend/`): `bun run typecheck`
Expected: PASS.

- [ ] **Step 4: Run the backend test suite**

Run (from `backend/`): `bun run test`
Expected: PASS (existing suites + the 5 `eventSchema` tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/handlers/events.ts backend/src/index.ts
git commit -m "feat(analytics): public POST /api/events beacon route"
```

---

### Task 4: Frontend `getAnonId` util (TDD)

**Files:**
- Create: `frontend/src/utils/anonId.ts`
- Test: `frontend/src/utils/anonId.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/utils/anonId.test.ts` (mirror `frontend/src/utils/raidHp.test.ts` import style; frontend vitest runs under jsdom so `localStorage` exists):

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { getAnonId, ANON_ID_KEY } from './anonId';

describe('getAnonId', () => {
  beforeEach(() => localStorage.clear());

  it('creates and persists an id on first call', () => {
    const id = getAnonId();
    expect(id).toBeTruthy();
    expect(localStorage.getItem(ANON_ID_KEY)).toBe(id);
  });

  it('returns the same id on subsequent calls', () => {
    const a = getAnonId();
    const b = getAnonId();
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 2: Run the test — verify it fails**

Run (from `frontend/`): `bun run test -- anonId`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the util**

Create `frontend/src/utils/anonId.ts`:

```typescript
export const ANON_ID_KEY = 'trpg_anon_id';

export function getAnonId(): string {
  try {
    const existing = localStorage.getItem(ANON_ID_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(ANON_ID_KEY, id);
    return id;
  } catch {
    // localStorage unavailable (privacy mode) — return an ephemeral id
    return 'anon-ephemeral';
  }
}
```

- [ ] **Step 4: Run the test — verify it passes**

Run (from `frontend/`): `bun run test -- anonId`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/anonId.ts frontend/src/utils/anonId.test.ts
git commit -m "feat(analytics): persistent anon id util with tests"
```

---

### Task 5: Frontend `trackEvent` util (TDD)

**Files:**
- Create: `frontend/src/utils/trackEvent.ts`
- Test: `frontend/src/utils/trackEvent.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/utils/trackEvent.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { trackEvent, __resetTrackEventGuard } from './trackEvent';

describe('trackEvent', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetTrackEventGuard();
    vi.restoreAllMocks();
    vi.stubEnv('VITE_API_URL', 'https://api.test');
  });

  it('POSTs to /api/events with event + mode + anonId', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    trackEvent('reached_game', 'daily');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.test/api/events');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body.event).toBe('reached_game');
    expect(body.mode).toBe('daily');
    expect(body.anonId).toBeTruthy();
  });

  it('dedupes the same event+mode within a page-load', () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    trackEvent('reached_game', 'daily');
    trackEvent('reached_game', 'daily');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not dedupe different modes', () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    trackEvent('reached_game', 'daily');
    trackEvent('reached_game', 'endless');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('swallows fetch rejection without throwing', () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network'));
    vi.stubGlobal('fetch', fetchMock);

    expect(() => trackEvent('started_typing', 'raid')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the test — verify it fails**

Run (from `frontend/`): `bun run test -- trackEvent`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the util**

Create `frontend/src/utils/trackEvent.ts`:

```typescript
import { getAnonId } from './anonId';

export type AnalyticsEvent = 'reached_game' | 'started_typing';
export type AnalyticsMode = 'daily' | 'endless' | 'raid';

const sent = new Set<string>();

/** Test-only: reset the per-page-load dedup guard. */
export function __resetTrackEventGuard(): void {
  sent.clear();
}

export function trackEvent(event: AnalyticsEvent, mode: AnalyticsMode): void {
  const key = `${event}:${mode}`;
  if (sent.has(key)) return;
  sent.add(key);

  try {
    const baseUrl = import.meta.env.VITE_API_URL as string;
    if (!baseUrl) return;
    void fetch(`${baseUrl}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, anonId: getAnonId(), mode }),
      keepalive: true,
    }).catch(() => {
      // analytics is best-effort; never surface failures
    });
  } catch {
    // never throw from analytics
  }
}
```

- [ ] **Step 4: Run the test — verify it passes**

Run (from `frontend/`): `bun run test -- trackEvent`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/trackEvent.ts frontend/src/utils/trackEvent.test.ts
git commit -m "feat(analytics): fire-and-forget trackEvent util with dedup + tests"
```

---

### Task 6: Wire daily/endless events in `TypingInterface`

**Files:**
- Modify: `frontend/src/components/TypingInterface.tsx`

`currentMode` here is `'daily' | 'endless'` (raid uses a different component). The dedup guard in `trackEvent` makes these idempotent per page-load.

- [ ] **Step 1: Import the util**

Add near the other imports at the top of `TypingInterface.tsx`:

```typescript
import { trackEvent } from '../utils/trackEvent';
```

- [ ] **Step 2: Fire `reached_game` when text loads**

In the "text loaded reset" effect (the `useEffect` that begins `if (text.length === 0) return;`, ~lines 181-197), add the beacon right after the early-return guard:

```typescript
useEffect(() => {
  if (text.length === 0) return;
  trackEvent('reached_game', currentMode as 'daily' | 'endless');
  // ...existing reset logic (setHasStartedTyping(false), etc.)...
}, [text, /* ...existing deps... */]);
```

> Leave the existing dependency array as-is; `text`/`currentMode` are already in scope. Do not add `currentMode` to the deps if it triggers lint exhaustive-deps churn — instead read it inside via a ref pattern only if lint complains; otherwise add it.

- [ ] **Step 3: Fire `started_typing` on first keystroke**

At the `hasStartedTyping` flip (~lines 277-279), add the beacon:

```typescript
if (!hasStartedTyping) {
  setHasStartedTyping(true);
  performance.startSession();
  trackEvent('started_typing', currentMode as 'daily' | 'endless');
}
```

- [ ] **Step 4: Lint, format, typecheck**

Run (from `frontend/`): `bun run lint && bun run format:check && bun run typecheck`
Expected: PASS. If `format:check` fails, run `bun run format` (or the project's writer script) and re-check.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/TypingInterface.tsx
git commit -m "feat(analytics): fire reached_game + started_typing in TypingInterface"
```

---

### Task 7: Wire raid events in `RaidGame`

**Files:**
- Modify: `frontend/src/components/RaidGame.tsx`

- [ ] **Step 1: Import the util**

Add near the top imports of `RaidGame.tsx`:

```typescript
import { trackEvent } from '../utils/trackEvent';
```

- [ ] **Step 2: Fire `reached_game` when raid text is loaded/playing**

In the effect that resets on `localText` change (~lines 95-99), fire the beacon when there is text:

```typescript
useEffect(() => {
  resetTypingState();
  wordIndexRef.current = 0;
  setHasStarted(false);
  if (localText.length > 0) trackEvent('reached_game', 'raid');
}, [localText, resetTypingState]);
```

- [ ] **Step 3: Fire `started_typing` on first raid keystroke**

At the `hasStarted` flip inside `handleKeyDown` (~line 77):

```typescript
if (!hasStarted) {
  setHasStarted(true);
  trackEvent('started_typing', 'raid');
}
```

- [ ] **Step 4: Lint, format, typecheck**

Run (from `frontend/`): `bun run lint && bun run format:check && bun run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/RaidGame.tsx
git commit -m "feat(analytics): fire reached_game + started_typing in RaidGame"
```

---

### Task 8: Derived-metrics SQL doc

**Files:**
- Create: `docs/analytics/funnel-queries.md`

- [ ] **Step 1: Write the doc**

Create `docs/analytics/funnel-queries.md`:

````markdown
# Funnel & Retention Queries

Run against the production D1 (`typing-rpg-db`). Wrap each in:

```bash
bunx wrangler d1 execute typing-rpg-db --remote --command "<SQL>"
```

## Top-of-funnel (new beacon)
Distinct visitors who reached the game vs. started typing, last 30 days, by mode:

```sql
SELECT event, mode, COUNT(DISTINCT anon_id) AS visitors
FROM analytics_events
WHERE created_at >= strftime('%s','now') - 30*24*3600
GROUP BY event, mode
ORDER BY event, mode;
```

> Compare `reached_game` distinct visitors against the Cloudflare Web Analytics
> pageview total (CF dashboard) — that ratio is the homepage→game conversion that
> was invisible before this beacon. Note: distinct `anon_id` here vs distinct
> `user_id` in `gameSessions` below means the funnel ratio is approximate (anon
> visitors never create sessions), which is expected and fine at this scale.

## Finished-battle (existing data)
Completed battles per mode per UTC day, last 30 days:

```sql
SELECT mode, DATE(created_at,'unixepoch') AS day, COUNT(*) AS finishes
FROM game_sessions
WHERE created_at >= strftime('%s','now') - 30*24*3600
GROUP BY mode, day
ORDER BY day DESC, mode;
```

## 7-day return (signed-in)
Users active on >= 2 distinct UTC days within any rolling 7-day window (proxy:
distinct active days in the last 7 days, users with >= 2):

```sql
SELECT user_id, COUNT(DISTINCT DATE(created_at,'unixepoch')) AS active_days
FROM game_sessions
WHERE created_at >= strftime('%s','now') - 7*24*3600
GROUP BY user_id
HAVING active_days >= 2
ORDER BY active_days DESC;
```

Count of returning users (single number):

```sql
SELECT COUNT(*) AS returning_users FROM (
  SELECT user_id
  FROM game_sessions
  WHERE created_at >= strftime('%s','now') - 7*24*3600
  GROUP BY user_id
  HAVING COUNT(DISTINCT DATE(created_at,'unixepoch')) >= 2
);
```
````

- [ ] **Step 2: Commit**

```bash
git add docs/analytics/funnel-queries.md
git commit -m "docs(analytics): funnel + retention SQL queries"
```

---

### Task 9: Full verification sweep

**Files:** none (verification only)

- [ ] **Step 1: Backend CI order**

Run (from `backend/`): `bun install && bun run typecheck && bun run test`
Expected: all PASS.

- [ ] **Step 2: Frontend CI order**

Run (from `frontend/`): `bun install && bun run lint && bun run format:check && bun run typecheck && bun run test && bun run build`
Expected: all PASS; `build` produces `dist/` with no errors.

- [ ] **Step 3: Record results**

State plainly which commands passed and paste any failing output. Do not claim success without the green output in hand.

---

## Self-Review Notes

- **Spec coverage:** table (Task 1) ✓, public route (Task 3) ✓, anonId (Task 4) ✓, trackEvent + dedup (Task 5) ✓, 4 fire points (Tasks 6-7) ✓, derived SQL (Task 8) ✓, backend+frontend tests (Tasks 2,4,5) ✓, verification (Task 9) ✓.
- **No-authMiddleware deviation** is called out explicitly in Task 3 Step 2.
- **Naming consistency:** `eventSchema`, `recordEvent`, `getAnonId`/`ANON_ID_KEY`, `trackEvent`/`__resetTrackEventGuard`, `analyticsEvents` table — used identically across tasks.
- **Not tested by design:** component render/integration tests for the 4 fire points (no established component-test harness in repo; covered by util tests + Task 9 build + manual smoke). Handler HTTP-level test omitted for the same reason — validation logic is unit-tested via `eventSchema`.
- **Manual smoke (post-merge, optional):** run frontend+backend locally, enter a battle, confirm a `POST /api/events` 204 in the network tab and a row via the Task 8 funnel query.
