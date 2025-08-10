import { AppContext } from '../core/types';
import { users } from '../db/schema';
import { getAuth } from '@hono/clerk-auth';
import { createClerkClient } from '@clerk/backend';

// Gets a user's profile from the database, or creates one if it doesn't exist.

export const createUser = async (c: AppContext) => {
  const auth = getAuth(c);
  if (!auth?.userId) return c.json({ error: 'Unauthorized' }, 401);

  const db = c.get('db');

  // pull username from Clerk (fallback if unavailable)
  let username = 'NewPlayer';
  try {
    const clerkClient = createClerkClient({ secretKey: c.env.CLERK_SECRET_KEY });
    const clerkUser = await clerkClient.users.getUser(auth.userId);
    username = clerkUser.username ?? username;
  } catch (_) {
    // ignore and keep fallback
  }

  await db
    .insert(users)
    .values({ id: auth.userId, username })
    .onConflictDoNothing({ target: users.id });

  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, auth.userId),
  });

  return c.json({ success: true, user }, 200);
};

export const getUser = async (c: AppContext) => {
  const auth = getAuth(c);
  if (!auth?.userId) return c.json({ error: 'Unauthorized' }, 401);

  const user = await c
    .get('db')
    .query.users.findFirst({ where: (u, { eq }) => eq(u.id, auth.userId) });
  if (!user) return c.json({ error: 'Not found' }, 404);

  return c.json({ success: true, user });
};