import { GameContext } from './GameContext';
import { useState, useCallback, useMemo } from 'react';

const STORAGE_KEY = 'endless_word_count';
const DEFAULT_WORD_COUNT = 25;
const VALID_WORD_COUNTS = [10, 25, 50, 100];

const getStoredWordCount = (): number => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (VALID_WORD_COUNTS.includes(parsed)) {
        return parsed;
      }
    }
  } catch {
    // localStorage not available
  }
  return DEFAULT_WORD_COUNT;
};

export const GameProvider = ({
  children,
  initialMode = 'daily',
}: {
  children: React.ReactNode;
  initialMode?: 'daily' | 'endless';
}) => {
  const [currentMode, setCurrentMode] = useState<'daily' | 'endless'>(
    initialMode
  );
  const [totalWords, setTotalWords] = useState<number>(0);
  const [remainingWords, setRemainingWords] = useState<number>(0);
  const [monstersDefeated, setMonstersDefeated] = useState<number>(0);
  const [endlessWordCount, setEndlessWordCountState] =
    useState<number>(getStoredWordCount);

  // Helper function to decrement remaining words (for word completion)
  const decrementRemainingWords = useCallback(() => {
    setRemainingWords(prev => Math.max(0, prev - 1));
  }, []);

  const incrementMonstersDefeated = useCallback(() => {
    setMonstersDefeated(prev => prev + 1);
  }, []);

  // Set endless word count and persist to localStorage
  const setEndlessWordCount = useCallback((count: number) => {
    if (VALID_WORD_COUNTS.includes(count)) {
      setEndlessWordCountState(count);
      try {
        localStorage.setItem(STORAGE_KEY, count.toString());
      } catch {
        // localStorage not available
      }
    }
  }, []);

  const contextValue = useMemo(
    () => ({
      currentMode,
      setCurrentMode,
      totalWords,
      remainingWords,
      setTotalWords,
      setRemainingWords,
      decrementRemainingWords,
      monstersDefeated,
      incrementMonstersDefeated,
      endlessWordCount,
      setEndlessWordCount,
    }),
    [
      currentMode,
      totalWords,
      remainingWords,
      decrementRemainingWords,
      monstersDefeated,
      incrementMonstersDefeated,
      endlessWordCount,
      setEndlessWordCount,
    ]
  );

  return (
    <GameContext.Provider value={contextValue}>{children}</GameContext.Provider>
  );
};
