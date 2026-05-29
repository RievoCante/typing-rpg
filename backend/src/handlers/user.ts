import { AppContext } from '../core/types';
import { users } from '../db/schema';
import { getAuth } from '@hono/clerk-auth';
import { createClerkClient } from '@clerk/backend';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { jsonError } from '../core/errors';
import { parseCharacterConfig } from '../core/character';

const meCreateSchema = z
  .object({
    username: z.string().min(1).max(50).optional(),
  })
  .optional();

// Gets a user's profile from the database, or creates one if it doesn't exist.

export const createUser = async (c: AppContext) => {
  const auth = getAuth(c);
  if (!auth?.userId) return jsonError(c, 401, 'Unauthorized');

  // optional body (e.g., allow client to propose a username)
  let body: unknown = undefined;
  try {
    if (c.req.header('content-type')?.includes('application/json')) {
      body = await c.req.json();
    }
  } catch {
    // ignore malformed body; we can still create from Clerk
  }
  const parsed = meCreateSchema.safeParse(body);
  if (!parsed.success && body !== undefined) {
    return jsonError(c, 400, 'Validation failed', parsed.error.format());
  }

  const db = c.get('db');

  let username = parsed.success && parsed.data?.username ? parsed.data.username : 'NewPlayer';
  try {
    const clerkClient = createClerkClient({ secretKey: c.env.CLERK_SECRET_KEY });
    const clerkUser = await clerkClient.users.getUser(auth.userId);
    username = parsed.success && parsed.data?.username ? parsed.data.username : (clerkUser.username ?? username);
  } catch {
    // keep fallback/parsed username
  }

  await db
    .insert(users)
    .values({ userId: auth.userId, username })
    .onConflictDoUpdate({
      target: users.userId,
      set: { username },
    });

  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.userId, auth.userId),
  });

  return c.json({ success: true, user }, 200);
};

export const getUser = async (c: AppContext) => {
  const auth = getAuth(c);
  if (!auth?.userId) return jsonError(c, 401, 'Unauthorized');

  const user = await c
    .get('db')
    .query.users.findFirst({ where: (u, { eq }) => eq(u.userId, auth.userId) });
  if (!user) return jsonError(c, 404, 'Not found');

  return c.json({ success: true, user });
};

// PATCH /me/character — persist the signed-in user's cosmetic avatar config.
export const updateCharacter = async (c: AppContext) => {
  const auth = getAuth(c);
  if (!auth?.userId) return jsonError(c, 401, 'Unauthorized');

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return jsonError(c, 400, 'Invalid JSON body');
  }
  const config = parseCharacterConfig(body);
  if (!config) return jsonError(c, 400, 'Invalid character config');

  const db = c.get('db');
  await db
    .update(users)
    .set({ character: JSON.stringify(config), updatedAt: new Date() })
    .where(eq(users.userId, auth.userId));

  return c.json({ success: true, character: config });
};