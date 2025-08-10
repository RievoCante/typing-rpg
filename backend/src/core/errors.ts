import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

// Consistent JSON error shape
export function jsonError(
  c: Context,
  status: ContentfulStatusCode,
  message: string,
  details?: unknown,
) {
  return c.json({ success: false, error: message, details }, status);
}
