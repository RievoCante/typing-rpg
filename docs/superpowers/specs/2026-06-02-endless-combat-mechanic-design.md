# Endless Combat Mechanic Rework — Design Spec (Phase 1)

**Date:** 2026-06-02
**Status:** Approved (brainstorm), pending implementation plan
**Scope:** Endless mode only. Daily (3 fixed quotes) and Raid (server-authoritative) are **out of scope** and unchanged.

## Background / Roadmap

This is **Phase 1 of 3** in the larger combat/weapon initiative:

1. **Phase 1 — Combat mechanic rework (this spec):** continuous word stream, fixed monster HP, combo-based crit damage, remove the player-chosen word count.
2. **Phase 2 — Monster variation:** more monster types/families with distinct HP + attack + look (builds on the fixed-HP model here).
3. **Phase 3 — Weapons + loot drops:** monsters drop weapons; weapons become damage modifiers on top of this mechanic; compact potion UI + weapon inventory UI.

Phases 2–3 are intentionally deferred and get their own spec → plan → build cycles.

## Problem

Today in Endless, *the remaining-words pool **is** the monster's HP* (`HealthBar.tsx:14` → `remainingWords / totalWords`). One correct word = 1 word drained; the monster dies when the player's chosen block of words (`[10,25,50,100]`, default 25) runs out. Consequences:

- Typing **speed and accuracy don't affect combat** moment-to-moment — only the end-of-session XP multiplier.
- Any future **damage modifier is meaningless**, because the player picks the word count and finishing it always kills the monster.

## Goals

- Make the core skill (fast, accurate typing) **drive combat directly**, per word.
- Decouple monster HP from the words typed, so damage is a real quantity.
- Add a **combo crit system** that rewards sustained flawless typing.
- Remove the player-chosen word count; words become a continuous stream.
- Lay clean foundations for Phase 2 (per-monster stats) and Phase 3 (weapon damage modifiers).

## Non-Goals

- No weapons, loot drops, or inventory (Phase 3).
- No new monster types/art (Phase 2).
- No changes to Daily or Raid.
- No backend/schema changes (the mechanic is client-side; session XP accounting is preserved, not redesigned).
- Compact potion UI is **not** part of Phase 1.

## Design Overview

Three coupled changes in Endless:

### 1. Fixed monster HP (decoupled from words)

- Each monster spawns with a fixed `maxHp` by tier:
  | Tier | maxHp |
  |---|---|
  | normal | 24 |
  | mini-boss | 48 |
  | boss | 90 |
- New state `monsterHp` (current) + `monsterMaxHp`. Health bar renders `monsterHp / monsterMaxHp * 100`.
- Monster is **defeated when `monsterHp <= 0`**, replacing the `remainingWords <= 0` check.
- Tier→HP lives in a single config (co-located with the existing `SLIME_CONFIGS` / `GOLEM_CONFIGS` tier data or a new `monsterCombat` config) so Phase 2 can extend it.

### 2. Continuous word stream

- Words are no longer a fixed per-monster block. The typing surface shows a **long text block** (e.g. ~50 words) that the player types through continuously.
- **Monster lifecycle is independent of the text block.** When a monster dies mid-block, the next monster spawns (visual swap + fresh HP) **without regenerating or resetting the text** the player is typing.
- When the player nears the **end of the current text block**, a fresh block is generated and appended/swapped so the stream never "runs out." (Exact buffering strategy — append vs. swap-at-boundary — is an implementation detail for the plan; the requirement is: typing never stops for lack of words, and a monster death never interrupts the typed text.)
- The player-chosen word count is **removed** (see §4).

### 3. Combo crit damage

- Track `streak` = consecutive correct words.
- **Crit chance:** `critChance = min(0.75, streak * 0.015)`
  - First crit possible at streak 1; **caps at 75% at streak 50**.
  - Reference points: streak 5 → 7.5%, 10 → 15%, 20 → 30%, 33 → ~50%, 50+ → 75%.
- **On each correct word:** roll `random() < critChance`.
  - Crit → `damage = BASE_DMG * CRIT_MULT` = `1 * 2` = **2**.
  - Non-crit → `damage = BASE_DMG` = **1**.
  - Subtract `damage` from `monsterHp`.
  - Increment `streak`.
