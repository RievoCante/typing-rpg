import { useState, useEffect } from 'react';
import { SignedIn } from '@clerk/clerk-react';
import Header from './components/Header';
import ModeSelector from './components/ModeSelector';
import MilestoneProgress from './components/MilestoneProgress';
import HealthBar from './components/HealthBar';
import Monster from './components/Monster';
import TypingInterface from './components/TypingInterface';
import PlayerLevel from './components/PlayerLevel';
import PixelArtBackground from './components/PixelArtBackground';
import { usePlayerStats } from './hooks/usePlayerStats';
import { useDailyProgress } from './hooks/useDailyProgress';
import {
  SLIME_COLORS,
  SLIME_SIZES,
  type SlimeShapeEnum,
} from './types/SlimeTypes';
import { GOLEM_COLORS, GOLEM_SIZES } from './types/GolemTypes';
import type { MonsterFamily } from './components/Monster';
import type { MonsterTypeEnum } from './context/GameContext';
import PotionPopup from './components/PotionPopup';
import DeathPopup from './components/DeathPopup';

// Contexts
import { ThemeProvider } from './context/ThemeProvider';
import { GameProvider } from './context/GameProvider';
import { useGameContext } from './hooks/useGameContext';
import { useBootstrap } from './hooks/useBootstrap';
import LoadingScreen from './components/LoadingScreen';
import VolumeControl from './components/VolumeControl';
import SiteLogo from './components/SiteLogo';
import LeftSidebar from './components/LeftSidebar';

// Main game content component that uses GameContext
function GameContent() {
  const {
    level,
    currentXp,
    xpToNextLevel,
    reload: reloadPlayerStats,
  } = usePlayerStats();
  const {
    currentMode,
    monstersDefeated,
    isCurrentMonsterDefeated,
    setCurrentMonsterType,
    isPlayerDead,
    resetPlayerHealth,
    resetKillStreak,
    givePotion,
    hasPotion,
  } = useGameContext();

  const dailyProgress = useDailyProgress();
  const { markCompletedToday } = dailyProgress;
  const { bootstrapping } = useBootstrap(markCompletedToday);

  // Use defeat state from context (tracks actual defeat moment, not derived health %)
  const isDefeated = isCurrentMonsterDefeated;

  // Monster randomization: 50/50 family, then random variation
  const [monsterFamily, setMonsterFamily] = useState<MonsterFamily>('slime');
  const [monsterType, setMonsterType] = useState<MonsterTypeEnum>('normal');
  const [monsterShape, setMonsterShape] = useState<SlimeShapeEnum>('round');

  // Each new monster gets random family, type, color, size, and shape
  const [monsterVisuals, setMonsterVisuals] = useState(() => ({
    color: SLIME_COLORS[Math.floor(Math.random() * SLIME_COLORS.length)],
    scale: SLIME_SIZES[Math.floor(Math.random() * SLIME_SIZES.length)],
  }));

  // Helper to get random slime type and shape
  const getRandomSlimeType = (): {
    type: MonsterTypeEnum;
    shape: SlimeShapeEnum;
  } => {
    const types: MonsterTypeEnum[] = ['normal', 'mini-boss', 'boss'];
    const type = types[Math.floor(Math.random() * types.length)];
    // 50/50 chance for round or square shape, independent of type
    const shape: SlimeShapeEnum = Math.random() > 0.5 ? 'round' : 'square';
    return { type, shape };
  };

  // Helper to get random golem type
  const getRandomGolemType = (): MonsterTypeEnum => {
    const types: MonsterTypeEnum[] = ['normal', 'mini-boss', 'boss'];
    return types[Math.floor(Math.random() * types.length)];
  };

  // Generate new monster on defeat
  const generateNewMonster = () => {
    // 50/50 family selection
    const family: MonsterFamily = Math.random() > 0.5 ? 'slime' : 'golem';
    setMonsterFamily(family);

    let newMonsterType: MonsterTypeEnum;

    if (family === 'slime') {
      const slimeConfig = getRandomSlimeType();
      newMonsterType = slimeConfig.type;
      setMonsterType(slimeConfig.type);
      setMonsterShape(slimeConfig.shape);
      setMonsterVisuals({
        color: SLIME_COLORS[Math.floor(Math.random() * SLIME_COLORS.length)],
        scale: SLIME_SIZES[Math.floor(Math.random() * SLIME_SIZES.length)],
      });
    } else {
      newMonsterType = getRandomGolemType();
      setMonsterType(newMonsterType);
      setMonsterVisuals({
        color: GOLEM_COLORS[Math.floor(Math.random() * GOLEM_COLORS.length)],
        scale: GOLEM_SIZES[Math.floor(Math.random() * GOLEM_SIZES.length)],
      });
    }

    // Update the monster type in context for attack system
    setCurrentMonsterType(newMonsterType);
  };

  // Re-randomize visuals when a monster is defeated (monstersDefeated increments)
  useEffect(() => {
    if (monstersDefeated === 0) return; // skip initial mount
    generateNewMonster();
    // Offer potion after monster defeat
    givePotion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monstersDefeated]);

  // Handle player death - reset everything
  const handleDeathRestart = () => {
    resetPlayerHealth();
    resetKillStreak();
    // Reload page or reset session - for now, we'll just reload
    window.location.reload();
  };

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
        <HealthBar />
        <Monster
          key={monstersDefeated}
          monsterFamily={monsterFamily}
          monsterType={monsterType}
          isDefeated={isDefeated}
          color={monsterVisuals.color}
          scale={monsterVisuals.scale}
          shape={monsterShape}
        />
        <SignedIn>
          <PlayerLevel
            level={level}
            currentXp={currentXp}
            xpToNextLevel={xpToNextLevel}
          />
        </SignedIn>
        <TypingInterface
          dailyProgress={dailyProgress}
          reloadPlayerStats={reloadPlayerStats}
        />
        {currentMode === 'daily' && (
          <MilestoneProgress
            completedQuotes={dailyProgress.completedQuotes}
            totalMilestones={3}
          />
        )}
        <VolumeControl />

        {/* Potion popup when available */}
        {hasPotion && <PotionPopup />}

        {/* Death popup when player dies */}
        {isPlayerDead && <DeathPopup onRestart={handleDeathRestart} />}
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <GameProvider>
        <GameContent />
      </GameProvider>
    </ThemeProvider>
  );
}

export default App;
