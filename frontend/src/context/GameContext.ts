import { createContext } from 'react';
import type { EndlessDifficulty } from '../hooks/useEndlessSettings';
import type { Weapon } from '../utils/weapons';

export type MonsterTypeEnum = 'normal' | 'mini-boss' | 'boss';

// Endless monster variant, layered on top of family + tier. Elite/rare are
// rarer, tougher (HP ×), glow, and reward the player on kill (see combatTuning
// + GameProvider). Daily/raid are always 'common'.
export type MonsterVariant = 'common' | 'elite' | 'rare';

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
  // Spawn a fresh monster of `type` + `variant` at full HP (Endless). HP scales
  // by variant on top of the tier HP.
  spawnMonster: (type: MonsterTypeEnum, variant?: MonsterVariant) => void;
  // Current monster variant (common/elite/rare) — drives glow, nameplate, HP.
  currentMonsterVariant: MonsterVariant;
  // Per-run equipped weapon (Endless loot); null = Fists. Modifies combat damage.
  equippedWeapon: Weapon | null;
  // Pending Endless weapon drop awaiting the player's "Take" (the drop modal);
  // null = none. Gates the kill-result overlay until acknowledged.
  pendingDrop: Weapon | null;
  clearPendingDrop: () => void;
  // Persistent weapon vault (Phase 3b): unlocked collection + chosen loadout.
  // The pre-run loadout panel reads/writes this; logged-out = empty + read-only.
  weaponVault: {
    unlocked: string[];
    loadout: string | null;
    setLoadout: (id: string | null) => void;
    isSignedIn: boolean;
  };
  // Endless combo streak
  comboStreak: number;
  comboCritChance: number;
  registerComboCorrect: (
    weapon?: Weapon | null,
    rng?: () => number
  ) => {
    damage: number;
    crit: boolean;
  };
  registerComboWrong: () => void;
  endlessDifficulty: EndlessDifficulty;
  setEndlessDifficulty: (difficulty: EndlessDifficulty) => void;
  // Player typing state
  hasStartedTyping: boolean;
  setHasStartedTyping: (value: boolean) => void;
  // Pause state (typing unfocused). isManuallyPaused is the player-driven pause
  // (Esc / pause button); isPaused is the effective freeze (manual OR unfocused).
  isPaused: boolean;
  setIsPaused: (value: boolean) => void;
  isManuallyPaused: boolean;
  setIsManuallyPaused: (value: boolean) => void;
  // Endless potion inventory
  potionCount: number;
  maxPotions: number;
  registerCorrectWord: () => void;
  drinkPotion: () => void;
  // Current monster tier (drives HP + 3D model)
  currentMonsterType: MonsterTypeEnum;
  // Player health (Endless monster attacks)
  playerHealth: number;
  maxPlayerHealth: number;
  damagePlayer: (amount: number) => void;
  healPlayer: (amount: number) => void;
  resetPlayerHealth: () => void;
  isPlayerDead: boolean;
  damagePlayerFromMistake: () => void;
  // Kill streak (consecutive kills this run)
  killStreak: number;
  resetKillStreak: () => void;
  // Full run reset (health, streaks, potions, monster, combo)
  resetGameState: () => void;
}

export const GameContext = createContext<GameContextType>({
  currentMode: 'endless',
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
  currentMonsterVariant: 'common',
  equippedWeapon: null,
  pendingDrop: null,
  clearPendingDrop: () => {},
  weaponVault: {
    unlocked: [],
    loadout: null,
    setLoadout: () => {},
    isSignedIn: false,
  },
  comboStreak: 0,
  comboCritChance: 0,
  registerComboCorrect: () => ({ damage: 1, crit: false }),
  registerComboWrong: () => {},
  endlessDifficulty: 'beginner',
  setEndlessDifficulty: () => {},
  // Player typing state
  hasStartedTyping: false,
  setHasStartedTyping: () => {},
  // Pause state
  isPaused: false,
  setIsPaused: () => {},
  isManuallyPaused: false,
  setIsManuallyPaused: () => {},
  // Endless potion inventory
  potionCount: 0,
  maxPotions: 3,
  registerCorrectWord: () => {},
  drinkPotion: () => {},
  // Current monster tier
  currentMonsterType: 'normal',
  // Player health
  playerHealth: 100,
  maxPlayerHealth: 100,
  damagePlayer: () => {},
  healPlayer: () => {},
  resetPlayerHealth: () => {},
  isPlayerDead: false,
  damagePlayerFromMistake: () => {},
  // Kill streak
  killStreak: 0,
  resetKillStreak: () => {},
  // Full run reset
  resetGameState: () => {},
});
