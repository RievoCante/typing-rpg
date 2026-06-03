import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RaidRoom } from './RaidRoom';
describe('RaidRoom', () => {
    let room;
    let mockEnv;
    let mockCtx;
    beforeEach(() => {
        mockEnv = { CLERK_SECRET_KEY: 'test' };
        mockCtx = {
            id: { toString: () => 'test-room' },
            acceptWebSocket: vi.fn(),
            storage: { put: vi.fn(), get: vi.fn() },
        };
        room = new RaidRoom(mockCtx, mockEnv);
        vi.spyOn(console, 'error').mockImplementation(() => { });
    });
    afterEach(() => {
        vi.restoreAllMocks();
        // Clear any pending timers from the room instance
        const s = room.state;
        if (s?.attackTimer)
            clearInterval(s.attackTimer);
        if (s?.graceTimer)
            clearTimeout(s.graceTimer);
        if (s?.countdownTimer)
            clearTimeout(s.countdownTimer);
        vi.useRealTimers();
    });
    it('starts in lobby phase', () => {
        expect(room.state.phase).toBe('lobby');
    });
    it('adds player on join', () => {
        const ws = { send: vi.fn() };
        room.handlePlayerJoin(ws, { userId: 'u1', username: 'Alice' });
        expect(room.state.players.size).toBe(1);
    });
    it('rejects start_game from non-host', () => {
        const ws = { send: vi.fn() };
        room.handlePlayerJoin(ws, { userId: 'u1', username: 'Alice' });
        const ws2 = { send: vi.fn() };
        room.handlePlayerJoin(ws2, { userId: 'u2', username: 'Bob' });
        const initialPhase = room.state.phase;
        room.handleStartGame(ws2);
        expect(room.state.phase).toBe(initialPhase);
    });
    it('transitions to playing on host start', () => {
        const ws = { send: vi.fn() };
        const ws2 = { send: vi.fn() };
        room.handlePlayerJoin(ws, { userId: 'u1', username: 'Alice' });
        room.handlePlayerJoin(ws2, { userId: 'u2', username: 'Bob' });
        room.handleStartGame(ws);
        expect(room.state.phase).toBe('playing');
    });
    it('uses flat 100 HP boss (no scaling per player count)', () => {
        const ws1 = { send: vi.fn() };
        const ws2 = { send: vi.fn() };
        room.handlePlayerJoin(ws1, { userId: 'u1', username: 'Alice' });
        room.handlePlayerJoin(ws2, { userId: 'u2', username: 'Bob' });
        room.handleStartGame(ws1);
        expect(room.state.bossMaxHp).toBe(100);
        expect(room.state.bossHp).toBe(100);
    });
    it('generates WORDS_PER_PLAYER-length text (75 words) per player on game start', () => {
        const ws1 = { send: vi.fn() };
        const ws2 = { send: vi.fn() };
        room.handlePlayerJoin(ws1, { userId: 'u1', username: 'Alice' });
        room.handlePlayerJoin(ws2, { userId: 'u2', username: 'Bob' });
        room.handleStartGame(ws1);
        const text1 = room.state.texts.get('u1');
        const text2 = room.state.texts.get('u2');
        expect(text1.split(' ').length).toBe(75);
        expect(text2.split(' ').length).toBe(75);
    });
    it('decreases boss HP by WORD_DAMAGE=1 on word_complete', () => {
        const ws = { send: vi.fn() };
        const ws2 = { send: vi.fn() };
        room.handlePlayerJoin(ws, { userId: 'u1', username: 'Alice' });
        room.handlePlayerJoin(ws2, { userId: 'u2', username: 'Bob' });
        room.handleStartGame(ws);
        const initialHp = room.state.bossHp;
        room.handleWordComplete(ws, { wordIndex: 0 });
        expect(room.state.bossHp).toBe(initialHp - 1);
    });
    it('does not allow joining when not in lobby', () => {
        const ws = { send: vi.fn() };
        const ws2 = { send: vi.fn() };
        room.handlePlayerJoin(ws, { userId: 'u1', username: 'Alice' });
        room.handlePlayerJoin(ws2, { userId: 'u2', username: 'Bob' });
        room.handleStartGame(ws);
        const ws3 = { send: vi.fn() };
        room.handlePlayerJoin(ws3, { userId: 'u3', username: 'Charlie' });
        expect(room.state.players.size).toBe(2);
    });
    it('ends game in defeat when last player disconnects mid-game', () => {
        const ws = { send: vi.fn() };
        const ws2 = { send: vi.fn() };
        room.handlePlayerJoin(ws, { userId: 'u1', username: 'Alice' });
        room.handlePlayerJoin(ws2, { userId: 'u2', username: 'Bob' });
        room.handleStartGame(ws);
        // Both players disconnect
        room.webSocketClose(ws);
        room.webSocketClose(ws2);
        expect(room.state.phase).toBe('finished');
    });
    it('ends game in victory when boss HP reaches 0', () => {
        const ws = { send: vi.fn() };
        const ws2 = { send: vi.fn() };
        room.handlePlayerJoin(ws, { userId: 'u1', username: 'Alice' });
        room.handlePlayerJoin(ws2, { userId: 'u2', username: 'Bob' });
        room.handleStartGame(ws);
        room.state.bossHp = 1;
        room.handleWordComplete(ws, { wordIndex: 0 });
        expect(room.state.phase).toBe('finished');
    });
    // ── Mistake mechanic ──
    it('applies mistake damage in [5, 15] range to the typing player only', () => {
        const ws = { send: vi.fn() };
        const ws2 = { send: vi.fn() };
        room.handlePlayerJoin(ws, { userId: 'u1', username: 'Alice' });
        room.handlePlayerJoin(ws2, { userId: 'u2', username: 'Bob' });
        room.handleStartGame(ws);
        const p1Before = room.state.players.get(ws).hp;
        const p2Before = room.state.players.get(ws2).hp;
        room.handleMistake(ws);
        const p1After = room.state.players.get(ws).hp;
        const p2After = room.state.players.get(ws2).hp;
        const dmg = p1Before - p1After;
        expect(dmg).toBeGreaterThanOrEqual(5);
        expect(dmg).toBeLessThanOrEqual(15);
        // Other player untouched
        expect(p2After).toBe(p2Before);
    });
    it('marks player dead and ends game in defeat when mistake kills last alive player', () => {
        const ws = { send: vi.fn() };
        const ws2 = { send: vi.fn() };
        room.handlePlayerJoin(ws, { userId: 'u1', username: 'Alice' });
        room.handlePlayerJoin(ws2, { userId: 'u2', username: 'Bob' });
        room.handleStartGame(ws);
        // Kill Bob first
        room.state.players.get(ws2).isAlive = false;
        room.state.players.get(ws2).hp = 0;
        // Set Alice to 1 hp so the mistake kills her
        room.state.players.get(ws).hp = 1;
        room.handleMistake(ws);
        expect(room.state.players.get(ws).isAlive).toBe(false);
        expect(room.state.phase).toBe('finished');
    });
    it('ignores mistake when phase is lobby', () => {
        const ws = { send: vi.fn() };
        room.handlePlayerJoin(ws, { userId: 'u1', username: 'Alice' });
        const hpBefore = room.state.players.get(ws).hp;
        room.handleMistake(ws);
        expect(room.state.players.get(ws).hp).toBe(hpBefore);
    });
    // ── Boss attack ──
    it('boss attack hits ALL alive players each tick', () => {
        const ws = { send: vi.fn() };
        const ws2 = { send: vi.fn() };
        const ws3 = { send: vi.fn() };
        room.handlePlayerJoin(ws, { userId: 'u1', username: 'Alice' });
        room.handlePlayerJoin(ws2, { userId: 'u2', username: 'Bob' });
        room.handlePlayerJoin(ws3, { userId: 'u3', username: 'Charlie' });
        // 3 players auto-enter countdown; start the raid directly for this unit test.
        room.beginRaid();
        // Kill Charlie so we can verify only alive players are hit
        room.state.players.get(ws3).isAlive = false;
        room.state.players.get(ws3).hp = 0;
        const p1Before = room.state.players.get(ws).hp;
        const p2Before = room.state.players.get(ws2).hp;
        room.bossAttack();
        expect(room.state.players.get(ws).hp).toBe(p1Before - 10);
        expect(room.state.players.get(ws2).hp).toBe(p2Before - 10);
        // Dead player not re-hit
        expect(room.state.players.get(ws3).hp).toBe(0);
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
        };
        room.state.roomId = 'GHOST1';
        room.state.dbRoomCreated = false;
        await room.createRoomInDb('u1', 'Alice');
        expect(room.state.dbRoomCreated).toBe(true);
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
        };
        room.state.roomId = 'GHOST2';
        room.state.phase = 'lobby';
        room.state.dbRoomCreated = false;
        const ws = { send: vi.fn() };
        room.handlePlayerJoin(ws, { userId: 'u1', username: 'Alice' });
        // Should not throw even when dbRoomCreated is false
        expect(() => room.webSocketClose(ws)).not.toThrow();
    });
    it('loads persisted roomId and dbRoomCreated on initialization', async () => {
        mockCtx.storage.get = vi.fn((key) => {
            if (key === 'roomId')
                return Promise.resolve('PERSISTED');
            if (key === 'dbRoomCreated')
                return Promise.resolve(true);
            return Promise.resolve(undefined);
        });
        await room.ensureInitialized();
        expect(room.state.roomId).toBe('PERSISTED');
        expect(room.state.dbRoomCreated).toBe(true);
    });
    // ── Player count sync regression tests ──
    it('syncs playerCount on non-host join', async () => {
        const syncSpy = vi.spyOn(room, 'syncPlayerCountToDb').mockResolvedValue(undefined);
        const ws1 = { send: vi.fn() };
        const ws2 = { send: vi.fn() };
        room.handlePlayerJoin(ws1, { userId: 'u1', username: 'Alice' });
        expect(syncSpy).not.toHaveBeenCalled(); // host creates room instead
        room.handlePlayerJoin(ws2, { userId: 'u2', username: 'Bob' });
        expect(syncSpy).toHaveBeenCalledWith(2);
    });
    it('syncs playerCount on leave when players remain', async () => {
        const syncSpy = vi.spyOn(room, 'syncPlayerCountToDb').mockResolvedValue(undefined);
        const ws1 = { send: vi.fn() };
        const ws2 = { send: vi.fn() };
        room.handlePlayerJoin(ws1, { userId: 'u1', username: 'Alice' });
        room.handlePlayerJoin(ws2, { userId: 'u2', username: 'Bob' });
        syncSpy.mockClear();
        await room.webSocketClose(ws2);
        expect(syncSpy).toHaveBeenCalledWith(1, undefined, undefined, undefined);
    });
    it('syncs playerCount and status on game start', async () => {
        const syncSpy = vi.spyOn(room, 'syncPlayerCountToDb').mockResolvedValue(undefined);
        const ws1 = { send: vi.fn() };
        const ws2 = { send: vi.fn() };
        room.handlePlayerJoin(ws1, { userId: 'u1', username: 'Alice' });
        room.handlePlayerJoin(ws2, { userId: 'u2', username: 'Bob' });
        room.handleStartGame(ws1);
        expect(syncSpy).toHaveBeenCalledWith(2, 'active');
    });
    // ── WS credential sourcing (P1-4) ──
    it('webSocketMessage("join") uses stored credentials, ignoring message body', () => {
        const ws = { send: vi.fn() };
        // Simulate worker.fetch storing validated credentials for this WS
        room.wsCredentials.set(ws, {
            userId: 'trusted-id',
            username: 'TrustedName',
        });
        // Client tries to impersonate a different user via the message body
        room.webSocketMessage(ws, JSON.stringify({
            type: 'join',
            userId: 'spoofed-id',
            username: 'Attacker',
        }));
        const players = Array.from(room.state.players.values());
        expect(players.length).toBe(1);
        expect(players[0].userId).toBe('trusted-id');
        expect(players[0].username).toBe('TrustedName');
    });
    it('webSocketMessage("join") drops the join when no credentials are stored', () => {
        const ws = { send: vi.fn() };
        // No entry in wsCredentials — simulates a malformed/bypassed upgrade
        room.webSocketMessage(ws, JSON.stringify({ type: 'join', userId: 'x', username: 'X' }));
        expect(room.state.players.size).toBe(0);
    });
    it('webSocketClose cleans up wsCredentials for the closed WS', () => {
        const ws = { send: vi.fn() };
        room.wsCredentials.set(ws, {
            userId: 'u1',
            username: 'Alice',
        });
        room.handlePlayerJoin(ws, { userId: 'u1', username: 'Alice' });
        room.webSocketClose(ws);
        expect(room.wsCredentials.has(ws)).toBe(false);
    });
    // ── Auto-start countdown ──
    describe('auto-start countdown', () => {
        it('enters countdown phase and broadcasts countdown_started when the 3rd player joins', () => {
            vi.useFakeTimers();
            const ws1 = { send: vi.fn() };
            const ws2 = { send: vi.fn() };
            const ws3 = { send: vi.fn() };
            room.handlePlayerJoin(ws1, { userId: 'u1', username: 'Alice' });
            room.handlePlayerJoin(ws2, { userId: 'u2', username: 'Bob' });
            expect(room.state.phase).toBe('lobby');
            room.handlePlayerJoin(ws3, { userId: 'u3', username: 'Cara' });
            expect(room.state.phase).toBe('countdown');
            expect(ws3.send).toHaveBeenCalledWith(expect.stringContaining('"type":"countdown_started"'));
        });
        it('begins the raid automatically after COUNTDOWN_MS (5s)', () => {
            vi.useFakeTimers();
            const ws1 = { send: vi.fn() };
            const ws2 = { send: vi.fn() };
            const ws3 = { send: vi.fn() };
            room.handlePlayerJoin(ws1, { userId: 'u1', username: 'Alice' });
            room.handlePlayerJoin(ws2, { userId: 'u2', username: 'Bob' });
            room.handlePlayerJoin(ws3, { userId: 'u3', username: 'Cara' });
            expect(room.state.phase).toBe('countdown');
            vi.advanceTimersByTime(5000);
            expect(room.state.phase).toBe('playing');
        });
        it('manual 2-player start begins immediately with no countdown', () => {
            const ws1 = { send: vi.fn() };
            const ws2 = { send: vi.fn() };
            room.handlePlayerJoin(ws1, { userId: 'u1', username: 'Alice' });
            room.handlePlayerJoin(ws2, { userId: 'u2', username: 'Bob' });
            room.handleStartGame(ws1);
            expect(room.state.phase).toBe('playing');
            expect(room.state.countdownTimer).toBeNull();
        });
    });
    // ── Countdown cancellation ──
    describe('countdown cancellation', () => {
        it('cancels the countdown and returns to lobby when a player drops below 3', () => {
            vi.useFakeTimers();
            const ws1 = { send: vi.fn() };
            const ws2 = { send: vi.fn() };
            const ws3 = { send: vi.fn() };
            room.handlePlayerJoin(ws1, { userId: 'u1', username: 'Alice' });
            room.handlePlayerJoin(ws2, { userId: 'u2', username: 'Bob' });
            room.handlePlayerJoin(ws3, { userId: 'u3', username: 'Cara' });
            expect(room.state.phase).toBe('countdown');
            room.webSocketClose(ws3);
            expect(room.state.phase).toBe('lobby');
            expect(room.state.countdownTimer).toBeNull();
            expect(room.state.players.size).toBe(2);
            expect(ws1.send).toHaveBeenCalledWith(expect.stringContaining('"type":"countdown_cancelled"'));
            // The cleared timer must not fire a late beginRaid.
            vi.advanceTimersByTime(5000);
            expect(room.state.phase).toBe('lobby');
        });
        it('reassigns host when the host leaves during the countdown', () => {
            vi.useFakeTimers();
            const ws1 = { send: vi.fn() };
            const ws2 = { send: vi.fn() };
            const ws3 = { send: vi.fn() };
            room.handlePlayerJoin(ws1, { userId: 'u1', username: 'Alice' });
            room.handlePlayerJoin(ws2, { userId: 'u2', username: 'Bob' });
            room.handlePlayerJoin(ws3, { userId: 'u3', username: 'Cara' });
            expect(room.state.players.get(ws1).isHost).toBe(true);
            room.webSocketClose(ws1); // host leaves during countdown
            expect(room.state.phase).toBe('lobby');
            const remaining = Array.from(room.state.players.values());
            expect(remaining.some(p => p.isHost)).toBe(true);
        });
    });
    // ── webSocketError regression test ──
    it('removes player on webSocketError and transfers host in lobby', () => {
        const ws1 = { send: vi.fn() };
        const ws2 = { send: vi.fn() };
        room.handlePlayerJoin(ws1, { userId: 'u1', username: 'Alice' });
        room.handlePlayerJoin(ws2, { userId: 'u2', username: 'Bob' });
        expect(room.state.players.get(ws1).isHost).toBe(true);
        expect(room.state.players.get(ws2).isHost).toBe(false);
        room.webSocketError(ws1);
        expect(room.state.players.has(ws1)).toBe(false);
        expect(room.state.players.get(ws2).isHost).toBe(true);
    });
    it('stores a valid characterConfig on join and includes it in room_state', () => {
        const ws = { send: vi.fn() };
        const cfg = {
            armorType: 'plate',
            armorColor: '#2f9e69',
            helmetType: 'barbute',
            helmetColor: '#d4af37',
            skinTone: '#e0a878',
        };
        room.handlePlayerJoin(ws, { userId: 'u1', username: 'Alice' }, cfg);
        const stored = room.state.players.get(ws);
        expect(stored.characterConfig).toEqual(cfg);
        // Assert by message type rather than call index so the test stays correct
        // even if broadcast ordering changes.
        const calls = ws.send.mock.calls.map((c) => JSON.parse(c[0]));
        const roomState = calls.find((m) => m.type === 'room_state');
        expect(roomState).toBeDefined();
        const me = roomState.players.find((p) => p.userId === 'u1');
        expect(me.characterConfig).toEqual(cfg);
        const joined = calls.find((m) => m.type === 'player_joined');
        expect(joined.characterConfig).toEqual(cfg);
    });
    it('defaults characterConfig to null when absent or invalid', () => {
        const ws = { send: vi.fn() };
        room.handlePlayerJoin(ws, { userId: 'u2', username: 'Bob' });
        expect(room.state.players.get(ws).characterConfig).toBeNull();
        const ws2 = { send: vi.fn() };
        room.handlePlayerJoin(ws2, { userId: 'u3', username: 'Cara' }, { bodyShape: 'triangle' });
        expect(room.state.players.get(ws2).characterConfig).toBeNull();
    });
});
