import type { MiddlewareHandler } from 'hono';
import type { Bindings, Variables, AppContext } from './types';

// Workers counters are per Cloudflare location and eventually consistent.
// The binding configuration in wrangler.toml owns the 120 requests / 60s limit.
export const rateLimit = (
  keyFn: (c: AppContext) => string,
): MiddlewareHandler<{ Bindings: Bindings; Variables: Variables }> => {
  return async (c, next) => {
    // Fail closed on missing configuration and service errors, including locally.
    // Wrangler dev provides a local implementation of the configured binding.
    if (!c.env.API_RATE_LIMITER) {
      throw new Error('API_RATE_LIMITER binding is required');
    }

    const { success } = await c.env.API_RATE_LIMITER.limit({
      key: `api:${keyFn(c)}`,
    });
    if (!success) {
      // The API supplies no reset time; wait one complete configured period.
      c.header('Retry-After', '60');
      return c.json({ error: 'Too Many Requests' }, 429);
    }
    await next();
  };
};
