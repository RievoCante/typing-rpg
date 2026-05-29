import { useState } from 'react';
import { avatarConfigFromSeed } from '../utils/avatarConfig';
import PlayerAvatar3D from './PlayerAvatar3D';

interface Props {
  roomCode: string;
  players: { userId: string; username: string; isHost: boolean }[];
  isHost: boolean;
  onStartGame: () => void;
  onLeaveRoom: () => void;
  error?: string | null;
}

export default function RaidLobbyScreen({
  roomCode,
  players,
  isHost,
  onStartGame,
  onLeaveRoom,
  error,
}: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can be blocked (e.g. insecure context, no permission);
      // ignore silently — the code is still visible on screen.
    }
  };

  return (
    <div className="flex items-center justify-center">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl max-w-lg w-full text-center">
        <h2 className="text-2xl font-bold mb-4">Lobby</h2>
        <div className="mb-6">
          <p className="text-xs text-gray-400 mb-1 tracking-wider">ROOM CODE</p>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded font-mono text-2xl tracking-widest"
            aria-label="Copy room code"
          >
            {roomCode}
            <span className="text-xs text-gray-400">
              {copied ? 'Copied!' : 'Copy'}
            </span>
          </button>
        </div>
        <div className="mb-6">
          {players.length === 0 ? (
            <p className="text-gray-400">Waiting for players...</p>
          ) : (
            <ul className="space-y-2">
              {players.map(p => (
                <li
                  key={p.userId}
                  className="p-3 bg-gray-700 rounded flex items-center gap-3"
                >
                  <div className="h-10 w-10 shrink-0">
                    <PlayerAvatar3D
                      config={avatarConfigFromSeed(p.userId)}
                      isAlive
                      hpPercent={100}
                    />
                  </div>
                  <span>
                    {p.username}
                    {p.isHost && (
                      <span className="text-yellow-400 text-sm ml-2">
                        (Host)
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded text-red-200">
            {error}
          </div>
        )}
        <div className="flex flex-col items-center gap-4 mt-6">
          {isHost && (
            <button
              onClick={onStartGame}
              className="w-full max-w-xs px-8 py-3 bg-green-600 rounded font-bold hover:bg-green-700"
            >
              Start Game
            </button>
          )}
          {!isHost && (
            <p className="text-gray-400">Waiting for host to start...</p>
          )}
          <button
            onClick={onLeaveRoom}
            className="w-full max-w-xs px-8 py-3 bg-red-600 rounded font-bold hover:bg-red-700"
          >
            Leave Room
          </button>
        </div>
      </div>
    </div>
  );
}
