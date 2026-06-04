import { useCallback, useState } from 'react';

export type EndlessDifficulty =
  | 'beginner'
  | 'common'
  | 'intermediate'
  | 'advanced';

// Difficulty is Endless-only and can't change mid-run: changing it restarts the
// run. This decides what a selection should do, kept pure so it's testable
// without a DOM and out of the component file (avoids fast-refresh churn).
//   'noop'    — same difficulty (nothing to do)
//   'apply'   — different, but the run hasn't started, so switch silently
//   'confirm' — different and the run is underway; ask before restarting
export type DifficultySelectionAction = 'noop' | 'apply' | 'confirm';

export function resolveDifficultySelection(
  current: EndlessDifficulty,
  next: EndlessDifficulty,
  runStarted: boolean
): DifficultySelectionAction {
  if (next === current) return 'noop';
  return runStarted ? 'confirm' : 'apply';
}

const DIFFICULTY_KEY = 'endless_difficulty';
const DEFAULT_DIFFICULTY: EndlessDifficulty = 'beginner';
const VALID_DIFFICULTIES: EndlessDifficulty[] = [
  'beginner',
  'common',
  'intermediate',
  'advanced',
];

const getStoredDifficulty = (): EndlessDifficulty => {
  try {
    const stored = localStorage.getItem(DIFFICULTY_KEY);
    if (stored && VALID_DIFFICULTIES.includes(stored as EndlessDifficulty)) {
      return stored as EndlessDifficulty;
    }
  } catch {
    // localStorage not available
  }
  return DEFAULT_DIFFICULTY;
};

export function useEndlessSettings() {
  const [endlessDifficulty, setEndlessDifficultyState] =
    useState<EndlessDifficulty>(getStoredDifficulty);

  const setEndlessDifficulty = useCallback((difficulty: EndlessDifficulty) => {
    if (!VALID_DIFFICULTIES.includes(difficulty)) return;
    setEndlessDifficultyState(difficulty);
    try {
      localStorage.setItem(DIFFICULTY_KEY, difficulty);
    } catch {
      // localStorage not available
    }
  }, []);

  return {
    endlessDifficulty,
    setEndlessDifficulty,
  };
}
