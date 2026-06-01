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
  // Endless monster HP (decoupled from words; see utils/combatTuning.ts)
  monsterHp: number;
  monsterMaxHp: number;
  damageMonster: (amount: number) => void;
  // Spawn a fresh monster of `type` at full HP for its tier (Endless).
  spawnMonster: (type: MonsterTypeEnum) => void;
  // Endless combo streak
  comboStreak: number;
  comboCritChance: number;
  registerComboCorrect: (rng?: () => number) => {
    damage: number;
    crit: boolean;
  };
  registerComboWrong: () => void;
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
  monsterHp: 0,
  monsterMaxHp: 0,
  damageMonster: () => {},
  spawnMonster: () => {},
  comboStreak: 0,
  comboCritChance: 0,
  registerComboCorrect: () => ({ damage: 1, crit: false }),
  registerComboWrong: () => {},
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
