import { useState } from 'react';
import Header from './components/Header';
import TypingInterface from './components/TypingInterface';
import { ThemeProvider } from './context/ThemeProvider';
import PlayerLevel from './components/PlayerLevel';
import { usePlayerStats } from './hooks/usePlayerStats';

function App() {
  const [currentMode, setCurrentMode] = useState<'daily' | 'endless'>('daily');
  const { level, currentXp, xpToNextLevel, addXp } = usePlayerStats();

  const handleModeChange = (mode: 'daily' | 'endless') => {
    setCurrentMode(mode);
  };

  return (
    <ThemeProvider>
      <Header />
      <PlayerLevel
        level={level}
        currentXp={currentXp}
        xpToNextLevel={xpToNextLevel}
      />
      <TypingInterface
        currentMode={currentMode}
        onModeChange={handleModeChange}
        addXp={addXp}
      />
    </ThemeProvider>
  );
}

export default App;
