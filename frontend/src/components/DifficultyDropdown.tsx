import { useEffect, useRef, useState } from 'react';
import { useThemeContext } from '../hooks/useThemeContext';
import { useGameContext } from '../hooks/useGameContext';
import type { EndlessDifficulty } from '../hooks/useEndlessSettings';
import { DIFFICULTY_XP_MULTIPLIER } from '../utils/calculateXP';

const DIFFICULTY_OPTIONS: EndlessDifficulty[] = [
  'beginner',
  'common',
  'intermediate',
  'advanced',
];

const DIFFICULTY_LABELS: Record<EndlessDifficulty, string> = {
  beginner: 'Beginner (200)',
  common: 'Common (1k)',
  intermediate: 'Intermediate (5k)',
  advanced: 'Advanced (10k)',
};

// Reward-multiplier badge label, e.g. "1×", "1.5×", "2×", "3×". Derived from
// the shared DIFFICULTY_XP_MULTIPLIER so the badge can never drift from the
// actual XP math.
const multiplierLabel = (difficulty: EndlessDifficulty): string =>
  `${DIFFICULTY_XP_MULTIPLIER[difficulty]}×`;

// Tiered, theme-aware badge colors: gray → green → blue → gold as reward rises.
const BADGE_COLORS: Record<EndlessDifficulty, { dark: string; light: string }> =
  {
    beginner: {
      dark: 'bg-gray-700 text-gray-300',
      light: 'bg-gray-200 text-gray-600',
    },
    common: {
      dark: 'bg-green-900/60 text-green-300',
      light: 'bg-green-100 text-green-700',
    },
    intermediate: {
      dark: 'bg-blue-900/60 text-blue-300',
      light: 'bg-blue-100 text-blue-700',
    },
    advanced: {
      dark: 'bg-amber-900/60 text-amber-300',
      light: 'bg-amber-100 text-amber-700',
    },
  };

function MultiplierBadge({
  difficulty,
  isDark,
}: {
  difficulty: EndlessDifficulty;
  isDark: boolean;
}) {
  const color = isDark
    ? BADGE_COLORS[difficulty].dark
    : BADGE_COLORS[difficulty].light;
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[11px] font-semibold leading-none tabular-nums ${color}`}
      title={`${multiplierLabel(difficulty)} XP reward`}
    >
      {multiplierLabel(difficulty)}
    </span>
  );
}

export default function DifficultyDropdown() {
  const { theme } = useThemeContext();
  const { endlessDifficulty, setEndlessDifficulty } = useGameContext();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isDark = theme === 'dark';
  const accent = isDark ? 'text-yellow-400' : 'text-blue-600';

  // Close on click outside or Escape.
  useEffect(() => {
    if (!isOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  const select = (difficulty: EndlessDifficulty) => {
    setEndlessDifficulty(difficulty);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(o => !o)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-300 ${accent}`}
      >
        {DIFFICULTY_LABELS[endlessDifficulty]}
        <MultiplierBadge difficulty={endlessDifficulty} isDark={isDark} />
        <svg
          className={`w-3 h-3 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && (
        <ul
          role="listbox"
          className={`absolute right-0 z-20 mt-1 min-w-[11rem] rounded-lg border p-1 shadow-lg transition-colors duration-300 ${
            isDark ? 'bg-[#2A2C3C] border-gray-700' : 'bg-white border-gray-200'
          }`}
        >
          {DIFFICULTY_OPTIONS.map(difficulty => {
            const isActive = endlessDifficulty === difficulty;
            return (
              <li key={difficulty} role="option" aria-selected={isActive}>
                <button
                  type="button"
                  onClick={() => select(difficulty)}
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-1.5 text-left text-sm font-medium transition-colors duration-150 ${
                    isActive
                      ? accent
                      : isDark
                        ? 'text-gray-300 hover:bg-[#33364a]'
                        : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span>{DIFFICULTY_LABELS[difficulty]}</span>
                  <span className="flex items-center gap-2">
                    <MultiplierBadge difficulty={difficulty} isDark={isDark} />
                    {isActive && (
                      <svg
                        className="w-3.5 h-3.5"
                        viewBox="0 0 14 14"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M2.5 7.5L5.5 10.5L11.5 4"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
