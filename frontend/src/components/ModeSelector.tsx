import { useThemeContext } from '../hooks/useThemeContext';
import { useGameContext } from '../hooks/useGameContext';
import { useEffect, useState } from 'react';

interface ModeSelectorProps {
  isCompletedToday: boolean;
  getTimeUntilReset: () => { hours: number; minutes: number; seconds: number };
}

export default function ModeSelector({ isCompletedToday, getTimeUntilReset }: ModeSelectorProps) {
  const { theme } = useThemeContext();
  const { currentMode, setCurrentMode } = useGameContext();
  const [timeLeft, setTimeLeft] = useState(getTimeUntilReset());

  // Live ticking countdown without heavy re-renders
  useEffect(() => {
    setTimeLeft(getTimeUntilReset());
    const id = setInterval(() => {
      setTimeLeft(getTimeUntilReset());
    }, 1000);
    return () => clearInterval(id);
  }, [getTimeUntilReset]);

  const resetTooltip = `Resets in ${String(timeLeft.hours).padStart(2, '0')}:${String(timeLeft.minutes).padStart(2, '0')}:${String(timeLeft.seconds).padStart(2, '0')} (UTC)`;

  return (
    <div className="flex justify-center w-full py-6">
      <div 
        className={`relative flex rounded-lg p-1 transition-colors duration-300 ${
          theme === 'dark' 
            ? 'bg-gray-800 border border-gray-700' 
            : 'bg-gray-100 border border-gray-200'
        }`}
      >
        {/* Sliding background indicator */}
        <div
          className={`absolute top-1 bottom-1 w-1/2 rounded-md transition-all duration-300 ease-in-out ${
            theme === 'dark' ? 'bg-gray-700' : 'bg-white shadow-sm'
          } ${
            currentMode === 'endless' ? 'translate-x-full' : 'translate-x-0'
          }`}
        />
        
        {/* Daily Mode Button */}
        <div className="relative group">
          <button
            onClick={() => setCurrentMode('daily')}
            disabled={isCompletedToday}
            className={`relative z-10 px-8 py-3 rounded-md transition-all duration-300 font-medium text-lg min-w-[140px] flex items-center justify-center ${
              currentMode === 'daily'
                ? theme === 'dark'
                  ? 'text-white'
                  : 'text-gray-900'
                : theme === 'dark'
                  ? 'text-gray-400 hover:text-gray-300'
                  : 'text-gray-500 hover:text-gray-700'
            } ${isCompletedToday ? 'opacity-50' : ''}`}
          >
            Daily
          </button>
          {isCompletedToday && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-green-400 font-semibold text-sm">Completed</span>
            </div>
          )}
          {isCompletedToday && (
            <div className={`absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap ${
              theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-800 text-white'
            }`}>
              {resetTooltip}
            </div>
          )}
        </div>
        
        {/* Endless Mode Button */}
        <button
          onClick={() => setCurrentMode('endless')}
          className={`relative z-10 px-8 py-3 rounded-md transition-all duration-300 font-medium text-lg min-w-[140px] flex items-center justify-center ${
            currentMode === 'endless'
              ? theme === 'dark'
                ? 'text-white'
                : 'text-gray-900'
              : theme === 'dark'
                ? 'text-gray-400 hover:text-gray-300'
                : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Endless
        </button>
      </div>
    </div>
  );
}
