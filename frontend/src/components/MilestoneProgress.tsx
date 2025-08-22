import { useThemeContext } from '../hooks/useThemeContext';

interface MilestoneProgressProps {
  completedQuotes: number; // 0-3
  totalMilestones: number; // Always 3 for daily mode
}

const MILESTONE_LABELS = ['Easy', 'Medium', 'Hard'];

export default function MilestoneProgress({
  completedQuotes,
  totalMilestones,
}: MilestoneProgressProps) {
  const { theme } = useThemeContext();

  // Ensure we don't exceed bounds
  const safeCurrentMilestone = Math.max(
    0,
    Math.min(completedQuotes, totalMilestones)
  );

  return (
    <div
      className={`fixed right-4 top-1/2 transform -translate-y-1/2 p-4 rounded-lg shadow-lg border z-40 ${
        theme === 'dark'
          ? 'bg-[#2A2C3C] border-gray-700'
          : 'bg-white border-gray-200'
      }`}
    >
      {/* Header */}
      <div className="text-center mb-4">
        <h3
          className={`text-sm font-bold ${
            theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
          }`}
        >
          Daily Progress
        </h3>
      </div>

      {/* Vertical milestone layout */}
      <div className="flex flex-col items-center space-y-3">
        {Array.from({ length: totalMilestones }).map((_, index) => {
          const isCompleted = index < safeCurrentMilestone;
          const isCurrent =
            index === safeCurrentMilestone &&
            safeCurrentMilestone < totalMilestones;

          return (
            <div key={index} className="flex flex-col items-center">
              {/* Milestone dot */}
              <div className="relative group">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                    isCompleted
                      ? 'bg-green-500 text-white shadow-lg scale-110'
                      : isCurrent
                        ? theme === 'dark'
                          ? 'bg-yellow-500 text-gray-900 shadow-lg animate-pulse'
                          : 'bg-yellow-400 text-gray-900 shadow-lg animate-pulse'
                        : theme === 'dark'
                          ? 'bg-gray-600 text-gray-400'
                          : 'bg-gray-300 text-gray-500'
                  }`}
                >
                  {isCompleted
                    ? '✓'
                    : index === totalMilestones - 1
                      ? '👑'
                      : index + 1}
                </div>

                {/* Tooltip */}
                <div
                  className={`absolute left-full ml-2 top-1/2 transform -translate-y-1/2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap ${
                    theme === 'dark'
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-800 text-white'
                  }`}
                >
                  {MILESTONE_LABELS[index]}
                  {isCompleted && ' ✓'}
                  {isCurrent && ' (Current)'}
                </div>
              </div>

              {/* Label below dot */}
              <span
                className={`text-xs mt-1 text-center ${
                  isCompleted
                    ? 'text-green-500 font-medium'
                    : isCurrent
                      ? theme === 'dark'
                        ? 'text-yellow-400 font-medium'
                        : 'text-yellow-600 font-medium'
                      : theme === 'dark'
                        ? 'text-gray-500'
                        : 'text-gray-400'
                }`}
              >
                {MILESTONE_LABELS[index]}
              </span>

              {/* Connecting line */}
              {index < totalMilestones - 1 && (
                <div
                  className={`w-0.5 h-4 my-1 transition-colors duration-300 ${
                    isCompleted
                      ? 'bg-green-500'
                      : theme === 'dark'
                        ? 'bg-gray-600'
                        : 'bg-gray-300'
                  }`}
                />
              )}
            </div>
          );
        })}

        {/* Progress text at bottom */}
        <div className="pt-2 border-t border-gray-300 dark:border-gray-600 w-full">
          <span
            className={`text-xs font-medium text-center block ${
              safeCurrentMilestone === totalMilestones
                ? 'text-green-500'
                : theme === 'dark'
                  ? 'text-gray-300'
                  : 'text-gray-600'
            }`}
          >
            {safeCurrentMilestone === totalMilestones
              ? 'Complete!'
              : `${safeCurrentMilestone}/${totalMilestones}`}
          </span>
        </div>
      </div>
    </div>
  );
}
