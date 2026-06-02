import { AppContext } from '../core/types';
import { users } from '../db/schema';
import { getAuth } from '@hono/clerk-auth';
import { eq } from 'drizzle-orm';
import { jsonError } from '../core/errors';
import {
  parseUnlocked,
  mergeUnlocked,
  isWeaponId,
  unlockSchema,
  selectSchema,
} from '../core/weapons';

// GET /me/vault — the signed-in user's unlocked weapons + selected loadout.
export const getVault = async (c: AppContext) => {
  const auth = getAuth(c);
  if (!auth?.userId) return jsonError(c, 401, 'Unauthorized');

  const user = await c
    .get('db')
    .query.users.findFirst({ where: (u, { eq }) => eq(u.userId, auth.userId) });
  if (!user) return jsonError(c, 404, 'User not found');

  return c.json({
    success: true,
    unlocked: parseUnlocked(user.unlockedWeapons),
    loadout: user.loadoutWeapon ?? null,
  });
};

// POST /me/vault/unlock — add found weapon ids to the user's collection. Unions
// with the current set, keeps only valid pool ids, dedupes. Idempotent.
export const unlockWeapons = async (c: AppContext) => {
  const auth = getAuth(c);
  if (!auth?.userId) return jsonError(c, 401, 'Unauthorized');

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return jsonError(c, 400, 'Invalid JSON body');
  }
  const parsed = unlockSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(c, 400, 'Validation failed', parsed.error.format());
  }

  const db = c.get('db');
  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.userId, auth.userId),
  });
  if (!user) return jsonError(c, 404, 'User not found');

  const merged = mergeUnlocked(
    parseUnlocked(user.unlockedWeapons),
    parsed.data.weaponIds
  );

  await db
    .update(users)
    .set({ unlockedWeapons: JSON.stringify(merged), updatedAt: new Date() })
    .where(eq(users.userId, auth.userId));

  return c.json({ success: true, unlocked: merged });
};

// POST /me/vault/select — set the loadout weapon (must be unlocked) or null to
// clear it back to Fists.
export const selectLoadout = async (c: AppContext) => {
  const auth = getAuth(c);
  if (!auth?.userId) return jsonError(c, 401, 'Unauthorized');

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return jsonError(c, 400, 'Invalid JSON body');
  }
  const parsed = selectSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(c, 400, 'Validation failed', parsed.error.format());
  }

  const db = c.get('db');
  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.userId, auth.userId),
  });
  if (!user) return jsonError(c, 404, 'User not found');

  const { weaponId } = parsed.data;
  if (weaponId !== null) {
    if (!isWeaponId(weaponId)) {
      return jsonError(c, 400, 'Unknown weapon id');
    }
    const unlocked = parseUnlocked(user.unlockedWeapons);
    if (!unlocked.includes(weaponId)) {
      return jsonError(c, 400, 'Weapon not unlocked');
    }
  }

  await db
    .update(users)
    .set({ loadoutWeapon: weaponId, updatedAt: new Date() })
    .where(eq(users.userId, auth.userId));

  return c.json({ success: true, loadout: weaponId });
};
