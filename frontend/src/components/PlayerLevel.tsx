// This component displays the player's current level and XP progress.
import { useThemeContext } from '../hooks/useThemeContext';

interface PlayerLevelProps {
  level: number;
  currentXp: number;
  xpToNextLevel: number;
}

export default function PlayerLevel({ level, currentXp, xpToNextLevel }: PlayerLevelProps) {
  const { theme } = useThemeContext();
  
  // Calculate the XP progress percentage for the bar's width.
  const xpPercentage = xpToNextLevel > 0 ? (currentXp / xpToNextLevel) * 100 : 0;

  return (
    <div className={`fixed top-20 right-4 p-3 rounded-lg shadow-lg z-50 w-64 transition-colors duration-300 ${
      theme === 'dark' 
        ? 'bg-gray-800 border border-gray-700' 
        : 'bg-white border border-gray-200'
    }`}>
      <div className="flex items-center justify-between mb-1">
        <span className={`text-sm font-semibold ${
          theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
        }`}>Player Level</span>
        <span className={`text-lg font-bold ${
          theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'
        }`}>{level}</span>
      </div>
      <div className={`w-full h-2 rounded-full overflow-hidden ${
        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
      }`}>
        <div
          className={`h-full transition-all duration-300 ease-in-out ${
            theme === 'dark' ? 'bg-yellow-400' : 'bg-yellow-500'
          }`}
          style={{ width: `${xpPercentage}%` }}
        ></div>
      </div>
      <div className={`flex justify-between text-xs mt-1 ${
        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
      }`}>
        <span>{currentXp} XP</span>
        <span>{xpToNextLevel} XP</span>
      </div>
    </div>
  );
}
