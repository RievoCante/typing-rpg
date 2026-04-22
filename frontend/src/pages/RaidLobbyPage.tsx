import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';

interface LobbyRoom {
  roomId: string;
  hostName: string;
  playerCount: number;
  status: string;
}

export default function RaidLobbyPage() {
  const [rooms, setRooms] = useState<LobbyRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const { getToken } = useAuth();

  const apiUrl = import.meta.env.VITE_API_URL;

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
    fetchRooms();
    const id = setInterval(fetchRooms, 5000);
    return () => clearInterval(id);
  }, [fetchRooms]);

  const handleCreateRoom = async () => {
    setCreating(true);
    try {
      const token = await getToken();
      const res = await fetch(`${apiUrl}/api/raid/rooms`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.roomId) {
        navigate(`/raid/${data.roomId}`);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleJoinRoom = async (roomId: string) => {
    try {
      const token = await getToken();
      await fetch(`${apiUrl}/api/raid/rooms/${roomId}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      navigate(`/raid/${roomId}`);
    } catch {
      alert('Failed to join room');
    }
  };

  return (
    <div className="min-h-screen p-8 text-white">
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
        <p className="text-gray-400">No active rooms. Be the first to create one!</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {rooms.map(room => (
            <div key={room.roomId} className="p-4 bg-gray-800 rounded-lg shadow">
              <div className="flex justify-between items-center mb-2">
                <span className="font-mono text-lg">{room.roomId}</span>
                <span className="text-sm text-gray-400">{room.playerCount}/3</span>
              </div>
              <p className="text-sm text-gray-400 mb-3">Host: {room.hostName}</p>
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
