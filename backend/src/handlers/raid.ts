import { Hono, Context } from 'hono';
import { Bindings, Variables } from '../core/types';
import { authMiddleware } from '../core/auth';
import { getAuth } from '@hono/clerk-auth';
import { eq, desc } from 'drizzle-orm';
import { raidPlayers, raidRooms, users } from '../db/schema';

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

// Helper to build ws URL from request
function getWsUrl(c: Context, roomCode: string) {
  const url = new URL(c.req.url);
  const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${url.host}/raid/${roomCode}`;
}

// GET /api/raid/rooms — list public lobby (waiting rooms only)
raid.get('/rooms', async (c) => {
  const db = c.get('db');
  
  const rooms = await db.query.raidRooms.findMany({
    where: (r, { eq }) => eq(r.status, 'waiting'),
    orderBy: (r, { desc }) => [desc(r.createdAt)],
  });

  // For MVP, player count comes from DO. Return static for now.
  const roomsWithCount = rooms.map(room => ({
    roomCode: room.roomCode,
    hostUsername: room.hostUsername,
    playerCount: 1, // Will be updated via real-time from DO
    maxPlayers: room.maxPlayers,
    status: room.status,
    createdAt: room.createdAt instanceof Date ? room.createdAt.getTime() : Number(room.createdAt) * 1000,
  }));

  return c.json({ rooms: roomsWithCount });
});

// POST /api/raid/rooms — create a room
raid.post('/rooms', authMiddleware, async (c) => {
  const auth = getAuth(c);
  if (!auth?.userId) return c.json({ error: 'Unauthorized' }, 401);

  const db = c.get('db');
  const [userRow] = await db.select({ username: users.username })
    .from(users)
    .where(eq(users.userId, auth.userId))
    .limit(1);

  // Generate unique room code
  let roomCode = generateRoomCode();
  let attempts = 0;
  while (attempts < 10) {
    const existing = await db.query.raidRooms.findFirst({
      where: (r, { eq }) => eq(r.roomCode, roomCode),
    });
    if (!existing) break;
    roomCode = generateRoomCode();
    attempts++;
  }

  const createdAt = new Date();
  const expiresAt = createdAt.getTime() + 5 * 60 * 1000; // 5 minutes

  await db.insert(raidRooms).values({
    roomCode,
    hostId: auth.userId,
    hostUsername: userRow?.username ?? auth.userId,
    status: 'waiting',
    maxPlayers: 4,
    createdAt,
  });

  return c.json({ roomCode, expiresAt, wsUrl: getWsUrl(c, roomCode) });
});

// POST /api/raid/rooms/:code/join — get ws URL for room
raid.post('/rooms/:code/join', authMiddleware, async (c) => {
  const auth = getAuth(c);
  if (!auth?.userId) return c.json({ error: 'Unauthorized' }, 401);

  const roomCode = c.req.param('code').toUpperCase();
  const db = c.get('db');

  const room = await db.query.raidRooms.findFirst({
    where: (r, { eq }) => eq(r.roomCode, roomCode),
  });

  if (!room) return c.json({ error: 'Room not found' }, 404);
  if (room.status !== 'waiting') return c.json({ error: 'Room is not accepting players' }, 400);

  return c.json({ roomCode, wsUrl: getWsUrl(c, roomCode) });
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
