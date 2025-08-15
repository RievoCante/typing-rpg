// This component displays the player's current level and XP progress.
import { useEffect, useState } from 'react';
import { useThemeContext } from '../hooks/useThemeContext';

interface PlayerLevelProps {
  level: number;
  currentXp: number;
  xpToNextLevel: number;
  xpGain?: number; // transient xp gain indicator
}

export default function PlayerLevel({ level, currentXp, xpToNextLevel, xpGain = 0 }: PlayerLevelProps) {
  const { theme } = useThemeContext();
  const [showGain, setShowGain] = useState(false);
  const [displayAmount, setDisplayAmount] = useState(0);
  
  // Animate +XP when xpGain changes
  useEffect(() => {
    if (!xpGain || xpGain <= 0) return;
    setDisplayAmount(xpGain);
    setShowGain(true);
    const hideTimer = setTimeout(() => setShowGain(false), 1500); // start fade out
    const unmountTimer = setTimeout(() => setDisplayAmount(0), 1500 + 400); // remove after fade
    return () => {
      clearTimeout(hideTimer);
      clearTimeout(unmountTimer);
    };
  }, [xpGain]);
  
  // Calculate the XP progress percentage for the bar's width.
  const xpPercentage = xpToNextLevel > 0 ? (currentXp / xpToNextLevel) * 100 : 0;

  return (
    <div className={`fixed top-20 right-4 p-3 rounded-lg shadow-lg z-50 w-64 transition-colors duration-300 ${
      theme === 'dark' 
        ? 'bg-[#2A2C3C] border border-gray-700' 
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

      {displayAmount > 0 && (
        <div
          className={`mt-2 text-sm font-bold transition-all duration-400 ease-out ${
            showGain ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
          } ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}`}
        >
          +{displayAmount} XP
        </div>
      )}
    </div>
  );
}
