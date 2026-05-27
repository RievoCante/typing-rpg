import { Share2 } from 'lucide-react';
import { useThemeContext } from '../hooks/useThemeContext';

interface Props {
  resetTimeLeft: {
    hours: number;
    minutes: number;
    seconds: number;
  } | null;
}

export default function DailyCompletedOverlay({ resetTimeLeft }: Props) {
  const { theme } = useThemeContext();
  return (
    <div className="absolute inset-0 flex items-center justify-center rounded-lg overflow-hidden">
      <div className="flex flex-col items-center gap-3 pointer-events-auto">
        <div className="px-6 py-2 rounded-lg text-white font-extrabold text-2xl bg-emerald-600/90 shadow">
          COMPLETED!
        </div>
        {resetTimeLeft && (
          <div
            className="text-xs sm:text-sm -mt-1 text-black dark:text-white"
            style={{ color: theme === 'dark' ? '#ffffff' : '#000000' }}
          >
            Resets in {String(resetTimeLeft.hours).padStart(2, '0')}:
            {String(resetTimeLeft.minutes).padStart(2, '0')}:
            {String(resetTimeLeft.seconds).padStart(2, '0')} UTC
          </div>
        )}
        <button
          type="button"
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-white/90 text-black hover:bg-white transition-colors shadow dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
        >
          <Share2
            size={16}
            className="text-black dark:text-white"
            style={{ color: theme === 'dark' ? '#ffffff' : '#000000' }}
          />
          <span
            className="text-black dark:text-white"
            style={{ color: theme === 'dark' ? '#ffffff' : '#000000' }}
          >
            Share
          </span>
        </button>
      </div>
    </div>
  );
}
