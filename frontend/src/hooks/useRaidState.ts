import { useState, useEffect, useCallback } from 'react';
import type { RaidServerMessage, RaidPlayer, RaidStats } from './useRaidSocket';

export type { RaidPlayer } from './useRaidSocket';

export type RaidPhase = 'lobby' | 'playing' | 'finished';

// Per-player hit events for animated popups. Each carries a fresh `id` so
// consumers can key animations even when the same player is hit multiple
// times in a row. `targets` lists all players hit in this event so the boss
// attack (which damages every alive player) is rendered in every lane.
export type RaidHitEvent = {
  id: number;
  targets: { playerId: string; damage: number }[];
  kind: 'mistake' | 'boss';
};

// Fires when any player lands a hit on the boss. Used to drive per-attacker
// avatar animations and synchronous boss HP updates between room_state syncs.
export type RaidWordHit = {
  id: number;
  playerId: string;
};

export type RaidState = {
  phase: RaidPhase;
  players: RaidPlayer[];
  bossHp: number;
  bossMaxHp: number;
  localText: string;
  isHost: boolean;
  result: 'victory' | 'defeat' | null;
  stats: RaidStats | null;
  error: string | null;
  lastHit: RaidHitEvent | null;
  lastWordHit: RaidWordHit | null;
};

let hitIdSeq = 0;
let wordHitIdSeq = 0;

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
    error: null,
    lastHit: null,
    lastWordHit: null,
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
            // Clear the prior error once we receive a fresh authoritative
            // room state — stale errors should not linger across phases.
            error: null,
          };
        });
        break;
      case 'error':
        setState(prev => ({ ...prev, error: lastMessage.message }));
        break;
      case 'game_started':
        setState(prev => ({
          ...prev,
          phase: 'playing',
          localText: lastMessage.texts?.[localUserId] ?? '',
          // Wipe stale results when starting a fresh game.
          result: null,
          stats: null,
          error: null,
          lastHit: null,
          lastWordHit: null,
        }));
        break;
      case 'word_hit':
        setState(prev => ({
          ...prev,
          bossHp: lastMessage.newBossHp,
          lastWordHit: {
            id: ++wordHitIdSeq,
            playerId: lastMessage.playerId,
          },
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
      case 'player_hit':
        setState(prev => ({
          ...prev,
          players: prev.players.map(p =>
            p.userId === lastMessage.playerId
              ? { ...p, hp: lastMessage.newHp }
              : p
          ),
          lastHit: {
            id: ++hitIdSeq,
            targets: [
              { playerId: lastMessage.playerId, damage: lastMessage.damage },
            ],
            kind: 'mistake',
          },
        }));
        break;
      case 'boss_attacked':
        setState(prev => {
          const hpByPlayer = new Map(
            lastMessage.players.map(p => [p.playerId, p])
          );
          return {
            ...prev,
            players: prev.players.map(p => {
              const hit = hpByPlayer.get(p.userId);
              return hit ? { ...p, hp: hit.newHp, isAlive: hit.isAlive } : p;
            }),
            lastHit: {
              id: ++hitIdSeq,
              targets: lastMessage.players.map(p => ({
                playerId: p.playerId,
                damage: lastMessage.damage,
              })),
              kind: 'boss',
            },
          };
        });
        break;
      case 'player_joined':
        // Incremental add: server sends room_state immediately before this,
        // but React batching can drop the earlier setLastMessage. Adding here
        // guarantees the host's player list updates without waiting for the
        // next room_state broadcast.
        setState(prev => {
          if (prev.players.some(p => p.userId === lastMessage.userId))
            return prev;
          return {
            ...prev,
            players: [
              ...prev.players,
              {
                userId: lastMessage.userId,
                username: lastMessage.username,
                hp: 100,
                maxHp: 100,
                isHost: false,
                isAlive: true,
                wordsTyped: 0,
                wordsCorrect: 0,
                damageDealt: 0,
              },
            ],
          };
        });
        break;
      case 'player_left':
        setState(prev => ({
          ...prev,
          players: prev.players.filter(p => p.userId !== lastMessage.userId),
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
