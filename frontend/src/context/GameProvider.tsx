import { GameContext } from './GameContext';
import { useState, useCallback, useMemo } from 'react';

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

  // Helper function to decrement remaining words (for word completion)
  const decrementRemainingWords = useCallback(() => {
    setRemainingWords(prev => Math.max(0, prev - 1));
  }, []);

  const incrementMonstersDefeated = useCallback(() => {
    setMonstersDefeated(prev => prev + 1);
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
    }),
    [
      currentMode,
      totalWords,
      remainingWords,
      decrementRemainingWords,
      monstersDefeated,
      incrementMonstersDefeated,
    ]
  );

  return (
    <GameContext.Provider value={contextValue}>{children}</GameContext.Provider>
  );
};
