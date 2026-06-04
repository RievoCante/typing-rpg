import {
  useState,
  useEffect,
  useCallback,
  useRef,
  lazy,
  Suspense,
} from 'react';
import { SignedIn } from '@clerk/clerk-react';
import { Pause } from 'lucide-react';
import Header from './components/Header';
import ModeSelector from './components/ModeSelector';
import MilestoneProgress from './components/MilestoneProgress';
import HealthBar from './components/HealthBar';
import TypingInterface from './components/TypingInterface';
import PlayerLevel from './components/PlayerLevel';
import PixelArtBackground from './components/PixelArtBackground';
import { useDailyProgress } from './hooks/useDailyProgress';
import { SLIME_COLORS, type SlimeShapeEnum } from './types/SlimeTypes';
import { GOLEM_COLORS } from './types/GolemTypes';
import { MUSHROOM_COLORS } from './types/MushroomTypes';
import { CRYSTAL_COLORS } from './types/CrystalTypes';
import type { MonsterFamily } from './components/Monster';
import { pickEyeStyle, type EyeStyle } from './utils/eyeStyles';
import MonsterNameplate from './components/MonsterNameplate';
import type { MonsterTypeEnum, MonsterVariant } from './context/GameContext';
import {
  pickMonsterType,
  pickMonsterVariant,
  pickMonsterFamily,
} from './utils/monsterSpawn';
import { VARIANT_SIZE } from './utils/combatTuning';
import BattleReport from './components/BattleReport';
import LevelUpToast from './components/LevelUpToast';

// Contexts
import { useGameContext } from './hooks/useGameContext';
import { useBootstrap } from './hooks/useBootstrap';
import LoadingScreen from './components/LoadingScreen';
import VolumeControl from './components/VolumeControl';
import SiteLogo from './components/SiteLogo';
import LeftSidebar from './components/LeftSidebar';
import { useDocumentTitle } from './hooks/useDocumentTitle';

// Lazy-load the three.js-backed surfaces so three-vendor leaves the critical
// path and streams in as an async chunk after first paint.
const Monster = lazy(() => import('./components/Monster'));
const RaidView = lazy(() => import('./components/RaidView'));

// Per-family base scale (the family's natural "medium" size). Multiplied by the
// rarity size factor (VARIANT_SIZE) so size reads as rarity across families.
const FAMILY_BASE_SCALE: Record<MonsterFamily, number> = {
  slime: 0.8,
  golem: 1.6,
  mushroom: 1.0,
  crystal: 1.2,
};

