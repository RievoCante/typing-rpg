interface Props {
  players: { userId: string; username: string; isHost: boolean }[];
  isHost: boolean;
  localUserId: string;
  onStartGame: () => void;
}

export default function RaidLobbyScreen({
  players,
  isHost,
  onStartGame,
}: Props) {
  return (
    <div className="flex items-center justify-center">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl max-w-lg w-full text-center">
        <h2 className="text-2xl font-bold mb-6">Lobby</h2>
        <div className="mb-6">
          {players.length === 0 ? (
            <p className="text-gray-400">Waiting for players...</p>
          ) : (
            <ul className="space-y-2">
              {players.map(p => (
                <li key={p.userId} className="p-3 bg-gray-700 rounded">
                  {p.username}{' '}
                  {p.isHost && (
                    <span className="text-yellow-400 text-sm ml-2">(Host)</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        {isHost && (
          <button
            onClick={onStartGame}
            className="px-8 py-3 bg-green-600 rounded font-bold hover:bg-green-700"
          >
            Start Game
          </button>
        )}
        {!isHost && (
          <p className="text-gray-400">Waiting for host to start...</p>
        )}
      </div>
    </div>
  );
}
