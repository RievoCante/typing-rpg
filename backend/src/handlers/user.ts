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

  // `username` is the Clerk-synced handle; `displayName` is user-owned (set via PATCH /me)
  // and is intentionally never written here so boot sync can't clobber the user's choice.
  // Leaderboard display precedence: displayName -> username (Clerk) -> firstName (Clerk),
  // where the firstName fallback is baked into `username` below since the leaderboard
  // can only read DB columns.
  let username = parsed.success && parsed.data?.username ? parsed.data.username : 'NewPlayer';
  try {
    const clerkClient = createClerkClient({ secretKey: c.env.CLERK_SECRET_KEY });
    const clerkUser = await clerkClient.users.getUser(auth.userId);
    const clerkUsername = clerkUser.username;
    const firstName = clerkUser.firstName?.trim() || null;
    username =
      parsed.success && parsed.data?.username
        ? parsed.data.username
        : (clerkUsername ?? firstName ?? username);
  } catch (e) {
    console.error('Clerk username fetch failed for user', auth.userId, ':', e);
    // keep fallback/parsed username
  }

  await db
    .insert(users)
    .values({ userId: auth.userId, username })
    .onConflictDoUpdate({
      target: users.userId,
      set: { username, updatedAt: new Date() },
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

// PATCH /me — update the signed-in user's display name (preserves case).
const displayNameSchema = z.object({
  displayName: z.string().min(1).max(50).nullable(),
});

export const updateDisplayName = async (c: AppContext) => {
  const auth = getAuth(c);
  if (!auth?.userId) return jsonError(c, 401, 'Unauthorized');

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return jsonError(c, 400, 'Invalid JSON body');
  }
  const parsed = displayNameSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(c, 400, 'Validation failed', parsed.error.format());
  }

  const db = c.get('db');
  const updated = await db
    .update(users)
    .set({ displayName: parsed.data.displayName, updatedAt: new Date() })
    .where(eq(users.userId, auth.userId))
    .returning({ userId: users.userId });

  if (updated.length === 0) return jsonError(c, 404, 'User not found');
  return c.json({ success: true, displayName: parsed.data.displayName });
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
  const updated = await db
    .update(users)
    .set({ character: JSON.stringify(config), updatedAt: new Date() })
    .where(eq(users.userId, auth.userId))
    .returning({ userId: users.userId });

  // No row updated means the user has no profile yet (never called POST /me).
  // Report 404 instead of a misleading success so the client doesn't believe
  // the config was persisted when it wasn't.
  if (updated.length === 0) return jsonError(c, 404, 'User not found');

  return c.json({ success: true, character: config });
};
