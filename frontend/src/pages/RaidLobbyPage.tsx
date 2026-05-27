import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRaidApi } from '../hooks/useRaidApi';
import { Sword, Users, RefreshCw } from 'lucide-react';

export default function RaidLobbyPage() {
  const navigate = useNavigate();
  const { createRoom, listRooms, joinRoom, loading, error } = useRaidApi();
  const [rooms, setRooms] = useState<RaidRoom[]>([]);
  const [joinCode, setJoinCode] = useState('');

  interface RaidRoom {
    roomCode: string;
    hostUsername: string;
    playerCount: number;
    maxPlayers: number;
    status: string;
    createdAt: number;
  }

  const fetchRooms = useCallback(async () => {
    const roomList = await listRooms();
    setRooms(roomList);
  }, [listRooms]);

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, [fetchRooms]);

  const handleCreateRoom = async () => {
    const result = await createRoom();
    if (result) {
      navigate(`/raid/${result.roomCode}`);
    }
  };

  const handleJoinRoom = async (roomCode: string) => {
    const result = await joinRoom(roomCode);
    if (result) {
      navigate(`/raid/${roomCode}`);
    }
  };

  const handleJoinByCode = () => {
    if (joinCode.trim().length === 6) {
      handleJoinRoom(joinCode.trim().toUpperCase());
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 flex items-center justify-center gap-3">
            <Sword className="w-8 h-8" />
            Raid Boss Battle
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Team up with 2-4 players to defeat the boss!
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <button
            onClick={handleCreateRoom}
            disabled={loading}
            className="p-6 rounded-lg bg-gradient-to-br from-red-600 to-red-800 text-white font-bold text-lg hover:from-red-500 hover:to-red-700 transition disabled:opacity-50"
          >
            <Sword className="w-6 h-6 mx-auto mb-2" />
            Create Room
          </button>

          <div className="p-6 rounded-lg bg-gray-100 dark:bg-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              Join with code
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={e =>
                  setJoinCode(e.target.value.toUpperCase().slice(0, 6))
                }
                placeholder="ABC123"
                className="flex-1 px-4 py-2 rounded border dark:bg-gray-700 dark:border-gray-600 font-mono text-lg text-center"
              />
              <button
                onClick={handleJoinByCode}
                disabled={joinCode.length !== 6 || loading}
                className="px-6 py-2 rounded bg-blue-600 text-white font-bold hover:bg-blue-500 disabled:opacity-50"
              >
                Join
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="rounded-lg bg-white dark:bg-gray-800 shadow">
          <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Users className="w-5 h-5" />
              Available Rooms
            </h2>
            <button
              onClick={fetchRooms}
              className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>

          <div className="divide-y dark:divide-gray-700">
            {rooms.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                No rooms available. Create one to start!
              </div>
            ) : (
              rooms.map(room => (
                <div
                  key={room.roomCode}
                  className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <div>
                    <div className="font-bold">{room.roomCode}</div>
                    <div className="text-sm text-gray-500">
                      Hosted by {room.hostUsername}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500">
                      {room.playerCount}/{room.maxPlayers} players
                    </span>
                    <button
                      onClick={() => handleJoinRoom(room.roomCode)}
                      disabled={loading || room.playerCount >= room.maxPlayers}
                      className="px-4 py-2 rounded bg-green-600 text-white font-bold hover:bg-green-500 disabled:opacity-50"
                    >
                      Join
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
