import { useThemeContext } from '../hooks/useThemeContext';
import { useGameContext } from '../hooks/useGameContext';

interface HealthBarProps {
  isAnimating?: boolean; // For hit animation
}

export default function HealthBar({ isAnimating = false }: HealthBarProps) {
  const { theme } = useThemeContext();
  const { currentMode, totalWords, remainingWords, monsterHp, monsterMaxHp } =
    useGameContext();

  // Endless: monster has real HP (combat damage). Daily/Raid: HP tracks the
  // remaining words in the current quote/text (unchanged behavior).
  let clampedHealth: number;
  if (currentMode === 'endless') {
    const validHp = Math.max(0, Math.min(monsterHp, monsterMaxHp));
    const pct = monsterMaxHp > 0 ? (validHp / monsterMaxHp) * 100 : 0;
    clampedHealth = Math.max(0, Math.min(100, pct));
  } else {
    const validRemainingWords = Math.max(
      0,
      Math.min(remainingWords, totalWords)
    );
    const pct = totalWords > 0 ? (validRemainingWords / totalWords) * 100 : 0;
    clampedHealth = Math.max(0, Math.min(100, pct));
  }

  return (
    <div className="w-full max-w-xs mx-auto mb-4">
      <div
        className={`h-4 rounded-full border-2 overflow-hidden ${
          theme === 'dark'
            ? 'bg-gray-800 border-gray-600'
            : 'bg-gray-200 border-gray-300'
        }`}
      >
        <div
          className={`h-full transition-all duration-300 ${
            isAnimating ? 'animate-pulse' : ''
          } ${
            clampedHealth > 60
              ? 'bg-green-500'
              : clampedHealth > 30
                ? 'bg-yellow-500'
                : 'bg-red-500'
          }`}
          style={{ width: `${clampedHealth}%` }}
        />
      </div>
    </div>
  );
}
