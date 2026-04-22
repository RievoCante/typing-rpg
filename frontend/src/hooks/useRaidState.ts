import { useState, useEffect, useCallback } from 'react';

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

export type RaidPhase = 'lobby' | 'playing' | 'finished';

export type RaidState = {
  phase: RaidPhase;
  players: RaidPlayer[];
  bossHp: number;
  bossMaxHp: number;
  localText: string;
  isHost: boolean;
  isLocalAlive: boolean;
  result: 'victory' | 'defeat' | null;
  stats: { totalWords: number; avgWpm: number; durationMs: number } | null;
};

export function useRaidState(lastMessage: any, localUserId: string) {
  const [state, setState] = useState<RaidState>({
    phase: 'lobby',
    players: [],
    bossHp: 0,
    bossMaxHp: 0,
    localText: '',
    isHost: false,
    isLocalAlive: true,
    result: null,
    stats: null,
  });

  useEffect(() => {
    if (!lastMessage || !lastMessage.type) return;

    switch (lastMessage.type) {
      case 'room_state':
        setState(prev => {
          const players = lastMessage.players || [];
          const localPlayer = players.find((p: RaidPlayer) => p.userId === localUserId);
          return {
            ...prev,
            phase: lastMessage.phase,
            players,
            bossHp: lastMessage.bossHp ?? prev.bossHp,
            bossMaxHp: lastMessage.bossMaxHp ?? prev.bossMaxHp,
            isHost: localPlayer?.isHost ?? false,
            isLocalAlive: localPlayer?.isAlive ?? true,
          };
        });
        break;
      case 'game_started':
        setState(prev => ({
          ...prev,
          phase: 'playing',
          localText: lastMessage.texts?.[localUserId] ?? '',
        }));
        break;
      case 'player_died':
        if (lastMessage.playerId === localUserId) {
          setState(prev => ({ ...prev, isLocalAlive: false }));
        }
        break;
      case 'victory':
      case 'defeat':
        setState(prev => ({
          ...prev,
          phase: 'finished',
          result: lastMessage.type,
          stats: lastMessage.stats ?? null,
        }));
        break;
    }
  }, [lastMessage, localUserId]);

  const isPhase = useCallback((phase: RaidPhase) => state.phase === phase, [state.phase]);

  return { state, isPhase };
}
