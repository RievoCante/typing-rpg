import { GameContext } from "./GameContext";
import { useState, useCallback } from "react";

export const GameProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentMode, setCurrentMode] = useState<'daily' | 'endless'>('daily');
  const [totalWords, setTotalWords] = useState<number>(0);
  const [remainingWords, setRemainingWords] = useState<number>(0);

  // Helper function to decrement remaining words (for word completion)
  const decrementRemainingWords = useCallback(() => {
    setRemainingWords(prev => Math.max(0, prev - 1));
  }, []);

  const contextValue = {
    currentMode,
    setCurrentMode,
    totalWords,
    remainingWords,
    setTotalWords,
    setRemainingWords,
    decrementRemainingWords,
  };

  return (
    <GameContext.Provider value={contextValue}>
      {children}
    </GameContext.Provider>
  );
};