import { Hono, Context } from 'hono';
import { Bindings, Variables } from '../core/types';
import { authMiddleware } from '../core/auth';
import { getAuth } from '@hono/clerk-auth';
import { eq, desc, gt, and } from 'drizzle-orm';
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

function generateGuestId(): string {
  return `guest-${crypto.randomUUID().slice(0, 8)}`;
}

function generateGuestUsername(): string {
  return `Guest-${Math.floor(Math.random() * 900) + 100}`;
}

// Helper to build ws URL from request
function getWsUrl(c: Context, roomCode: string) {
  const url = new URL(c.req.url);
  const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${url.host}/raid/${roomCode}`;
}

// Helper to get user info or generate guest credentials
async function getUserOrGuest(c: Context): Promise<{ userId: string; username: string; isGuest: boolean }> {
  const auth = getAuth(c);
  
  if (auth?.userId) {
    const db = c.get('db');
    const [userRow] = await db.select({ username: users.username })
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
    wsUrl: getWsUrl(c, roomCode),
  });
});

// POST /api/raid/rooms/:code/join — get ws URL for room
raid.post('/rooms/:code/join', async (c) => {
  await getUserOrGuest(c); // Validates user or generates guest, but we don't need to use the result here

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
