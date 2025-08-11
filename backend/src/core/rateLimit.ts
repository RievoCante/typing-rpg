// Simple KV-backed rate limiter for Cloudflare Workers (Hono)
// No-ops if KV binding is missing, so dev remains unaffected.

import type { Context, Next } from 'hono';

export type RateLimitOptions = {
  windowMs: number; // e.g., 60_000
  limit: number; // e.g., 120
  prefix?: string; // key prefix
};

export const kvRateLimit = (
  keyFn: (c: Context) => string,
  opts: RateLimitOptions,
) => {
  const { windowMs, limit, prefix = 'rl' } = opts;
  return async (c: Context, next: Next) => {
    const kv = (c.env as any).RATE_LIMIT_KV as KVNamespace | undefined;
    if (!kv) return next(); // no KV in dev → skip limiting

    const key = `${prefix}:${keyFn(c)}`;
    const now = Date.now();
    const bucketRaw = await kv.get(key, 'json');
    let bucket = (bucketRaw as { count: number; reset: number } | null) ?? null;

    if (!bucket || now > bucket.reset) {
      bucket = { count: 0, reset: now + windowMs };
    }

    bucket.count += 1;

    // Use absolute expiration (seconds) and ensure at least 60s in the future to satisfy KV constraints.
    const nowSec = Math.ceil(now / 1000);
    let expirationSec = Math.ceil(bucket.reset / 1000);
    if (expirationSec - nowSec < 60) expirationSec = nowSec + 60;
    await kv.put(key, JSON.stringify(bucket), { expiration: expirationSec });

    if (bucket.count > limit) {
      const retryAfter = Math.max(0, Math.ceil((bucket.reset - now) / 1000));
      c.header('Retry-After', retryAfter.toString());
      return c.json({ error: 'Too Many Requests' }, 429);
    }

    await next();
  };
};
