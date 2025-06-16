import { useState } from 'react';
import Header from './components/Header';
import ModeSelector from './components/ModeSelector';
import MilestoneProgress from './components/MilestoneProgress';
import TypingInterface from './components/TypingInterface';
import { ThemeProvider } from './context/ThemeProvider';
import PlayerLevel from './components/PlayerLevel';
import { usePlayerStats } from './hooks/usePlayerStats';
import { useDailyProgress } from './hooks/useDailyProgress';

function App() {
  const [currentMode, setCurrentMode] = useState<'daily' | 'endless'>('daily');
  const { level, currentXp, xpToNextLevel, addXp } = usePlayerStats();
  const dailyProgress = useDailyProgress();

  const handleModeChange = (mode: 'daily' | 'endless') => {
    setCurrentMode(mode);
  };

  return (
    <ThemeProvider>
      <Header />
      <ModeSelector
        currentMode={currentMode}
        onModeChange={handleModeChange}
      />
      {currentMode === 'daily' && (
        <MilestoneProgress
          currentMilestone={dailyProgress.completedQuotes}
          totalMilestones={3}
        />
      )}
      <PlayerLevel
        level={level}
        currentXp={currentXp}
        xpToNextLevel={xpToNextLevel}
      />
      <TypingInterface
        currentMode={currentMode}
        addXp={addXp}
        onModeChange={handleModeChange}
      />
    </ThemeProvider>
  );
}

export default App;
