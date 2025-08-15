import { useThemeContext } from '../hooks/useThemeContext';
import { useGameContext } from '../hooks/useGameContext';
import { useEffect, useState } from 'react';

export default function ModeSelector() {
  const { theme } = useThemeContext();
  const { currentMode, setCurrentMode } = useGameContext();
  const [, setTick] = useState(0);

  // Live ticking countdown without heavy re-renders
  useEffect(() => {
    const id = setInterval(() => setTick((n) => (n + 1) % 60), 1000);
    return () => clearInterval(id);
  }, []);

  // Countdown shown in TypingInterface when completed

  return (
    <div className="flex justify-center w-full py-6">
      <div 
        className={`relative flex rounded-lg p-1 transition-colors duration-300 ${
          theme === 'dark' 
            ? 'bg-[#2A2C3C] border border-gray-700' 
            : 'bg-gray-100 border border-gray-200'
        }`}
      >
        {/* Sliding background indicator */}
        <div
          className={`absolute top-1 bottom-1 left-1 w-[calc(50%-0.25rem)] rounded-md transition-all duration-300 ease-in-out ${
            theme === 'dark' ? 'bg-gray-700' : 'bg-white shadow-sm'
          } ${
            currentMode === 'endless' ? 'translate-x-full' : 'translate-x-0'
          }`}
        />
        
        {/* Daily Mode Button */}
        <div className="relative group">
          <button
            onClick={() => setCurrentMode('daily')}
            className={`relative z-10 px-8 py-3 rounded-md transition-all duration-300 font-medium text-lg min-w-[140px] flex items-center justify-center ${
              currentMode === 'daily'
                ? theme === 'dark'
                  ? 'text-white'
                  : 'text-gray-900'
                : theme === 'dark'
                  ? 'text-gray-400 hover:text-gray-300'
                  : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Daily
          </button>
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
