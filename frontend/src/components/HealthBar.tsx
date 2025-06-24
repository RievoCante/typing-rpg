import { useThemeContext } from '../hooks/useThemeContext';
import { useGameContext } from '../hooks/useGameContext';

interface HealthBarProps {
  isAnimating?: boolean; // For hit animation
}

export default function HealthBar({ isAnimating = false }: HealthBarProps) {
  const { theme } = useThemeContext();
  const { totalWords, remainingWords } = useGameContext();
  
  // Calculate health percentage based on remaining words
  // Health = (remainingWords / totalWords) * 100
  const validRemainingWords = Math.max(0, Math.min(remainingWords, totalWords));
  const healthPercentage = totalWords > 0 ? (validRemainingWords / totalWords) * 100 : 0;
  const clampedHealth = Math.max(0, Math.min(100, healthPercentage));
  
  // Health parts logic based on mode (for future use)
  // In daily mode: health parts = length of current quote
  // In endless mode: health parts = 25 (fixed)

  return (
    <div className="w-full max-w-xs mx-auto mb-4">
      <div className={`h-4 rounded-full border-2 overflow-hidden ${
        theme === 'dark' 
          ? 'bg-gray-800 border-gray-600' 
          : 'bg-gray-200 border-gray-300'
      }`}>
        <div 
          className={`h-full transition-all duration-300 ${
            isAnimating ? 'animate-pulse' : ''
          } ${
            clampedHealth > 60 ? 'bg-green-500' :
            clampedHealth > 30 ? 'bg-yellow-500' :
            'bg-red-500'
          }`}
          style={{ width: `${clampedHealth}%` }}
        />
      </div>
    </div>
  );
} 