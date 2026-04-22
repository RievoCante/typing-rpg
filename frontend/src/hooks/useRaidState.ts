import { useState, useEffect, useCallback } from 'react';
import type { RaidServerMessage, RaidPlayer, RaidStats } from './useRaidSocket';

export type RaidPhase = 'lobby' | 'playing' | 'finished';

export type RaidState = {
  phase: RaidPhase;
  players: RaidPlayer[];
  bossHp: number;
  bossMaxHp: number;
  localText: string;
  isHost: boolean;
  result: 'victory' | 'defeat' | null;
  stats: RaidStats | null;
};

export function useRaidState(
  lastMessage: RaidServerMessage | null,
  localUserId: string
) {
  const [state, setState] = useState<RaidState>({
    phase: 'lobby',
    players: [],
    bossHp: 0,
    bossMaxHp: 0,
    localText: '',
    isHost: false,
    result: null,
    stats: null,
  });

  useEffect(() => {
    if (!lastMessage || !lastMessage.type) return;

    switch (lastMessage.type) {
      case 'room_state':
        setState(prev => {
          const players = lastMessage.players || [];
          const localPlayer = players.find(
            (p: RaidPlayer) => p.userId === localUserId
          );
          return {
            ...prev,
            phase: lastMessage.phase,
            players,
            bossHp: lastMessage.bossHp ?? prev.bossHp,
            bossMaxHp: lastMessage.bossMaxHp ?? prev.bossMaxHp,
            isHost: localPlayer?.isHost ?? false,
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
        setState(prev => ({
          ...prev,
          players: prev.players.map(p =>
            p.userId === lastMessage.playerId ? { ...p, isAlive: false } : p
          ),
        }));
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

  const isPhase = useCallback(
    (phase: RaidPhase) => state.phase === phase,
    [state.phase]
  );

  const isLocalAlive =
    state.players.find(p => p.userId === localUserId)?.isAlive ?? true;

  return { state, isPhase, isLocalAlive };
}
