import { Hono, Context } from 'hono';
import { Bindings, Variables } from '../core/types';
import { authMiddleware } from '../core/auth';
import { getAuth } from '@hono/clerk-auth';
import { eq, desc } from 'drizzle-orm';
import { raidPlayers, raidRooms } from '../db/schema';
import { getUserOrGuest } from '../core/raidAuth';

const raid = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_CODE_LENGTH = 6;

function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

// Build the WebSocket URL the frontend will connect with. Credentials are
// embedded so the worker.fetch upgrade handler can validate auth BEFORE
// routing to the Durable Object, and the DO can trust them without any
// re-derivation. For Clerk users we forward the bearer token so the upgrade
// can verify the userId matches `sub`.
function getWsUrl(
  c: Context,
  roomCode: string,
  userId: string,
  username: string
): string {
  const url = new URL(c.req.url);
  const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  const params = new URLSearchParams({ userId, username });

  // Forward the bearer token so the WS upgrade can verify the authenticated
  // userId. Guests have no token; nothing to forward.
  const auth = c.req.header('Authorization');
  if (auth?.startsWith('Bearer ')) {
    params.set('token', auth.slice(7));
  }

  return `${protocol}//${url.host}/raid/${roomCode}?${params.toString()}`;
}

// GET /api/raid/rooms — list public lobby (waiting rooms only)
raid.get('/rooms', async (c) => {
  const db = c.get('db');

  // Hide rooms older than 10 minutes — they are likely abandoned or ghost rooms.
  const staleThreshold = new Date(Date.now() - 10 * 60 * 1000);

  const rooms = await db.query.raidRooms.findMany({
    where: (r, { eq, gt, and }) => and(eq(r.status, 'waiting'), gt(r.createdAt, staleThreshold)),
    orderBy: (r, { desc }) => [desc(r.createdAt)],
  });

    const roomsWithCount = rooms.map(room => ({
      roomId: room.roomCode,
      hostName: room.hostUsername,
      playerCount: room.playerCount,
      maxPlayers: room.maxPlayers,
      status: room.status,
      createdAt: room.createdAt instanceof Date ? room.createdAt.getTime() : Number(room.createdAt) * 1000,
    }));

  return c.json({ rooms: roomsWithCount });
});

// POST /api/raid/rooms — create a room
raid.post('/rooms', async (c) => {
  const db = c.get('db');
  const user = await getUserOrGuest(c);

  const roomCode = generateRoomCode();

  await db.insert(raidRooms).values({
    roomCode,
    hostId: user.userId,
    hostUsername: user.username,
    status: 'waiting',
    playerCount: 1,
    maxPlayers: 3,
    createdAt: new Date(),
  });

  return c.json({
    roomCode,
    wsUrl: getWsUrl(c, roomCode, user.userId, user.username),
    userId: user.userId,
    username: user.username,
    isGuest: user.isGuest,
  });
});

// POST /api/raid/rooms/:code/join — get ws URL for room
raid.post('/rooms/:code/join', async (c) => {
  const user = await getUserOrGuest(c);

  const roomCode = c.req.param('code').toUpperCase();
  const db = c.get('db');

  const room = await db.query.raidRooms.findFirst({
    where: (r, { eq }) => eq(r.roomCode, roomCode),
  });

  if (!room) return c.json({ error: 'Room not found' }, 404);
  if (room.status !== 'waiting') return c.json({ error: 'Room is not accepting players' }, 400);

  return c.json({
    roomCode,
    wsUrl: getWsUrl(c, roomCode, user.userId, user.username),
    userId: user.userId,
    username: user.username,
    isGuest: user.isGuest,
  });
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
