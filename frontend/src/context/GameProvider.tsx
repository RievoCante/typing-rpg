import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  GameContext,
  type MonsterTypeEnum,
  type MonsterVariant,
} from './GameContext';
import { useEndlessSettings } from '../hooks/useEndlessSettings';
import { usePlayerHealth } from '../hooks/usePlayerHealth';
import { usePotionSystem } from '../hooks/usePotionSystem';
import { useMonsterAttackLoop } from '../hooks/useMonsterAttackLoop';
import { useComboSystem } from '../hooks/useComboSystem';
import { useWeaponSystem } from '../hooks/useWeaponSystem';
import { useWeaponVault } from '../hooks/useWeaponVault';
import { getWeaponById } from '../utils/weapons';
import {
  MONSTER_MAX_HP,
  VARIANT_HP_MULT,
  VARIANT_COMBO_SURGE,
} from '../utils/combatTuning';

// GameProvider owns daily/endless game state. Raid state lives entirely inside
// the RaidView component subtree (its own hooks: useRaidSocket, useRaidState)
// so the two surfaces cannot cross-contaminate. `currentMode` here is the
// mode-selector value; switching to 'raid' just causes App.tsx to mount the
// raid surface in place of the daily/endless UI.
export const GameProvider = ({
  children,
  initialMode = 'endless',
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
  const [currentMonsterVariant, setCurrentMonsterVariant] =
    useState<MonsterVariant>('common');
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
  // Stable callbacks pulled out so the HP-defeat effect can depend on them
  // without depending on the whole (per-render) combo/potion objects.
  const { addStreak } = combo;

  const endlessSettings = useEndlessSettings();
  const health = usePlayerHealth();
  const potion = usePotionSystem(
    health.healPlayer,
    health.playerHealth,
    health.maxPlayerHealth
  );
  const { addPotion } = potion;
  // Persistent vault (Phase 3b): the run's starting weapon is the player's
  // chosen loadout (resolved from its id) instead of always Fists.
  const weaponVault = useWeaponVault();
  const loadoutWeapon = useMemo(
    () => getWeaponById(weaponVault.loadout),
    [weaponVault.loadout]
  );
  const weapon = useWeaponSystem(loadoutWeapon);
  const {
    tryDrop: tryDropWeapon,
    equipLoadout,
    pendingDrop,
    clearPendingDrop,
  } = weapon;

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

  // Spawn a fresh monster of `type` + `variant` at full HP (Endless). HP scales
  // by variant on top of the tier HP (elite/rare are tougher). Atomic with the
  // type/variant change so a same-tier respawn still resets HP, and a tier or
  // variant change uses the new effective HP. App.generateNewMonster calls this.
  const spawnMonster = useCallback(
    (type: MonsterTypeEnum, variant: MonsterVariant = 'common') => {
      setCurrentMonsterType(type);
      setCurrentMonsterVariant(variant);
      const max = Math.round(MONSTER_MAX_HP[type] * VARIANT_HP_MULT[variant]);
      setMonsterMaxHp(max);
      setMonsterHp(max);
      defeatHandledRef.current = false;
    },
    []
  );

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
      // Variant kill reward: elite/rare grant an instant combo surge (more
      // crits = faster kills), and a rare also drops a potion. Common = none.
      const surge = VARIANT_COMBO_SURGE[currentMonsterVariant];
      if (surge > 0) addStreak(surge);
      if (currentMonsterVariant === 'rare') addPotion();
      // Weapon loot: every kill rolls a drop (chance + rarity scale with the
      // variant). A hit becomes a pending drop surfaced by the weapon-drop modal
      // (no auto-equip — the loadout stays fixed for the run).
      tryDropWeapon(currentMonsterVariant);
    }
  }, [
    currentMode,
    monsterHp,
    monsterMaxHp,
    incrementMonstersDefeated,
    currentMonsterVariant,
    addStreak,
    addPotion,
    tryDropWeapon,
  ]);

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

  // Endless respawn is gated behind the post-kill results overlay: the defeat
  // flag stays true (monster shows its death state) until the player presses
  // Space, at which point TypingInterface calls resetDefeatState() -> App spawns
  // the next monster. (Daily/raid still clear via the remainingWords derive.)

  // Each new monster session restarts the "started typing" gate so attacks
  // pause until the user actually begins typing. Endless is a continuous stream
  // where monstersDefeated increments mid-typing on every HP kill, so resetting
  // the gate there would stutter the flow — endless re-gates per text block via
  // TypingInterface's text-change effect instead.
  useEffect(() => {
    if (currentMode === 'endless') return;
    setHasStartedTyping(false);
  }, [currentMode, monstersDefeated]);

  // Apply the persistent loadout as the run's starting weapon while the run is
  // fresh (no kills yet, not started typing, alive). Covers the vault loading
  // async and the player changing their loadout in the pre-run panel. Once
  // typing/kills begin it won't yank a mid-run weapon; death restores the
  // loadout via weapon.reset() in resetGameState.
  useEffect(() => {
    if (
      currentMode === 'endless' &&
      monstersDefeated === 0 &&
      !hasStartedTyping &&
      !health.isPlayerDead
    ) {
      equipLoadout(loadoutWeapon);
    }
  }, [
    currentMode,
    monstersDefeated,
    hasStartedTyping,
    health.isPlayerDead,
    loadoutWeapon,
    equipLoadout,
  ]);

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
    setCurrentMonsterVariant('common');
    defeatHandledRef.current = false;
    combo.reset();
    weapon.reset();
  }, [health, potion, combo, weapon]);

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
      currentMonsterVariant,
      equippedWeapon: weapon.equippedWeapon,
      pendingDrop,
      clearPendingDrop,
      weaponVault: {
        unlocked: weaponVault.unlocked,
        loadout: weaponVault.loadout,
        setLoadout: weaponVault.setLoadout,
        isSignedIn: weaponVault.isSignedIn,
      },
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
      currentMonsterVariant,
      weapon.equippedWeapon,
      pendingDrop,
      clearPendingDrop,
      weaponVault.unlocked,
      weaponVault.loadout,
      weaponVault.setLoadout,
      weaponVault.isSignedIn,
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
