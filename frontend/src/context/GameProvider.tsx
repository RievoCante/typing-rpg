import { GameContext, type MonsterTypeEnum } from './GameContext';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';

const STORAGE_KEY = 'endless_word_count';
const DEFAULT_WORD_COUNT = 25;
const VALID_WORD_COUNTS = [10, 25, 50, 100];

const DIFFICULTY_STORAGE_KEY = 'endless_difficulty';
const DEFAULT_DIFFICULTY: 'beginner' | 'intermediate' | 'advanced' = 'beginner';
const VALID_DIFFICULTIES: ('beginner' | 'intermediate' | 'advanced')[] = [
  'beginner',
  'intermediate',
  'advanced',
];
const MAX_PLAYER_HEALTH = 100;
const POTION_CHANCE = 0.3; // 30% chance
const POTION_MIN_HEAL = 25;
const POTION_MAX_HEAL = 50;

// Attack intervals per monster type (in seconds)
const ATTACK_INTERVALS: Record<MonsterTypeEnum, number> = {
  normal: 6,
  'mini-boss': 5,
  boss: 4,
};

// Damage per monster type for periodic attacks (reduced for better playability)
const PERIODIC_DAMAGE: Record<MonsterTypeEnum, number> = {
  normal: 3,
  'mini-boss': 5,
  boss: 7,
};

// Damage for typo mistakes (reduced for better playability)
const MISTAKE_DAMAGE_MIN = 2;
const MISTAKE_DAMAGE_MAX = 5;

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

