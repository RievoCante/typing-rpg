import { useThemeContext } from '../hooks/useThemeContext';
import { useGameContext } from '../hooks/useGameContext';
import { Skull, RotateCcw } from 'lucide-react';

interface DeathPopupProps {
  onRestart: () => void;
}

export default function DeathPopup({ onRestart }: DeathPopupProps) {
  const { theme } = useThemeContext();
  const { killStreak, monstersDefeated } = useGameContext();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div
        className={`rounded-xl p-8 shadow-2xl border-2 max-w-md mx-4 ${
          theme === 'dark'
            ? 'bg-red-950/95 border-red-500 text-white'
            : 'bg-red-50 border-red-300 text-gray-900'
        }`}
      >
        <div className="text-center mb-6">
          <div
            className={`inline-block p-4 rounded-full mb-4 ${
              theme === 'dark' ? 'bg-red-900' : 'bg-red-200'
            }`}
          >
            <Skull
              size={48}
              className={theme === 'dark' ? 'text-red-400' : 'text-red-600'}
            />
          </div>
          <h2
            className={`text-3xl font-bold mb-2 ${
              theme === 'dark' ? 'text-red-300' : 'text-red-700'
            }`}
          >
            You Died!
          </h2>
          <p
            className={`text-lg ${
              theme === 'dark' ? 'text-red-200' : 'text-red-600'
            }`}
          >
            The monster defeated you...
          </p>
        </div>

        <div
          className={`rounded-lg p-4 mb-6 ${
            theme === 'dark' ? 'bg-red-900/50' : 'bg-red-100'
          }`}
        >
          <div className="flex justify-between mb-2">
            <span>Monsters Defeated:</span>
            <span className="font-bold">{monstersDefeated}</span>
          </div>
          <div className="flex justify-between">
            <span>Kill Streak:</span>
            <span className="font-bold text-yellow-400">{killStreak}</span>
          </div>
        </div>

        <div
          className={`text-sm mb-6 text-center ${
            theme === 'dark' ? 'text-red-300' : 'text-red-600'
          }`}
        >
          <p>All progress lost. Starting fresh...</p>
        </div>

        <button
          onClick={onRestart}
          className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors ${
            theme === 'dark'
              ? 'bg-red-600 hover:bg-red-500 text-white'
              : 'bg-red-500 hover:bg-red-400 text-white'
          }`}
        >
          <RotateCcw size={20} />
          Try Again
        </button>
      </div>
    </div>
  );
}
