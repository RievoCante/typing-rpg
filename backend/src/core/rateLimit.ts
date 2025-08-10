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

    await kv.put(key, JSON.stringify(bucket), { expirationTtl: Math.ceil((bucket.reset - now) / 1000) });

    if (bucket.count > limit) {
      c.header('Retry-After', Math.ceil((bucket.reset - now) / 1000).toString());
      return c.json({ error: 'Too Many Requests' }, 429);
    }

    await next();
  };
};
