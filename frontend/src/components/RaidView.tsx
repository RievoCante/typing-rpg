import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useRaidSocket } from '../hooks/useRaidSocket';
import { useRaidState } from '../hooks/useRaidState';
import { useGameContext } from '../hooks/useGameContext';
import { useCharacter } from '../hooks/useCharacter';
import RaidLobbyScreen from './RaidLobbyScreen';
import RaidGame from './RaidGame';
import RaidResultScreen from './RaidResultScreen';

type Phase = 'room-list' | 'in-room';

interface LobbyRoom {
  roomId: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  status: string;
}

interface RoomResponse {
  roomCode: string;
  wsUrl: string;
  userId: string;
  username: string;
  isGuest: boolean;
  error?: string;
}

export default function RaidView() {
  const [phase, setPhase] = useState<Phase>('room-list');
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<LobbyRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [localUserId, setLocalUserId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const hasJoined = useRef(false);

  const { getToken } = useAuth();
  const { setCurrentMode } = useGameContext();
  const { config: characterConfig, ready: characterReady } = useCharacter();
  const apiUrl = import.meta.env.VITE_API_URL;

  // Fetch room list when in room-list phase, poll every 5 seconds
  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/raid/rooms`);
      const data = await res.json();
      setRooms(Array.isArray(data.rooms) ? data.rooms : []);
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

  // Reset join state when leaving a room. Credentials are set when the
  // backend responds to create/join — never generated locally.
  useEffect(() => {
    if (!activeRoomId) return;
    hasJoined.current = false;
  }, [activeRoomId]);

  const { lastMessage, isConnected, error, send } = useRaidSocket(wsUrl ?? '');
  const { state, isPhase, isLocalAlive } = useRaidState(
    lastMessage,
    localUserId ?? ''
  );

  // Reset hasJoined when disconnected so reconnection re-triggers join
  useEffect(() => {
    if (!isConnected) {
      hasJoined.current = false;
    }
  }, [isConnected]);

  // Auto-join once connected. Identity is established by the WS upgrade URL
  // params (validated server-side); the join message is just the "I'm ready"
  // signal — the DO ignores any userId/username in the body. We also wait for
  // the character config to finish loading (`characterReady`) so teammates get
  // the saved look on first join rather than the seed; join fires exactly once
  // (guarded by `hasJoined`), so a later config change does not re-send.
  useEffect(() => {
    if (
      isConnected &&
      username &&
      localUserId &&
      characterReady &&
      !hasJoined.current
    ) {
      hasJoined.current = true;
      send({ type: 'join', characterConfig });
    }
  }, [
    isConnected,
    username,
    localUserId,
    characterReady,
    send,
    characterConfig,
  ]);

  const handleCreateRoom = async () => {
    setCreating(true);
    try {
      const token = await getToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${apiUrl}/api/raid/rooms`, {
        method: 'POST',
        headers,
      });
      if (!res.ok) {
        alert('Failed to create room');
        return;
      }
      const data: RoomResponse = await res.json();
      if (data.roomCode && data.wsUrl && data.userId && data.username) {
        setLocalUserId(data.userId);
        setUsername(data.username);
        setActiveRoomId(data.roomCode);
        setWsUrl(data.wsUrl);
        setPhase('in-room');
      }
    } finally {
      setCreating(false);
    }
  };

  const handleJoinRoom = async (roomId: string) => {
    setJoinError(null);
    try {
      const token = await getToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${apiUrl}/api/raid/rooms/${roomId}/join`, {
        method: 'POST',
        headers,
      });
      if (!res.ok) {
        if (res.status === 404) setJoinError('Room not found');
        else if (res.status === 400)
          setJoinError('Room is not accepting players');
        else setJoinError('Failed to join room');
        return;
      }
      const data: RoomResponse = await res.json();
      if (data.userId && data.username && data.wsUrl) {
        setLocalUserId(data.userId);
        setUsername(data.username);
        setWsUrl(data.wsUrl);
        setActiveRoomId(roomId);
        setPhase('in-room');
      } else {
        setJoinError('Invalid server response');
      }
    } catch {
      setJoinError('Failed to join room');
    }
  };

  const handleJoinByCode = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) {
      setJoinError('Room code must be 6 characters');
      return;
    }
    await handleJoinRoom(code);
  };

  const handleBackToLobby = () => {
    setWsUrl(null);
    setActiveRoomId(null);
    setLocalUserId(null);
    setUsername(null);
    setPhase('room-list');
    setLoading(true);
  };

  if (phase === 'room-list') {
    return (
      <div className="min-h-screen p-8 text-white flex flex-col items-center">
        <div className="max-w-4xl w-full text-center">
          <h1 className="text-3xl font-bold mb-6">Raid Lobby</h1>
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-center mb-6">
            <button
              onClick={handleCreateRoom}
              disabled={creating}
              className="px-6 py-3 bg-red-600 rounded-lg font-bold hover:bg-red-700 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Room'}
            </button>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={e =>
                  setJoinCode(e.target.value.toUpperCase().slice(0, 6))
                }
                onKeyDown={e => {
                  if (e.key === 'Enter') handleJoinByCode();
                }}
                placeholder="ROOM CODE"
                maxLength={6}
                className="px-3 py-3 bg-gray-800 rounded-lg font-mono uppercase tracking-widest text-center w-36 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleJoinByCode}
                disabled={joinCode.trim().length !== 6}
                className="px-4 py-3 bg-blue-600 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50"
              >
                Join by Code
              </button>
            </div>
          </div>
          {joinError && (
            <p className="mb-4 text-red-400 text-sm">{joinError}</p>
          )}
          {loading ? (
            <p>Loading rooms...</p>
          ) : rooms.length === 0 ? (
            <p className="text-gray-400">
              No active rooms. Be the first to create one!
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {rooms.map(room => {
                const isFull = room.playerCount >= room.maxPlayers;
                return (
                  <div
                    key={room.roomId}
                    className="p-4 bg-gray-800 rounded-lg shadow"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-mono text-lg">{room.roomId}</span>
                      <span
                        className={`text-sm ${isFull ? 'text-red-400 font-semibold' : 'text-gray-400'}`}
                      >
                        {room.playerCount}/{room.maxPlayers}
                        {isFull && ' · FULL'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mb-3">
                      Host: {room.hostName}
                    </p>
                    <button
                      onClick={() => handleJoinRoom(room.roomId)}
                      disabled={isFull}
                      title={isFull ? 'Room is full' : undefined}
                      className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed disabled:hover:bg-gray-600"
                    >
                      {isFull ? 'Full' : 'Join'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
          roomCode={activeRoomId ?? ''}
          players={state.players}
          isHost={state.isHost}
          onStartGame={() => send({ type: 'start_game' })}
          onLeaveRoom={handleBackToLobby}
          error={state.error}
        />
      )}
      {isPhase('playing') && (
        <RaidGame
          players={state.players}
          bossHp={state.bossHp}
          bossMaxHp={state.bossMaxHp}
          localText={state.localText}
          isLocalAlive={isLocalAlive}
          localUserId={localUserId ?? ''}
          lastHit={state.lastHit}
          lastWordHit={state.lastWordHit}
          onWordComplete={(wordIndex: number) =>
            send({ type: 'word_complete', wordIndex })
          }
          onMistake={() => send({ type: 'mistake' })}
        />
      )}
      {isPhase('finished') && (
        <RaidResultScreen
          result={state.result}
          stats={state.stats}
          players={state.players}
          localUserId={localUserId ?? ''}
          onHome={() => setCurrentMode('daily')}
        />
      )}
    </div>
  );
}
