# Battle Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a full end-of-run "Battle Report" recap (continuous per-second graph, grade, run summary, loot) once on player death, backed by a pure run-level metrics reducer that accumulates across kills and resets on restart.

**Architecture:** A new pure reducer (`runMetricsReducer`) accumulates per-second samples, crit count, total XP, best WPM, monsters defeated, run elapsed seconds, and looted weapons across an entire Endless run; a thin `useRunMetrics()` hook wraps it with `useReducer`. `GameProvider` owns the hook, wraps `registerComboCorrect` to tally crits on each roll, feeds fight samples / XP / loot in, and resets it inside `resetGameState`. On death (`isPlayerDead`), `App.tsx` renders `<BattleReport>` (replacing `DeathPopup`), which renders a pure-data-driven inline SVG graph plus grade/summary/loot computed by pure helpers.

**Tech Stack:** React 19, Vite, TypeScript, Tailwind, vitest

---

## Constraints (read before starting)

- **No `@testing-library/react`, no jsdom.** Test PURE functions/reducers only. NEVER use `renderHook` or render components in tests. Mirror `src/hooks/useComboSystem.test.ts` and `src/hooks/useRaidState.test.ts` (pure-reducer style).
- **Frontend dir (all commands run here):** `/Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend`
- **Run a single test file:** `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bun run test src/<path>.test.ts`
- **`bun run test` = `vitest run`.** Test glob: `src/**/*.test.ts`, `src/**/*.test.tsx`. No setup file, no DOM.
- **After editing any source, run `bun run format` before committing** (CI runs `format:check`).
- **Final gate (all must pass):** `cd <frontend> && bun run lint && bun run format:check && bunx tsc -b && bun run test`. Typecheck is `bunx tsc -b` (NOT `tsc --noEmit`).
- **Commit message footer (every commit):** `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- Every task leaves the app compiling and the suite green.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `frontend/src/utils/grade.ts` (new) | Pure `grade(accuracy)` → `'S'\|'A'\|'B'\|'C'\|'D'`. |
| `frontend/src/utils/grade.test.ts` (new) | Threshold tests for `grade`. |
| `frontend/src/hooks/useRunMetrics.ts` (new) | Pure `runMetricsReducer` + `RunMetricsState`/`RunMetricsAction` types + `initialRunMetrics` + `useRunMetrics()` hook. |
| `frontend/src/hooks/useRunMetrics.test.ts` (new) | Pure tests for `runMetricsReducer` (append samples, tally crits, best WPM, XP, loot dedupe, reset). |
| `frontend/src/utils/battleReportData.ts` (new) | Pure graph-data-prep `buildGraphSeries(chartData, width, height)` → SVG polyline points + axis info. |
| `frontend/src/utils/battleReportData.test.ts` (new) | Pure tests for `buildGraphSeries`. |
| `frontend/src/components/BattleReport.tsx` (new) | Recap UI: inline SVG graph + grade + run summary + loot list. No DOM-render tests. |
| `frontend/src/context/GameProvider.tsx` (edit) | Own `useRunMetrics`; wrap `registerComboCorrect` to tally crits; feed fight samples / XP / loot; reset in `resetGameState`; expose run metrics + setters on context. |
| `frontend/src/context/GameContext.ts` (edit) | Add run-metrics fields + setters to the context type and default value. |
| `frontend/src/components/TypingInterface.tsx` (edit) | Forward each finished fight's `chartData` to the run accumulator. |
| `frontend/src/App.tsx` (edit) | Route per-kill XP into run metrics; render `<BattleReport>` instead of `<DeathPopup>` on death. |

---

## Task 1: Pure `grade(accuracy)` helper

**Files:**
- Source: `frontend/src/utils/grade.ts` (new)
- Test: `frontend/src/utils/grade.test.ts` (new)

Thresholds (locked): `S ≥98 · A ≥95 · B ≥90 · C ≥80 · D <80`. Accuracy is the 0–100 keystroke accuracy from `SessionMetrics.accuracy`.

- [ ] Write failing test `frontend/src/utils/grade.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { grade } from './grade';

describe('grade', () => {
  it('returns S at >= 98', () => {
    expect(grade(100)).toBe('S');
    expect(grade(98)).toBe('S');
  });

  it('returns A at >= 95 and < 98', () => {
    expect(grade(97)).toBe('A');
    expect(grade(95)).toBe('A');
  });

  it('returns B at >= 90 and < 95', () => {
    expect(grade(94)).toBe('B');
    expect(grade(90)).toBe('B');
  });

  it('returns C at >= 80 and < 90', () => {
    expect(grade(89)).toBe('C');
    expect(grade(80)).toBe('C');
  });

  it('returns D below 80', () => {
    expect(grade(79)).toBe('D');
    expect(grade(0)).toBe('D');
  });

  it('clamps out-of-range input', () => {
    expect(grade(150)).toBe('S');
    expect(grade(-5)).toBe('D');
  });
});
```
- [ ] Run (expect FAIL — file does not exist): `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bun run test src/utils/grade.test.ts`
- [ ] Implement `frontend/src/utils/grade.ts`:
```ts
// Letter grade from keystroke accuracy (0–100). Battle Report only.
// Locked thresholds: S ≥98 · A ≥95 · B ≥90 · C ≥80 · D <80.
export type Grade = 'S' | 'A' | 'B' | 'C' | 'D';