- **On each wrong word** (a word that locks with one or more incorrect characters): `streak = 0` (crit chance returns to 0). The word deals normal non-crit damage or is simply not counted as a hit — see Open Question Q1.
- **Streak persists across monster kills** (it is the player's typing flow, not tied to a monster). It resets to 0 only on a wrong word or on run reset (player death / restart).
- Constants (`BASE_DMG`, `CRIT_MULT`, ramp `0.015`, cap `0.75`, tier HP) live in one combat-tuning module for easy balancing and Phase-3 weapon multipliers.

### Expected balance (crit ×2)

EV (expected damage/word) = `1 + critChance`. With monster HP 24/48/90:

| Monster | HP | cold (~1.0) | warmed (~1.5) | blazing (~1.75) |
|---|---|---|---|---|
| Normal | 24 | ~24 words | ~16 | ~14 |
| Mini-boss | 48 | ~48 | ~32 | ~27 |
| Boss | 90 | ~90 | ~60 | ~51 |

A "cold" normal monster ≈ today's default (25 words); combos accelerate kills; bosses are a genuine grind.

### 4. Remove word-count selector

- Remove the Endless word-count setting UI, the `[10,25,50,100]` options, and the `endless_word_count` / `WORD_COUNT_KEY` localStorage key (`useEndlessSettings.ts`).
- The **difficulty selector stays** (it still drives which word list feeds the stream).
- `generateText(...)` is still used to produce stream blocks, just no longer with a player-chosen count — it uses a fixed internal block size.

## UI Changes (Endless)

- **Monster HP bar:** repurpose the existing `HealthBar` to read `monsterHp / monsterMaxHp` instead of `remainingWords / totalWords`.
- **Combo meter (new):** a small element near the typing area showing the current streak and tier — `🔥 Heating / Hot / Blazing ×N` with a fill bar reflecting `critChance`. Labels: streak ≥1 "Heating", crit ≥40% "Hot", crit = 75% "Blazing" (exact thresholds tunable).
- **Damage popups:** floating per-word numbers; crits render larger/pink with "CRIT!", reusing the existing window-event + popup architecture (`usePotionPopups` / `TypingPopups` / `sfxEngine` pattern). A crit may play a distinct SFX cue.

## Data Flow

1. Player types a word → `handleWordCompleted` (Endless) determines correct vs. wrong (locked status / `analyzeWords`).
2. Correct → update streak, roll crit, compute damage, `damageMonster(damage)`, dispatch `combat-hit` event (`{ damage, crit }`) for popup/SFX; also still call `registerCorrectWord()` for potion drops.
3. Wrong → `streak = 0`, dispatch nothing (or a `combo-break` event for UI — Open Question Q2).
4. `damageMonster` decrements `monsterHp`; an effect detects `monsterHp <= 0` → defeat animation → spawn next monster (new tier via existing `pickMonsterType`, new HP, **text untouched**).
5. Stream buffer tops up when the typed text nears its end.
6. On player death, `EndlessCompletionHandler` runs as today, sourced from continuous-stream session stats (words typed, correct/incorrect, WPM).

## Components / Units

- `combatTuning.ts` (new) — all constants: tier HP map, `BASE_DMG`, `CRIT_MULT`, ramp, cap; pure helpers `critChanceForStreak(streak)`, `rollDamage(streak, rng)`. **Unit-tested.**
- `useComboSystem.ts` (new) — owns `streak`, exposes `registerCorrectWord()`/`registerWrongWord()`/`reset()` and derived `critChance`; mirrors the `usePotionSystem` shape. **Unit-tested.**
- Monster HP state — added to `GameProvider` / `GameContext` (`monsterHp`, `monsterMaxHp`, `damageMonster`, defeat detection updated).
- Continuous stream — changes in `TypingInterface` text-generation effect so monster death no longer triggers `restartSession`/`setRestartKey` for the text; text regenerates only on buffer exhaustion.
- `ComboMeter.tsx` (new) — presentational, reads streak/critChance.
- Combat-hit popups — extend the existing popup hook/component family.
- Remove word-count UI + `useEndlessSettings` word-count slice.

## Error / Edge Handling

- **Cold start:** streak 0 → first monster slower; acceptable and intended.
- **Crit cap:** clamp at 0.75; streak may grow unbounded but crit chance is clamped.
- **RNG:** crit roll uses a single injectable RNG so tests are deterministic.
- **Run reset (death/restart):** reset `streak`, `monsterHp`, stream buffer, monster tier progression, potion state — consistent with existing `resetGameState`.
- **Multiple monster deaths within one text block:** supported — text is independent of monsters.
- **Wrong word then fix before lock:** if the player corrects before space-lock, the word is correct and the streak is preserved (matches existing locked-word semantics).

## Testing Strategy

- `combatTuning.test.ts`: `critChanceForStreak` curve (0, 5, 20, 33, 50, 100), clamp at 0.75, `rollDamage` returns base/crit for forced RNG.
- `useComboSystem.test.ts`: streak increments on correct, resets to 0 on wrong, persists across "monster kill" (no reset call), `reset()` clears.
- Monster HP: defeat fires at `monsterHp <= 0`; health-bar percentage math.
- Regression: Endless session still records correct/incorrect/WPM and awards XP on death; potion drops still fire per correct word; Daily/Raid untouched.
- Run frontend CI: `bun run lint && bun run format:check && bunx tsc --noEmit && bun run test`.

## Open Questions (resolve during planning)

- **Q1 — Wrong-word damage:** does a wrong word still deal 1 non-crit damage (it was "typed"), or deal **0** (no hit, pure penalty)? *Proposed: 0 damage — a mistake should sting.*
- **Q2 — Combo-break feedback:** show a "combo broken" flash/SFX on reset? *Proposed: subtle flash + soft SFX, low priority.*
- **Q3 — Block size / buffering:** fixed ~50-word blocks swapped at boundary, vs. true append streaming. *Proposed: ~50-word block, regenerate when the cursor passes a threshold near the end.*
- **Q4 — Combo meter thresholds/labels:** exact crit% cutoffs for Heating/Hot/Blazing.
- **Q5 — XP impact:** confirm Endless XP (WPM × correct/incorrect words) needs no rebalance now that sessions can run longer/continuously. *Proposed: no change in Phase 1; revisit if sessions inflate XP.*
