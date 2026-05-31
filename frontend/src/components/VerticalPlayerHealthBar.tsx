import { useState, useEffect } from 'react';
import { useThemeContext } from '../hooks/useThemeContext';
import { useGameContext } from '../hooks/useGameContext';
import { Heart, Skull } from 'lucide-react';

interface VerticalPlayerHealthBarProps {
  className?: string;
}

export default function VerticalPlayerHealthBar({
  className = '',
}: VerticalPlayerHealthBarProps) {
  const { theme } = useThemeContext();
  const { playerHealth, maxPlayerHealth, isPlayerDead, killStreak } =
    useGameContext();
  const [isFlashing, setIsFlashing] = useState(false);
  const [prevHealth, setPrevHealth] = useState(playerHealth);

  // Flash when health decreases (monster attacked)
  useEffect(() => {
    if (playerHealth < prevHealth) {
      setIsFlashing(true);
      const timeout = setTimeout(() => setIsFlashing(false), 300);
      return () => clearTimeout(timeout);
    }
    setPrevHealth(playerHealth);
  }, [playerHealth, prevHealth]);

  const healthPercentage = (playerHealth / maxPlayerHealth) * 100;
  const clampedHealth = Math.max(0, Math.min(100, healthPercentage));

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      {/* Kill streak - at top */}
      {killStreak > 0 && (
        <div className="flex flex-col items-center">
          <span className="text-lg">🔥</span>
          <span
            className={`text-xs font-bold ${
              theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'
            }`}
          >
            {killStreak}
          </span>
        </div>
      )}

      {/* Heart/Death icon - above health bar */}
      <div className="flex-shrink-0">
        {isPlayerDead ? (
          <Skull size={24} className="text-red-600" />
        ) : (
          <Heart size={24} className="text-red-500" fill="#ef4444" />
        )}
      </div>

      {/* Vertical Health bar container */}
      <div
        className={`w-6 h-48 rounded-full border-2 overflow-hidden relative ${
          isFlashing
            ? 'border-red-500 animate-pulse shadow-lg shadow-red-500/50'
            : theme === 'dark'
              ? 'bg-gray-800 border-gray-600'
              : 'bg-gray-200 border-gray-300'
        }`}
      >
        {/* Red health fill - grows from bottom */}
        <div
          className={`absolute bottom-0 left-0 right-0 transition-all duration-300 ${
            isPlayerDead ? 'bg-red-900' : 'bg-red-600'
          }`}
          style={{ height: `${clampedHealth}%` }}
        />
      </div>

      {/* HP text - below health bar */}
      <span
        className={`text-xs font-bold ${
          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
        }`}
      >
        {isPlayerDead ? 'DEAD' : Math.round(playerHealth)}
      </span>
    </div>
  );
}