export function grade(accuracy: number): Grade {
  const a = Math.max(0, Math.min(100, accuracy));
  if (a >= 98) return 'S';
  if (a >= 95) return 'A';
  if (a >= 90) return 'B';
  if (a >= 80) return 'C';
  return 'D';
}
```
- [ ] Run (expect PASS): `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bun run test src/utils/grade.test.ts`
- [ ] Format: `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bun run format`
- [ ] Commit:
```
git add frontend/src/utils/grade.ts frontend/src/utils/grade.test.ts
git commit -m "feat(battle-report): pure grade(accuracy) helper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Pure `runMetricsReducer` + `useRunMetrics` hook

**Files:**
- Source: `frontend/src/hooks/useRunMetrics.ts` (new)
- Test: `frontend/src/hooks/useRunMetrics.test.ts` (new)

Existing shapes to reuse (do NOT redefine):
- `ChartData` (`{ wpm: number[]; raw: number[]; err: number[] }`) from `frontend/src/types/completion.ts`.
- `Weapon` (`{ id; name; rarity; bonusDamage; bonusCritChance; critMultBonus }`) from `frontend/src/utils/weapons.ts`.
- `consistency(samples: number[])` from `frontend/src/utils/consistency.ts` (used later by the component, not the reducer).

Reducer contract:
- `APPEND_FIGHT { chart: ChartData }` — concatenates the fight's `wpm`/`raw`/`err` arrays onto the run timeline (continuous run graph) and updates `bestWpm` to the max single sample seen across the whole run.
- `TALLY_CRIT` — `critCount + 1` (called once per crit roll).
- `ADD_XP { amount }` — `totalXp + amount` (ignores non-positive).
- `INC_MONSTER` — `monstersDefeated + 1`.
- `ADD_SECONDS { seconds }` — `elapsedSeconds + seconds` (accumulated run duration; ignores non-positive).
- `LOOT { weapon }` — appends to `loot`, **deduped by weapon `id`** (same drop can't double-count if an effect re-fires).
- `RESET` — back to `initialRunMetrics`.

- [ ] Write failing test `frontend/src/hooks/useRunMetrics.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  runMetricsReducer,
  initialRunMetrics,
  type RunMetricsState,
} from './useRunMetrics';
import type { ChartData } from '../types/completion';
import type { Weapon } from '../utils/weapons';

const fight = (wpm: number[], raw: number[], err: number[]): ChartData => ({
  wpm,
  raw,
  err,
});

const weapon = (id: string): Weapon => ({
  id,
  name: id,
  rarity: 'common',
  bonusDamage: 0,
  bonusCritChance: 0,
  critMultBonus: 0,
});

describe('runMetricsReducer', () => {
  it('starts empty', () => {
    const s = initialRunMetrics;
    expect(s.chart).toEqual({ wpm: [], raw: [], err: [] });
    expect(s.critCount).toBe(0);
    expect(s.totalXp).toBe(0);
    expect(s.monstersDefeated).toBe(0);
    expect(s.bestWpm).toBe(0);
    expect(s.elapsedSeconds).toBe(0);
    expect(s.loot).toEqual([]);
  });

  it('APPEND_FIGHT concatenates samples into one continuous timeline', () => {
    let s: RunMetricsState = initialRunMetrics;
    s = runMetricsReducer(s, {
      type: 'APPEND_FIGHT',
      chart: fight([40, 50], [42, 55], [0, 1]),
    });
    s = runMetricsReducer(s, {
      type: 'APPEND_FIGHT',
      chart: fight([60], [62], [0]),
    });
    expect(s.chart.wpm).toEqual([40, 50, 60]);
    expect(s.chart.raw).toEqual([42, 55, 62]);
    expect(s.chart.err).toEqual([0, 1, 0]);
  });

  it('APPEND_FIGHT tracks best single-sample WPM across the run', () => {
    let s: RunMetricsState = initialRunMetrics;
    s = runMetricsReducer(s, {
      type: 'APPEND_FIGHT',
      chart: fight([40, 70], [40, 70], [0, 0]),
    });
    s = runMetricsReducer(s, {
      type: 'APPEND_FIGHT',
      chart: fight([55], [55], [0]),
    });
    expect(s.bestWpm).toBe(70);
  });

  it('TALLY_CRIT increments crit count', () => {
    let s: RunMetricsState = initialRunMetrics;
    s = runMetricsReducer(s, { type: 'TALLY_CRIT' });
    s = runMetricsReducer(s, { type: 'TALLY_CRIT' });
    expect(s.critCount).toBe(2);
  });

  it('ADD_XP accumulates and ignores non-positive', () => {
    let s: RunMetricsState = initialRunMetrics;
    s = runMetricsReducer(s, { type: 'ADD_XP', amount: 30 });
    s = runMetricsReducer(s, { type: 'ADD_XP', amount: 0 });
    s = runMetricsReducer(s, { type: 'ADD_XP', amount: -5 });
    s = runMetricsReducer(s, { type: 'ADD_XP', amount: 12 });
    expect(s.totalXp).toBe(42);
  });

  it('INC_MONSTER counts kills', () => {
    let s: RunMetricsState = initialRunMetrics;
    s = runMetricsReducer(s, { type: 'INC_MONSTER' });
    s = runMetricsReducer(s, { type: 'INC_MONSTER' });
    s = runMetricsReducer(s, { type: 'INC_MONSTER' });
    expect(s.monstersDefeated).toBe(3);
  });

  it('ADD_SECONDS accumulates run duration', () => {
    let s: RunMetricsState = initialRunMetrics;
    s = runMetricsReducer(s, { type: 'ADD_SECONDS', seconds: 18 });
    s = runMetricsReducer(s, { type: 'ADD_SECONDS', seconds: 7 });
    expect(s.elapsedSeconds).toBe(25);
  });

  it('LOOT appends weapons and dedupes by id', () => {
    let s: RunMetricsState = initialRunMetrics;
    s = runMetricsReducer(s, { type: 'LOOT', weapon: weapon('club') });
    s = runMetricsReducer(s, { type: 'LOOT', weapon: weapon('club') });
    s = runMetricsReducer(s, { type: 'LOOT', weapon: weapon('axe') });
    expect(s.loot.map(w => w.id)).toEqual(['club', 'axe']);
  });

  it('RESET returns to the initial state', () => {
    let s: RunMetricsState = initialRunMetrics;
    s = runMetricsReducer(s, { type: 'TALLY_CRIT' });
    s = runMetricsReducer(s, { type: 'INC_MONSTER' });
    s = runMetricsReducer(s, { type: 'ADD_XP', amount: 99 });
    s = runMetricsReducer(s, { type: 'RESET' });
    expect(s).toEqual(initialRunMetrics);
  });

  it('does not mutate the input state', () => {
    const s = initialRunMetrics;
    runMetricsReducer(s, { type: 'TALLY_CRIT' });
    expect(s.critCount).toBe(0);
  });
});
```
- [ ] Run (expect FAIL — file does not exist): `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bun run test src/hooks/useRunMetrics.test.ts`
- [ ] Implement `frontend/src/hooks/useRunMetrics.ts`:
```ts
import { useReducer, useCallback, useMemo } from 'react';
import type { ChartData } from '../types/completion';
import type { Weapon } from '../utils/weapons';

// --- Pure reducer (exported for tests, following useComboSystem/useRaidState
// convention). Run-level metrics survive across monster kills and reset only on
// run restart (resetGameState). Endless-only; daily/raid never feed it. ---

export interface RunMetricsState {
  /** One continuous per-second timeline for the whole run (graph source). */
  chart: ChartData;
  critCount: number;
  totalXp: number;
  monstersDefeated: number;
  /** Highest single per-second WPM sample seen across the run. */
  bestWpm: number;
  /** Accumulated run duration in seconds (sum of each fight's elapsed). */
  elapsedSeconds: number;
  /** Weapons dropped this run, deduped by id, in drop order. */
  loot: Weapon[];
}

export type RunMetricsAction =
  | { type: 'APPEND_FIGHT'; chart: ChartData }
  | { type: 'TALLY_CRIT' }
  | { type: 'ADD_XP'; amount: number }
  | { type: 'INC_MONSTER' }
  | { type: 'ADD_SECONDS'; seconds: number }
  | { type: 'LOOT'; weapon: Weapon }
  | { type: 'RESET' };

export const initialRunMetrics: RunMetricsState = {
  chart: { wpm: [], raw: [], err: [] },
  critCount: 0,
  totalXp: 0,
  monstersDefeated: 0,
  bestWpm: 0,
  elapsedSeconds: 0,
  loot: [],
};

export function runMetricsReducer(
  state: RunMetricsState,
  action: RunMetricsAction
): RunMetricsState {
  switch (action.type) {
    case 'APPEND_FIGHT': {
      const wpm = [...state.chart.wpm, ...action.chart.wpm];
      const raw = [...state.chart.raw, ...action.chart.raw];
      const err = [...state.chart.err, ...action.chart.err];
      const bestWpm = action.chart.wpm.reduce(
        (best, v) => Math.max(best, v),
        state.bestWpm
      );
      return { ...state, chart: { wpm, raw, err }, bestWpm };
    }
    case 'TALLY_CRIT':
      return { ...state, critCount: state.critCount + 1 };
    case 'ADD_XP':
      return action.amount > 0
        ? { ...state, totalXp: state.totalXp + action.amount }
        : state;
    case 'INC_MONSTER':
      return { ...state, monstersDefeated: state.monstersDefeated + 1 };
    case 'ADD_SECONDS':
      return action.seconds > 0
        ? { ...state, elapsedSeconds: state.elapsedSeconds + action.seconds }
        : state;
    case 'LOOT':
      return state.loot.some(w => w.id === action.weapon.id)
        ? state
        : { ...state, loot: [...state.loot, action.weapon] };
    case 'RESET':
      return initialRunMetrics;
    default:
      return state;
  }
}

// --- Hook ---

// Run-level metrics accumulator. Owned by GameProvider so its callbacks can be
// fed from the combo roll (crits), XP awards, monster kills, fight finalize
// (samples + seconds), and weapon drops, and reset together in resetGameState.
export function useRunMetrics() {
  const [state, dispatch] = useReducer(runMetricsReducer, initialRunMetrics);

  const appendFight = useCallback(
    (chart: ChartData, seconds: number) => {
      dispatch({ type: 'APPEND_FIGHT', chart });
      dispatch({ type: 'ADD_SECONDS', seconds });
    },
    []
  );
  const tallyCrit = useCallback(() => dispatch({ type: 'TALLY_CRIT' }), []);
  const addXp = useCallback(
    (amount: number) => dispatch({ type: 'ADD_XP', amount }),
    []
  );
  const incMonster = useCallback(() => dispatch({ type: 'INC_MONSTER' }), []);
  const loot = useCallback(
    (weapon: Weapon) => dispatch({ type: 'LOOT', weapon }),
    []
  );
  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  return useMemo(
    () => ({ state, appendFight, tallyCrit, addXp, incMonster, loot, reset }),
    [state, appendFight, tallyCrit, addXp, incMonster, loot, reset]
  );
}
```
- [ ] Run (expect PASS): `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bun run test src/hooks/useRunMetrics.test.ts`
- [ ] Format: `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bun run format`
- [ ] Commit:
```
git add frontend/src/hooks/useRunMetrics.ts frontend/src/hooks/useRunMetrics.test.ts
git commit -m "feat(battle-report): pure run-metrics reducer + useRunMetrics hook

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Pure graph-data-prep `buildGraphSeries`

**Files:**
- Source: `frontend/src/utils/battleReportData.ts` (new)
- Test: `frontend/src/utils/battleReportData.test.ts` (new)

The graph is a lightweight inline SVG line chart. Keep all geometry in a pure function so it is unit-testable without DOM. Maps the run `ChartData` to polyline point strings (`"x,y x,y …"`) for WPM and raw, plus error-marker coordinates, scaled to a given `width`/`height` box with the y-axis spanning `[0, maxY]` where `maxY` is the max of all wpm+raw samples (min 1, to avoid divide-by-zero). y is flipped so higher WPM sits nearer the top (smaller y).

- [ ] Write failing test `frontend/src/utils/battleReportData.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildGraphSeries } from './battleReportData';
import type { ChartData } from '../types/completion';

