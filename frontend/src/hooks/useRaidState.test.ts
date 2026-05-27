import { describe, it, expect } from 'vitest';
import {
  applyRaidMessage,
  initialRaidState,
  type RaidState,
} from './useRaidState';
import type { RaidPlayer, RaidServerMessage, RaidStats } from './useRaidSocket';

const LOCAL = 'user_local';
const REMOTE = 'user_remote';

const mkPlayer = (over: Partial<RaidPlayer> = {}): RaidPlayer => ({
  userId: LOCAL,
  username: 'Local',
  hp: 100,
  maxHp: 100,
  isHost: false,
  isAlive: true,
  wordsTyped: 0,
  wordsCorrect: 0,
  damageDealt: 0,
  ...over,
});

const stats: RaidStats = { totalWords: 10, avgWpm: 60, durationMs: 30000 };

describe('applyRaidMessage', () => {
  describe('room_state', () => {
    it('updates phase, players, boss hp and clears error', () => {
      const start: RaidState = {
        ...initialRaidState,
        error: 'old error',
        bossHp: 50,
      };
      const msg: RaidServerMessage = {
        type: 'room_state',
        phase: 'playing',
        players: [mkPlayer()],
        bossHp: 80,
        bossMaxHp: 100,
      };
      const next = applyRaidMessage(start, msg, LOCAL);
      expect(next.phase).toBe('playing');
      expect(next.players).toHaveLength(1);
      expect(next.bossHp).toBe(80);
      expect(next.bossMaxHp).toBe(100);
      expect(next.error).toBeNull();
    });

    it('derives isHost from the local player', () => {
      const msg: RaidServerMessage = {
        type: 'room_state',
        phase: 'lobby',
        players: [mkPlayer({ isHost: true }), mkPlayer({ userId: REMOTE })],
        bossHp: 0,
        bossMaxHp: 0,
      };
      const next = applyRaidMessage(initialRaidState, msg, LOCAL);
      expect(next.isHost).toBe(true);

      const next2 = applyRaidMessage(initialRaidState, msg, REMOTE);
      expect(next2.isHost).toBe(false);
    });

    it('preserves prior bossHp/bossMaxHp when message omits them', () => {
      const start: RaidState = {
        ...initialRaidState,
        bossHp: 42,
        bossMaxHp: 100,
      };
      const msg = {
        type: 'room_state',
        phase: 'playing',
        players: [],
      } as unknown as RaidServerMessage;
      const next = applyRaidMessage(start, msg, LOCAL);
      expect(next.bossHp).toBe(42);
      expect(next.bossMaxHp).toBe(100);
    });

    it('picks up result/stats when attached to room_state (defeat batching)', () => {
      const msg: RaidServerMessage = {
        type: 'room_state',
        phase: 'finished',
        players: [],
        bossHp: 0,
        bossMaxHp: 100,
        result: 'defeat',
        stats,
      };
      const next = applyRaidMessage(initialRaidState, msg, LOCAL);
      expect(next.result).toBe('defeat');
      expect(next.stats).toEqual(stats);
    });
  });

  describe('game_started', () => {
    it('transitions to playing, sets localText, wipes stale result/error/hits', () => {
      const start: RaidState = {
        ...initialRaidState,
        result: 'victory',
        stats,
        error: 'stale',
        lastHit: { id: 1, targets: [], kind: 'mistake' },
        lastWordHit: { id: 1, playerId: LOCAL },
      };
      const msg: RaidServerMessage = {
        type: 'game_started',
        texts: { [LOCAL]: 'hello world', [REMOTE]: 'foo bar' },
      };
      const next = applyRaidMessage(start, msg, LOCAL);
      expect(next.phase).toBe('playing');
      expect(next.localText).toBe('hello world');
      expect(next.result).toBeNull();
      expect(next.stats).toBeNull();
      expect(next.error).toBeNull();
      expect(next.lastHit).toBeNull();
      expect(next.lastWordHit).toBeNull();
    });

    it('falls back to empty string when localUserId is not in texts', () => {
      const msg: RaidServerMessage = {
        type: 'game_started',
        texts: { [REMOTE]: 'foo' },
      };
      const next = applyRaidMessage(initialRaidState, msg, LOCAL);
      expect(next.localText).toBe('');
    });
  });

  describe('word_hit', () => {
    it('updates bossHp and emits lastWordHit', () => {
      const start: RaidState = { ...initialRaidState, bossHp: 100 };
      const msg: RaidServerMessage = {
        type: 'word_hit',
        playerId: REMOTE,
        newBossHp: 88,
      };
      const next = applyRaidMessage(start, msg, LOCAL);
      expect(next.bossHp).toBe(88);
      expect(next.lastWordHit?.playerId).toBe(REMOTE);
      expect(typeof next.lastWordHit?.id).toBe('number');
    });

    it('bumps lastWordHit.id between consecutive hits so animations re-key', () => {
      const msg: RaidServerMessage = {
        type: 'word_hit',
        playerId: REMOTE,
        newBossHp: 88,
      };
      const first = applyRaidMessage(initialRaidState, msg, LOCAL);
      const second = applyRaidMessage(first, msg, LOCAL);
      expect(second.lastWordHit?.id).toBeGreaterThan(first.lastWordHit!.id);
    });
  });

  describe('player_hit', () => {
    it('reduces hp on the targeted player and records lastHit', () => {
      const start: RaidState = {
        ...initialRaidState,
        players: [mkPlayer({ hp: 100 }), mkPlayer({ userId: REMOTE, hp: 90 })],
      };
      const msg: RaidServerMessage = {
        type: 'player_hit',
        playerId: REMOTE,
        damage: 10,
        newHp: 80,
      };
      const next = applyRaidMessage(start, msg, LOCAL);
      expect(next.players[0].hp).toBe(100);
      expect(next.players[1].hp).toBe(80);
      expect(next.lastHit?.kind).toBe('mistake');
      expect(next.lastHit?.targets).toEqual([{ playerId: REMOTE, damage: 10 }]);
    });
  });

  describe('boss_attacked', () => {
    it('updates hp and isAlive for every targeted player and stacks targets in lastHit', () => {
      const start: RaidState = {
        ...initialRaidState,
        players: [mkPlayer({ hp: 30 }), mkPlayer({ userId: REMOTE, hp: 5 })],
      };
      const msg: RaidServerMessage = {
        type: 'boss_attacked',
        damage: 10,
        players: [
          { playerId: LOCAL, newHp: 20, isAlive: true },
          { playerId: REMOTE, newHp: 0, isAlive: false },
        ],
      };
      const next = applyRaidMessage(start, msg, LOCAL);
      expect(next.players[0].hp).toBe(20);
      expect(next.players[0].isAlive).toBe(true);
      expect(next.players[1].hp).toBe(0);
      expect(next.players[1].isAlive).toBe(false);
      expect(next.lastHit?.kind).toBe('boss');
      expect(next.lastHit?.targets).toHaveLength(2);
    });
  });

  describe('player_died', () => {
    it('marks the dead player isAlive=false and leaves the rest untouched', () => {
      const start: RaidState = {
        ...initialRaidState,
        players: [mkPlayer(), mkPlayer({ userId: REMOTE })],
      };
      const msg: RaidServerMessage = { type: 'player_died', playerId: REMOTE };
      const next = applyRaidMessage(start, msg, LOCAL);
      expect(next.players[0].isAlive).toBe(true);
      expect(next.players[1].isAlive).toBe(false);
    });
  });

  describe('player_joined / player_left', () => {
    it('appends a new player with default vitals', () => {
      const start: RaidState = {
        ...initialRaidState,
        players: [mkPlayer({ isHost: true })],
      };
      const msg: RaidServerMessage = {
        type: 'player_joined',
        userId: REMOTE,
        username: 'Bob',
      };
      const next = applyRaidMessage(start, msg, LOCAL);
      expect(next.players).toHaveLength(2);
      expect(next.players[1]).toMatchObject({
        userId: REMOTE,
        username: 'Bob',
        hp: 100,
        maxHp: 100,
        isHost: false,
        isAlive: true,
      });
    });

    it('is a no-op if the joined player is already in the list', () => {
      const start: RaidState = {
        ...initialRaidState,
        players: [mkPlayer({ userId: REMOTE, username: 'Bob' })],
      };
      const msg: RaidServerMessage = {
        type: 'player_joined',
        userId: REMOTE,
        username: 'Bob',
      };
      const next = applyRaidMessage(start, msg, LOCAL);
      expect(next).toBe(start);
    });

    it('removes the player on player_left', () => {
      const start: RaidState = {
        ...initialRaidState,
        players: [mkPlayer(), mkPlayer({ userId: REMOTE })],
      };
      const msg: RaidServerMessage = {
        type: 'player_left',
        userId: REMOTE,
      };
      const next = applyRaidMessage(start, msg, LOCAL);
      expect(next.players).toHaveLength(1);
      expect(next.players[0].userId).toBe(LOCAL);
    });
  });

  describe('victory / defeat', () => {
    it('victory transitions to finished and records stats', () => {
      const start: RaidState = { ...initialRaidState, phase: 'playing' };
      const msg: RaidServerMessage = { type: 'victory', stats };
      const next = applyRaidMessage(start, msg, LOCAL);
      expect(next.phase).toBe('finished');
      expect(next.result).toBe('victory');
      expect(next.stats).toEqual(stats);
    });

    it('defeat transitions to finished and records stats', () => {
      const start: RaidState = { ...initialRaidState, phase: 'playing' };
      const msg: RaidServerMessage = { type: 'defeat', stats };
      const next = applyRaidMessage(start, msg, LOCAL);
      expect(next.phase).toBe('finished');
      expect(next.result).toBe('defeat');
      expect(next.stats).toEqual(stats);
    });
  });

  describe('error', () => {
    it('records the error message without touching other state', () => {
      const start: RaidState = {
        ...initialRaidState,
        phase: 'playing',
        players: [mkPlayer()],
      };
      const msg: RaidServerMessage = { type: 'error', message: 'nope' };
      const next = applyRaidMessage(start, msg, LOCAL);
      expect(next.error).toBe('nope');
      expect(next.phase).toBe('playing');
      expect(next.players).toEqual(start.players);
    });
  });
});