const getStoredDifficulty = (): 'beginner' | 'intermediate' | 'advanced' => {
  try {
    const stored = localStorage.getItem(DIFFICULTY_STORAGE_KEY);
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
  const [endlessDifficulty, setEndlessDifficultyState] = useState<
    'beginner' | 'intermediate' | 'advanced'
  >(getStoredDifficulty);

  // Player HP system
  const [playerHealth, setPlayerHealth] = useState<number>(MAX_PLAYER_HEALTH);
  const [isPlayerDead, setIsPlayerDead] = useState<boolean>(false);

  // Monster attack system
  const [currentMonsterType, setCurrentMonsterType] =
    useState<MonsterTypeEnum>('normal');
  const attackTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Kill streak
  const [killStreak, setKillStreak] = useState<number>(0);

  // Potion system
  const [hasPotion, setHasPotion] = useState<boolean>(false);
  const [potionHealAmount, setPotionHealAmount] = useState<number>(0);

  // Player typing state - controls when monster can attack
  const [hasStartedTyping, setHasStartedTyping] = useState<boolean>(false);

  // Pause state - stops monster attacks when typing area unfocused
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // Helper function to decrement remaining words (for word completion)
  const decrementRemainingWords = useCallback(() => {
    setRemainingWords(prev => Math.max(0, prev - 1));
  }, []);

  const incrementMonstersDefeated = useCallback(() => {
    setMonstersDefeated(prev => prev + 1);
    setKillStreak(prev => prev + 1);
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
      // Wait for defeat animation to complete before spawning new monster
      // This ensures the old monster fully fades out before the new one appears
      const timeout = setTimeout(() => {
        setIsCurrentMonsterDefeated(false);
      }, 1200); // Match the animation duration
      return () => clearTimeout(timeout);
    }
  }, [monstersDefeated]);

  // Reset hasStartedTyping when monstersDefeated increments (new session starts)
  useEffect(() => {
    setHasStartedTyping(false);
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

  // Set endless difficulty and persist to localStorage
  const setEndlessDifficulty = useCallback(
    (difficulty: 'beginner' | 'intermediate' | 'advanced') => {
      if (VALID_DIFFICULTIES.includes(difficulty)) {
        setEndlessDifficultyState(difficulty);
        try {
          localStorage.setItem(DIFFICULTY_STORAGE_KEY, difficulty);
        } catch {
          // localStorage not available
        }
      }
    },
    []
  );

  // Player HP functions
  const damagePlayer = useCallback((amount: number) => {
    setPlayerHealth(prev => {
      const newHealth = Math.max(0, prev - amount);
      if (newHealth <= 0) {
        setIsPlayerDead(true);
      }
      return newHealth;
    });
  }, []);

  const healPlayer = useCallback((amount: number) => {
    setPlayerHealth(prev => Math.min(MAX_PLAYER_HEALTH, prev + amount));
  }, []);

  const resetPlayerHealth = useCallback(() => {
    setPlayerHealth(MAX_PLAYER_HEALTH);
    setIsPlayerDead(false);
  }, []);

  const resetKillStreak = useCallback(() => {
    setKillStreak(0);
  }, []);

  // Reset all game state while preserving mode and settings (for death retry)
  const resetGameState = useCallback(() => {
    setPlayerHealth(MAX_PLAYER_HEALTH);
    setIsPlayerDead(false);
    setMonstersDefeated(0);
    setKillStreak(0);
    setHasPotion(false);
    setPotionHealAmount(0);
    setIsCurrentMonsterDefeated(false);
    setHasStartedTyping(false);
    setTotalWords(0);
    setRemainingWords(0);
    // Attack timer cleanup is handled by the useEffect when conditions change
  }, []);

  // Potion functions
  const givePotion = useCallback(() => {
    if (Math.random() < POTION_CHANCE) {
      const healAmount =
        Math.floor(Math.random() * (POTION_MAX_HEAL - POTION_MIN_HEAL + 1)) +
        POTION_MIN_HEAL;
      setPotionHealAmount(healAmount);
      setHasPotion(true);
    }
  }, []);

  const drinkPotion = useCallback(() => {
    if (hasPotion && potionHealAmount > 0) {
      healPlayer(potionHealAmount);
      setHasPotion(false);
      setPotionHealAmount(0);
    }
  }, [hasPotion, potionHealAmount, healPlayer]);

  // Periodic monster attacks
  useEffect(() => {
    // Only attack in endless mode and when:
    // - player is alive
    // - monster is not defeated
    // - player has started typing
    if (
      currentMode !== 'endless' ||
      isPlayerDead ||
      isCurrentMonsterDefeated ||
      totalWords === 0 ||
      !hasStartedTyping ||
      isPaused
    ) {
      if (attackTimerRef.current) {
        clearInterval(attackTimerRef.current);
        attackTimerRef.current = null;
      }
      return;
    }

    const attackInterval = ATTACK_INTERVALS[currentMonsterType] * 1000;

    attackTimerRef.current = setInterval(() => {
      const damage = PERIODIC_DAMAGE[currentMonsterType];
      damagePlayer(damage);
      // Dispatch event to show ATTACK! popup in UI
      try {
        window.dispatchEvent(new Event('monster-attack'));
      } catch {
        /* ignore */
      }
    }, attackInterval);

    return () => {
      if (attackTimerRef.current) {
        clearInterval(attackTimerRef.current);
        attackTimerRef.current = null;
      }
    };
  }, [
    currentMode,
    currentMonsterType,
    isPlayerDead,
    isCurrentMonsterDefeated,
    totalWords,
    hasStartedTyping,
    isPaused,
    damagePlayer,
  ]);

  // Expose damage function for typo attacks
  const damagePlayerFromMistake = useCallback(() => {
    const damage =
      Math.floor(
        Math.random() * (MISTAKE_DAMAGE_MAX - MISTAKE_DAMAGE_MIN + 1)
      ) + MISTAKE_DAMAGE_MIN;
    damagePlayer(damage);
  }, [damagePlayer]);

  // Make damagePlayerFromMistake available via a ref or expose it differently
  // For now, we'll add it to context

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
      endlessDifficulty,
      setEndlessDifficulty,
      // Player HP system
      playerHealth,
      maxPlayerHealth: MAX_PLAYER_HEALTH,
      damagePlayer,
      healPlayer,
      resetPlayerHealth,
      isPlayerDead,
      // Monster attack system
      currentMonsterType,
      setCurrentMonsterType,
      damagePlayerFromMistake,
      // Kill streak
      killStreak,
      resetKillStreak,
      // Potion system
      hasPotion,
      potionHealAmount,
      drinkPotion,
      givePotion,
      // Player typing state
      hasStartedTyping,
      setHasStartedTyping,
      // Pause state
      isPaused,
      setIsPaused,
      // Death retry
      resetGameState,
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
      endlessDifficulty,
      setEndlessDifficulty,
      playerHealth,
      damagePlayer,
      healPlayer,
      resetPlayerHealth,
      isPlayerDead,
      currentMonsterType,
      setCurrentMonsterType,
      damagePlayerFromMistake,
      killStreak,
      resetKillStreak,
      hasPotion,
      potionHealAmount,
      drinkPotion,
      givePotion,
      hasStartedTyping,
      isPaused,
      resetGameState,
    ]
  );

  return (
    <GameContext.Provider value={contextValue}>{children}</GameContext.Provider>
  );
};
