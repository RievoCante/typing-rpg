import { useThemeContext } from '../hooks/useThemeContext';
import { useGameContext } from '../hooks/useGameContext';

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

export default function DifficultySelector() {
  const { theme } = useThemeContext();
  const { endlessDifficulty, setEndlessDifficulty } = useGameContext();

  return (
    <div className="flex justify-center w-full pt-1 pb-1">
      <div
        className={`flex rounded-lg p-1 transition-colors duration-300 ${
          theme === 'dark'
            ? 'bg-[#2A2C3C] border border-gray-700'
            : 'bg-gray-100 border border-gray-200'
        }`}
      >
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
  );
}
