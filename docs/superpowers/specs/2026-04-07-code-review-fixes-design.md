# Code Review Fixes Design
Date: 2026-04-07

## Context
Five critical/important issues were identified in a code review of the typing-rpg codebase. This spec covers the design for all five fixes.

---

## Fix 1 — Daily Session Loss (Silent Fire-and-Forget)

**Problem:** `DailyCompletionHandler.createSession` is called as fire-and-forget. If it fails, the user sees "+XP" and the congrats modal, but localStorage marks the day done so they can't retry. Nothing is saved.

**Design:**
- `DailyCompletionHandler.handleCompletion()` becomes `async` and `await`s `createSession`
- On success: commit localStorage (mark day complete), pass `xpDelta` from server response back to caller
- On failure: throw or return an error result — do NOT commit localStorage
- `TypingInterface` receives the error and renders an error state in the congrats modal (or a banner above it) with a "Retry" button that re-calls the handler
- The congrats modal must support an `error` + `onRetry` prop to show the error state

**Endless mode:** Keep 3 silent retries with exponential backoff (no UX change — a failed endless save is low-stakes).

---

## Fix 2 — Duplicate XP Calculation

**Problem:** `frontend/src/utils/calculateXP.ts` is a verbatim copy of `backend/src/core/xp.ts`. It's untracked in git and will silently drift.

**Design:**
- Since Fix 1 makes us `await createSession`, we can consume `xpDelta` from the server's session response directly
- Remove the call to `calculateXpDelta` in both completion handlers
- Delete `frontend/src/utils/calculateXP.ts`
- Both handlers return the server-provided `xpDelta` to `TypingInterface` for the XP popup

---

## Fix 3 — Daily Quote Consistency (Timezone + Replay)

**Problem:** Quote is selected by `dayOfWeek % quotes.length` client-side. Users near midnight on different UTC offsets see different quotes. Only 7 unique quotes per difficulty. Replay possible via clock manipulation.

**Design (client-side PRNG seeded by UTC date):**
- Change `getDayOfWeekIndex()` to return the UTC date string `YYYY-MM-DD`
- Use a simple deterministic PRNG (mulberry32 or similar, ~10 lines) seeded by a numeric hash of the date string
- Use the PRNG to select quote indices instead of `dayOfWeek % length`
- All users on the same UTC date see the same quotes; ~365 unique combinations per year
- No new API endpoint, no loading state, no extra complexity

This does not fix the replay-via-clock-manipulation vector — that's deferred as a future server-side concern.

---

## Fix 4 — CORS Origin Restriction

**Problem:** `cors()` with no args allows `Access-Control-Allow-Origin: *`.

**Design:**
- Change to `cors({ origin: ['https://typingrpg.com', 'http://localhost:5173'] })`
- Production origin: `https://typingrpg.com`
- Dev origin: `http://localhost:5173` (Vite default)

---

## Fix 5 — Leaderboard SQL Aggregation

**Problem:** `getTodayDailyWpmLeaderboard` fetches all of today's sessions into Worker memory, deduplicates via JS Map, sorts in JS, then slices. Will OOM as user count grows.

**Design:**
- Replace with a single Drizzle query using `max(sessions.wpm)` + `groupBy(sessions.userId)` + `orderBy(desc(...))` + `limit(10)`
- Join to `users` table for `username` and `level` in the same query
- Remove the JS Map deduplication and sort entirely
- Fix the `as any` type casts on timestamp comparisons using Drizzle's `sql` helper or proper column types

---

## Files Affected

| File | Change |
|------|--------|
| `frontend/src/handlers/DailyCompletionHandler.ts` | Await save, return server xpDelta, throw on error |
| `frontend/src/handlers/EndlessCompletionHandler.ts` | Silent retry, return server xpDelta |
| `frontend/src/utils/calculateXP.ts` | **Delete** |
| `frontend/src/utils/textGenerator.ts` | PRNG-seeded quote selection by UTC date |
| `frontend/src/components/CongratsModal.tsx` | Add error + onRetry prop |
| `frontend/src/components/TypingInterface.tsx` | Handle completion error, pass retry handler |
| `backend/src/index.ts` | Restrict CORS origin |
| `backend/src/handlers/leaderboard.ts` | SQL GROUP BY aggregation |
