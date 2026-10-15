import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import type { Bindings, Variables } from './types';
import { rateLimit } from './rateLimit';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
app.onError(() => new Response('Unavailable', { status: 500 }));
app.use('*', rateLimit((c) => `ip:${c.req.header('cf-connecting-ip') ?? 'anon'}`));
app.get('/', (c) => c.text('ok'));
const request = (binding?: Bindings['API_RATE_LIMITER']) =>
  app.request('/', { headers: { 'cf-connecting-ip': '192.0.2.1' } }, {
    API_RATE_LIMITER: binding,
    get RATE_LIMIT_KV() { throw new Error('KV was accessed'); },
  });

describe('native rate limiter', () => {
  it('allows requests with a stable prefixed key without KV access', async () => {
    const limit = vi.fn().mockResolvedValue({ success: true });
    expect((await request({ limit })).status).toBe(200);
    expect((await request({ limit })).status).toBe(200);
    expect(limit.mock.calls).toEqual([
      [{ key: 'api:ip:192.0.2.1' }], [{ key: 'api:ip:192.0.2.1' }],
    ]);
  });
  it('rejects exhausted counters and conservatively waits a full period', async () => {
    const res = await request({ limit: vi.fn().mockResolvedValue({ success: false }) });
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
    expect(await res.json()).toEqual({ error: 'Too Many Requests' });
  });
  it('does not silently disable protection when the binding is missing', async () => {
    expect((await request()).status).toBe(500);
  });
  it('does not allow requests when the binding fails', async () => {
    expect((await request({ limit: vi.fn().mockRejectedValue(new Error('unavailable')) })).status).toBe(500);
  });
});
