import { createContext } from 'react';

interface GameContextType {
  currentMode: 'daily' | 'endless';
  setCurrentMode: (mode: 'daily' | 'endless') => void;
  totalWords: number;
  remainingWords: number;
  setTotalWords: (count: number) => void;
  setRemainingWords: (count: number) => void;
  decrementRemainingWords: () => void;
  monstersDefeated: number;
  incrementMonstersDefeated: () => void;
  // Monster defeat state tracking
  isCurrentMonsterDefeated: boolean;
  resetDefeatState: () => void;
  endlessWordCount: number;
  setEndlessWordCount: (count: number) => void;
}

export const GameContext = createContext<GameContextType>({
  currentMode: 'daily',
  setCurrentMode: () => {},
  totalWords: 0,
  remainingWords: 0,
  setTotalWords: () => {},
  setRemainingWords: () => {},
  decrementRemainingWords: () => {},
  monstersDefeated: 0,
  incrementMonstersDefeated: () => {},
  // Monster defeat state tracking
  isCurrentMonsterDefeated: false,
  resetDefeatState: () => {},
  endlessWordCount: 25,
  setEndlessWordCount: () => {},
});
