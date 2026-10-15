import { useEffect, useState } from 'react';

export interface LobbyRoom {
  roomId: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  status: string;
}

export function useRaidRooms(apiUrl: string, enabled: boolean) {
  const [rooms, setRooms] = useState<LobbyRoom[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let inFlight = false;
    let refreshPending = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    setLoading(true);

    const refresh = async () => {
      if (!active || document.hidden) return;
      if (inFlight) {
        refreshPending = true;
        return;
      }
      inFlight = true;
      refreshPending = false;
      const request = new AbortController();
      controller = request;
      try {
        const res = await fetch(`${apiUrl}/api/raid/rooms`, {
          signal: request.signal,
        });
        if (!res.ok) throw new Error('Room list unavailable');
        const data = await res.json();
        if (active && !request.signal.aborted) {
          setRooms(Array.isArray(data.rooms) ? data.rooms : []);
        }
      } catch {
        if (active && !request.signal.aborted) setRooms([]);
      } finally {
        inFlight = false;
        if (active && !request.signal.aborted) setLoading(false);
        if (active && !document.hidden) {
          timer = setTimeout(() => void refresh(), refreshPending ? 0 : 30_000);
        }
      }
    };

    const onVisibilityChange = () => {
      clearTimeout(timer);
      if (document.hidden) controller?.abort();
      else void refresh();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    void refresh();
    return () => {
      active = false;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [apiUrl, enabled]);

  return { rooms, loading };
}
