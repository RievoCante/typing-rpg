import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useDailyProgress } from '../hooks/useDailyProgress';
import MilestoneProgress from './MilestoneProgress';

// Contexts
import { useGameContext } from '../hooks/useGameContext';
import { useThemeContext } from '../hooks/useThemeContext';

const Header: React.FC = () => {
  const { theme, toggleTheme } = useThemeContext();
  const {currentMode} = useGameContext();
  const dailyProgress = useDailyProgress();
  // const { isMuted, toggleMute } = useContext(AudioProvider);

  return (
    <header
      className={`p-4 flex justify-between items-center border-b ${
        theme === 'dark'
          ? 'bg-gray-800 border-gray-700'
          : 'bg-white border-gray-200'
      } transition-colors duration-300`}
    >
      <div className="flex items-center">
        <h1
          className={`text-2xl font-bold mr-2 ${
            theme === 'dark' ? 'text-white' : 'text-black'
          }`}
        >
          Typing RPG
        </h1>
        <span
          className={`text-sm px-2 py-1 rounded-full ${
            theme === 'dark'
              ? 'bg-purple-900 text-purple-200'
              : 'bg-purple-100 text-purple-800'
          }`}
        >
          Beta
        </span>
      </div>
      
      {currentMode === 'daily' && (
        <div className="flex items-center">
          <MilestoneProgress 
            currentMilestone={dailyProgress.completedQuotes} 
            totalMilestones={3} 
          />
        </div>
      )}

      <div className="flex space-x-4">
        {/* <button
          onClick={toggleMute}
          className={`p-2 rounded-full transition-colors ${
            theme === "dark" ? "hover:bg-gray-700" : "hover:bg-gray-100"
          }`}
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button> */}

        <button
          onClick={toggleTheme}
          className={`p-2 rounded-full transition-colors ${
            theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
          }`}
          aria-label={
            theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'
          }
        >
          {theme === 'dark' ? (
            <Sun size={20} className="text-white" />
          ) : (
            <Moon size={20} />
          )}
        </button>
      </div>
    </header>
  );
};

export default Header;
