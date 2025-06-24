import Header from './components/Header';
import ModeSelector from './components/ModeSelector';
import MilestoneProgress from './components/MilestoneProgress';
import HealthBar from './components/HealthBar';
import Monster from './components/Monster';
import TypingInterface from './components/TypingInterface';
import PlayerLevel from './components/PlayerLevel';
import { usePlayerStats } from './hooks/usePlayerStats';
import { useDailyProgress } from './hooks/useDailyProgress';

// Contexts
import { ThemeProvider } from './context/ThemeProvider';
import { GameProvider } from './context/GameProvider';
import { useGameContext } from './hooks/useGameContext';
import { useThemeContext } from './hooks/useThemeContext';

// Main game content component that uses GameContext
function GameContent() {
  const { level, currentXp, xpToNextLevel, addXp } = usePlayerStats();
  const { totalWords, remainingWords, currentMode } = useGameContext();
  const { theme } = useThemeContext();
  
  // Centralize daily progress state at App level
  const dailyProgress = useDailyProgress();

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
        addXp={addXp}
        dailyProgress={dailyProgress}
      />
      
      {/* Fixed left sidebar for Daily Progress */}
      {currentMode === 'daily' && (
        <MilestoneProgress 
          completedQuotes={dailyProgress.completedQuotes} 
          totalMilestones={3} 
        />
      )}
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
