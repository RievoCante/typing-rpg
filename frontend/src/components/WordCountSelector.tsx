import { useThemeContext } from '../hooks/useThemeContext';
import { useGameContext } from '../hooks/useGameContext';

const WORD_COUNT_OPTIONS = [10, 25, 50, 100];

export default function WordCountSelector() {
  const { theme } = useThemeContext();
  const { endlessWordCount, setEndlessWordCount } = useGameContext();

  return (
    <div className="flex justify-center w-full pt-1 pb-1">
      <div
        className={`flex rounded-lg p-1 transition-colors duration-300 ${
          theme === 'dark'
            ? 'bg-[#2A2C3C] border border-gray-700'
            : 'bg-gray-100 border border-gray-200'
        }`}
      >
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
    </div>
  );
}
