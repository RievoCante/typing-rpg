// Simple KV-backed rate limiter for Cloudflare Workers (Hono)
// No-ops if KV binding is missing, so dev remains unaffected.
export const kvRateLimit = (keyFn, opts) => {
    const { windowMs, limit, prefix = 'rl' } = opts;
    return async (c, next) => {
        const kv = c.env.RATE_LIMIT_KV;
        if (!kv)
            return next(); // no KV in dev → skip limiting
        const key = `${prefix}:${keyFn(c)}`;
        const now = Date.now();
        const bucketRaw = await kv.get(key, 'json');
        let bucket = bucketRaw ?? null;
        if (!bucket || now > bucket.reset) {
            bucket = { count: 0, reset: now + windowMs };
        }
        bucket.count += 1;
        // Use absolute expiration (seconds) and ensure at least 60s in the future to satisfy KV constraints.
        const nowSec = Math.ceil(now / 1000);
        let expirationSec = Math.ceil(bucket.reset / 1000);
        if (expirationSec - nowSec < 60)
            expirationSec = nowSec + 60;
        await kv.put(key, JSON.stringify(bucket), { expiration: expirationSec });
        if (bucket.count > limit) {
            const retryAfter = Math.max(0, Math.ceil((bucket.reset - now) / 1000));
            c.header('Retry-After', retryAfter.toString());
            return c.json({ error: 'Too Many Requests' }, 429);
        }
        await next();
    };
};
