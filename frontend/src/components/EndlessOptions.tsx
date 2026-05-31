import { useThemeContext } from '../hooks/useThemeContext';
import { useGameContext } from '../hooks/useGameContext';

const WORD_COUNT_OPTIONS = [10, 25, 50, 100];

const DIFFICULTY_OPTIONS: ('beginner' | 'intermediate' | 'advanced')[] = [
  'beginner',
  'intermediate',
  'advanced',
];

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export default function EndlessOptions() {
  const { theme } = useThemeContext();
  const {
    endlessWordCount,
    setEndlessWordCount,
    endlessDifficulty,
    setEndlessDifficulty,
  } = useGameContext();

  return (
    <div className="flex justify-center w-full pt-2">
      <div
        className={`flex items-center rounded-lg p-1 transition-colors duration-300 ${
          theme === 'dark'
            ? 'bg-[#2A2C3C] border border-gray-700'
            : 'bg-gray-100 border border-gray-200'
        }`}
      >
        {/* Word count options */}
        <div className="flex">
          {WORD_COUNT_OPTIONS.map(count => {
            const isActive = endlessWordCount === count;
            return (
              <button
                key={count}
                onClick={() => setEndlessWordCount(count)}
                className={`relative px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-300 ${
                  isActive
                    ? theme === 'dark'
                      ? 'text-yellow-400'
                      : 'text-blue-600'
                    : theme === 'dark'
                      ? 'text-gray-400 hover:text-gray-300'
                      : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {count}
              </button>
            );
          })}
        </div>

        {/* Separator */}
        <div
          className={`w-px h-6 mx-2 ${
            theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'
          }`}
        />

        {/* Difficulty options */}
        <div className="flex">
          {DIFFICULTY_OPTIONS.map(difficulty => {
            const isActive = endlessDifficulty === difficulty;
            return (
              <button
                key={difficulty}
                onClick={() => setEndlessDifficulty(difficulty)}
                className={`relative px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-300 ${
                  isActive
                    ? theme === 'dark'
                      ? 'text-yellow-400'
                      : 'text-blue-600'
                    : theme === 'dark'
                      ? 'text-gray-400 hover:text-gray-300'
                      : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {DIFFICULTY_LABELS[difficulty]}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
