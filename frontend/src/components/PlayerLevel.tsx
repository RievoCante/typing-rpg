// This component displays the player's current level and XP progress.
import { useEffect, useState } from 'react';
import { useThemeContext } from '../hooks/useThemeContext';
import { hpBonus, levelDmgBonus } from '../utils/combatTuning';
import type { LevelUpEvent } from '../utils/combatTuning';
import LevelUpToast from './LevelUpToast';

interface PlayerLevelProps {
  level: number;
  currentXp: number;
  xpToNextLevel: number;
  xpGain?: number; // transient xp gain indicator
  xpGainKey?: number; // bump to re-fire the gain animation (even for equal amounts)
  levelUpEvent?: LevelUpEvent | null; // celebration popup, rendered under the card
  onLevelUpDismiss?: () => void;
}

const GAIN_VISIBLE_MS = 3000; // keep the big +XP on screen for 3s
const GAIN_FADE_MS = 500; // then fade it out

export default function PlayerLevel({
  level,
  currentXp,
  xpToNextLevel,
  xpGain = 0,
  xpGainKey = 0,
  levelUpEvent = null,
  onLevelUpDismiss,
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

  // Cumulative stats earned from leveling (shown on hover). Both are derived
  // purely from level (see combatTuning), so they always reflect current state.
  const hp = hpBonus(level);
  const dmg = levelDmgBonus(level);
  const nextMilestone = (Math.floor(level / 5) + 1) * 5;

  return (
    <div
      className={`group fixed top-20 right-4 p-3 rounded-lg shadow-lg z-50 w-64 transition-colors duration-300 ${
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

      {/* Hover: cumulative stats gained from leveling up */}
      <div
        className={`pointer-events-none absolute top-full right-0 left-0 mt-2 z-50 rounded-lg p-3 text-xs shadow-lg opacity-0 -translate-y-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0 ${
          theme === 'dark'
            ? 'bg-[#23252f] border border-gray-700 text-gray-200'
            : 'bg-white border border-gray-200 text-gray-700'
        }`}
        role="tooltip"
      >
        <div
          className={`mb-2 font-semibold ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
          }`}
        >
          Level bonuses
        </div>
        <div className="flex items-center justify-between">
          <span>Max HP</span>
          <span className="font-bold text-emerald-400">+{hp}</span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span>Base DMG</span>
          <span className="font-bold text-emerald-400">+{dmg.toFixed(2)}</span>
        </div>
        <div
          className={`mt-2 ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          }`}
        >
          Next milestone at Lv {nextMilestone}
        </div>
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

      {/* Level-up / milestone celebration, anchored beneath the card */}
      {levelUpEvent?.leveledUp && onLevelUpDismiss && (
        <LevelUpToast
          level={levelUpEvent.newLevel}
          milestone={levelUpEvent.milestoneReached}
          onDismiss={onLevelUpDismiss}
        />
      )}
    </div>
  );
}
