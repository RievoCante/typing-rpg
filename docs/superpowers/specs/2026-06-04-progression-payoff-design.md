# Progression payoff — make leveling *do* something (subtly)

**Date:** 2026-06-04
**Status:** Approved
**Spec 2 of 4**
**Mode:** Endless (solo).

## Problem

The player has a backend **level** (exponential XP curve, synced via `/me`), but
**leveling up does nothing**: no moment, no reward, no power. Typing well → XP →
level ticks → nothing changes. The loop is hollow.

## Design philosophy (locked)

Leveling is **deliberately subtle** — a progress marker, not a power lever. The
*real* power stays with moment-to-moment typing skill (streak→crit, weapons). So
leveling delivers a **celebration moment** + a **faint** mechanical tailwind.

## Changes

### 1. Level-up detection + celebration moment
Today XP is synced by `reloadPlayerStats()` (calls `/me`) after a session POST.

- Capture `level` **before** the reload; compare **after**.
- If it increased → fire a **"Level Up!"** celebration (burst + level number).
- If the new level crosses a **multiple of 5** → bigger **milestone** celebration
  showing the reward granted.
- Reuse existing SFX (`playArpeggio`) + particle/popup patterns; new lightweight
  `LevelUpToast` component.

### 2. Milestone rewards (every 5 levels)
`milestonesReached = floor(level / 5)`.

| Reward | Formula | At lvl 5 / 20 / 50 | Notes |
| --- | --- | --- | --- |
| Max HP | `+1 × milestonesReached` (uncapped) | +1 / +4 / +10 | Trivial vs base 100 HP. |
| Base damage | `min(1.0, 0.25 × milestonesReached)` | +0.25 / +1.0 (capped) / +1.0 | **Capped at +1.0** (~level 20) so it never outweighs streak/weapon power. |

These are **derived from level client-side** — no backend change. (XP/level already
persist server-side.)

### 3. Wiring the bonuses into combat
- **Max HP:** `usePlayerHealth` and `resetGameState` currently hardcode max = 100.
  Change to `100 + hpBonus(level)`. HP at run start = computed max.
- **Base damage:** `rollDamage()` adds the level damage bonus to base:
  `base = BASE_DMG + weapon.bonusDamage + levelDmgBonus(level)`. Pure helper
  `levelDmgBonus(level)` in `combatTuning.ts`, capped at +1.0.

## Edge cases
- Multi-level jumps (cross several milestones at once): celebrate the **highest**
  milestone reached; apply the final derived bonus (idempotent — it's `floor(level/5)`).
- Guest / logged-out: no persistent level → no level-ups. Feature is signed-in only.

## Out of scope
- Content unlocks, currency/shop, cosmetics beyond the level number/title.
- Backend level-curve changes.

## Testing (TDD)
- Pure helpers: `hpBonus(level)`, `levelDmgBonus(level)` — milestone boundaries
  (4→0, 5→1st tier), damage cap (level 20 = +1.0, level 50 = +1.0).
- Level-up detection: prev<new fires once; crossing a multiple of 5 flags milestone.
- `rollDamage` includes level bonus.

## Files (confirm exact wiring in plan)
| File | Change |
| --- | --- |
| `utils/combatTuning.ts` | `levelDmgBonus(level)` (capped) into `rollDamage`; `hpBonus(level)` helper |
| `hooks/usePlayerHealth.ts` + `context/GameProvider.tsx` (`resetGameState`) | max HP = 100 + hpBonus |
| `hooks/usePlayerStats.ts` / completion flow | capture prev level, detect level-up + milestone |
| `components/LevelUpToast.tsx` (new) | celebration moment |
