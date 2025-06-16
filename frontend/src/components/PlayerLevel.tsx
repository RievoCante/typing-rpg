// This component displays the player's current level and XP progress.

interface PlayerLevelProps {
  level: number;
  currentXp: number;
  xpToNextLevel: number;
}

export default function PlayerLevel({ level, currentXp, xpToNextLevel }: PlayerLevelProps) {
  // Calculate the XP progress percentage for the bar's width.
  const xpPercentage = xpToNextLevel > 0 ? (currentXp / xpToNextLevel) * 100 : 0;

  return (
        <div className="fixed top-20 right-4 bg-gray-800 p-3 rounded-lg shadow-lg z-50 w-64">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold text-gray-300">Player Level</span>
        <span className="text-lg font-bold text-yellow-400">{level}</span>
      </div>
      <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-yellow-400 transition-all duration-300 ease-in-out"
          style={{ width: `${xpPercentage}%` }}
        ></div>
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>{currentXp} XP</span>
        <span>{xpToNextLevel} XP</span>
      </div>
    </div>
  );
}
