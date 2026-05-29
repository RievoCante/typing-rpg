import { useEffect, useRef, useState, useCallback } from 'react';
import type { PlayerAvatarConfig } from '../utils/avatarConfig';

// Heartbeat under common proxy idle timeouts (Cloudflare ~100s, browsers
// sometimes shorter). 15s leaves ample margin while avoiding chatter.
const HEARTBEAT_INTERVAL_MS = 15000;
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
  characterConfig?: PlayerAvatarConfig | null;
};

export type RaidPlayerResult = {
  userId: string;
  username: string;
  damageDealt: number;
  wordsCorrect: number;
  wordsTyped: number;
  survived: boolean;
  wpm: number;
  xpAwarded: number;
};

export type RaidStats = {
  totalWords: number;
  avgWpm: number;
  durationMs: number;
  players?: RaidPlayerResult[];
};

export type RaidServerMessage =
  | {
      type: 'room_state';
      phase: 'lobby' | 'countdown' | 'playing' | 'finished';
      players: RaidPlayer[];
      bossHp: number;
      bossMaxHp: number;
      /** Present only when phase === 'countdown'. Server epoch ms. */
      countdownEndsAt?: number;
      result?: 'victory' | 'defeat';
      stats?: RaidStats;
    }
  | { type: 'game_started'; texts: Record<string, string> }
  | { type: 'countdown_started'; durationMs: number }
  | { type: 'countdown_cancelled' }
  | { type: 'player_died'; playerId: string }
  | { type: 'victory'; stats: RaidStats }
  | { type: 'defeat'; stats: RaidStats }
  | {
      type: 'boss_attacked';
      damage: number;
      players: { playerId: string; newHp: number; isAlive: boolean }[];
    }
  | {
      type: 'player_hit';
      playerId: string;
      damage: number;
      newHp: number;
    }
  | { type: 'word_hit'; playerId: string; newBossHp: number }
  | {
      type: 'player_joined';
      userId: string;
      username: string;
      characterConfig?: PlayerAvatarConfig | null;
    }
  | { type: 'player_left'; userId: string }
  | { type: 'error'; message: string };

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
    if (!wsUrl) return;
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

    ws.onclose = event => {
      // Diagnostic: capture close code/reason so we can pin down mid-game drops.
      console.warn('[raid-ws] close', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });
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

    ws.onerror = event => {
      console.warn('[raid-ws] error', event);
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