// Main game content component that uses GameContext
function GameContent() {
  const {
    currentMode,
    monstersDefeated,
    isCurrentMonsterDefeated,
    spawnMonster,
    isPlayerDead,
    resetGameState,
    level,
    currentXp,
    xpToNextLevel,
    reloadPlayerStats,
    levelUpEvent,
    clearLevelUpEvent,
    addRunXp,
    isManuallyPaused,
  } = useGameContext();

  const dailyProgress = useDailyProgress();
  const { markCompletedToday } = dailyProgress;
  const { bootstrapping } = useBootstrap(markCompletedToday);

  useDocumentTitle(); // home page uses the default title

  // Use defeat state from context (tracks actual defeat moment, not derived health %)
  const isDefeated = isCurrentMonsterDefeated;

  // Monster randomization: 50/50 family, then random variation
  const [monsterFamily, setMonsterFamily] = useState<MonsterFamily>('slime');
  const [monsterType, setMonsterType] = useState<MonsterTypeEnum>('normal');
  const [monsterShape, setMonsterShape] = useState<SlimeShapeEnum>('round');
  const [monsterVariant, setMonsterVariant] =
    useState<MonsterVariant>('common');

  // Each new monster gets random family, type, color, size, and shape
  const [monsterVisuals, setMonsterVisuals] = useState<{
    color: string;
    scale: number;
    eyeStyle: EyeStyle;
  }>(() => ({
    color: SLIME_COLORS[Math.floor(Math.random() * SLIME_COLORS.length)],
    scale: FAMILY_BASE_SCALE.slime * VARIANT_SIZE.common,
    eyeStyle: 'neutral',
  }));

  // Generate new monster on defeat. Visuals (family, color, size, shape) stay
  // random; the *type* (which drives attack DPS) is gated by run progress via
  // pickMonsterType so fresh runs start safe and difficulty ramps as the player
  // survives — a boss can no longer spawn on the first monster.
  const generateNewMonster = (progress: number = monstersDefeated) => {
    // Weighted family selection (slime/golem common, mushroom/crystal rarer).
    const family: MonsterFamily = pickMonsterFamily();
    setMonsterFamily(family);

    const newMonsterType: MonsterTypeEnum = pickMonsterType(progress);
    setMonsterType(newMonsterType);

    // Variant (common/elite/rare): rarer + tougher + glows, gated by run
    // progress like the tier. Endless only — Daily monsters stay common.
    // Elite/rare also scale up the visual size.
    const variant: MonsterVariant =
      currentMode === 'endless' ? pickMonsterVariant(progress) : 'common';
    setMonsterVariant(variant);

    // Size is driven by rarity (variant), not random: common = small, rare =
    // big. Color stays randomized per family for variety.
    const scale = FAMILY_BASE_SCALE[family] * VARIANT_SIZE[variant];
    let color: string;
    if (family === 'slime') {
      // 50/50 round or square shape, independent of type.
      setMonsterShape(Math.random() > 0.5 ? 'round' : 'square');
      color = SLIME_COLORS[Math.floor(Math.random() * SLIME_COLORS.length)];
    } else if (family === 'golem') {
      color = GOLEM_COLORS[Math.floor(Math.random() * GOLEM_COLORS.length)];
    } else if (family === 'mushroom') {
      color =
        MUSHROOM_COLORS[Math.floor(Math.random() * MUSHROOM_COLORS.length)];
    } else {
      color = CRYSTAL_COLORS[Math.floor(Math.random() * CRYSTAL_COLORS.length)];
    }
    setMonsterVisuals({ color, scale, eyeStyle: pickEyeStyle(family) });

    // Spawn in context: sets type + variant for the attack/HP system AND resets
    // the monster's HP to full for its tier×variant (Endless). Atomic so a
    // same-tier respawn still refills HP.
    spawnMonster(newMonsterType, variant);
  };

  // Spawn the next monster only AFTER the death animation finishes, i.e. when
  // the defeat flag falls true -> false (end of the ~1.2s defeat window set in
  // GameProvider). Keeping the visuals stable through the window lets the dying
  // monster fade out and its particle burst play on a single persistent canvas,
  // instead of the next model flashing in mid-explosion.
  const wasDefeatedRef = useRef(false);
  useEffect(() => {
    if (wasDefeatedRef.current && !isDefeated && monstersDefeated > 0) {
      generateNewMonster();
    }
    // Defeat just started (false -> true): fire the kill event for the kill
    // popup. Endless only — Daily/Raid juice is out of scope.
    if (!wasDefeatedRef.current && isDefeated && currentMode === 'endless') {
      window.dispatchEvent(
        new CustomEvent('monster-killed', {
          detail: { variant: monsterVariant },
        })
      );
    }
    wasDefeatedRef.current = isDefeated;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDefeated, monstersDefeated]);

  // Handle player death - reset everything while preserving current mode, then
  // spawn a fresh random monster. resetGameState refills HP but keeps the dead
  // run's monster type/visuals, so without this the same monster would persist
  // into the new run. Pass progress 0 so the restart begins at the safe tier.
  const handleDeathRestart = () => {
    resetGameState();
    generateNewMonster(0);
  };

  // Changing difficulty restarts the run on the new word pool. DifficultyDropdown
  // dispatches 'restart-run' (it can't reach generateNewMonster, which lives
  // here) after a confirm. The ref keeps the listener calling the latest restart
  // closure without resubscribing every render. The difficulty change itself
  // retriggers TypingInterface's text regen, so the run begins on the new pool.
  const restartRunRef = useRef(handleDeathRestart);
  restartRunRef.current = handleDeathRestart;
  useEffect(() => {
    const handler = () => restartRunRef.current();
    window.addEventListener('restart-run', handler);
    return () => window.removeEventListener('restart-run', handler);
  }, []);

  // Big "+N XP" reward under the Player Level card on monster kill.
  // Nonce bumps every award so equal back-to-back amounts still animate.
  const [xpGain, setXpGain] = useState(0);
  const [xpGainNonce, setXpGainNonce] = useState(0);
  const handleXpGain = useCallback(
    (xp: number) => {
      if (xp <= 0) return;
      addRunXp(xp);
      setXpGain(xp);
      setXpGainNonce(n => n + 1);
    },
    [addRunXp]
  );

  if (bootstrapping) return <LoadingScreen />;

  return (
    <div className="min-h-screen relative">
      {/* Retro pixel art background - Slime Kingdom theme */}
      <PixelArtBackground />

      {/* Game content layered on top */}
      <div className="relative z-10">
        <SiteLogo />
        <LeftSidebar />
        <Header />
        <ModeSelector />
        {currentMode === 'raid' ? (
          <Suspense fallback={<LoadingScreen />}>
            <RaidView />
          </Suspense>
        ) : (
          <>
            <MonsterNameplate family={monsterFamily} variant={monsterVariant} />
            <HealthBar />
            <div className="relative">
              <Suspense
                fallback={
                  <div className="w-full max-w-md mx-auto py-4">
                    <div className="w-full aspect-[3/2]" />
                  </div>
                }
              >
                <Monster
                  monsterFamily={monsterFamily}
                  monsterType={monsterType}
                  variant={monsterVariant}
                  isDefeated={isDefeated}
                  color={monsterVisuals.color}
                  scale={monsterVisuals.scale}
                  shape={monsterShape}
                  eyeStyle={monsterVisuals.eyeStyle}
                  paused={isManuallyPaused}
                />
              </Suspense>
              {isManuallyPaused && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <Pause
                    size={96}
                    className="text-white/85 drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
                    fill="currentColor"
                    strokeWidth={0}
                  />
                </div>
              )}
            </div>
            <SignedIn>
              <PlayerLevel
                level={level}
                currentXp={currentXp}
                xpToNextLevel={xpToNextLevel}
                xpGain={xpGain}
                xpGainKey={xpGainNonce}
              />
            </SignedIn>
            <TypingInterface
              dailyProgress={dailyProgress}
              reloadPlayerStats={reloadPlayerStats}
              onXpGain={handleXpGain}
            />
            {currentMode === 'daily' && (
              <MilestoneProgress
                completedQuotes={dailyProgress.completedQuotes}
                totalMilestones={3}
              />
            )}
          </>
        )}
        <VolumeControl />

        {/* Battle Report (full run recap) when the player dies */}
        {isPlayerDead && <BattleReport onRestart={handleDeathRestart} />}

        {/* Subtle level-up celebration (Endless, signed-in only) */}
        <SignedIn>
          {levelUpEvent?.leveledUp && (
            <LevelUpToast
              level={levelUpEvent.newLevel}
              milestone={levelUpEvent.milestoneReached}
              onDismiss={clearLevelUpEvent}
            />
          )}
        </SignedIn>
      </div>
    </div>
  );
}

function App() {
  return <GameContent />;
}

export default App;
