// Handlers for public leaderboard endpoints
import { and, desc, eq, gte, lt } from "drizzle-orm";
import { AppContext } from "../core/types";
import { users, gameSessions } from "../db/schema";

// GET /api/leaderboard/levels?limit=50&offset=0
export const getLevelLeaderboard = async (c: AppContext) => {
  const url = new URL(c.req.url);
  const limitParam = url.searchParams.get("limit");
  const offsetParam = url.searchParams.get("offset");
  let limit = Number.parseInt(limitParam || "50", 10);
  let offset = Number.parseInt(offsetParam || "0", 10);
  if (!Number.isFinite(limit) || limit <= 0) limit = 50;
  if (limit > 100) limit = 100;
  if (!Number.isFinite(offset) || offset < 0) offset = 0;

  const db = c.get("db");
  try {
    const rows = await db.query.users.findMany({
      columns: {
        userId: true,
        username: true,
        level: true,
        xp: true,
        updatedAt: true,
      },
      orderBy: (u, { desc, asc }) => [desc(u.level), desc(u.xp), asc(u.userId)],
      limit,
      offset,
    });

    const items = rows.map((u, idx) => ({
      rank: offset + idx + 1,
      userId: u.userId,
      username: u.username,
      level: u.level,
      xp: u.xp,
      updatedAt: u.updatedAt ?? null,
    }));

    return c.json({ success: true, items });
  } catch (e) {
    console.error("getLevelLeaderboard error", e);
    return c.json({ error: "Failed to load leaderboard" }, 500);
  }
};

// GET /api/leaderboard/today-wpm?limit=50&offset=0
export const getTodayDailyWpmLeaderboard = async (c: AppContext) => {
  const url = new URL(c.req.url);
  const limitParam = url.searchParams.get("limit");
  const offsetParam = url.searchParams.get("offset");
  let limit = Number.parseInt(limitParam || "50", 10);
  let offset = Number.parseInt(offsetParam || "0", 10);
  if (!Number.isFinite(limit) || limit <= 0) limit = 50;
  if (limit > 100) limit = 100;
  if (!Number.isFinite(offset) || offset < 0) offset = 0;

  // UTC day window
  const now = new Date();
  const dayStartMs = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  const dayEndMs = dayStartMs + 86_400_000;
  const dayStart = new Date(dayStartMs);
  const dayEnd = new Date(dayEndMs);

  const db = c.get("db");
  try {
    // Fetch today's daily sessions joined with users
    const rows = await db
      .select({
        userId: gameSessions.userId,
        username: users.username,
        wpm: gameSessions.wpm,
        createdAt: gameSessions.createdAt,
      })
      .from(gameSessions)
      .innerJoin(users, eq(users.userId, gameSessions.userId))
      .where(
        and(
          eq(gameSessions.mode, "daily"),
          gte(gameSessions.createdAt, dayStart as any),
          lt(gameSessions.createdAt, dayEnd as any)
        )
      )
      .orderBy(desc(gameSessions.createdAt));

    // Keep latest entry per user, then sort by WPM desc
    const latestByUser = new Map<
      string,
      {
        userId: string;
        username: string;
        wpm: number;
        createdAt: Date | number;
      }
    >();
    for (const r of rows) {
      if (!latestByUser.has(r.userId)) {
        latestByUser.set(r.userId, r);
      }
    }
    const aggregated = Array.from(latestByUser.values()).sort((a, b) => {
      if (b.wpm !== a.wpm) return b.wpm - a.wpm;
      const at =
        a.createdAt instanceof Date
          ? a.createdAt.getTime()
          : Number(a.createdAt) * 1000;
      const bt =
        b.createdAt instanceof Date
          ? b.createdAt.getTime()
          : Number(b.createdAt) * 1000;
      return at - bt;
    });

    const paged = aggregated.slice(offset, offset + limit);
    const items = paged.map((r, idx) => ({
      rank: offset + idx + 1,
      userId: r.userId,
      username: r.username,
      wpm: r.wpm,
    }));

    return c.json({ success: true, items });
  } catch (e) {
    console.error("getTodayDailyWpmLeaderboard error", e);
    return c.json({ error: "Failed to load leaderboard" }, 500);
  }
};
