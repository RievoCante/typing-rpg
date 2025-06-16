interface MilestoneProgressProps {
  currentMilestone: number
  totalMilestones: number
}

export default function MilestoneProgress({ currentMilestone, totalMilestones }: MilestoneProgressProps) {
  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-gray-800 p-3 rounded-lg shadow-lg z-40">
      <div className="flex space-x-4 items-center">
        {Array.from({ length: totalMilestones }).map((_, index) => (
          <div key={index} className="relative">
            {/* Milestone dot */}
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center ${
                index < currentMilestone ? "bg-green-500" : index === currentMilestone ? "bg-yellow-500" : "bg-gray-600"
              }`}
            >
              {index === totalMilestones - 1 && (
                <span className="text-xs font-bold">{index < currentMilestone ? "✓" : "👑"}</span>
              )}
            </div>

            {/* Connecting line */}
            {index < totalMilestones - 1 && (
              <div
                className={`absolute top-1/2 left-full h-0.5 w-4 -translate-y-1/2 ${
                  index < currentMilestone ? "bg-green-500" : "bg-gray-600"
                }`}
              ></div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
