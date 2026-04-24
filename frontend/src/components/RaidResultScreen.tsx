interface Props {
  result: 'victory' | 'defeat' | null;
  stats: { totalWords: number; avgWpm: number; durationMs: number } | null;
  players: {
    userId: string;
    username: string;
    damageDealt: number;
    isAlive: boolean;
  }[];
  onPlayAgain: () => void;
  onHome: () => void;
}

export default function RaidResultScreen({
  result,
  stats,
  players,
  onPlayAgain,
  onHome,
}: Props) {
  return (
    <div className="flex items-center justify-center">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl max-w-lg w-full text-center">
        <h2
          className={`text-4xl font-bold mb-4 ${result === 'victory' ? 'text-green-400' : 'text-red-400'}`}
        >
          {result === 'victory' ? 'VICTORY!' : 'DEFEAT'}
        </h2>
        {stats && (
          <div className="mb-6 text-gray-300">
            <p>Total Words: {stats.totalWords}</p>
            <p>Duration: {Math.round(stats.durationMs / 1000)}s</p>
          </div>
        )}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Team Stats</h3>
          <ul className="space-y-2">
            {players.map(p => (
              <li
                key={p.userId}
                className="p-3 bg-gray-700 rounded flex justify-between"
              >
                <span>
                  {p.username} {p.isAlive ? '✅' : '💀'}
                </span>
                <span>{p.damageDealt} dmg</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex gap-4 justify-center">
          <button
            onClick={onPlayAgain}
            className="px-6 py-2 bg-blue-600 rounded hover:bg-blue-700"
          >
            Play Again
          </button>
          <button
            onClick={onHome}
            className="px-6 py-2 bg-gray-600 rounded hover:bg-gray-700"
          >
            Home
          </button>
        </div>
      </div>
    </div>
  );
}
