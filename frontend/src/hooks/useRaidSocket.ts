import { useEffect, useRef, useState, useCallback } from 'react';

const HEARTBEAT_INTERVAL_MS = 30000;
const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 3;

export type RaidPlayer = {
  userId: string;
  username: string;
  hp: number;
  maxHp: number;
  isHost: boolean;
  isAlive: boolean;
  wordsTyped: number;
  wordsCorrect: number;
  damageDealt: number;
};

export type RaidStats = {
  totalWords: number;
  avgWpm: number;
  durationMs: number;
};

export type RaidServerMessage =
  | {
      type: 'room_state';
      phase: 'lobby' | 'playing' | 'finished';
      players: RaidPlayer[];
      bossHp: number;
      bossMaxHp: number;
    }
  | { type: 'game_started'; texts: Record<string, string> }
  | { type: 'player_died'; playerId: string }
  | { type: 'victory'; stats: RaidStats }
  | { type: 'defeat'; stats: RaidStats }
  | {
      type: 'boss_attacked';
      targetId: string;
      damage: number;
      newBossHp: number;
    }
  | { type: 'word_hit'; playerId: string; newBossHp: number }
  | { type: 'player_joined'; userId: string; username: string }
  | { type: 'player_left'; userId: string };

export function useRaidSocket(wsUrl: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [lastMessage, setLastMessage] = useState<RaidServerMessage | null>(
    null
  );
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reconnectAttempts = useRef(0);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      wsRef.current.close();
    }

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setError(null);
      reconnectAttempts.current = 0;
      heartbeatRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, HEARTBEAT_INTERVAL_MS);
    };

    ws.onmessage = event => {
      try {
        const data = JSON.parse(event.data);
        setLastMessage(data);
      } catch {
        // ignore invalid JSON
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts.current++;
        reconnectTimeoutRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
      } else {
        setError('Disconnected. Please refresh to reconnect.');
      }
    };

    ws.onerror = () => {
      setError('Connection error. Retrying...');
    };
  }, [wsUrl]);

  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const disconnect = useCallback(() => {
    reconnectAttempts.current = MAX_RECONNECT_ATTEMPTS;
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return { lastMessage, isConnected, error, send, disconnect };
}
