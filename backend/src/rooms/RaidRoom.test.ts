import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RaidRoom } from './RaidRoom';

describe('RaidRoom', () => {
  let room: RaidRoom;
  let mockEnv: any;
  let mockCtx: any;

  beforeEach(() => {
    mockEnv = { CLERK_SECRET_KEY: 'test' };
    mockCtx = {
      id: { toString: () => 'test-room' },
      acceptWebSocket: vi.fn(),
      storage: { put: vi.fn(), get: vi.fn() },
    };
    room = new RaidRoom(mockCtx, mockEnv);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Clear any pending timers from the room instance
    const s = (room as any).state;
    if (s?.attackTimer) clearInterval(s.attackTimer);
    if (s?.graceTimer) clearTimeout(s.graceTimer);
    if (s?.countdownTimer) clearTimeout(s.countdownTimer);
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
    const ws2 = { send: vi.fn() } as any;
    (room as any).handlePlayerJoin(ws, { userId: 'u1', username: 'Alice' });
    (room as any).handlePlayerJoin(ws2, { userId: 'u2', username: 'Bob' });
    (room as any).handleStartGame(ws);
    expect((room as any).state.phase).toBe('playing');
  });

  it('uses flat 100 HP boss (no scaling per player count)', () => {
    const ws1 = { send: vi.fn() } as any;
    const ws2 = { send: vi.fn() } as any;
    (room as any).handlePlayerJoin(ws1, { userId: 'u1', username: 'Alice' });
    (room as any).handlePlayerJoin(ws2, { userId: 'u2', username: 'Bob' });
    (room as any).handleStartGame(ws1);
    expect((room as any).state.bossMaxHp).toBe(100);
    expect((room as any).state.bossHp).toBe(100);
  });

  it('generates WORDS_PER_PLAYER-length text (75 words) per player on game start', () => {
    const ws1 = { send: vi.fn() } as any;
    const ws2 = { send: vi.fn() } as any;
    (room as any).handlePlayerJoin(ws1, { userId: 'u1', username: 'Alice' });
    (room as any).handlePlayerJoin(ws2, { userId: 'u2', username: 'Bob' });
    (room as any).handleStartGame(ws1);
    const text1 = (room as any).state.texts.get('u1') as string;
    const text2 = (room as any).state.texts.get('u2') as string;
    expect(text1.split(' ').length).toBe(75);
    expect(text2.split(' ').length).toBe(75);
  });

  it('decreases boss HP by WORD_DAMAGE=1 on word_complete', () => {
    const ws = { send: vi.fn() } as any;
    const ws2 = { send: vi.fn() } as any;
    (room as any).handlePlayerJoin(ws, { userId: 'u1', username: 'Alice' });
    (room as any).handlePlayerJoin(ws2, { userId: 'u2', username: 'Bob' });
    (room as any).handleStartGame(ws);
    const initialHp = (room as any).state.bossHp;
    (room as any).handleWordComplete(ws, { wordIndex: 0 });
    expect((room as any).state.bossHp).toBe(initialHp - 1);
  });

  it('does not allow joining when not in lobby', () => {
    const ws = { send: vi.fn() } as any;
    const ws2 = { send: vi.fn() } as any;
    (room as any).handlePlayerJoin(ws, { userId: 'u1', username: 'Alice' });
    (room as any).handlePlayerJoin(ws2, { userId: 'u2', username: 'Bob' });
    (room as any).handleStartGame(ws);
    const ws3 = { send: vi.fn() } as any;
    (room as any).handlePlayerJoin(ws3, { userId: 'u3', username: 'Charlie' });
    expect((room as any).state.players.size).toBe(2);
  });

  it('ends game in defeat when last player disconnects mid-game', () => {
    const ws = { send: vi.fn() } as any;
    const ws2 = { send: vi.fn() } as any;
    (room as any).handlePlayerJoin(ws, { userId: 'u1', username: 'Alice' });
    (room as any).handlePlayerJoin(ws2, { userId: 'u2', username: 'Bob' });
    (room as any).handleStartGame(ws);
    // Both players disconnect
    (room as any).webSocketClose(ws);
    (room as any).webSocketClose(ws2);
    expect((room as any).state.phase).toBe('finished');
  });

  it('ends game in victory when boss HP reaches 0', () => {
    const ws = { send: vi.fn() } as any;
    const ws2 = { send: vi.fn() } as any;
    (room as any).handlePlayerJoin(ws, { userId: 'u1', username: 'Alice' });
    (room as any).handlePlayerJoin(ws2, { userId: 'u2', username: 'Bob' });
    (room as any).handleStartGame(ws);
    (room as any).state.bossHp = 1;
    (room as any).handleWordComplete(ws, { wordIndex: 0 });
    expect((room as any).state.phase).toBe('finished');
  });

  // ── Mistake mechanic ──

  it('applies mistake damage in [5, 15] range to the typing player only', () => {
    const ws = { send: vi.fn() } as any;
    const ws2 = { send: vi.fn() } as any;
    (room as any).handlePlayerJoin(ws, { userId: 'u1', username: 'Alice' });
    (room as any).handlePlayerJoin(ws2, { userId: 'u2', username: 'Bob' });
    (room as any).handleStartGame(ws);

    const p1Before = (room as any).state.players.get(ws).hp;
    const p2Before = (room as any).state.players.get(ws2).hp;
    (room as any).handleMistake(ws);
    const p1After = (room as any).state.players.get(ws).hp;
    const p2After = (room as any).state.players.get(ws2).hp;

    const dmg = p1Before - p1After;
    expect(dmg).toBeGreaterThanOrEqual(5);
    expect(dmg).toBeLessThanOrEqual(15);
    // Other player untouched
    expect(p2After).toBe(p2Before);
  });

  it('marks player dead and ends game in defeat when mistake kills last alive player', () => {
    const ws = { send: vi.fn() } as any;
    const ws2 = { send: vi.fn() } as any;
    (room as any).handlePlayerJoin(ws, { userId: 'u1', username: 'Alice' });
    (room as any).handlePlayerJoin(ws2, { userId: 'u2', username: 'Bob' });
    (room as any).handleStartGame(ws);

    // Kill Bob first
    (room as any).state.players.get(ws2).isAlive = false;
    (room as any).state.players.get(ws2).hp = 0;
    // Set Alice to 1 hp so the mistake kills her
    (room as any).state.players.get(ws).hp = 1;
    (room as any).handleMistake(ws);

    expect((room as any).state.players.get(ws).isAlive).toBe(false);
    expect((room as any).state.phase).toBe('finished');
  });

  it('ignores mistake when phase is lobby', () => {
    const ws = { send: vi.fn() } as any;
    (room as any).handlePlayerJoin(ws, { userId: 'u1', username: 'Alice' });
    const hpBefore = (room as any).state.players.get(ws).hp;
    (room as any).handleMistake(ws);
    expect((room as any).state.players.get(ws).hp).toBe(hpBefore);
  });

  // ── Boss attack ──

  it('boss attack hits ALL alive players each tick', () => {
    const ws = { send: vi.fn() } as any;
    const ws2 = { send: vi.fn() } as any;
    const ws3 = { send: vi.fn() } as any;
    (room as any).handlePlayerJoin(ws, { userId: 'u1', username: 'Alice' });
    (room as any).handlePlayerJoin(ws2, { userId: 'u2', username: 'Bob' });
    (room as any).handlePlayerJoin(ws3, { userId: 'u3', username: 'Charlie' });
    // 3 players auto-enter countdown; start the raid directly for this unit test.
    (room as any).beginRaid();
    // Kill Charlie so we can verify only alive players are hit
    (room as any).state.players.get(ws3).isAlive = false;
    (room as any).state.players.get(ws3).hp = 0;

    const p1Before = (room as any).state.players.get(ws).hp;
    const p2Before = (room as any).state.players.get(ws2).hp;
    (room as any).bossAttack();
    expect((room as any).state.players.get(ws).hp).toBe(p1Before - 10);
    expect((room as any).state.players.get(ws2).hp).toBe(p2Before - 10);
    // Dead player not re-hit
    expect((room as any).state.players.get(ws3).hp).toBe(0);
  });

  // ── Ghost room regression tests ──

  it('createRoomInDb treats duplicate key as success', async () => {
    const uniqueError = new Error('SQLITE_CONSTRAINT_PRIMARYKEY');

    // Make prepare throw so the error is caught by createRoomInDb's try/catch
    mockEnv.DB = {
      prepare: vi.fn(() => { throw uniqueError; }),
      exec: vi.fn(() => Promise.resolve()),
      batch: vi.fn(() => Promise.resolve([])),
      dump: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
    } as any;

    (room as any).state.roomId = 'GHOST1';
    (room as any).state.dbRoomCreated = false;

    await (room as any).createRoomInDb('u1', 'Alice');
    expect((room as any).state.dbRoomCreated).toBe(true);
  });

  it('webSocketClose deletes room in lobby even if dbRoomCreated is false', async () => {
    // Provide a mock D1Database that createDbClient can wrap
    mockEnv.DB = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          run: vi.fn(() => Promise.resolve()),
          all: vi.fn(() => Promise.resolve({ results: [] })),
          raw: vi.fn(() => Promise.resolve([])),
        })),
      })),
      exec: vi.fn(() => Promise.resolve()),
      batch: vi.fn(() => Promise.resolve([])),
      dump: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
    } as any;

    (room as any).state.roomId = 'GHOST2';
    (room as any).state.phase = 'lobby';
    (room as any).state.dbRoomCreated = false;

    const ws = { send: vi.fn() } as any;
    (room as any).handlePlayerJoin(ws, { userId: 'u1', username: 'Alice' });

    // Should not throw even when dbRoomCreated is false
    expect(() => (room as any).webSocketClose(ws)).not.toThrow();
  });

  it('loads persisted roomId and dbRoomCreated on initialization', async () => {
    mockCtx.storage.get = vi.fn((key: string) => {
      if (key === 'roomId') return Promise.resolve('PERSISTED');
      if (key === 'dbRoomCreated') return Promise.resolve(true);
      return Promise.resolve(undefined);
    });

    await (room as any).ensureInitialized();

    expect((room as any).state.roomId).toBe('PERSISTED');
    expect((room as any).state.dbRoomCreated).toBe(true);
  });

  // ── Player count sync regression tests ──

  it('syncs playerCount on non-host join', async () => {
    const syncSpy = vi.spyOn(room as any, 'syncPlayerCountToDb').mockResolvedValue(undefined);
    const ws1 = { send: vi.fn() } as any;
    const ws2 = { send: vi.fn() } as any;

    (room as any).handlePlayerJoin(ws1, { userId: 'u1', username: 'Alice' });
    expect(syncSpy).not.toHaveBeenCalled(); // host creates room instead

    (room as any).handlePlayerJoin(ws2, { userId: 'u2', username: 'Bob' });
    expect(syncSpy).toHaveBeenCalledWith(2);
  });

  it('syncs playerCount on leave when players remain', async () => {
    const syncSpy = vi.spyOn(room as any, 'syncPlayerCountToDb').mockResolvedValue(undefined);
    const ws1 = { send: vi.fn() } as any;
    const ws2 = { send: vi.fn() } as any;

    (room as any).handlePlayerJoin(ws1, { userId: 'u1', username: 'Alice' });
    (room as any).handlePlayerJoin(ws2, { userId: 'u2', username: 'Bob' });
    syncSpy.mockClear();

    await (room as any).webSocketClose(ws2);
    expect(syncSpy).toHaveBeenCalledWith(1, undefined, undefined, undefined);
  });

  it('syncs playerCount and status on game start', async () => {
    const syncSpy = vi.spyOn(room as any, 'syncPlayerCountToDb').mockResolvedValue(undefined);
    const ws1 = { send: vi.fn() } as any;
    const ws2 = { send: vi.fn() } as any;

    (room as any).handlePlayerJoin(ws1, { userId: 'u1', username: 'Alice' });
    (room as any).handlePlayerJoin(ws2, { userId: 'u2', username: 'Bob' });

    (room as any).handleStartGame(ws1);
    expect(syncSpy).toHaveBeenCalledWith(2, 'active');
  });

  // ── WS credential sourcing (P1-4) ──

  it('webSocketMessage("join") uses stored credentials, ignoring message body', () => {
    const ws = { send: vi.fn() } as any;
    // Simulate worker.fetch storing validated credentials for this WS
    (room as any).wsCredentials.set(ws, {
      userId: 'trusted-id',
      username: 'TrustedName',
    });

    // Client tries to impersonate a different user via the message body
    (room as any).webSocketMessage(
      ws,
      JSON.stringify({
        type: 'join',
        userId: 'spoofed-id',
        username: 'Attacker',
      })
    );

    const players = Array.from((room as any).state.players.values());
    expect(players.length).toBe(1);
    expect((players[0] as any).userId).toBe('trusted-id');
    expect((players[0] as any).username).toBe('TrustedName');
  });

  it('webSocketMessage("join") drops the join when no credentials are stored', () => {
    const ws = { send: vi.fn() } as any;
    // No entry in wsCredentials — simulates a malformed/bypassed upgrade
    (room as any).webSocketMessage(
      ws,
      JSON.stringify({ type: 'join', userId: 'x', username: 'X' })
    );
    expect((room as any).state.players.size).toBe(0);
  });

  it('webSocketClose cleans up wsCredentials for the closed WS', () => {
    const ws = { send: vi.fn() } as any;
    (room as any).wsCredentials.set(ws, {
      userId: 'u1',
      username: 'Alice',
    });
    (room as any).handlePlayerJoin(ws, { userId: 'u1', username: 'Alice' });
    (room as any).webSocketClose(ws);
    expect((room as any).wsCredentials.has(ws)).toBe(false);
  });

  // ── Auto-start countdown ──

  describe('auto-start countdown', () => {
    it('enters countdown phase and broadcasts countdown_started when the 3rd player joins', () => {
      vi.useFakeTimers();
      const ws1 = { send: vi.fn() } as any;
      const ws2 = { send: vi.fn() } as any;
      const ws3 = { send: vi.fn() } as any;
      (room as any).handlePlayerJoin(ws1, { userId: 'u1', username: 'Alice' });
      (room as any).handlePlayerJoin(ws2, { userId: 'u2', username: 'Bob' });
      expect((room as any).state.phase).toBe('lobby');
      (room as any).handlePlayerJoin(ws3, { userId: 'u3', username: 'Cara' });
      expect((room as any).state.phase).toBe('countdown');
      expect(ws3.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"countdown_started"')
      );
    });

    it('begins the raid automatically after COUNTDOWN_MS (5s)', () => {
      vi.useFakeTimers();
      const ws1 = { send: vi.fn() } as any;
      const ws2 = { send: vi.fn() } as any;
      const ws3 = { send: vi.fn() } as any;
      (room as any).handlePlayerJoin(ws1, { userId: 'u1', username: 'Alice' });
      (room as any).handlePlayerJoin(ws2, { userId: 'u2', username: 'Bob' });
      (room as any).handlePlayerJoin(ws3, { userId: 'u3', username: 'Cara' });
      expect((room as any).state.phase).toBe('countdown');
      vi.advanceTimersByTime(5000);
      expect((room as any).state.phase).toBe('playing');
    });

    it('manual 2-player start begins immediately with no countdown', () => {
      const ws1 = { send: vi.fn() } as any;
      const ws2 = { send: vi.fn() } as any;
      (room as any).handlePlayerJoin(ws1, { userId: 'u1', username: 'Alice' });
      (room as any).handlePlayerJoin(ws2, { userId: 'u2', username: 'Bob' });
      (room as any).handleStartGame(ws1);
      expect((room as any).state.phase).toBe('playing');
      expect((room as any).state.countdownTimer).toBeNull();
    });
  });

  // ── Countdown cancellation ──

  describe('countdown cancellation', () => {
    it('cancels the countdown and returns to lobby when a player drops below 3', () => {
      vi.useFakeTimers();
      const ws1 = { send: vi.fn() } as any;
      const ws2 = { send: vi.fn() } as any;
      const ws3 = { send: vi.fn() } as any;
      (room as any).handlePlayerJoin(ws1, { userId: 'u1', username: 'Alice' });
      (room as any).handlePlayerJoin(ws2, { userId: 'u2', username: 'Bob' });
      (room as any).handlePlayerJoin(ws3, { userId: 'u3', username: 'Cara' });
      expect((room as any).state.phase).toBe('countdown');

      (room as any).webSocketClose(ws3);

      expect((room as any).state.phase).toBe('lobby');
      expect((room as any).state.countdownTimer).toBeNull();
      expect((room as any).state.players.size).toBe(2);
      expect(ws1.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"countdown_cancelled"')
      );

      // The cleared timer must not fire a late beginRaid.
      vi.advanceTimersByTime(5000);
      expect((room as any).state.phase).toBe('lobby');
    });

    it('reassigns host when the host leaves during the countdown', () => {
      vi.useFakeTimers();
      const ws1 = { send: vi.fn() } as any;
      const ws2 = { send: vi.fn() } as any;
      const ws3 = { send: vi.fn() } as any;
      (room as any).handlePlayerJoin(ws1, { userId: 'u1', username: 'Alice' });
      (room as any).handlePlayerJoin(ws2, { userId: 'u2', username: 'Bob' });
      (room as any).handlePlayerJoin(ws3, { userId: 'u3', username: 'Cara' });
      expect((room as any).state.players.get(ws1).isHost).toBe(true);

      (room as any).webSocketClose(ws1); // host leaves during countdown

      expect((room as any).state.phase).toBe('lobby');
      const remaining = Array.from((room as any).state.players.values()) as any[];
      expect(remaining.some(p => p.isHost)).toBe(true);
    });
  });

  // ── webSocketError regression test ──

  it('removes player on webSocketError and transfers host in lobby', () => {
    const ws1 = { send: vi.fn() } as any;
    const ws2 = { send: vi.fn() } as any;

    (room as any).handlePlayerJoin(ws1, { userId: 'u1', username: 'Alice' });
    (room as any).handlePlayerJoin(ws2, { userId: 'u2', username: 'Bob' });

    expect((room as any).state.players.get(ws1).isHost).toBe(true);
    expect((room as any).state.players.get(ws2).isHost).toBe(false);

    (room as any).webSocketError(ws1);

    expect((room as any).state.players.has(ws1)).toBe(false);
    expect((room as any).state.players.get(ws2).isHost).toBe(true);
  });

  it('stores a valid characterConfig on join and includes it in room_state', () => {
    const ws = { send: vi.fn() } as any;
    const cfg = {
      bodyShape: 'round',
      bodyColor: '#34d399',
      eyeStyle: 'dot',
      accessory: 'antenna',
      accessoryColor: '#fde047',
    };
    (room as any).handlePlayerJoin(ws, { userId: 'u1', username: 'Alice' }, cfg);
    const stored = (room as any).state.players.get(ws);
    expect(stored.characterConfig).toEqual(cfg);

    // Assert by message type rather than call index so the test stays correct
    // even if broadcast ordering changes.
    const calls = ws.send.mock.calls.map((c: any) => JSON.parse(c[0]));
    const roomState = calls.find((m: any) => m.type === 'room_state');
    expect(roomState).toBeDefined();
    const me = roomState.players.find((p: any) => p.userId === 'u1');
    expect(me.characterConfig).toEqual(cfg);

    const joined = calls.find((m: any) => m.type === 'player_joined');
    expect(joined.characterConfig).toEqual(cfg);
  });

  it('defaults characterConfig to null when absent or invalid', () => {
    const ws = { send: vi.fn() } as any;
    (room as any).handlePlayerJoin(ws, { userId: 'u2', username: 'Bob' });
    expect((room as any).state.players.get(ws).characterConfig).toBeNull();

    const ws2 = { send: vi.fn() } as any;
    (room as any).handlePlayerJoin(
      ws2,
      { userId: 'u3', username: 'Cara' },
      { bodyShape: 'triangle' }
    );
    expect((room as any).state.players.get(ws2).characterConfig).toBeNull();
  });
});
