// This component displays the player's current level and XP progress.
import { useEffect, useState } from 'react';
import { useThemeContext } from '../hooks/useThemeContext';

interface PlayerLevelProps {
  level: number;
  currentXp: number;
  xpToNextLevel: number;
  xpGain?: number; // transient xp gain indicator
  xpGainKey?: number; // bump to re-fire the gain animation (even for equal amounts)
}

const GAIN_VISIBLE_MS = 3000; // keep the big +XP on screen for 3s
const GAIN_FADE_MS = 500; // then fade it out

export default function PlayerLevel({
  level,
  currentXp,
  xpToNextLevel,
  xpGain = 0,
  xpGainKey = 0,
}: PlayerLevelProps) {
  const { theme } = useThemeContext();
  const [showGain, setShowGain] = useState(false);
  const [displayAmount, setDisplayAmount] = useState(0);

  // Animate the big +XP badge whenever a new gain comes in. Keyed on
  // xpGainKey so back-to-back kills awarding the same XP still re-fire.
  useEffect(() => {
    if (!xpGain || xpGain <= 0) return;
    setDisplayAmount(xpGain);
    setShowGain(true);
    const hideTimer = setTimeout(() => setShowGain(false), GAIN_VISIBLE_MS); // start fade out
    const unmountTimer = setTimeout(
      () => setDisplayAmount(0),
      GAIN_VISIBLE_MS + GAIN_FADE_MS
    ); // remove after fade
    return () => {
      clearTimeout(hideTimer);
      clearTimeout(unmountTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xpGainKey]);

  // Calculate the XP progress percentage for the bar's width.
  const xpPercentage =
    xpToNextLevel > 0 ? (currentXp / xpToNextLevel) * 100 : 0;

  return (
    <div
      className={`fixed top-20 right-4 p-3 rounded-lg shadow-lg z-50 w-64 transition-colors duration-300 ${
        theme === 'dark'
          ? 'bg-[#2A2C3C] border border-gray-700'
          : 'bg-white border border-gray-200'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span
          className={`text-sm font-semibold ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
          }`}
        >
          Player Level
        </span>
        <span
          className={`text-lg font-bold ${
            theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'
          }`}
        >
          {level}
        </span>
      </div>
      <div
        className={`w-full h-2 rounded-full overflow-hidden ${
          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
        }`}
      >
        <div
          className={`h-full transition-all duration-300 ease-in-out ${
            theme === 'dark' ? 'bg-yellow-400' : 'bg-yellow-500'
          }`}
          style={{ width: `${xpPercentage}%` }}
        ></div>
      </div>
      <div
        className={`flex justify-between text-xs mt-1 ${
          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
        }`}
      >
        <span>{currentXp} XP</span>
        <span>{xpToNextLevel} XP</span>
      </div>

      {/* Big "+N XP" reward, shown just below the card on monster kill */}
      {displayAmount > 0 && (
        <div className="absolute top-full left-0 right-0 mt-3 flex justify-center pointer-events-none">
          <span
            className={`text-4xl font-extrabold tracking-wide drop-shadow-lg transition-all ease-out ${
              showGain
                ? 'opacity-100 translate-y-0 scale-100 duration-300'
                : 'opacity-0 -translate-y-2 scale-90 duration-500'
            } ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-500'}`}
          >
            +{displayAmount} XP
          </span>
        </div>
      )}
    </div>
  );
}
