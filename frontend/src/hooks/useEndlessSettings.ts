import { useCallback, useState } from 'react';

export type EndlessDifficulty =
  | 'beginner'
  | 'common'
  | 'intermediate'
  | 'advanced';

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
