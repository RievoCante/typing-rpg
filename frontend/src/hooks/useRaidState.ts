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

export const initialRaidState: RaidState = {
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
};

// Pure reducer extracted from the hook so it can be unit-tested without a
// React renderer. Always returns a new state object (never mutates `prev`).
export function applyRaidMessage(
  prev: RaidState,
  msg: RaidServerMessage,
  localUserId: string
): RaidState {
  switch (msg.type) {
    case 'room_state': {
      const players = msg.players || [];
      const localPlayer = players.find(
        (p: RaidPlayer) => p.userId === localUserId
      );
      return {
        ...prev,
        phase: msg.phase,
        players,
        bossHp: msg.bossHp ?? prev.bossHp,
        bossMaxHp: msg.bossMaxHp ?? prev.bossMaxHp,
        isHost: localPlayer?.isHost ?? false,
        // When the server attaches the terminal result/stats to a room_state
        // (sent right after victory/defeat), pick them up so a coalesced
        // render still populates the result screen.
        result: msg.result ?? prev.result,
        stats: msg.stats ?? prev.stats,
        // Stale errors should not linger across phases.
        error: null,
      };
    }
    case 'error':
      return { ...prev, error: msg.message };
    case 'game_started':
      return {
        ...prev,
        phase: 'playing',
        localText: msg.texts?.[localUserId] ?? '',
        result: null,
        stats: null,
        error: null,
        lastHit: null,
        lastWordHit: null,
      };
    case 'word_hit':
      return {
        ...prev,
        bossHp: msg.newBossHp,
        lastWordHit: { id: ++wordHitIdSeq, playerId: msg.playerId },
      };
    case 'player_died':
      return {
        ...prev,
        players: prev.players.map(p =>
          p.userId === msg.playerId ? { ...p, isAlive: false } : p
        ),
      };
    case 'player_hit':
      return {
        ...prev,
        players: prev.players.map(p =>
          p.userId === msg.playerId ? { ...p, hp: msg.newHp } : p
        ),
        lastHit: {
          id: ++hitIdSeq,
          targets: [{ playerId: msg.playerId, damage: msg.damage }],
          kind: 'mistake',
        },
      };
    case 'boss_attacked': {
      const hpByPlayer = new Map(msg.players.map(p => [p.playerId, p]));
      return {
        ...prev,
        players: prev.players.map(p => {
          const hit = hpByPlayer.get(p.userId);
          return hit ? { ...p, hp: hit.newHp, isAlive: hit.isAlive } : p;
        }),
        lastHit: {
          id: ++hitIdSeq,
          targets: msg.players.map(p => ({
            playerId: p.playerId,
            damage: msg.damage,
          })),
          kind: 'boss',
        },
      };
    }
    case 'player_joined':
      // Incremental add: server sends room_state immediately before this,
      // but React batching can drop the earlier setLastMessage. Adding here
      // guarantees the host's player list updates without waiting for the
      // next room_state broadcast.
      if (prev.players.some(p => p.userId === msg.userId)) return prev;
      return {
        ...prev,
        players: [
          ...prev.players,
          {
            userId: msg.userId,
            username: msg.username,
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
    case 'player_left':
      return {
        ...prev,
        players: prev.players.filter(p => p.userId !== msg.userId),
      };
    case 'victory':
    case 'defeat':
      return {
        ...prev,
        phase: 'finished',
        result: msg.type,
        stats: msg.stats ?? null,
      };
    default:
      return prev;
  }
}

export function useRaidState(
  lastMessage: RaidServerMessage | null,
  localUserId: string
) {
  const [state, setState] = useState<RaidState>(initialRaidState);

  useEffect(() => {
    if (!lastMessage || !lastMessage.type) return;
    setState(prev => applyRaidMessage(prev, lastMessage, localUserId));
  }, [lastMessage, localUserId]);

  const isPhase = useCallback(
    (phase: RaidPhase) => state.phase === phase,
    [state.phase]
  );

  const isLocalAlive =
    state.players.find(p => p.userId === localUserId)?.isAlive ?? true;

  return { state, isPhase, isLocalAlive };
}
