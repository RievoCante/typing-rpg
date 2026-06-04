// Handler for the public, anonymous-friendly analytics beacon (POST /api/events).
// Best-effort: it never returns an error to the client — a dropped beacon must
// not affect gameplay. See db/schema.ts `analyticsEvents`.
import { AppContext } from '../core/types';
import { getAuth } from '@hono/clerk-auth';
import { analyticsEvents } from '../db/schema';
import { z } from 'zod';

export const eventSchema = z.object({
  event: z.enum(['reached_game', 'started_typing']),
  anonId: z.string().min(1).max(64),
  mode: z.enum(['daily', 'endless', 'raid']).optional(),
});

export type EventBody = z.infer<typeof eventSchema>;

// POST /api/events — public (no authMiddleware), IP rate-limited.
export const recordEvent = async (c: AppContext) => {
  let json: unknown;
  try {
    json = await c.req.json();
  } catch {
    return c.body(null, 204); // best-effort: never error the beacon
  }

  const parsed = eventSchema.safeParse(json);
  if (!parsed.success) return c.body(null, 204);

  // Opportunistic: capture the Clerk userId if a token rode along; anonymous → null.
  const userId = getAuth(c)?.userId ?? null;

  try {
    const db = c.get('db');
    await db.insert(analyticsEvents).values({
      event: parsed.data.event,
      anonId: parsed.data.anonId,
      mode: parsed.data.mode ?? null,
      userId,
    });
  } catch {
    // swallow — a failed analytics write must not surface to the client
  }

  return c.body(null, 204);
};