const data: ChartData = {
  wpm: [0, 50, 100],
  raw: [0, 50, 100],
  err: [0, 1, 0],
};

describe('buildGraphSeries', () => {
  it('returns empty series for empty data', () => {
    const s = buildGraphSeries(
      { wpm: [], raw: [], err: [] },
      100,
      40
    );
    expect(s.wpmPoints).toBe('');
    expect(s.rawPoints).toBe('');
    expect(s.errMarkers).toEqual([]);
    expect(s.maxY).toBe(1);
  });

  it('spans x from 0 to width across sample indices', () => {
    const s = buildGraphSeries(data, 100, 40);
    const xs = s.wpmPoints.split(' ').map(p => Number(p.split(',')[0]));
    expect(xs[0]).toBe(0);
    expect(xs[xs.length - 1]).toBe(100);
  });

  it('flips y so the max sample sits at the top (y=0)', () => {
    const s = buildGraphSeries(data, 100, 40);
    expect(s.maxY).toBe(100);
    const ys = s.wpmPoints.split(' ').map(p => Number(p.split(',')[1]));
    // sample value 0 -> bottom (y=height); value 100 -> top (y=0)
    expect(ys[0]).toBe(40);
    expect(ys[2]).toBe(0);
  });

  it('emits an error marker per non-zero err sample', () => {
    const s = buildGraphSeries(data, 100, 40);
    expect(s.errMarkers).toHaveLength(1);
    expect(s.errMarkers[0].x).toBeCloseTo(50);
  });

  it('handles a single sample without NaN', () => {
    const s = buildGraphSeries(
      { wpm: [60], raw: [60], err: [0] },
      100,
      40
    );
    expect(s.wpmPoints).toBe('0,0');
    expect(Number.isNaN(s.maxY)).toBe(false);
  });
});
```
- [ ] Run (expect FAIL — file does not exist): `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bun run test src/utils/battleReportData.test.ts`
- [ ] Implement `frontend/src/utils/battleReportData.ts`:
```ts
import type { ChartData } from '../types/completion';

