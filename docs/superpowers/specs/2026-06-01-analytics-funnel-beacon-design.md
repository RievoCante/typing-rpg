# Analytics Funnel Beacon — Design

**Date:** 2026-06-01
**Status:** Approved (design)
**Branch:** `feature/analytics-funnel-beacon`

## Goal

Answer the open distribution question: do our ~100 visitors/mo actually get into the
game, play it, and come back? Today the only signal is Cloudflare Web Analytics, which
records every visit as path `/` (the app is a single route with mode switching done in
React state) and **cannot** capture custom events (confirmed: Cloudflare Web Analytics
FAQ — "Does Web Analytics support custom events? Not yet").

We instrument the funnel **without a new vendor** using a hybrid approach:

- **New beacon** for the two signals we can't see today: `reached_game`, `started_typing`.
- **Derived** from existing D1 data for the rest: finished-battle counts and 7-day return.

## Non-goals (YAGNI)

- No Workers Analytics Engine (overkill at this scale; can't be tested locally).
- No admin metrics endpoint or dashboard — metrics are ad-hoc SQL for now.
- No consent banner / cookie — the anon id is a random UUID in `localStorage`, no PII.
- No change to XP (`calculateXP.ts` / `xp.ts`) or wordlist sync invariants.

## Architecture

### 1. D1 table `analyticsEvents` (Drizzle schema + migration)

| column | type | notes |
|---|---|---|
| `id` | integer PK autoincrement | |
| `event` | text not null | `'reached_game'` \| `'started_typing'` |
| `anonId` | text not null | client-generated, persistent across visits |
| `userId` | text nullable | Clerk id if signed in (best-effort, analytics-grade) |
| `mode` | text nullable | `'daily'` \| `'endless'` \| `'raid'` |
| `createdAt` | integer (unix ts) default now | |

Index `idx_analytics_events` on `(event, createdAt)`.

Schema lives in `backend/src/db/schema.ts` alongside `users` / `gameSessions`.
Migration generated with `bun run db:gen` (drizzle-kit), output to `backend/drizzle/`.

### 2. Backend route `POST /api/events` (new `backend/src/handlers/events.ts`)

- **Public** — the one deliberate deviation from `/api/sessions`: it is mounted
  **without `authMiddleware`**, because anonymous visitors are exactly who we need to
  measure. It keeps the IP `limiter` middleware.
- Registered in `backend/src/index.ts` as `app.post("/events", limiter, recordEvent);`
  (placed with the other route registrations).
- Body validated with Zod: `{ event: 'reached_game'|'started_typing', anonId: string (1..64),
  mode?: 'daily'|'endless'|'raid', userId?: string }`.
- Best-effort auth: if a Clerk session is present (`getAuth(c)?.userId`), prefer that for
  `userId`; otherwise fall back to the client-supplied `userId` (unverified, analytics only).
- Inserts one row via `c.get("db")`. Returns `204 No Content`. Insert failures are
  swallowed server-side (best-effort) and never surface a 5xx to the beacon.

### 3. Frontend `getAnonId()` util (new `frontend/src/utils/anonId.ts`)

Reads/creates a UUID in `localStorage['trpg_anon_id']`. Pure, synchronous, SSR-safe guard
(`typeof localStorage`). Returns the id. This is the join key for any future
anonymous-return analysis.

### 4. Frontend `trackEvent()` util (new `frontend/src/utils/trackEvent.ts`)

- Signature: `trackEvent(event: 'reached_game'|'started_typing', mode: 'daily'|'endless'|'raid')`.
- Fire-and-forget `fetch` to `${import.meta.env.VITE_API_URL}/api/events`, `keepalive: true`,
  swallows all errors (analytics must never break gameplay).
- Sends `{ event, anonId: getAnonId(), mode }`. If a Clerk token/userId is available it is
  included; the util reads it via an injected getter so the util itself stays
  framework-light (the calling component passes the signed-in userId, or `undefined`).
- **In-memory dedup guard**: a module-level `Set` keyed by `${event}:${mode}` prevents
  duplicate sends within a single page-load. This is what stops Endless's many quote-loads
  from inflating `reached_game`. The guard resets naturally on full page reload.

### 5. Wiring (4 fire points)

| Signal | Component | Trigger |
|---|---|---|
| `reached_game` (daily/endless) | `TypingInterface.tsx` | text-loaded effect (`text.length > 0`) |
| `started_typing` (daily/endless) | `TypingInterface.tsx` | first keystroke (`hasStartedTyping` false→true) |
| `reached_game` (raid) | `RaidGame.tsx` | phase `playing` with `localText.length > 0` |
| `started_typing` (raid) | `RaidGame.tsx` | first keystroke (`hasStarted` false→true) |

`mode` is sourced from existing game context (daily/endless) or hard-coded `'raid'` in
`RaidGame`. The dedup guard makes these calls idempotent per page-load.

### 6. Derived metrics — no event code (committed `docs/analytics/funnel-queries.md`)

Ready-to-run `wrangler d1 execute typing-rpg-db --remote --command "..."` SQL:

- **funnel**: distinct `anonId` for `reached_game` vs `started_typing` (last 30d), by mode.
- **finished-battle**: counts over existing `gameSessions` by mode/day.
- **7-day return (signed-in)**: users with `gameSessions` on ≥2 distinct UTC days within a
  7-day window.
- **top-of-funnel note**: compare `reached_game` distinct-anonId count against the Cloudflare
  Web Analytics pageview total (read from the CF dashboard) — that ratio is the
  homepage→game conversion the handoff flagged as currently invisible.

## Data flow

```
visitor lands (Cloudflare RUM counts pageview as "/")
   │
   ├─ enters a battle screen ─────────► trackEvent('reached_game', mode) ─┐
   │                                                                       │  POST /api/events
   ├─ first keystroke ───────────────► trackEvent('started_typing', mode)─┤  (public, IP-limited)
   │                                                                       ▼
   └─ completes battle ──────────────► existing POST /api/sessions ──► gameSessions (D1)
                                                                        analyticsEvents (D1)
                                                                        │
                                                          ad-hoc SQL ◄──┘  (funnel + return queries)
```

## Error handling

- Beacon is fire-and-forget with `keepalive`; network/validation/insert failures are
  silently ignored client- and server-side. No retry (cf. EndlessCompletionHandler's
  retry is for XP-bearing session saves; analytics is not XP-bearing).
- Public endpoint abuse is bounded by the existing IP rate limiter; at ~100 visits/mo the
  blast radius is negligible. Bot inflation is acceptable and visible (distinct-anonId
  dampens it).

## Testing (CI order: install → lint → format:check → typecheck → test → build)

- **Backend** (`bun test`): `recordEvent` handler — valid anonymous insert, valid
  signed-in insert (Clerk userId wins over body userId), Zod rejection of bad `event`/missing
  `anonId`, and that a DB insert error still returns 204.
- **Frontend** (`bun test`): `getAnonId` persistence (creates once, returns same id);
  `trackEvent` dedup guard (second identical call within a page-load does not re-fetch);
  fetch failure is swallowed.

## Files touched

**Backend**
- `backend/src/db/schema.ts` — add `analyticsEvents` table + index.
- `backend/drizzle/<generated>.sql` — new migration.
- `backend/src/handlers/events.ts` — new `recordEvent` handler.
- `backend/src/index.ts` — register `POST /events` (no authMiddleware).
- `backend/src/handlers/events.test.ts` — handler tests.

**Frontend**
- `frontend/src/utils/anonId.ts` — new.
- `frontend/src/utils/trackEvent.ts` — new.
- `frontend/src/utils/anonId.test.ts`, `frontend/src/utils/trackEvent.test.ts` — new.
- `frontend/src/components/TypingInterface.tsx` — fire reached_game / started_typing.
- `frontend/src/components/RaidGame.tsx` — fire reached_game / started_typing (raid).

**Docs**
- `docs/analytics/funnel-queries.md` — derived-metric SQL.
