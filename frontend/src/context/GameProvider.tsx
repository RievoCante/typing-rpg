import { GameContext } from './GameContext';
import { useState, useCallback, useMemo, useEffect } from 'react';

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
  const [isCurrentMonsterDefeated, setIsCurrentMonsterDefeated] =
    useState<boolean>(false);
  const [endlessWordCount, setEndlessWordCountState] =
    useState<number>(getStoredWordCount);

  // Helper function to decrement remaining words (for word completion)
  const decrementRemainingWords = useCallback(() => {
    setRemainingWords(prev => Math.max(0, prev - 1));
  }, []);

  const incrementMonstersDefeated = useCallback(() => {
    setMonstersDefeated(prev => prev + 1);
  }, []);

  // Reset defeat state when a new monster spawns
  const resetDefeatState = useCallback(() => {
    setIsCurrentMonsterDefeated(false);
  }, []);

  // Auto-detect when current monster is defeated (health reaches 0%)
  useEffect(() => {
    const healthPercentage =
      totalWords > 0 ? (remainingWords / totalWords) * 100 : 100;
    if (healthPercentage <= 0 && !isCurrentMonsterDefeated && totalWords > 0) {
      setIsCurrentMonsterDefeated(true);
    }
  }, [remainingWords, totalWords, isCurrentMonsterDefeated]);

  // Reset defeat state when monstersDefeated increments (new monster spawned)
  useEffect(() => {
    if (monstersDefeated > 0) {
      // Quick spawn - particles still finishing as new slime appears
      const timeout = setTimeout(() => {
        setIsCurrentMonsterDefeated(false);
      }, 400); // Fast 400ms spawn
      return () => clearTimeout(timeout);
    }
  }, [monstersDefeated]);

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
      // Monster defeat state tracking
      isCurrentMonsterDefeated,
      resetDefeatState,
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
      isCurrentMonsterDefeated,
      resetDefeatState,
      endlessWordCount,
      setEndlessWordCount,
    ]
  );

  return (
    <GameContext.Provider value={contextValue}>{children}</GameContext.Provider>
  );
};
