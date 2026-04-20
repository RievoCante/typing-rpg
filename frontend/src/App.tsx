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
import { SLIME_COLORS, SLIME_SIZES } from './types/SlimeTypes';

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
  const { currentMode, monstersDefeated, isCurrentMonsterDefeated } =
    useGameContext();

  const dailyProgress = useDailyProgress();
  const { markCompletedToday } = dailyProgress;
  const { bootstrapping } = useBootstrap(markCompletedToday);

  // Use defeat state from context (tracks actual defeat moment, not derived health %)
  const isDefeated = isCurrentMonsterDefeated;

  // Each new monster gets a random color and size
  const [monsterVisuals, setMonsterVisuals] = useState(() => ({
    color: SLIME_COLORS[Math.floor(Math.random() * SLIME_COLORS.length)],
    scale: SLIME_SIZES[Math.floor(Math.random() * SLIME_SIZES.length)],
  }));

  // Re-randomize visuals when a monster is defeated (monstersDefeated increments)
  useEffect(() => {
    if (monstersDefeated === 0) return; // skip initial mount
    setMonsterVisuals({
      color: SLIME_COLORS[Math.floor(Math.random() * SLIME_COLORS.length)],
      scale: SLIME_SIZES[Math.floor(Math.random() * SLIME_SIZES.length)],
    });
  }, [monstersDefeated]);

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
          monsterType="normal"
          isDefeated={isDefeated}
          color={monsterVisuals.color}
          scale={monsterVisuals.scale}
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
