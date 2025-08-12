// Handlers for creating and fetching game sessions
import { AppContext } from '../core/types';
import { getAuth } from '@hono/clerk-auth';
import { gameSessions, users } from '../db/schema';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { applyXp, calculateXpDelta } from '../core/xp';

const sessionSchema = z.object({
  mode: z.enum(['daily', 'endless']),
  wpm: z.number().int().nonnegative(),
  totalWords: z.number().int().nonnegative(),
  correctWords: z.number().int().nonnegative(),
  incorrectWords: z.number().int().nonnegative(),
});

// POST /api/sessions
export const createSession = async (c: AppContext) => {
  const auth = getAuth(c);
  const userId = auth?.userId;
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  let json: unknown;
  try {
    json = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const parsed = sessionSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.format() }, 400);
  }
  const { mode, wpm, totalWords, correctWords, incorrectWords } = parsed.data;

  const db = c.get('db');
  try {
    // Save session
    const inserted = await db
      .insert(gameSessions)
      .values({ userId, mode, wpm, totalWords, correctWords, incorrectWords })
      .returning();

    // Load or create user
    let user = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.userId, userId) });
    if (!user) {
      await db.insert(users).values({ userId, username: 'NewPlayer' }).onConflictDoNothing({ target: users.userId });
      user = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.userId, userId) });
    }

    // Compute XP and update user
    if (user) {
      const xpDelta = calculateXpDelta(mode, incorrectWords, wpm);
      if (xpDelta > 0) {
        const updated = applyXp(user.level, user.xp, xpDelta);
        await db.update(users).set({ level: updated.level, xp: updated.xp }).where(eq(users.userId, userId));
        user.level = updated.level;
        user.xp = updated.xp;
      }
    }

    return c.json({ success: true, session: inserted[0], user }, 201);
  } catch (e) {
    console.error('createSession error', e);
    return c.json({ error: 'Failed to create session' }, 500);
  }
};

// GET /api/sessions?limit=20
export const getSessions = async (c: AppContext) => {
  const auth = getAuth(c);
  const userId = auth?.userId;
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const url = new URL(c.req.url);
  const limitParam = url.searchParams.get('limit');
  let limit = Number.parseInt(limitParam || '20', 10);
  if (!Number.isFinite(limit) || limit <= 0) limit = 20;
  if (limit > 100) limit = 100;

  const db = c.get('db');
  try {
    const sessions = await db.query.gameSessions.findMany({
      where: (gs, { eq }) => eq(gs.userId, userId),
      orderBy: (gs, { desc }) => [desc(gs.id)],
      limit,
    });
    return c.json({ success: true, sessions });
  } catch (e) {
    console.error('getSessions error', e);
    return c.json({ error: 'Failed to load sessions' }, 500);
  }
};
