// Handlers for creating and fetching game sessions
import { AppContext } from '../core/types';
import { getAuth } from '@hono/clerk-auth';
import { gameSessions, users } from '../db/schema';
import { z } from 'zod';
import { eq, desc, and } from 'drizzle-orm';
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
    // Hard server limit for daily mode: allow once per UTC day
    if (mode === 'daily') {
      const now = new Date();
      const dayStartMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
      const dayEndMs = dayStartMs + 86_400_000; // +24h

      // Fetch the latest daily session and decide in JS to avoid driver timestamp quirks
      const latestDaily = await db.query.gameSessions.findFirst({
        where: (gs, { eq, and }) => and(eq(gs.userId, userId), eq(gs.mode, 'daily')),
        orderBy: (gs, { desc }) => [desc(gs.id)],
      });
      if (latestDaily) {
        const createdMs = latestDaily.createdAt instanceof Date ? latestDaily.createdAt.getTime() : Number(latestDaily.createdAt) * 1000;
        if (createdMs >= dayStartMs && createdMs < dayEndMs) {
          const timeUntilResetSeconds = Math.max(0, Math.floor((dayEndMs - Date.now()) / 1000));
          return c.json({ error: 'already_completed', timeUntilResetSeconds }, 409);
        }
      }
    }

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
    let xpDelta = 0;
    if (user) {
      xpDelta = calculateXpDelta(mode, incorrectWords, wpm);
      if (xpDelta > 0) {
        const updated = applyXp(user.level, user.xp, xpDelta);
        await db
          .update(users)
          .set({ level: updated.level, xp: updated.xp, updatedAt: new Date() })
          .where(eq(users.userId, userId));
        user.level = updated.level;
        user.xp = updated.xp;
      }
    }

    // Include xpDelta in session payload so UI can display earned XP
    const sessionWithXp = { ...inserted[0], xpDelta } as any;

    return c.json({ success: true, session: sessionWithXp, user }, 201);
  } catch (e) {
    console.error('createSession error', e);
    return c.json({ error: 'Failed to create session' }, 500);
  }
};

// GET /api/daily/status
export const getDailyStatus = async (c: AppContext) => {
  const auth = getAuth(c);
  const userId = auth?.userId;
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const now = new Date();
  const dayStartMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dayEndMs = dayStartMs + 86_400_000;

  const db = c.get('db');
  try {
    const latestDaily = await db.query.gameSessions.findFirst({
      where: (gs, { eq, and }) => and(eq(gs.userId, userId), eq(gs.mode, 'daily')),
      orderBy: (gs, { desc }) => [desc(gs.id)],
    });

    let completedToday = false;
    if (latestDaily) {
      const createdMs = latestDaily.createdAt instanceof Date ? latestDaily.createdAt.getTime() : Number(latestDaily.createdAt) * 1000;
      completedToday = createdMs >= dayStartMs && createdMs < dayEndMs;
    }
    const timeUntilResetSeconds = Math.max(0, Math.floor((dayEndMs - Date.now()) / 1000));
    return c.json({ completedToday, timeUntilResetSeconds });
  } catch (e) {
    console.error('getDailyStatus error', e);
    return c.json({ error: 'Failed to load daily status' }, 500);
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
