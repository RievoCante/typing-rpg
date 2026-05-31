import { useState, useCallback, useMemo, useEffect } from 'react';
import { GameContext, type MonsterTypeEnum } from './GameContext';
import { useEndlessSettings } from '../hooks/useEndlessSettings';
import { usePlayerHealth } from '../hooks/usePlayerHealth';
import { usePotionSystem } from '../hooks/usePotionSystem';
import { useMonsterAttackLoop } from '../hooks/useMonsterAttackLoop';

// GameProvider owns daily/endless game state. Raid state lives entirely inside
// the RaidView component subtree (its own hooks: useRaidSocket, useRaidState)
// so the two surfaces cannot cross-contaminate. `currentMode` here is the
// mode-selector value; switching to 'raid' just causes App.tsx to mount the
// raid surface in place of the daily/endless UI.
export const GameProvider = ({
  children,
  initialMode = 'daily',
}: {
  children: React.ReactNode;
  initialMode?: 'daily' | 'endless';
}) => {
  const [currentMode, setCurrentMode] = useState<'daily' | 'endless' | 'raid'>(
    initialMode
  );
  const [totalWords, setTotalWords] = useState<number>(0);
  const [remainingWords, setRemainingWords] = useState<number>(0);
  const [monstersDefeated, setMonstersDefeated] = useState<number>(0);
  const [isCurrentMonsterDefeated, setIsCurrentMonsterDefeated] =
    useState<boolean>(false);
  const [currentMonsterType, setCurrentMonsterType] =
    useState<MonsterTypeEnum>('normal');
  const [killStreak, setKillStreak] = useState<number>(0);
  const [hasStartedTyping, setHasStartedTyping] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  const endlessSettings = useEndlessSettings();
  const health = usePlayerHealth();
  const potion = usePotionSystem(health.healPlayer);

  useMonsterAttackLoop({
    currentMode,
    currentMonsterType,
    isPlayerDead: health.isPlayerDead,
    isCurrentMonsterDefeated,
    totalWords,
    hasStartedTyping,
    isPaused,
    damagePlayer: health.damagePlayer,
  });

  const decrementRemainingWords = useCallback(() => {
    setRemainingWords(prev => Math.max(0, prev - 1));
  }, []);

  const incrementMonstersDefeated = useCallback(() => {
    setMonstersDefeated(prev => prev + 1);
    setKillStreak(prev => prev + 1);
  }, []);

  const resetDefeatState = useCallback(() => {
    setIsCurrentMonsterDefeated(false);
  }, []);

  // Detect defeat the instant remaining words hit zero, so the UI can fire
  // its defeat animation before the next monster spawns.
  useEffect(() => {
    const pct = totalWords > 0 ? (remainingWords / totalWords) * 100 : 100;
    if (pct <= 0 && !isCurrentMonsterDefeated && totalWords > 0) {
      setIsCurrentMonsterDefeated(true);
    }
  }, [remainingWords, totalWords, isCurrentMonsterDefeated]);

  // Clear the defeat flag after the animation window elapses so the next
  // monster can render fresh.
  useEffect(() => {
    if (monstersDefeated === 0) return;
    const t = setTimeout(() => setIsCurrentMonsterDefeated(false), 1200);
    return () => clearTimeout(t);
  }, [monstersDefeated]);

  // Each new monster session restarts the "started typing" gate so attacks
  // pause until the user actually begins typing.
  useEffect(() => {
    setHasStartedTyping(false);
  }, [monstersDefeated]);

  const resetKillStreak = useCallback(() => setKillStreak(0), []);

  const resetGameState = useCallback(() => {
    health.resetPlayerHealth();
    setMonstersDefeated(0);
    setKillStreak(0);
    potion.resetPotionState();
    setIsCurrentMonsterDefeated(false);
    setHasStartedTyping(false);
    setTotalWords(0);
    setRemainingWords(0);
  }, [health, potion]);

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
      isCurrentMonsterDefeated,
      resetDefeatState,
      ...endlessSettings,
      playerHealth: health.playerHealth,
      maxPlayerHealth: health.maxPlayerHealth,
      damagePlayer: health.damagePlayer,
      healPlayer: health.healPlayer,
      resetPlayerHealth: health.resetPlayerHealth,
      isPlayerDead: health.isPlayerDead,
      currentMonsterType,
      setCurrentMonsterType,
      damagePlayerFromMistake: health.damagePlayerFromMistake,
      killStreak,
      resetKillStreak,
      hasPotion: potion.hasPotion,
      potionHealAmount: potion.potionHealAmount,
      drinkPotion: potion.drinkPotion,
      givePotion: potion.givePotion,
      hasStartedTyping,
      setHasStartedTyping,
      isPaused,
      setIsPaused,
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
      endlessSettings,
      health,
      currentMonsterType,
      killStreak,
      resetKillStreak,
      potion,
      hasStartedTyping,
      isPaused,
      resetGameState,
    ]
  );

  return (
    <GameContext.Provider value={contextValue}>{children}</GameContext.Provider>
  );
};
