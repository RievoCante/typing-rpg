# Soften typo penalty — halve combo streak instead of resetting

**Date:** 2026-06-04
**Status:** Approved
**Scope:** Endless combo system (`useComboSystem`)

## Problem

Today a single typo wipes the entire combo streak to 0 (`WRONG_WORD → { streak: 0 }`),
which instantly drops crit chance from up to 75% back to 0%. This is maximally
punishing: one slip at word 40 erases all accumulated momentum. It rewards exactly
one thing — never making a mistake — and feels rage-inducing on long runs.

## Change

A typo **halves** the streak instead of zeroing it.

```
WRONG_WORD: { streak: 0 }  →  { streak: Math.floor(state.streak / 2) }
```

That's the entire mechanical change. Crit chance is derived from the streak
(`critChanceForStreak = streak × 1.5%`, capped 75%), so halving the streak halves
its crit contribution automatically — **no change to `combatTuning.ts` math**.

### Behavior

| Streak before typo | After (×0.5) | Crit before → after |
| --- | --- | --- |
| 40 | 20 | 60% → 30% |
| 10 | 5 | 15% → 7.5% |
| 3 | 1 | 4.5% → 1.5% |
| 1 | 0 | 1.5% → 0% |
| 0 | 0 | 0% → 0% |

Long flow survives a single slip; repeated errors still collapse the streak fast
(40 → 20 → 10 → 5 → 2 → 1 → 0).

## Unchanged

- `RESET` still zeros the streak — used for run restart / new session, not typos.
- `CORRECT_WORD` (+1) and `BONUS` (clamped surge) cases are untouched.
- All crit/damage math in `combatTuning.ts` is untouched.

## Edge cases

- `floor(1 / 2) = 0` and `floor(0 / 2) = 0` — a typo at streak 0 or 1 lands at 0
  with no special-casing or clamp required.

## Files

| File | Change |
| --- | --- |
| `frontend/src/hooks/useComboSystem.ts` | `WRONG_WORD` case → halve; fix stale comment (lines ~42–45). |
| `frontend/src/utils/combatTuning.ts` | Fix stale comment only (line ~45: "resets the streak to 0"). |
| `frontend/src/hooks/useComboSystem.test.ts` | Replace "WRONG_WORD resets to 0" expectation; add halving cases. |

## Testing (TDD)

1. Failing test: `WRONG_WORD` at streak 40 → 20; at streak 1 → 0.
2. Change the reducer case.
3. Update stale comments.
4. Run frontend test suite — expect green.

## Out of scope

- Consistency / accuracy as a crit factor (deferred — separate feature).
- Any change to crit ramp rate, caps, or weapon modifiers.
