# Stats → power — accuracy shapes loot quality

**Date:** 2026-06-04
**Status:** Approved
**Spec 4 of 4**
**Mode:** Endless (solo).

## Problem

Keystroke accuracy is captured per fight but only *displayed* — it doesn't affect
gameplay. Clean typing should be rewarded, giving every fight a "type clean for
better gear" tension on top of the existing speed/streak incentives.

## Design (locked)

**Accuracy → loot rarity (tier shift).** A run/fight's keystroke accuracy nudges the
**quality** of a drop up or down one tier. Drop **chance** is unchanged (still
variant-based: common 40% / elite 60% / rare 100%).

| Accuracy | Effect on rolled rarity |
| --- | --- |
| ≥ 98% | shift **+1** tier (e.g. rare → epic) |
| 85–98% | unchanged |
| < 85% | shift **−1** tier (e.g. epic → rare) |

Tier ladder: `common < rare < epic < legendary`. Shift is **clamped** to the ladder
ends (can't exceed legendary or drop below common). Applied **after** the existing
rarity roll in `rollWeaponDrop`, so it's a thin, table-agnostic post-step.

**Consistency → power: DEFERRED** (separate later spec — needs a live rolling signal).

## Where accuracy comes from
A drop fires on kill; that kill's `metrics.accuracy` (keystroke-level, already
computed) is the input. Pass it into `rollWeaponDrop(variant, accuracy)` (or a thin
wrapper) at the drop site.

## Edge cases
- No metrics / accuracy undefined (early frames, guest) → treat as neutral (no shift).
- Shift past ladder ends → clamp (legendary stays legendary; common stays common).
- Backend `/weapon-vault` validates unlocks against `WEAPON_IDS`; shifted rarity must
  still resolve to a **valid weapon id** in that rarity — confirm the pool has weapons
  at every rarity the shift can reach, else clamp to an available one.

## Out of scope
- Consistency→crit/damage (deferred), drop-chance changes, accuracy affecting XP or
  damage, Raid loot.

## Testing (TDD)
- Pure: rarity-shift helper — `≥98 → +1`, `<85 → −1`, mid → 0, clamp at both ends,
  neutral on undefined accuracy.
- `rollWeaponDrop(variant, accuracy)` with injected RNG: high accuracy biases toward
  higher rarity, low toward lower; chance unchanged.
- Verify every reachable rarity maps to a real weapon id (guard test, mirrors existing
  `weapons.sync.test.ts` style).

## Files (confirm exact wiring in plan)
| File | Change |
| --- | --- |
| `utils/weapons.ts` | `accuracy` param + rarity-shift post-step in `rollWeaponDrop`; clamp to available rarities |
| drop site (`hooks/useWeaponSystem.ts` / completion flow) | pass kill accuracy into the roll |
| `utils/weapons.test.ts` | shift + clamp + chance-unchanged cases |
