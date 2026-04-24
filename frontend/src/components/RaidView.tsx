import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useRaidSocket } from '../hooks/useRaidSocket';
import { useRaidState } from '../hooks/useRaidState';
import { useApi } from '../hooks/useApi';
import { useGameContext } from '../hooks/useGameContext';
import RaidLobbyScreen from './RaidLobbyScreen';
import RaidGame from './RaidGame';
import RaidResultScreen from './RaidResultScreen';

type Phase = 'room-list' | 'in-room';

interface LobbyRoom {
  roomId: string;
  hostName: string;
  playerCount: number;
  status: string;
}

export default function RaidView() {
  const [phase, setPhase] = useState<Phase>('room-list');
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<LobbyRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const hasJoined = useRef(false);

  const { userId, getToken } = useAuth();
  const { setCurrentMode } = useGameContext();
  const { getMe } = useApi();
  const apiUrl = import.meta.env.VITE_API_URL;

  // Fetch room list when in room-list phase, poll every 5 seconds
  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/raid/rooms`);
      const data = await res.json();
      setRooms(Array.isArray(data) ? data : []);
    } catch {
      setRooms([]);
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    if (phase !== 'room-list') return;
    fetchRooms();
    const id = setInterval(fetchRooms, 5000);
    return () => clearInterval(id);
  }, [phase, fetchRooms]);

  // Build WebSocket URL and fetch username once a room is selected
  useEffect(() => {
    if (!activeRoomId) return;
    hasJoined.current = false;
    getToken().then(token => {
      if (!token) return;
      const base = apiUrl.replace(/^http/, 'ws');
      setWsUrl(`${base}/api/raid/rooms/${activeRoomId}/ws?token=${token}`);
    });
    getMe()
      .then(r => r.json())
      .then(data => setUsername(data?.username ?? null))
      .catch(() => {});
  }, [activeRoomId, apiUrl, getToken, getMe]);

  const { lastMessage, isConnected, error, send } = useRaidSocket(wsUrl ?? '');
  const { state, isPhase, isLocalAlive } = useRaidState(
    lastMessage,
    userId ?? ''
  );

  // Auto-join once connected and username is ready
  useEffect(() => {
    if (isConnected && username && !hasJoined.current) {
      hasJoined.current = true;
      send({ type: 'join', userId: userId ?? 'anon', username });
    }
  }, [isConnected, username, send, userId]);

  const handleCreateRoom = async () => {
    setCreating(true);
    try {
      const token = await getToken();
      if (!token) {
        setCreating(false);
        alert('Please sign in to create a room');
        return;
      }
      const res = await fetch(`${apiUrl}/api/raid/rooms`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        alert('Failed to create room');
        return;
      }
      const data = await res.json();
      if (data.roomId) {
        setActiveRoomId(data.roomId);
        setPhase('in-room');
      }
    } finally {
      setCreating(false);
    }
  };

  const handleJoinRoom = async (roomId: string) => {
    try {
      const token = await getToken();
      if (!token) {
        alert('Please sign in to join a room');
        return;
      }
      const res = await fetch(`${apiUrl}/api/raid/rooms/${roomId}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        alert('Failed to join room');
        return;
      }
      setActiveRoomId(roomId);
      setPhase('in-room');
    } catch {
      alert('Failed to join room');
    }
  };

  const handleBackToLobby = () => {
    setWsUrl(null);
    setActiveRoomId(null);
    setPhase('room-list');
    setLoading(true);
  };

  if (phase === 'room-list') {
    return (
      <div className="p-8 text-white">
        <h1 className="text-3xl font-bold mb-6">Raid Lobby</h1>
        <button
          onClick={handleCreateRoom}
          disabled={creating}
          className="mb-6 px-6 py-3 bg-red-600 rounded-lg font-bold hover:bg-red-700 disabled:opacity-50"
        >
          {creating ? 'Creating...' : 'Create Room'}
        </button>
        {loading ? (
          <p>Loading rooms...</p>
        ) : rooms.length === 0 ? (
          <p className="text-gray-400">
            No active rooms. Be the first to create one!
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {rooms.map(room => (
              <div
                key={room.roomId}
                className="p-4 bg-gray-800 rounded-lg shadow"
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-mono text-lg">{room.roomId}</span>
                  <span className="text-sm text-gray-400">
                    {room.playerCount}/3
                  </span>
                </div>
                <p className="text-sm text-gray-400 mb-3">
                  Host: {room.hostName}
                </p>
                <button
                  onClick={() => handleJoinRoom(room.roomId)}
                  className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700"
                >
                  Join
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // in-room phase
  if (error) {
    return (
      <div className="flex items-center justify-center text-white p-8">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={handleBackToLobby}
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
      <div className="flex items-center justify-center text-white p-8">
        <p>Connecting to room {activeRoomId}...</p>
      </div>
    );
  }

  return (
    <div className="text-white">
      {isPhase('lobby') && (
        <RaidLobbyScreen
          players={state.players}
          isHost={state.isHost}
          onStartGame={() => send({ type: 'start_game' })}
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
          onWordComplete={(wordIndex: number) =>
            send({ type: 'word_complete', wordIndex })
          }
        />
      )}
      {isPhase('finished') && (
        <RaidResultScreen
          result={state.result}
          stats={state.stats}
          players={state.players}
          onPlayAgain={handleBackToLobby}
          onHome={() => setCurrentMode('daily')}
        />
      )}
    </div>
  );
}
