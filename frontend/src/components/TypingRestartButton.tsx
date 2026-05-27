import { RotateCcw } from 'lucide-react';
import { useThemeContext } from '../hooks/useThemeContext';

export default function TypingRestartButton({
  onRestart,
}: {
  onRestart: () => void;
}) {
  const { theme } = useThemeContext();
  return (
    <div className="absolute bottom-4 right-4 z-10 group">
      <button
        type="button"
        aria-label="Restart typing"
        onClick={onRestart}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onRestart();
          }
        }}
        tabIndex={0}
        className="rounded-full p-3 transition-colors bg-transparent text-gray-700 hover:bg-black/10 dark:text-gray-200 dark:hover:bg-white/10"
      >
        <RotateCcw size={18} />
      </button>
      <div
        className={`absolute right-full mr-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-0 group-hover:delay-[750ms] whitespace-nowrap ${
          theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-800 text-white'
        }`}
      >
        restart
        <span className="ml-2 opacity-80">
          <kbd
            className={`px-1.5 py-0.5 rounded border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-200 border-gray-300'}`}
          >
            tab
          </kbd>
          <span className="mx-1">+</span>
          <kbd
            className={`px-1.5 py-0.5 rounded border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-200 border-gray-300'}`}
          >
            enter
          </kbd>
        </span>
      </div>
    </div>
  );
}
