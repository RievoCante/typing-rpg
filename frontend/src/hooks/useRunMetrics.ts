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

  const appendFight = useCallback((chart: ChartData, seconds: number) => {
    dispatch({ type: 'APPEND_FIGHT', chart });
    dispatch({ type: 'ADD_SECONDS', seconds });
  }, []);
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
