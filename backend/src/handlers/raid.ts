import { Hono, Context } from 'hono';
import { Bindings, Variables } from '../core/types';
import { authMiddleware } from '../core/auth';
import { getAuth } from '@hono/clerk-auth';
import { generateRoomId } from '../rooms/RaidRoom';
import { eq, desc } from 'drizzle-orm';
import { raidPlayers } from '../db/schema';

const raid = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Helper to build ws URL from request
function getWsUrl(c: Context, roomId: string) {
  const url = new URL(c.req.url);
  const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${url.host}/api/raid/rooms/${roomId}/ws`;
}

// GET /api/raid/rooms — list public lobby
raid.get('/rooms', async (c) => {
  const kv = c.env.RAIDS_KV;
  const keys = await kv.list({ prefix: 'lobby:' });
  const rooms = [];
  for (const key of keys.keys) {
    const data = await kv.get(key.name, 'json');
    if (data) rooms.push(data);
  }
  return c.json(rooms);
});

// POST /api/raid/rooms — create a room
raid.post('/rooms', authMiddleware, async (c) => {
  const auth = getAuth(c);
  if (!auth?.userId) return c.json({ error: 'Unauthorized' }, 401);

  const roomId = generateRoomId();
  const doId = c.env.RAID_ROOMS.idFromName(roomId);

  // Write lobby entry to KV with 10-min TTL
  const lobbyEntry = {
    roomId,
    hostName: auth.userId,
    playerCount: 0,
    status: 'lobby',
    createdAt: Date.now(),
  };
  await c.env.RAIDS_KV.put(`lobby:${roomId}`, JSON.stringify(lobbyEntry), { expirationTtl: 600 });

  return c.json({ roomId, wsUrl: getWsUrl(c, roomId) });
});

// POST /api/raid/rooms/:id/join — join a room
raid.post('/rooms/:id/join', authMiddleware, async (c) => {
  const auth = getAuth(c);
  if (!auth?.userId) return c.json({ error: 'Unauthorized' }, 401);

  const roomId = c.req.param('id');
  const existing = await c.env.RAIDS_KV.get(`lobby:${roomId}`);
  if (!existing) {
    return c.json({ error: 'Room not found' }, 404);
  }

  return c.json({ roomId, wsUrl: getWsUrl(c, roomId) });
});

// GET /api/raid/sessions — my raid history
raid.get('/sessions', authMiddleware, async (c) => {
  const auth = getAuth(c);
  if (!auth?.userId) return c.json({ error: 'Unauthorized' }, 401);

  const db = c.get('db');
  const sessions = await db.select().from(raidPlayers)
    .where(eq(raidPlayers.userId, auth.userId))
    .orderBy(desc(raidPlayers.id))
    .limit(50);

  return c.json(sessions);
});

export default raid;
