# Combat juice — make hits, crits, and kills *feel* good

**Date:** 2026-06-04
**Status:** Approved (scope to confirm on review)
**Spec 1 of 4** (combat-juice → progression-payoff → battle-report → stats-to-power)
**Mode:** Endless (solo). Raid out of scope.

## Problem

The combat *mechanics* exist (streak→crit, weapons, variants) but the *feedback*
is thin, so good hits don't land emotionally:

- **No screen shake anywhere.**
- Only **crits** show a popup (`CRIT N!`); normal hits are silent; **no kill popup**.
- Crit SFX is **constant** — no escalation as the streak climbs.
- ComboMeter shifts color but has **no glow/pulse**.

What already works (don't rebuild): monster red-flash on hit, death particle burst,
player hurt-recoil.

## Goal

Make the moment-to-moment loop punchy. This is the foundation the other three
specs build on — a great-feeling fight makes loot, levels, and reports matter more.

## Changes

### 1. Screen shake (the big gap)
A new `useScreenShake()` hook driving a CSS transform on the gameplay container
at `App.tsx:190` (`<div className="relative z-10">` — wraps monster + typing area,
excludes the background so the backdrop stays still).

- **Crit:** short shake, intensity scaled by damage (bigger crit = bigger shake).
- **Kill:** a stronger one-shot shake on monster defeat.
- Implementation: ref + transient `translate`/`rotate` via `transform`, decaying
  over ~120–200ms with `requestAnimationFrame`. Respect `prefers-reduced-motion`
  (no shake when set).

### 2. SFX escalation by streak tier
`sfxEngine.ts` today plays a constant `playCrit()`. Tie pitch/intensity to the
existing combo tiers (the ones ComboMeter already names): **Combo → Heating → Hot
→ BLAZING** (derived from crit chance: 0 / >0 / mid / ≥0.75). Higher tier = higher
pitch / extra layer, so a hot streak *sounds* hotter. Same for hit SFX.

### 3. Kill + hit feedback popups
`TypingPopups.tsx` / `useCombatPopups.ts`:
- Add a **kill popup** on monster defeat (e.g. `DEFEATED` / variant-colored for
  elite/rare).
- Crit popup **scales with damage** (bigger number = bigger/brighter text).
- (Optional, confirm on review) a tiny non-crit hit tick so normal hits aren't silent.

### 4. ComboMeter glow/pulse
`ComboMeter.tsx`: at **Hot/BLAZING** tiers, add a pulsing glow (box-shadow/animation)
so a high streak is visually loud, not just a color change.

## Out of scope
- Streak→crit math (unchanged), Raid juice, new particle systems beyond what exists.

## Testing
- Unit: `useScreenShake` decay math (pure, injectable clock); tier→SFX mapping
  function; grade/popup selection helpers are pure and testable.
- Manual: crit shakes, kill shakes harder, BLAZING streak glows + higher-pitched
  crit SFX, reduced-motion disables shake.

## Files (confirm exact wiring in plan)
| File | Change |
| --- | --- |
| `hooks/useScreenShake.ts` (new) | shake state + RAF decay, reduced-motion guard |
| `App.tsx:190` | attach shake ref/transform to gameplay container; fire on crit/kill |
| `utils/sfxEngine.ts` | streak-tier param on crit/hit sounds |
| `components/TypingPopups.tsx`, `hooks/useCombatPopups.ts` | kill popup, damage-scaled crit popup |
| `components/ComboMeter.tsx` | glow/pulse at Hot/BLAZING |
