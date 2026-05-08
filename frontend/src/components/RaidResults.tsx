import { RaidStats } from '../hooks/useRaidWebSocket';

interface RaidResultsProps {
  victory: boolean;
  stats: RaidStats;
  onClose: () => void;
}

export default function RaidResults({
  victory,
  stats,
  onClose,
}: RaidResultsProps) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-8 max-w-lg w-full mx-4">
        <div
          className={`text-center mb-6 ${victory ? 'text-green-500' : 'text-red-500'}`}
        >
          <div className="text-6xl mb-2">{victory ? '🏆' : '💀'}</div>
          <h2 className="text-4xl font-bold">
            {victory ? 'VICTORY!' : 'DEFEAT'}
          </h2>
        </div>

        {stats && (
          <div className="space-y-4">
            <div className="text-center text-gray-400">
              Boss HP: {stats.bossHpEnd} / {stats.bossHpStart}
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-lg">Players</h3>
              {stats.players.map(player => (
                <div
                  key={player.id}
                  className={`flex justify-between p-2 rounded ${
                    player.isDead ? 'bg-red-900/30' : 'bg-green-900/30'
                  }`}
                >
                  <span>{player.username}</span>
                  <div className="flex gap-4 text-sm">
                    <span>Words: {player.wordsCompleted}</span>
                    <span>HP: {player.hpRemaining}</span>
                    {player.isDead && (
                      <span className="text-red-500">DEAD</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full mt-6 py-3 rounded bg-blue-600 hover:bg-blue-500 font-bold"
        >
          Back to Lobby
        </button>
      </div>
    </div>
  );
}
