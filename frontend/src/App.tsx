import Header from './components/Header';
import ModeSelector from './components/ModeSelector';
import MilestoneProgress from './components/MilestoneProgress';
import HealthBar from './components/HealthBar';
import Monster from './components/Monster';
import TypingInterface from './components/TypingInterface';
import PlayerLevel from './components/PlayerLevel';
import RecentSessions from './components/RecentSessions';
import { usePlayerStats } from './hooks/usePlayerStats';
import { useDailyProgress } from './hooks/useDailyProgress';

// Contexts
import { ThemeProvider } from './context/ThemeProvider';
import { GameProvider } from './context/GameProvider';
import { useGameContext } from './hooks/useGameContext';
import { useThemeContext } from './hooks/useThemeContext';
import { useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useApi } from './hooks/useApi';

// Main game content component that uses GameContext
function GameContent() {
  const { level, currentXp, xpToNextLevel } = usePlayerStats();
  const { totalWords, remainingWords, currentMode } = useGameContext();
  const { theme } = useThemeContext();

  const { isSignedIn } = useAuth();
  const { getMe, createMe } = useApi();
  const dailyProgress = useDailyProgress();

  // bootstrap = initial setup work after sign-in
  useEffect(() => {
    if (!isSignedIn) return;
    (async () => {
      try {
        const r1 = await getMe();
        if (r1.status === 404) {
          await createMe();
        }
      } catch {
        // ignore
      }
    })();
  }, [isSignedIn, getMe, createMe]);

  // Calculate monster state based on health
  const healthPercentage = totalWords > 0 ? (remainingWords / totalWords) * 100 : 100;
  const isDefeated = healthPercentage <= 0;

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      theme === 'dark' 
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' 
        : 'bg-gradient-to-br from-blue-50 via-white to-indigo-50'
    }`}>
      <Header />
      <ModeSelector/>
      <HealthBar />
      <Monster 
        monsterType="normal" 
        isDefeated={isDefeated}
      />
      <PlayerLevel
        level={level}
        currentXp={currentXp}
        xpToNextLevel={xpToNextLevel}
      />
      <TypingInterface 
        dailyProgress={dailyProgress}
      />
      {currentMode === 'daily' && (
        <MilestoneProgress 
          completedQuotes={dailyProgress.completedQuotes} 
          totalMilestones={3} 
        />
      )}
      <RecentSessions />
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
