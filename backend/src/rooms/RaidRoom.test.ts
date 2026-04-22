import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RaidRoom } from './RaidRoom';

describe('RaidRoom', () => {
  let room: RaidRoom;
  let mockEnv: any;
  let mockCtx: any;

  beforeEach(() => {
    vi.useFakeTimers();
    mockEnv = { CLERK_SECRET_KEY: 'test' };
    mockCtx = {
      id: { toString: () => 'test-room' },
      acceptWebSocket: vi.fn(),
      storage: { put: vi.fn(), get: vi.fn() },
    };
    room = new RaidRoom(mockCtx, mockEnv);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts in lobby phase', () => {
    expect((room as any).state.phase).toBe('lobby');
  });

  it('adds player on join', () => {
    const ws = { send: vi.fn() } as any;
    (room as any).handlePlayerJoin(ws, { userId: 'u1', username: 'Alice' });
    expect((room as any).state.players.size).toBe(1);
  });

  it('rejects start_game from non-host', () => {
    const ws = { send: vi.fn() } as any;
    (room as any).handlePlayerJoin(ws, { userId: 'u1', username: 'Alice' });
    const ws2 = { send: vi.fn() } as any;
    (room as any).handlePlayerJoin(ws2, { userId: 'u2', username: 'Bob' });

    const initialPhase = (room as any).state.phase;
    (room as any).handleStartGame(ws2);
    expect((room as any).state.phase).toBe(initialPhase);
  });

  it('transitions to playing on host start', () => {
    const ws = { send: vi.fn() } as any;
    (room as any).handlePlayerJoin(ws, { userId: 'u1', username: 'Alice' });
    (room as any).handleStartGame(ws);
    expect((room as any).state.phase).toBe('playing');
  });

  it('calculates boss HP as base * playerCount', () => {
    const ws1 = { send: vi.fn() } as any;
    const ws2 = { send: vi.fn() } as any;
    (room as any).handlePlayerJoin(ws1, { userId: 'u1', username: 'Alice' });
    (room as any).handlePlayerJoin(ws2, { userId: 'u2', username: 'Bob' });
    (room as any).handleStartGame(ws1);
    expect((room as any).state.bossMaxHp).toBe(250);
  });

  it('decreases boss HP on word_complete', () => {
    const ws = { send: vi.fn() } as any;
    (room as any).handlePlayerJoin(ws, { userId: 'u1', username: 'Alice' });
    (room as any).handleStartGame(ws);
    const initialHp = (room as any).state.bossHp;
    (room as any).handleWordComplete(ws, { wordIndex: 0 });
    expect((room as any).state.bossHp).toBe(initialHp - 6);
  });

  it('does not allow joining when not in lobby', () => {
    const ws = { send: vi.fn() } as any;
    (room as any).handlePlayerJoin(ws, { userId: 'u1', username: 'Alice' });
    (room as any).handleStartGame(ws);
    const ws2 = { send: vi.fn() } as any;
    (room as any).handlePlayerJoin(ws2, { userId: 'u2', username: 'Bob' });
    expect((room as any).state.players.size).toBe(1);
  });

  it('ends game in defeat when last player disconnects mid-game', () => {
    const ws = { send: vi.fn() } as any;
    (room as any).handlePlayerJoin(ws, { userId: 'u1', username: 'Alice' });
    (room as any).handleStartGame(ws);
    (room as any).webSocketClose(ws);
    expect((room as any).state.phase).toBe('finished');
  });
});
