# Difficulty XP Multiplier + Badge (Endless mode)

**Date:** 2026-06-01
**Branch:** feature/difficulty-xp-multiplier (off `dev`)
**Scope:** Endless mode only. Daily and Raid untouched.

## Problem

The endless difficulty selector (Beginner 200 / Common 1k / Intermediate 5k / Advanced 10k)
only swaps the word list — it has **no** effect on XP. Harder lists earn the same XP as
Beginner, yet rarer/longer words lower your WPM, which *reduces* XP today. Players have no
incentive or signal to pick harder lists.

## Solution

Introduce a real per-difficulty XP multiplier and surface it as a badge in the selector.

### Multiplier values (aggressive curve)

| Difficulty        | Multiplier | Badge |
|-------------------|-----------|-------|
| beginner (200)    | 1.0×      | `1×`   |
| common (1k)       | 1.5×      | `1.5×` |
| intermediate (5k) | 2.0×      | `2×`   |
| advanced (10k)    | 3.0×      | `3×`   |

Single source of truth, mirrored frontend↔backend like the existing XP-sync rule.

### Formula change (endless only)

- Today: `floor(base × wpmMult)`
- New:   `floor(base × difficultyMult × wpmMult)`

Daily keeps `floor(base × wpmMult)` (a new `useDifficultyMultiplier` flag in `MODE_CONFIG`,
mirroring the existing `useStepPenalties` flag, gates this so daily is unaffected even if a
difficulty value is somehow passed).

### Data flow

The backend doesn't currently know the chosen difficulty. End-to-end wiring:

1. `TypingInterface` already has `endlessDifficulty` → pass it into `useCompletionHandler`.
2. `useCompletionHandler` passes it to `EndlessCompletionHandler.handleCompletion(stats, difficulty)`.
3. Handler adds `difficulty` to the `SessionPayload` and to the `calculateEndlessXp(...)` preview.
4. `useApi.createSession` body type gains optional `difficulty`.
5. Backend `sessionSchema` gains **optional** `difficulty` enum; missing/invalid → defaults to
   `beginner` (1×), so existing Daily submissions (which send no difficulty) are unchanged.
6. Backend `calculateXpDelta(mode, incorrectWords, wpm, difficulty?)` applies the multiplier.

Server-authoritative: the badge/preview is cosmetic; the server recomputes XP from the
submitted difficulty.

### Badge UI (`DifficultyDropdown.tsx`)

- Small pill on **each dropdown row** and on the **closed button** (current multiplier always visible).
- Tiered, theme-aware colors: `1×` gray · `1.5×` green · `2×` blue · `3×` gold.
- New `DIFFICULTY_MULTIPLIER_LABEL` map + per-difficulty color-class map (dark/light variants).

## Files changed

**Backend**
- `core/xp.ts` — `EndlessDifficulty` type, `DIFFICULTY_XP_MULTIPLIER` map, `useDifficultyMultiplier`
  flag, new `difficulty` param on `calculateXpDelta`.
- `handlers/sessions.ts` — optional `difficulty` in zod schema; pass to `calculateXpDelta`.
- `core/xp.test.ts` — per-difficulty XP assertions.

**Frontend**
- `utils/calculateXP.ts` — `DIFFICULTY_XP_MULTIPLIER` (mirror), `difficulty` param on `calculateEndlessXp`.
- `types/completion.ts` — `difficulty?` on `SessionPayload`.
- `hooks/useApi.ts` — `difficulty?` on `createSession` body type.
- `handlers/EndlessCompletionHandler.ts` — thread difficulty into payload + preview.
- `hooks/useCompletionHandler.ts` — accept `endlessDifficulty`, pass to endless handler.
- `components/TypingInterface.tsx` — pass `endlessDifficulty` into `useCompletionHandler`.
- `components/DifficultyDropdown.tsx` — badge labels + tiered colors on rows and button.
- `utils/calculateXP.test.ts` — per-difficulty XP assertions (mirror of backend).

## Testing

- Backend `xp.test.ts` + frontend `calculateXP.test.ts`: each difficulty yields the right XP
  (e.g. advanced @ 60 WPM, 0 errors = `floor(100 × 3 × 1.0)` = 300), and the mirrors agree.
- Daily regression: existing daily tests stay green (no multiplier applied).
- CI: frontend lint → format:check → typecheck → test → build; backend typecheck → test.

## Out of scope

- Endless combat rebalance (separate S559 potion/boss work).
- Any Daily or Raid reward changes.
