import { Context } from 'hono';
import { getAuth } from '@hono/clerk-auth';
import { verifyToken as clerkVerifyToken } from '@clerk/backend';
import { eq } from 'drizzle-orm';
import { users } from '../db/schema';
import {
  generateGuestId,
  generateGuestUsername,
  isGuestId,
} from './guestIdentity';

// Verifier signature kept narrow so tests can inject a stub.
type TokenVerifier = (
  token: string,
  options: { secretKey: string }
) => Promise<{ sub?: string }>;

export type Identity = {
  userId: string;
  username: string;
  isGuest: boolean;
};

// HTTP-side: resolves the caller to a stable identity from a Hono context.
// Clerk session → authenticated user. Unauthenticated → freshly minted guest.
// Both raid HTTP endpoints (POST /rooms, POST /rooms/:code/join) use this.
export async function getUserOrGuest(c: Context): Promise<Identity> {
  const auth = getAuth(c);

  if (auth?.userId) {
    const db = c.get('db');
    const [userRow] = await db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.userId, auth.userId))
      .limit(1);

    return {
      userId: auth.userId,
      username: userRow?.username ?? auth.userId,
      isGuest: false,
    };
  }

  return {
    userId: generateGuestId(),
    username: generateGuestUsername(),
    isGuest: true,
  };
}

export type WsAuthResult =
  | { ok: true; userId: string; username: string }
  | { ok: false; status: 400 | 401; error: string };

// WS-side: validates a WebSocket upgrade request's identity parameters.
// Called from worker.fetch BEFORE forwarding to the RaidRoom Durable Object.
// Guests pass through; authenticated users must present a Clerk token whose
// `sub` matches the userId param so callers cannot impersonate other users.
// `verifier` is injectable so tests can drive the auth paths without mocking
// the Clerk SDK module.
export async function validateRaidWsAuth(
  url: URL,
  env: { CLERK_SECRET_KEY?: string },
  verifier: TokenVerifier = clerkVerifyToken
): Promise<WsAuthResult> {
  const userId = url.searchParams.get('userId');
  const username = url.searchParams.get('username');
  if (!userId || !username) {
    return { ok: false, status: 400, error: 'Missing userId or username' };
  }

  if (isGuestId(userId)) {
    return { ok: true, userId, username };
  }

  // Non-guest userId → Clerk token required and must match
  const token = url.searchParams.get('token');
  if (!token) {
    return { ok: false, status: 401, error: 'Authentication required' };
  }
  if (!env.CLERK_SECRET_KEY) {
    return { ok: false, status: 401, error: 'Auth not configured' };
  }

  try {
    const verified = await verifier(token, {
      secretKey: env.CLERK_SECRET_KEY,
    });
    if (verified.sub !== userId) {
      return { ok: false, status: 401, error: 'Token does not match userId' };
    }
    return { ok: true, userId, username };
  } catch {
    return { ok: false, status: 401, error: 'Invalid token' };
  }
}
