import { useEffect, useRef, useCallback } from 'react';

export interface Player {
  id: string;
  username: string;
  hp: number;
  maxHp: number;
  isDead: boolean;
  isHost?: boolean;
}

export interface RaidState {
  roomCode: string | null;
  status: 'connecting' | 'waiting' | 'active' | 'ended';
  bossHp: number;
  bossMaxHp: number;
  players: Player[];
  hostId: string | null;
}

export interface RaidStats {
  bossHpStart: number;
  bossHpEnd: number;
  victory: boolean;
  players: {
    id: string;
    username: string;
    wordsCompleted: number;
    hpRemaining: number;
    isDead: boolean;
  }[];
}

type MessageHandler = (msg: Record<string, unknown>) => void;

export function useRaidWebSocket(wsUrl: string, onMessage: MessageHandler) {
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = event => {
      try {
        const msg = JSON.parse(event.data);
        onMessageRef.current(msg);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [wsUrl]);

  const send = useCallback((message: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const startRaid = useCallback(() => send({ type: 'start_raid' }), [send]);
  const sendWordDone = useCallback(() => send({ type: 'word_done' }), [send]);
  const sendPlayerHit = useCallback(
    (damage: number) => {
      send({ type: 'player_hit', damage } as Record<string, unknown>);
    },
    [send]
  );

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  return { send, startRaid, sendWordDone, sendPlayerHit };
}
