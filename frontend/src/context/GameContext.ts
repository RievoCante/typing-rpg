import { createContext } from 'react';
import type { EndlessDifficulty } from '../hooks/useEndlessSettings';

export type MonsterTypeEnum = 'normal' | 'mini-boss' | 'boss';

interface GameContextType {
  currentMode: 'daily' | 'endless' | 'raid';
  setCurrentMode: (mode: 'daily' | 'endless' | 'raid') => void;
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
  endlessDifficulty: EndlessDifficulty;
  setEndlessDifficulty: (difficulty: EndlessDifficulty) => void;
  // Player typing state
  hasStartedTyping: boolean;
  setHasStartedTyping: (value: boolean) => void;
  // Pause state (typing unfocused)
  isPaused: boolean;
  setIsPaused: (value: boolean) => void;
  // Endless potion inventory
  potionCount: number;
  maxPotions: number;
  registerCorrectWord: () => void;
  drinkPotion: () => void;
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
  endlessDifficulty: 'beginner',
  setEndlessDifficulty: () => {},
  // Player typing state
  hasStartedTyping: false,
  setHasStartedTyping: () => {},
  // Pause state
  isPaused: false,
  setIsPaused: () => {},
  // Endless potion inventory
  potionCount: 0,
  maxPotions: 3,
  registerCorrectWord: () => {},
  drinkPotion: () => {},
});
