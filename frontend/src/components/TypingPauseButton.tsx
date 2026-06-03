import { Pause, Play } from 'lucide-react';
import { useThemeContext } from '../hooks/useThemeContext';

// Sits just left of the restart button. Shows a Play icon while paused (press to
// resume) and a Pause icon while running. Esc is the keyboard equivalent.
export default function TypingPauseButton({
  paused,
  onToggle,
}: {
  paused: boolean;
  onToggle: () => void;
}) {
  const { theme } = useThemeContext();
  return (
    <div className="relative group">
      <button
        type="button"
        aria-label={paused ? 'Resume game' : 'Pause game'}
        aria-pressed={paused}
        // Keep the typing container focused so pausing/resuming never blurs it.
        onMouseDown={e => e.preventDefault()}
        onClick={onToggle}
        tabIndex={0}
        className="rounded-full p-3 transition-colors bg-transparent text-gray-700 hover:bg-black/10 dark:text-gray-200 dark:hover:bg-white/10"
      >
        {paused ? <Play size={18} /> : <Pause size={18} />}
      </button>
      <div
        className={`absolute right-full mr-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-0 group-hover:delay-[750ms] whitespace-nowrap ${
          theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-800 text-white'
        }`}
      >
        {paused ? 'resume' : 'pause'}
        <span className="ml-2 opacity-80">
          <kbd
            className={`px-1.5 py-0.5 rounded border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-200 border-gray-300'}`}
          >
            esc
          </kbd>
        </span>
      </div>
    </div>
  );
}
