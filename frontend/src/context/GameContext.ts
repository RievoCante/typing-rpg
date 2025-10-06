import { createContext } from 'react';

interface GameContextType {
  currentMode: 'daily' | 'endless';
  setCurrentMode: (mode: 'daily' | 'endless') => void;
  totalWords: number;
  remainingWords: number;
  setTotalWords: (count: number) => void;
  setRemainingWords: (count: number) => void;
  decrementRemainingWords: () => void;
}

export const GameContext = createContext<GameContextType>({
  currentMode: 'daily',
  setCurrentMode: () => {},
  totalWords: 0,
  remainingWords: 0,
  setTotalWords: () => {},
  setRemainingWords: () => {},
  decrementRemainingWords: () => {},
});