export interface GraphSeries {
  /** SVG polyline points "x,y x,y …" for WPM. */
  wpmPoints: string;
  /** SVG polyline points "x,y x,y …" for raw WPM. */
  rawPoints: string;
  /** Positions of error markers (one per non-zero err sample). */
  errMarkers: { x: number; y: number }[];
  /** Y-axis upper bound used for scaling (>= 1). */
  maxY: number;
}

// Pure geometry for the Battle Report run graph. Scales per-second WPM/raw/err
// samples into an inline SVG box. x = index spread across `width`; y is flipped
// so higher values sit nearer the top (y=0). No DOM, fully unit-testable.
export function buildGraphSeries(
  chart: ChartData,
  width: number,
  height: number
): GraphSeries {
  const n = chart.wpm.length;
  if (n === 0) {
    return { wpmPoints: '', rawPoints: '', errMarkers: [], maxY: 1 };
  }

  const maxSample = Math.max(1, ...chart.wpm, ...chart.raw);
  const xAt = (i: number) => (n === 1 ? 0 : (i / (n - 1)) * width);
  const yAt = (v: number) => height - (v / maxSample) * height;

  const toPoints = (values: number[]) =>
    values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(' ');

  const errMarkers = chart.err
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e > 0)
    .map(({ i }) => ({ x: xAt(i), y: height }));

  return {
    wpmPoints: toPoints(chart.wpm),
    rawPoints: toPoints(chart.raw),
    errMarkers,
    maxY: maxSample,
  };
}
```
- [ ] Run (expect PASS): `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bun run test src/utils/battleReportData.test.ts`
- [ ] Format: `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bun run format`
- [ ] Commit:
```
git add frontend/src/utils/battleReportData.ts frontend/src/utils/battleReportData.test.ts
git commit -m "feat(battle-report): pure SVG graph-data-prep helper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Wire run-metrics into GameContext + GameProvider (crit tally, XP, kills, loot, reset)

