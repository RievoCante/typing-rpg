# Endless Rebalance — Potion Inventory Patch

**Date:** 2026-06-01
**Mode affected:** Endless only (Daily/Raid untouched)
**Status:** Approved design — pending implementation plan

## Problem

Endless difficulty is inverted and discontinuous. Players report 10-word sessions are
trivially easy while 25/50/100-word sessions are brutal. Root cause is that **healing
and damage run on two different clocks that don't scale together**:

| Lever | Scales with | Current constants |
|---|---|---|
| Damage to player | **Time** (continuous) | normal 3HP/6s · mini-boss 5/5s · boss 7/4s (0.5–1.75 HP/s) |
| Player attack | **Words typed** | 1 correct word = 1 monster HP |
| Potion drop | **Monster defeated** (= full word count) | 30% chance on kill, heal 25–50 |
| Player HP | fixed | 100 |

In Endless you fight successive monsters, each requiring your chosen word count to kill.
A potion only rolls when a monster dies, so heal frequency is inversely tied to word
count: a 10-word monster (~10s) rolls a potion fast; a 100-word monster (~120s) lets the
time-based damage clock kill you long before the single potion roll. Random, ungated
monster types (a boss can spawn on word 1 of a long run) add large unfair variance.

## Design intent

Word count is a **difficulty ladder**: 10 = easy → 100 = hard, on a *smooth, fair* curve.
Higher tiers should be harder because fights are longer (more sustained pressure), not
because healing becomes mathematically impossible or a random boss one-shots the run.

This patch fixes the economy and fairness. A separate **weapon system** (looted gear with
damage ranges and passives, decoupling monster HP from word count) is planned next and
will build on the corrected numbers here.

## Solution

Decouple heal cadence from monster size by moving potion drops onto a **word clock**, give
the player agency over *when* to heal via a stacking inventory, and gate monster types by
run progress so fresh runs start safe.

### 1. Potion inventory (Endless only)

- **Drop trigger:** after every **5th correct word** (locked words only — mistakes don't
  count), roll a **15% drop chance** (starting value, playtest-tunable via a single
  constant).
- **Stacking:** a successful drop adds 1 potion to the slot, **capped at 3**. At cap, no
  drop occurs (no roll wasted on logic, simply no add).
- **Use:** `Ctrl+H` (with `preventDefault`) **or** click the slot → consume 1 potion, heal
  a random **25–50** HP (rolled at use time), capped at `MAX_PLAYER_HEALTH` (100).
- **No-op at full HP:** if the player is at full HP, using a potion does nothing and does
  **not** consume one (don't waste it).
- **Lifetime:** potions persist across monsters within a single run; the inventory
  **resets to 0 on death / restart** (`resetGameState`). Not persisted to localStorage or
  the backend — cross-session persistence is reserved for the weapon system.
- **Replaces** the old 30%-on-kill potion roll entirely, so there is one unified heal
  economy.

### 2. Potion slot UI

- Positioned to the **right of the typing text box**.
- Shows 3 slots (filled/empty states) with a potion icon and current count.
- Displays a `Ctrl+H` hint.
- **Clickable** to use a potion (mouse path equivalent to the keyboard shortcut).
- Responsive: collapses to a compact count badge on narrow screens so it never crowds the
  typing area.

### 3. Boss-spawn gating (per-run ramp)

Replace random monster-type selection with progress-based selection keyed off monsters
defeated **in the current run**:

| Monsters defeated this run | Monster type |
|---|---|
| 0–2 | normal |
| 3–6 | normal, occasional mini-boss |
| 7+ | mini-boss / boss mix |

Fresh runs always start safe; DPS pressure ramps as the player survives longer. Word count
continues to set monster HP (= fight length = the difficulty ladder); this gating supplies
the *fairness* by removing the random-boss coin-flip.

### 4. Numbers

Keep existing HP, periodic damage, and attack intervals. Only the mechanics above change.

**Survivability sanity check** (≈50 WPM ≈ 0.83 words/s):
- 100-word monster, early run (normal, 0.5 HP/s over ~120s ≈ 60 damage): ~20 drop rolls at
  15% ≈ 3 potions, ~37 HP avg each ≈ 110 HP healing available → comfortable.
- 100-word monster, late run (boss, 1.75 HP/s over ~120s ≈ 210 damage) vs ~110 HP healing →
  razor-thin, survivable only with high accuracy (fewer mistakes) and speed (less exposure).
  This is the intended hard-but-fair top of the ladder.
- 10-word monster: ~2 drop rolls per kill, fast clears, minimal damage → easy, as intended.

The cap of 3 interacts well with manual use: spending a potion when low frees a slot, so a
skilled player effectively banks more than 3 across a long fight without ever being able to
hoard invincibility.

## Components and boundaries

| Unit | Responsibility | Change |
|---|---|---|
| `usePotionSystem` | Owns potion inventory: count, drop logic, use logic, cap, heal roll | Rework from on-kill drop to inventory + 5-correct-word drop trigger |
| `GameProvider` | Holds potion count + correct-word counter in run state; exposes add/use; clears on reset | Add state + actions |
| typing-mechanics hook | On each newly-locked correct word, advance the correct-word counter and fire the drop check | Wire counter → drop check |
| `PotionSlot` (new) | Renders 3 slots, count, Ctrl+H hint; click-to-use | New component |
| `TypingInterface` | Lays out the slot to the right of the text box; responsive collapse | Layout change |
| Global key handler | `Ctrl+H` → use potion (Endless, live session only); `preventDefault` | New handler |
| Monster spawn logic | Choose monster type from run-progress table instead of random | Replace selection |

## Out of scope (this patch)

- Weapon system / loot (next feature).
- Cross-session persistence of potions or any progression.
- Changes to Daily and Raid modes.
- Changes to base HP/DPS/interval constants beyond the new drop chance.

## Testing requirements

- Potion drops only on correct (locked) words, exactly on every 5th, at the configured
  chance; mistakes never trigger drops.
- Inventory caps at 3; no add at cap.
- Use heals 25–50 capped at 100; is a no-op (no consume) at full HP; no-op at 0 potions.
- `Ctrl+H` uses a potion and is prevented from opening browser history; click does the same.
- Inventory resets to 0 on death/restart.
- Monster type follows the progress table (0–2 normal, etc.), not randomness.
- Potion system is inert in Daily/Raid.
