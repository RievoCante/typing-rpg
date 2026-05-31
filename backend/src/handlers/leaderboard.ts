// Handlers for public leaderboard endpoints
import { and, asc, desc, eq, gte, lt, max, min } from "drizzle-orm";
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
    const maxWpm = max(gameSessions.wpm).as("wpm");
    const minCreatedAt = min(gameSessions.createdAt).as("createdAt");

    const rows = await db
      .select({
        username: users.username,
        wpm: maxWpm,
        createdAt: minCreatedAt,
      })
      .from(gameSessions)
      .innerJoin(users, eq(users.userId, gameSessions.userId))
      .where(
        and(
          eq(gameSessions.mode, "daily"),
          gte(gameSessions.createdAt, dayStart),
          lt(gameSessions.createdAt, dayEnd)
        )
      )
      .groupBy(gameSessions.userId, users.username)
      .orderBy(desc(maxWpm), asc(minCreatedAt))
      .limit(limit)
      .offset(offset);

    const items = rows.map((r, idx) => ({
      rank: offset + idx + 1,
      username: r.username,
      wpm: r.wpm ?? 0,
    }));

    return c.json({ success: true, items });
  } catch (e) {
    console.error("getTodayDailyWpmLeaderboard error", e);
    return c.json({ error: "Failed to load leaderboard" }, 500);
  }
};