**Files:**
- Edit: `frontend/src/context/GameContext.ts` (context type + default value)
- Edit: `frontend/src/context/GameProvider.tsx` (own hook, wrap combo, feed data, reset)
- No new test (integration is via existing reducer tests + the final manual check). The wrapped combo logic stays a thin pass-through; the testable accumulation already has Task 2 coverage.

Confirmed wiring facts (from source):
- `registerComboCorrect` is exposed on context = `combo.registerCorrectWord` (GameProvider line ~267); consumed in `TypingInterface.tsx:169` as `const { damage, crit } = registerComboCorrect(equippedWeapon);`. Wrap it in the provider so the same return value is preserved while crits are tallied.
- Kills increment in `incrementMonstersDefeated` (line ~98) and the kill `useEffect` (line ~141–156) which also calls `tryDropWeapon`.
- Weapon drops surface as `pendingDrop` (from `useWeaponSystem`). Tally loot when a drop becomes pending.
- `resetGameState` (line ~221–236) already calls `combo.reset()` / `weapon.reset()`; add `runMetrics.reset()`.

- [ ] In `frontend/src/context/GameContext.ts`, add run-metrics fields to the context interface. Locate the existing combo block (the type has `comboStreak`, `comboCritChance`, `registerComboCorrect`, `registerComboWrong`) and add after `registerComboWrong: () => void;`:
```ts
  // Run-level metrics for the Battle Report (Endless). Accumulated across kills,
  // reset in resetGameState.
  runMetrics: import('../hooks/useRunMetrics').RunMetricsState;
  /** Forward a finished fight's per-second samples + elapsed seconds. */
  appendRunFight: (chart: import('../types/completion').ChartData, seconds: number) => void;
  /** Add per-kill XP to the run total. */
  addRunXp: (amount: number) => void;
```
  (If `GameContext.ts` already imports these types at top, prefer a top-of-file `import type` instead of inline imports and reference the bare names. Use whichever matches the file's existing import style; inline `import(...)` shown above is the safe fallback.)
- [ ] In `frontend/src/context/GameContext.ts`, add matching defaults to the default context value object (next to `registerComboCorrect: () => ({ damage: 1, crit: false }),`):
```ts
  runMetrics: {
    chart: { wpm: [], raw: [], err: [] },
    critCount: 0,
    totalXp: 0,
    monstersDefeated: 0,
    bestWpm: 0,
    elapsedSeconds: 0,
    loot: [],
  },
  appendRunFight: () => {},
  addRunXp: () => {},
```
- [ ] In `frontend/src/context/GameProvider.tsx`, add the hook import after the `useComboSystem` import (line ~11):
```ts
import { useRunMetrics } from '../hooks/useRunMetrics';
```
- [ ] In `frontend/src/context/GameProvider.tsx`, instantiate the hook near the other hooks (after `const weapon = useWeaponSystem(loadoutWeapon);`, around line ~75):
```ts
  const runMetrics = useRunMetrics();
```
- [ ] In `frontend/src/context/GameProvider.tsx`, wrap `registerComboCorrect` to tally crits while preserving the roll return. Add this `useCallback` after the `runMetrics` line (it depends on `combo.registerCorrectWord` and `runMetrics.tallyCrit`):
```ts
  // Wrap the combo roll so each crit is counted for the Battle Report. The
  // return value is passed through unchanged so callers (TypingInterface) still
  // get { damage, crit }.
  const registerComboCorrect = useCallback(
    (weapon?: Parameters<typeof combo.registerCorrectWord>[0], rng?: () => number) => {
      const roll = combo.registerCorrectWord(weapon ?? null, rng);
      if (roll.crit) runMetrics.tallyCrit();
      return roll;
    },
    [combo, runMetrics]
  );
```
- [ ] In `frontend/src/context/GameProvider.tsx`, tally the kill into run metrics inside the existing endless kill `useEffect` (the block at line ~143 that calls `incrementMonstersDefeated()` and `tryDropWeapon(...)`). Add `runMetrics.incMonster();` immediately after `incrementMonstersDefeated();`, and add `runMetrics.incMonster` / `runMetrics` to that effect's dependency array. (Loot is captured by the pendingDrop effect below, so do not loot here.)
- [ ] In `frontend/src/context/GameProvider.tsx`, add an effect that records loot when a weapon drop becomes pending. Place it after the kill effect:
```ts
  // Record each weapon drop into the run loot list (deduped by id in the
  // reducer). pendingDrop is set by useWeaponSystem on a successful drop roll.
  useEffect(() => {
    if (pendingDrop) runMetrics.loot(pendingDrop);
  }, [pendingDrop, runMetrics]);
```
  (`pendingDrop` is already destructured from `weapon` at line ~79. If `pendingDrop` is a `Weapon | null`, this is type-safe; the `if` guards null.)
- [ ] In `frontend/src/context/GameProvider.tsx`, add `runMetrics.reset();` inside `resetGameState` (after `weapon.reset();`, line ~235) and add `runMetrics` to its dependency array.
- [ ] In `frontend/src/context/GameProvider.tsx`, expose the new fields on `contextValue`. Replace the existing `registerComboCorrect: combo.registerCorrectWord,` entry with `registerComboCorrect,` (the wrapped one), and add three new entries near it:
```ts
      registerComboCorrect,
      runMetrics: runMetrics.state,
      appendRunFight: runMetrics.appendFight,
      addRunXp: runMetrics.addXp,
```
  Update the `useMemo` dependency array: replace `combo.registerCorrectWord` with `registerComboCorrect`, and add `runMetrics.state`, `runMetrics.appendFight`, `runMetrics.addXp`.
- [ ] Typecheck (expect PASS): `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bunx tsc -b`
- [ ] Run full suite (expect PASS, nothing broke): `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bun run test`
- [ ] Format: `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bun run format`
- [ ] Commit:
```
git add frontend/src/context/GameContext.ts frontend/src/context/GameProvider.tsx
git commit -m "feat(battle-report): accumulate run metrics in GameProvider (crits, kills, XP, loot, reset)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Forward fight samples from TypingInterface into the run timeline

**Files:**
- Edit: `frontend/src/components/TypingInterface.tsx`
- No new test (no extractable pure logic added; this is wiring an existing finalize result into the context callback).

Confirmed facts: `TypingInterface` already owns `useSessionMetrics` (per-fight) and consumes the combo roll at line ~169. `useSessionMetrics.finalize(elapsedMinutes)` returns `SessionMetrics` containing `chartData: ChartData`. We forward that `chartData` plus elapsed seconds to `appendRunFight` at the same place per-kill XP is emitted (`onXpGain` at line ~160).

- [ ] In `frontend/src/components/TypingInterface.tsx`, destructure the new callback from `useGameContext()` alongside the existing combo/XP context usage (where `registerComboCorrect`, `registerCorrectWord` are pulled, around line ~84):
```ts
    appendRunFight,
```
- [ ] In `frontend/src/components/TypingInterface.tsx`, find where the fight is finalized for the kill overlay (the path that builds `SessionMetrics` from `useSessionMetrics.finalize(...)` and surfaces `chartData`). At that finalize site, after the metrics object is produced, forward the run samples:
```ts
      // Battle Report: append this fight's per-second samples to the run
      // timeline (Endless). elapsedSeconds derives from elapsedMinutes * 60.
      appendRunFight(metrics.chartData, Math.round(elapsedMinutes * 60));
```
  Use the actual local variable names present at that site (the finalize result and the elapsed-minutes value). If `finalize` is called inline, capture it: `const metrics = finalize(elapsedMinutes);` then `appendRunFight(metrics.chartData, Math.round(elapsedMinutes * 60));`. Add `appendRunFight` to the enclosing `useCallback`/`useEffect` dependency array if one wraps the finalize.
- [ ] Typecheck (expect PASS): `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bunx tsc -b`
- [ ] Run full suite (expect PASS): `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bun run test`
- [ ] Format: `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bun run format`
- [ ] Commit:
```
git add frontend/src/components/TypingInterface.tsx
git commit -m "feat(battle-report): forward fight samples to run timeline on each kill

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: `BattleReport` component (graph + grade + summary + loot)

**Files:**
- Source: `frontend/src/components/BattleReport.tsx` (new)
- No DOM-render test (jsdom/@testing-library are unavailable). Its only non-trivial logic (graph geometry, grade, accuracy/consistency) lives in already-tested pure helpers: `buildGraphSeries` (Task 3), `grade` (Task 1), `consistency` (existing). The component is presentational glue.

Inputs: read everything from `useGameContext()` — `runMetrics` (`RunMetricsState`), plus `killStreak`/`monstersDefeated` already available there. Accuracy for the grade: derive run keystroke accuracy from the run chart as `100 * (sum(raw) - sum(err)) / sum(raw)` is NOT available (err is per-second mistypes, raw is cumulative-rate, not counts), so use a simpler, honest signal: **average consistency** from `consistency(runMetrics.chart.raw)` for the "consistency" stat, and compute grade from a run accuracy passed via metrics. Since `RunMetricsState` does not store keystroke accuracy, store and grade on **best-effort run accuracy approximated from error density**: `accuracy = max(0, round(100 - 100 * totalErr / max(1, totalSamplesNonZeroRaw)))`. Keep this derivation inside the component (it is display-only, not invariant-bearing). The summary fields map directly to `RunMetricsState`.

Styling mirrors `RaidResultScreen.tsx` / `DeathPopup.tsx`: a fixed full-screen overlay (`fixed inset-0 z-50 flex items-center justify-center bg-black/70`), a centered card, stat blocks like `KillResultOverlay`'s `Stat`, and `RARITY_COLOR` from `weapons.ts` for loot names. A restart button reuses `DeathPopup`'s button styling + `RotateCcw` icon.

- [ ] Implement `frontend/src/components/BattleReport.tsx`:
```tsx
import { RotateCcw, Skull } from 'lucide-react';
import { useThemeContext } from '../hooks/useThemeContext';
import { useGameContext } from '../hooks/useGameContext';
import { grade } from '../utils/grade';
import { buildGraphSeries } from '../utils/battleReportData';
import { consistency } from '../utils/consistency';
import { RARITY_COLOR } from '../utils/weapons';

interface BattleReportProps {
  onRestart: () => void;
}

const GRAPH_W = 520;
const GRAPH_H = 160;

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

// Display-only run accuracy: error density over sampled seconds. Not an
// invariant — used solely to pick a letter grade for the recap.
function runAccuracy(err: number[], raw: number[]): number {
  const totalErr = err.reduce((a, b) => a + b, 0);
  const sampledSeconds = raw.filter(v => v > 0).length;
  if (sampledSeconds === 0) return 100;
  return Math.max(0, Math.round(100 - (100 * totalErr) / sampledSeconds));
}

export default function BattleReport({ onRestart }: BattleReportProps) {
  const { theme } = useThemeContext();
  const { runMetrics } = useGameContext();
  const dark = theme === 'dark';

  const { chart, critCount, totalXp, monstersDefeated, bestWpm, elapsedSeconds, loot } =
    runMetrics;

  const series = buildGraphSeries(chart, GRAPH_W, GRAPH_H);
  const accuracy = runAccuracy(chart.err, chart.raw);
  const letter = grade(accuracy);
  const avgConsistency = consistency(chart.raw);

  const stats: { label: string; value: string }[] = [
    { label: 'Monsters', value: String(monstersDefeated) },
    { label: 'Total XP', value: `+${totalXp}` },
    { label: 'Best WPM', value: String(bestWpm) },
    { label: 'Crits', value: String(critCount) },
    { label: 'Consistency', value: `${avgConsistency}%` },
    { label: 'Duration', value: formatDuration(elapsedSeconds) },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        className={`w-full max-w-2xl rounded-2xl border-2 p-6 shadow-2xl ${
          dark
            ? 'bg-gray-900/95 border-gray-700 text-white'
            : 'bg-white border-gray-200 text-gray-900'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Skull size={24} className="text-red-400" />
            <h2 className="text-2xl font-bold tracking-wide">Battle Report</h2>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-4xl font-black text-yellow-400 leading-none">
              {letter}
            </span>
            <span className="text-[10px] uppercase tracking-widest text-gray-400">
              {accuracy}% acc
            </span>
          </div>
        </div>

        {/* Continuous per-second run graph: WPM (solid), raw (faint), error ticks */}
        <div
          className={`rounded-lg p-3 mb-5 ${dark ? 'bg-black/30' : 'bg-gray-100'}`}
        >
          <svg
            viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`}
            width="100%"
            height={GRAPH_H}
            preserveAspectRatio="none"
            role="img"
            aria-label="Run WPM over time"
          >
            {series.rawPoints && (
              <polyline
                points={series.rawPoints}
                fill="none"
                stroke="currentColor"
                strokeOpacity={0.25}
                strokeWidth={1.5}
              />
            )}
            {series.wpmPoints && (
              <polyline
                points={series.wpmPoints}
                fill="none"
                className="text-yellow-400"
                stroke="currentColor"
                strokeWidth={2}
              />
            )}
            {series.errMarkers.map((m, i) => (
              <line
                key={i}
                x1={m.x}
                y1={GRAPH_H}
                x2={m.x}
                y2={GRAPH_H - 8}
                stroke="#f87171"
                strokeWidth={2}
              />
            ))}
          </svg>
          {chart.wpm.length === 0 && (
            <p className="text-center text-xs text-gray-400">No samples this run</p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4 mb-5">
          {stats.map(s => (
            <div key={s.label} className="flex flex-col items-center">
              <span className="text-2xl font-bold">{s.value}</span>
              <span className="text-[10px] uppercase tracking-widest text-gray-400">
                {s.label}
              </span>
            </div>
          ))}
        </div>

        <div className="mb-6">
          <h3 className="text-xs uppercase tracking-widest text-gray-400 mb-2">
            Loot
          </h3>
          {loot.length === 0 ? (
            <p className="text-sm text-gray-400">No weapons dropped this run.</p>
          ) : (
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {loot.map(w => (
                <li key={w.id} className={`text-sm font-semibold ${RARITY_COLOR[w.rarity]}`}>
                  {w.name}
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          onClick={onRestart}
          className="w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors bg-red-600 hover:bg-red-500 text-white"
        >
          <RotateCcw size={18} />
          New Run
        </button>
      </div>
    </div>
  );
}
```
- [ ] Typecheck (expect PASS): `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bunx tsc -b`
- [ ] Lint (expect PASS): `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bun run lint`
- [ ] Format: `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bun run format`
- [ ] Commit:
```
git add frontend/src/components/BattleReport.tsx
git commit -m "feat(battle-report): recap UI (graph, grade, summary, loot)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Mount BattleReport on death (replace DeathPopup)

**Files:**
- Edit: `frontend/src/App.tsx`
- No new test (presentational mount swap + a one-line XP forward).

Confirmed facts: `App.tsx:245` renders `{isPlayerDead && <DeathPopup onRestart={handleDeathRestart} />}`. `handleDeathRestart` calls `resetGameState()` (line ~168). Per-kill XP arrives via `handleXpGain` (line ~176) wired to `<TypingInterface onXpGain={handleXpGain} />` (line ~232). We forward that XP into run metrics and swap the death UI to the full report. The light `KillResultOverlay` is untouched.

- [ ] In `frontend/src/App.tsx`, replace the `DeathPopup` import (line ~36) with:
```ts
import BattleReport from './components/BattleReport';
```
- [ ] In `frontend/src/App.tsx`, pull `addRunXp` from context (extend the existing `useGameContext()` destructure at line ~60):
```ts
    addRunXp,
```
- [ ] In `frontend/src/App.tsx`, forward per-kill XP into run metrics inside `handleXpGain` (line ~176). Update it to:
```ts
  const handleXpGain = useCallback(
    (xp: number) => {
      if (xp <= 0) return;
      addRunXp(xp);
      setXpGain(xp);
      setXpGainNonce(n => n + 1);
    },
    [addRunXp]
  );
```
- [ ] In `frontend/src/App.tsx`, swap the death render (line ~245):
```tsx
        {/* Battle Report (full run recap) when the player dies */}
        {isPlayerDead && <BattleReport onRestart={handleDeathRestart} />}
```
- [ ] Typecheck (expect PASS): `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bunx tsc -b`
- [ ] Run full suite (expect PASS): `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bun run test`
- [ ] (Optional cleanup) If `DeathPopup.tsx` is now unreferenced anywhere, leave it in place — removing it is out of scope and risks unrelated breakage. Verify with: `grep -rn 'DeathPopup' frontend/src`.
- [ ] Format: `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bun run format`
- [ ] Commit:
```
git add frontend/src/App.tsx
git commit -m "feat(battle-report): show Battle Report on death; route per-kill XP to run total

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Final verification gate

**Files:** none (verification only).

- [ ] Lint: `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bun run lint`
- [ ] Format check: `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bun run format:check`
- [ ] Typecheck: `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bunx tsc -b`
- [ ] Tests: `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bun run test`
- [ ] Manual smoke (dev server, not part of CI): play Endless, kill several monsters (including an elite/rare for loot + a crit streak), then die. Confirm the Battle Report shows: a continuous graph spanning the whole run (not just the last fight), the correct grade, crit count > 0, monsters defeated, total XP, best WPM, average consistency, duration, and looted weapons. Press "New Run" → confirm a fresh report next death (all counters back to zero, no carryover).

---

## Self-review notes

Spec coverage check (`docs/superpowers/specs/2026-06-04-battle-report-design.md`):

- **Continuous run graph** — `runMetricsReducer.APPEND_FIGHT` concatenates every fight's `wpm`/`raw`/`err` into one timeline (Task 2, tested); `TypingInterface` forwards each fight's `chartData` on kill (Task 5); `buildGraphSeries` renders the whole timeline as one SVG polyline (Tasks 3, 6). ✅
- **Grade** — pure `grade(accuracy)` with locked thresholds S≥98/A≥95/B≥90/C≥80/D<80 (Task 1, tested); rendered in the report header (Task 6). ✅
- **Crit tally** — crits were previously uncounted; `GameProvider` now wraps `registerComboCorrect`, calls `runMetrics.tallyCrit()` when `roll.crit` is true, and passes the roll through unchanged so `TypingInterface` still gets `{ damage, crit }` (Task 4). Reducer `TALLY_CRIT` tested (Task 2). ✅
- **Run summary** — monsters defeated, total XP (routed from `App.handleXpGain` → `addRunXp`, Task 7), best WPM (max sample in `APPEND_FIGHT`), crits, average consistency (`consistency(chart.raw)`), duration (`ADD_SECONDS`) all rendered (Task 6); each accumulator tested (Task 2). ✅
- **Loot** — `pendingDrop` effect feeds `runMetrics.loot()`, deduped by id; rendered with `RARITY_COLOR` (Tasks 4, 6); `LOOT` dedupe tested (Task 2). ✅
- **Reset on restart** — `runMetrics.reset()` added to `resetGameState` alongside `combo.reset()`/`weapon.reset()` (Task 4); `RESET` tested (Task 2); manual smoke confirms zeroed counters on the next run (Task 8). ✅
- **Per-kill overlay unchanged** — `KillResultOverlay` is never touched; only the death-screen mount swaps `DeathPopup` → `BattleReport` (Task 7). ✅
- **No DOM/render tests** — every test target is a pure exported function (`grade`, `runMetricsReducer`, `buildGraphSeries`); `BattleReport` has no render test, matching the jsdom-free constraint. ✅

Risk notes for the implementer:
- The exact local variable names at the `useSessionMetrics.finalize` site in `TypingInterface.tsx` (Task 5) must be read from the file before editing — the plan gives the shape, not guaranteed identifiers.
- If `pendingDrop` can be set without a real kill (e.g. re-render with a stale value), the reducer's id-dedupe prevents double-counting, but verify `clearPendingDrop` timing during the manual smoke so the same weapon isn't re-looted after the drop modal closes; if it is, gate the loot effect on the drop's identity rather than truthiness.
- `GameContext.ts` import style: prefer top-of-file `import type { RunMetricsState } from '../hooks/useRunMetrics'` and `import type { ChartData } from '../types/completion'` if the file already uses that pattern, over the inline `import(...)` fallback shown in Task 4.
