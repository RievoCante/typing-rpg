# Battle Report — end-of-run recap that surfaces the stats

**Date:** 2026-06-04
**Status:** Approved
**Spec 3 of 4**
**Mode:** Endless (solo).

## Problem

We capture rich per-test metrics (per-second WPM/raw/err `chart_data`, keystroke
accuracy, consistency, char breakdown) but the result UI shows almost none of it —
only speed title, WPM, accuracy, XP, per kill. There's no satisfying payoff moment
for a run, and the data is invisible.

## Design (locked)

- **Per kill:** keep today's **light** `KillResultOverlay` (WPM, accuracy, XP, crit
  popup). Unchanged — don't interrupt Endless flow.
- **On death (run end):** show a **full Battle Report** once. This is the recap moment.

Run-end signal already exists: `isPlayerDead` (from `usePlayerHealth`), surfaced via
`DeathPopup` at `App.tsx:245`. The Battle Report replaces/augments that screen.

## Battle Report contents

1. **Per-second graph** — WPM + raw + error markers across the **whole run** (the
   monkeytype-style line). See "Run accumulation" below.
2. **Grade** (S/A/B/C/D) — from keystroke accuracy:
   `S ≥98 · A ≥95 · B ≥90 · C ≥80 · D <80`.
3. **Run summary:** monsters defeated, total XP earned, best WPM, total crits,
   average consistency, run duration.
4. **Loot:** weapons dropped this run.

## Run accumulation (must build)

`useSessionMetrics` finalizes/reset **per monster kill** — there's no run-level
timeline or counters today. The continuous run graph + summary need a new
**`useRunMetrics()`** hook that survives across kills and resets in `resetGameState`:

- Accumulate per-second samples across the whole run (append each fight's samples
  to a continuous run timeline) for the graph.
- Tally **crit count** (today crit rolls exist in `useComboSystem` but are never
  counted), **total XP this run**, **best WPM**, **monsters defeated** (already in
  `monstersDefeated`), **run elapsed seconds**, **weapons looted**.
- Reset alongside other run state in `resetGameState` (GameProvider).

## Out of scope
- Per-kill graph, Daily/Raid reports (Raid already has its own result screen),
  persisting run reports to backend / history (later), PB trend lines (later).

## Testing
- Pure: `grade(accuracy)` thresholds; run-metric reducers (append samples, tally
  crits, track best WPM) tested directly like other reducers in this codebase.
- Component: Battle Report renders all fields from a fixture run-metrics object;
  graph renders from a sample timeline.
- Manual: die after several kills → report shows continuous graph + correct grade,
  crit count, monsters, XP, loot.

## Files (confirm exact wiring in plan)
| File | Change |
| --- | --- |
| `hooks/useRunMetrics.ts` (new) | run-level accumulation (samples, crits, XP, best WPM, loot, elapsed) |
| `context/GameProvider.tsx` | own run metrics; reset in `resetGameState`; tally crits on each roll |
| `components/BattleReport.tsx` (new) | the recap UI (graph + grade + summary + loot) |
| `App.tsx:245` (`DeathPopup`) | render Battle Report on death |
| `utils/grade.ts` (new) | pure `grade(accuracy)` helper |
