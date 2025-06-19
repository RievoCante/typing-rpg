import Header from './components/Header';
import ModeSelector from './components/ModeSelector';
import TypingInterface from './components/TypingInterface';
import PlayerLevel from './components/PlayerLevel';
import { usePlayerStats } from './hooks/usePlayerStats';

// Contexts
import { ThemeProvider } from './context/ThemeProvider';
import { GameProvider } from './context/GameProvider';

function App() {
  const { level, currentXp, xpToNextLevel, addXp } = usePlayerStats();

  return (
    <ThemeProvider>
      <GameProvider>
        <Header/>
        <ModeSelector/>
        <PlayerLevel
          level={level}
          currentXp={currentXp}
          xpToNextLevel={xpToNextLevel}
        />
        <TypingInterface addXp={addXp}
/>
      </GameProvider>
    </ThemeProvider>
  );
}

export default App;
