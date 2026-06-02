import { useThemeContext } from '../hooks/useThemeContext';
import DifficultyDropdown from './DifficultyDropdown';

export default function EndlessOptions() {
  const { theme } = useThemeContext();

  return (
    <div className="flex w-full flex-col items-center gap-3 pt-2">
      <div className="flex justify-center w-full">
        <div
          className={`flex items-center rounded-lg p-1 transition-colors duration-300 ${
            theme === 'dark'
              ? 'bg-[#2A2C3C] border border-gray-700'
              : 'bg-gray-100 border border-gray-200'
          }`}
        >
          {/* Difficulty (word list) dropdown */}
          <DifficultyDropdown />
        </div>
      </div>
    </div>
  );
}
