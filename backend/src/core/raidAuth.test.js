import { describe, it, expect, vi } from 'vitest';
import { validateRaidWsAuth } from './raidAuth';
describe('validateRaidWsAuth', () => {
    const env = { CLERK_SECRET_KEY: 'sk_test' };
    it('rejects request without userId', async () => {
        const url = new URL('wss://example.com/raid/ABC123?username=foo');
        const res = await validateRaidWsAuth(url, env);
        expect(res.ok).toBe(false);
        if (!res.ok)
            expect(res.status).toBe(400);
    });
    it('rejects request without username', async () => {
        const url = new URL('wss://example.com/raid/ABC123?userId=guest-abc');
        const res = await validateRaidWsAuth(url, env);
        expect(res.ok).toBe(false);
        if (!res.ok)
            expect(res.status).toBe(400);
    });
    it('accepts guest userId at face value with no token (no verifier called)', async () => {
        const verifier = vi.fn();
        const url = new URL('wss://example.com/raid/ABC123?userId=guest-abc12345&username=Guest-123');
        const res = await validateRaidWsAuth(url, env, verifier);
        expect(res.ok).toBe(true);
        if (res.ok) {
            expect(res.userId).toBe('guest-abc12345');
            expect(res.username).toBe('Guest-123');
        }
        expect(verifier).not.toHaveBeenCalled();
    });
    it('rejects non-guest userId without a token', async () => {
        const url = new URL('wss://example.com/raid/ABC123?userId=user_2abc&username=Alice');
        const res = await validateRaidWsAuth(url, env);
        expect(res.ok).toBe(false);
        if (!res.ok)
            expect(res.status).toBe(401);
    });
    it('rejects non-guest userId when token does not match sub', async () => {
        const verifier = vi.fn().mockResolvedValue({ sub: 'user_other' });
        const url = new URL('wss://example.com/raid/ABC123?userId=user_2abc&username=Alice&token=eyJ');
        const res = await validateRaidWsAuth(url, env, verifier);
        expect(res.ok).toBe(false);
        if (!res.ok)
            expect(res.status).toBe(401);
    });
    it('accepts non-guest userId when token sub matches', async () => {
        const verifier = vi.fn().mockResolvedValue({ sub: 'user_2abc' });
        const url = new URL('wss://example.com/raid/ABC123?userId=user_2abc&username=Alice&token=eyJ');
        const res = await validateRaidWsAuth(url, env, verifier);
        expect(res.ok).toBe(true);
        if (res.ok) {
            expect(res.userId).toBe('user_2abc');
            expect(res.username).toBe('Alice');
        }
    });
    it('rejects when verifier throws', async () => {
        const verifier = vi.fn().mockRejectedValue(new Error('bad sig'));
        const url = new URL('wss://example.com/raid/ABC123?userId=user_2abc&username=Alice&token=eyJ');
        const res = await validateRaidWsAuth(url, env, verifier);
        expect(res.ok).toBe(false);
        if (!res.ok)
            expect(res.status).toBe(401);
    });
    it('rejects authenticated request when CLERK_SECRET_KEY is missing', async () => {
        const url = new URL('wss://example.com/raid/ABC123?userId=user_2abc&username=Alice&token=eyJ');
        const res = await validateRaidWsAuth(url, {});
        expect(res.ok).toBe(false);
        if (!res.ok)
            expect(res.status).toBe(401);
    });
});
