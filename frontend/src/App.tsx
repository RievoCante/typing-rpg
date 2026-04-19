import { useState, useEffect } from 'react';
import Header from './components/Header';
import ModeSelector from './components/ModeSelector';
import MilestoneProgress from './components/MilestoneProgress';
import HealthBar from './components/HealthBar';
import Monster from './components/Monster';
import TypingInterface from './components/TypingInterface';
import PlayerLevel from './components/PlayerLevel';
import { usePlayerStats } from './hooks/usePlayerStats';
import { useDailyProgress } from './hooks/useDailyProgress';
import { SLIME_COLORS, SLIME_SIZES } from './types/SlimeTypes';

// Contexts
import { ThemeProvider } from './context/ThemeProvider';
import { GameProvider } from './context/GameProvider';
import { useGameContext } from './hooks/useGameContext';
import { useThemeContext } from './hooks/useThemeContext';
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
  const { totalWords, remainingWords, currentMode, monstersDefeated } =
    useGameContext();
  const { theme } = useThemeContext();

  const dailyProgress = useDailyProgress();
  const { markCompletedToday } = dailyProgress;
  const { bootstrapping } = useBootstrap(markCompletedToday);

  // Calculate monster state based on health
  const healthPercentage =
    totalWords > 0 ? (remainingWords / totalWords) * 100 : 100;
  const isDefeated = healthPercentage <= 0;

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
    <div
      className={`min-h-screen transition-colors duration-300 ${
        theme === 'dark'
          ? 'bg-[#303446]'
          : 'bg-gradient-to-br from-blue-50 via-white to-indigo-50'
      }`}
    >
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
      <PlayerLevel
        level={level}
        currentXp={currentXp}
        xpToNextLevel={xpToNextLevel}
      />
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
