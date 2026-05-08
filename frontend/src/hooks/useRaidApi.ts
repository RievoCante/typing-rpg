import { useState, useCallback } from 'react';

export interface RaidRoom {
  roomCode: string;
  hostUsername: string;
  playerCount: number;
  maxPlayers: number;
  status: string;
  createdAt: number;
}

export interface CreateRoomResponse {
  roomCode: string;
  expiresAt: number;
  wsUrl: string;
}

export interface JoinRoomResponse {
  roomCode: string;
  wsUrl: string;
}

const API_BASE = '/api';

export function useRaidApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createRoom =
    useCallback(async (): Promise<CreateRoomResponse | null> => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/raid/rooms`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to create room');
        }
        return await res.json();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to create room');
        return null;
      } finally {
        setLoading(false);
      }
    }, []);

  const listRooms = useCallback(async (): Promise<RaidRoom[]> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/raid/rooms`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to list rooms');
      }
      const data = await res.json();
      return data.rooms;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to list rooms');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const joinRoom = useCallback(
    async (roomCode: string): Promise<JoinRoomResponse | null> => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/raid/rooms/${roomCode}/join`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to join room');
        }
        return await res.json();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to join room');
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { createRoom, listRooms, joinRoom, loading, error };
}
