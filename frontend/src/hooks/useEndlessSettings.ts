import { useCallback, useState } from 'react';

const WORD_COUNT_KEY = 'endless_word_count';
const DEFAULT_WORD_COUNT = 25;
const VALID_WORD_COUNTS = [10, 25, 50, 100];

const DIFFICULTY_KEY = 'endless_difficulty';
const DEFAULT_DIFFICULTY: 'beginner' | 'intermediate' | 'advanced' = 'beginner';
const VALID_DIFFICULTIES: ('beginner' | 'intermediate' | 'advanced')[] = [
  'beginner',
  'intermediate',
  'advanced',
];

const getStoredWordCount = (): number => {
  try {
    const stored = localStorage.getItem(WORD_COUNT_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (VALID_WORD_COUNTS.includes(parsed)) return parsed;
    }
  } catch {
    // localStorage not available
  }
  return DEFAULT_WORD_COUNT;
};

const getStoredDifficulty = (): 'beginner' | 'intermediate' | 'advanced' => {
  try {
    const stored = localStorage.getItem(DIFFICULTY_KEY);
    if (
      stored &&
      VALID_DIFFICULTIES.includes(
        stored as 'beginner' | 'intermediate' | 'advanced'
      )
    ) {
      return stored as 'beginner' | 'intermediate' | 'advanced';
    }
  } catch {
    // localStorage not available
  }
  return DEFAULT_DIFFICULTY;
};

export function useEndlessSettings() {
  const [endlessWordCount, setEndlessWordCountState] =
    useState<number>(getStoredWordCount);
  const [endlessDifficulty, setEndlessDifficultyState] = useState<
    'beginner' | 'intermediate' | 'advanced'
  >(getStoredDifficulty);

  const setEndlessWordCount = useCallback((count: number) => {
    if (!VALID_WORD_COUNTS.includes(count)) return;
    setEndlessWordCountState(count);
    try {
      localStorage.setItem(WORD_COUNT_KEY, count.toString());
    } catch {
      // localStorage not available
    }
  }, []);

  const setEndlessDifficulty = useCallback(
    (difficulty: 'beginner' | 'intermediate' | 'advanced') => {
      if (!VALID_DIFFICULTIES.includes(difficulty)) return;
      setEndlessDifficultyState(difficulty);
      try {
        localStorage.setItem(DIFFICULTY_KEY, difficulty);
      } catch {
        // localStorage not available
      }
    },
    []
  );

  return {
    endlessWordCount,
    setEndlessWordCount,
    endlessDifficulty,
    setEndlessDifficulty,
  };
}
