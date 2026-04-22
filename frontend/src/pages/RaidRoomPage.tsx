import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useRaidSocket } from '../hooks/useRaidSocket';
import { useRaidState } from '../hooks/useRaidState';
import RaidLobbyScreen from '../components/RaidLobbyScreen';
import RaidGame from '../components/RaidGame';
import RaidResultScreen from '../components/RaidResultScreen';

export default function RaidRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { userId } = useAuth();
  const apiUrl = import.meta.env.VITE_API_URL;

  const wsUrl = `${apiUrl.replace(/^http/, 'ws')}/api/raid/rooms/${roomId}/ws`;
  const { lastMessage, isConnected, error, send } = useRaidSocket(wsUrl);
  // IMPORTANT: useRaidState returns isLocalAlive separately, not in state
  const { state, isPhase, isLocalAlive } = useRaidState(
    lastMessage,
    userId ?? ''
  );

  const handleJoin = (username: string) => {
    send({ type: 'join', userId: userId ?? 'anon', username });
  };

  const handleStartGame = () => {
    send({ type: 'start_game' });
  };

  const handleWordComplete = (wordIndex: number) => {
    send({ type: 'word_complete', wordIndex });
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => navigate('/raid')}
            className="px-4 py-2 bg-gray-700 rounded"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <p>Connecting to room {roomId}...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white">
      {isPhase('lobby') && (
        <RaidLobbyScreen
          players={state.players}
          isHost={state.isHost}
          localUserId={userId ?? ''}
          onJoin={handleJoin}
          onStartGame={handleStartGame}
        />
      )}
      {isPhase('playing') && (
        <RaidGame
          players={state.players}
          bossHp={state.bossHp}
          bossMaxHp={state.bossMaxHp}
          localText={state.localText}
          isLocalAlive={isLocalAlive}
          localUserId={userId ?? ''}
          onWordComplete={handleWordComplete}
        />
      )}
      {isPhase('finished') && (
        <RaidResultScreen
          result={state.result}
          stats={state.stats}
          players={state.players}
          onPlayAgain={() => navigate('/raid')}
        />
      )}
    </div>
  );
}
