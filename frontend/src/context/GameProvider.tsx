import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { GameContext, type MonsterTypeEnum } from './GameContext';
import { useEndlessSettings } from '../hooks/useEndlessSettings';
import { usePlayerHealth } from '../hooks/usePlayerHealth';
import { usePotionSystem } from '../hooks/usePotionSystem';
import { useMonsterAttackLoop } from '../hooks/useMonsterAttackLoop';
import { useComboSystem } from '../hooks/useComboSystem';
import { MONSTER_MAX_HP } from '../utils/combatTuning';

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

  // Endless monster HP (decoupled from words). Initialized to the normal tier;
  // each spawn resets it via spawnMonster. Daily/raid never touch these.
  const [monsterMaxHp, setMonsterMaxHp] = useState<number>(
    MONSTER_MAX_HP.normal
  );
  const [monsterHp, setMonsterHp] = useState<number>(MONSTER_MAX_HP.normal);
  const combo = useComboSystem();

  const endlessSettings = useEndlessSettings();
  const health = usePlayerHealth();
  const potion = usePotionSystem(
    health.healPlayer,
    health.playerHealth,
    health.maxPlayerHealth
  );

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

  // Subtract combo damage from the current monster (Endless). Clamped at 0.
  const damageMonster = useCallback((amount: number) => {
    setMonsterHp(prev => Math.max(0, prev - amount));
  }, []);

  // One-shot guard so the endless HP-defeat effect fires exactly once per
  // monster. Cleared only by spawnMonster (a genuinely new monster) — NOT by the
  // defeat flag — because HP sits at 0 through the death-animation window, during
  // which the flag flips back to false a render before spawnMonster restores HP.
  // Guarding on the flag would re-fire defeat in that gap and freeze the game.
  const defeatHandledRef = useRef<boolean>(false);

  // Spawn a fresh monster of `type` at full tier HP (Endless). Atomic with the
  // type change so a same-tier respawn (normal -> normal) still resets HP, and
  // a tier change uses the new tier's HP. App.generateNewMonster calls this.
  const spawnMonster = useCallback((type: MonsterTypeEnum) => {
    setCurrentMonsterType(type);
    const max = MONSTER_MAX_HP[type];
    setMonsterMaxHp(max);
    setMonsterHp(max);
    defeatHandledRef.current = false;
  }, []);

  // Endless: the monster dies the instant its HP hits zero (combat damage),
  // mid-stream. This is THE kill event in endless — it counts the defeat, which
  // drives the death-animation timer below + App respawn. One-shot via
  // defeatHandledRef so it can't re-fire while HP sits at 0 during the window.
  // Block/text completion is just a buffer refill and must NOT count a kill
  // (see useTypingCompletion).
  useEffect(() => {
    if (currentMode !== 'endless') return;
    if (monsterHp <= 0 && monsterMaxHp > 0 && !defeatHandledRef.current) {
      defeatHandledRef.current = true;
      setIsCurrentMonsterDefeated(true);
      incrementMonstersDefeated();
    }
  }, [currentMode, monsterHp, monsterMaxHp, incrementMonstersDefeated]);

  // Daily/raid: the monster is "defeated" exactly while its HP (remaining words)
  // sits at zero with a prompt loaded. Deriving the flag from remainingWords sets
  // it once on the kill and clears it the instant the next prompt loads — no
  // matter how long the post-kill results screen holds the pause open. (A fixed
  // timer here used to mis-fire while that results screen waited for Space.)
  // Endless does not use the word pool for defeat — its HP effect above owns that.
  useEffect(() => {
    if (currentMode === 'endless') return;
    if (totalWords <= 0) return;
    const defeated = remainingWords <= 0;
    setIsCurrentMonsterDefeated(prev => (prev === defeated ? prev : defeated));
  }, [currentMode, remainingWords, totalWords]);

  // Endless only: clear the defeat flag after the death-animation window so App
  // spawns the next monster. Endless has no per-kill press-Space pause, so the
  // fixed window is safe here (daily/raid instead clear via the remainingWords
  // derive above when the next prompt loads).
  useEffect(() => {
    if (currentMode !== 'endless') return;
    if (monstersDefeated === 0) return;
    const t = setTimeout(() => setIsCurrentMonsterDefeated(false), 1200);
    return () => clearTimeout(t);
  }, [currentMode, monstersDefeated]);

  // Each new monster session restarts the "started typing" gate so attacks
  // pause until the user actually begins typing. Endless is a continuous stream
  // where monstersDefeated increments mid-typing on every HP kill, so resetting
  // the gate there would stutter the flow — endless re-gates per text block via
  // TypingInterface's text-change effect instead.
  useEffect(() => {
    if (currentMode === 'endless') return;
    setHasStartedTyping(false);
  }, [currentMode, monstersDefeated]);

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
    setMonsterMaxHp(MONSTER_MAX_HP.normal);
    setMonsterHp(MONSTER_MAX_HP.normal);
    defeatHandledRef.current = false;
    combo.reset();
  }, [health, potion, combo]);

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
      monsterHp,
      monsterMaxHp,
      damageMonster,
      spawnMonster,
      comboStreak: combo.streak,
      comboCritChance: combo.critChance,
      registerComboCorrect: combo.registerCorrectWord,
      registerComboWrong: combo.registerWrongWord,
      ...endlessSettings,
      playerHealth: health.playerHealth,
      maxPlayerHealth: health.maxPlayerHealth,
      damagePlayer: health.damagePlayer,
      healPlayer: health.healPlayer,
      resetPlayerHealth: health.resetPlayerHealth,
      isPlayerDead: health.isPlayerDead,
      currentMonsterType,
      damagePlayerFromMistake: health.damagePlayerFromMistake,
      killStreak,
      resetKillStreak,
      potionCount: potion.potionCount,
      maxPotions: potion.maxPotions,
      registerCorrectWord: potion.registerCorrectWord,
      drinkPotion: potion.drinkPotion,
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
      monsterHp,
      monsterMaxHp,
      damageMonster,
      spawnMonster,
      combo.streak,
      combo.critChance,
      combo.registerCorrectWord,
      combo.registerWrongWord,
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
