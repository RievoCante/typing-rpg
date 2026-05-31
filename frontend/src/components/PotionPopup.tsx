import { useState, useEffect, useCallback } from 'react';
import { useThemeContext } from '../hooks/useThemeContext';
import { useGameContext } from '../hooks/useGameContext';
import { FlaskConical } from 'lucide-react';

export default function PotionPopup() {
  const { theme } = useThemeContext();
  const { hasPotion, potionHealAmount, drinkPotion } = useGameContext();
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (hasPotion) {
      setIsVisible(true);
      // Small delay for entrance animation
      const timer = setTimeout(() => setIsAnimating(true), 50);
      return () => clearTimeout(timer);
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [hasPotion]);

  const handleUsePotion = useCallback(() => {
    // drinkPotion is the context action to consume the potion
    drinkPotion();
  }, [drinkPotion]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
      <div
        className={`pointer-events-auto rounded-xl p-6 shadow-2xl border-2 max-w-sm mx-4 transition-all duration-300 ${
          isAnimating
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 translate-y-4'
        } ${
          theme === 'dark'
            ? 'bg-purple-900/90 border-purple-400 text-white'
            : 'bg-purple-100 border-purple-300 text-gray-900'
        }`}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className={`p-3 rounded-full ${
              theme === 'dark' ? 'bg-purple-800' : 'bg-purple-200'
            }`}
          >
            <FlaskConical
              size={32}
              className={theme === 'dark' ? 'text-pink-300' : 'text-purple-600'}
            />
          </div>
          <div>
            <h3
              className={`font-bold text-lg ${
                theme === 'dark' ? 'text-pink-200' : 'text-purple-800'
              }`}
            >
              Potion Found!
            </h3>
            <p
              className={`text-sm ${
                theme === 'dark' ? 'text-purple-200' : 'text-purple-700'
              }`}
            >
              The monster dropped a healing potion!
            </p>
          </div>
        </div>

        <div
          className={`text-center mb-4 py-2 rounded-lg ${
            theme === 'dark' ? 'bg-purple-800/50' : 'bg-purple-200/50'
          }`}
        >
          <span className="text-2xl font-bold text-green-400">
            +{potionHealAmount} HP
          </span>
        </div>

        <button
          onClick={handleUsePotion}
          className={`w-full py-3 rounded-lg font-bold transition-colors ${
            theme === 'dark'
              ? 'bg-pink-600 hover:bg-pink-500 text-white'
              : 'bg-purple-600 hover:bg-purple-500 text-white'
          }`}
        >
          Drink Potion
        </button>
      </div>
    </div>
  );
}
