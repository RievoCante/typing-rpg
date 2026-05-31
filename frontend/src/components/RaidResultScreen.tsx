import type { RaidStats } from '../hooks/useRaidSocket';

interface Props {
  result: 'victory' | 'defeat' | null;
  stats: RaidStats | null;
  players: {
    userId: string;
    username: string;
    damageDealt: number;
    isAlive: boolean;
  }[];
  localUserId: string;
  onHome: () => void;
}

export default function RaidResultScreen({
  result,
  stats,
  players,
  localUserId,
  onHome,
}: Props) {
  const statsByUserId = new Map((stats?.players ?? []).map(p => [p.userId, p]));
  const localXp = statsByUserId.get(localUserId)?.xpAwarded ?? 0;

  // Don't render a result heading if `result` hasn't arrived — a null fallback
  // to DEFEAT would silently mask missing state.
  const headingClass =
    result === 'victory'
      ? 'text-green-400'
      : result === 'defeat'
        ? 'text-red-400'
        : 'text-gray-400';
  const headingText =
    result === 'victory'
      ? 'VICTORY!'
      : result === 'defeat'
        ? 'DEFEAT'
        : 'Loading...';

  return (
    <div className="flex items-center justify-center">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl max-w-lg w-full text-center">
        <h2 className={`text-4xl font-bold mb-4 ${headingClass}`}>
          {headingText}
        </h2>

        {result === 'victory' && localXp > 0 && (
          <div className="mb-4 inline-block px-4 py-2 rounded-lg bg-yellow-900/40 border border-yellow-500/50">
            <p className="text-yellow-300 font-bold">+{localXp} XP earned</p>
          </div>
        )}

        {stats && (
          <div className="mb-6 text-gray-300">
            <p>Total Words: {stats.totalWords}</p>
            <p>Avg WPM: {stats.avgWpm}</p>
            <p>Duration: {Math.round(stats.durationMs / 1000)}s</p>
          </div>
        )}

        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Team Stats</h3>
          <ul className="space-y-2">
            {players.map(p => {
              const perPlayer = statsByUserId.get(p.userId);
              return (
                <li
                  key={p.userId}
                  className="p-3 bg-gray-700 rounded flex flex-col gap-1 text-left"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">
                      {p.username} {p.isAlive ? '✅' : '💀'}
                      {p.userId === localUserId && (
                        <span className="ml-2 text-xs text-blue-300">
                          (you)
                        </span>
                      )}
                    </span>
                    <span className="text-sm">{p.damageDealt} dmg</span>
                  </div>
                  {perPlayer && (
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>WPM: {perPlayer.wpm}</span>
                      <span>{perPlayer.wordsCorrect} words</span>
                      <span>
                        {perPlayer.xpAwarded > 0
                          ? `+${perPlayer.xpAwarded} XP`
                          : ''}
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        <div className="flex justify-center">
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
