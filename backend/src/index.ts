import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import * as Sentry from "@sentry/node";
import { sentry } from "@hono/sentry";

import { createDbClient } from "./db";
import { getUser, createUser, updateCharacter, updateDisplayName } from "./handlers/user";
import { getVault, unlockWeapons, selectLoadout } from "./handlers/vault";
import {
  createSession,
  getSessions,
  getDailyStatus,
} from "./handlers/sessions";
import {
  getLevelLeaderboard,
  getTodayDailyWpmLeaderboard,
} from "./handlers/leaderboard";
import { recordEvent } from "./handlers/events";
import { Bindings, Variables } from "./core/types";
import { authMiddleware } from "./core/auth";
import { kvRateLimit } from "./core/rateLimit";
import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
import { validateRaidWsAuth } from "./core/raidAuth";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>().basePath(
  "/api"
);

// MIDDLEWARE
// Sentry DSN from Cloudflare Workers secret (SENTRY_DSN)
// For local dev, add SENTRY_DSN to backend/.dev.vars
app.use("*", async (c, next) => {
  if (c.env.SENTRY_DSN) {
    const sentryMiddleware = sentry({
      dsn: c.env.SENTRY_DSN,
      environment: c.env.MODE ?? "production",
      tracesSampleRate: 0.1,
    });
    await sentryMiddleware(c, next);
  } else {
    await next();
  }
});
app.use("*", cors({
  origin: ["https://typingrpg.com", "http://localhost:5173"],
}));
app.use("*", logger());
// Populate auth context for all requests (even public) so getAuth works
app.use("*", clerkMiddleware());

// DB client middleware.
app.use("*", async (c, next) => {
  const db = createDbClient(c.env.DB);
  c.set("db", db);
  await next();
});

// Rate limit: per-user if signed in, else per-IP. No-op if KV not bound.
const keyFn = (c: any) =>
  getAuth(c)?.userId ?? c.req.header("cf-connecting-ip") ?? "anon";
const limiter = kvRateLimit(keyFn, {
  windowMs: 60_000,
  limit: 120,
  prefix: "api",
});

// ROUTES
app.get("/", (c) => c.text("Welcome to the Typing RPG API!"));

// user routes
app.get("/me", authMiddleware, limiter, getUser);
app.post("/me", authMiddleware, limiter, createUser);
app.patch("/me", authMiddleware, limiter, updateDisplayName);
app.patch("/me/character", authMiddleware, limiter, updateCharacter);

// weapon vault routes (Phase 3b)
app.get("/me/vault", authMiddleware, limiter, getVault);
app.post("/me/vault/unlock", authMiddleware, limiter, unlockWeapons);
app.post("/me/vault/select", authMiddleware, limiter, selectLoadout);

// session routes
app.post("/sessions", authMiddleware, limiter, createSession);
app.get("/sessions", authMiddleware, limiter, getSessions);
app.get("/daily/status", authMiddleware, limiter, getDailyStatus);

// leaderboard routes (public)
app.get("/leaderboard/levels", limiter, getLevelLeaderboard);
app.get("/leaderboard/today-wpm", limiter, getTodayDailyWpmLeaderboard);

// analytics beacon (public + anonymous; NO authMiddleware by design)
app.post("/events", limiter, recordEvent);

import raidRoutes from "./handlers/raid";
app.use("/raid/*", limiter);
app.route("/raid", raidRoutes);

const worker = {
  async fetch(req: Request, env: Bindings, ctx: any) {
    const url = new URL(req.url);
    // Route WebSocket upgrade requests to Durable Object at /raid/:roomCode
    // Path pattern: /raid/XXXXXX (6 char room code).
    // Auth is validated HERE — the DO trusts the credentials it sees in the
    // URL because we have already verified them.
    if (
      url.pathname.startsWith('/raid/') &&
      url.pathname.length === 12 &&
      req.headers.get('Upgrade') === 'websocket'
    ) {
      const authResult = await validateRaidWsAuth(url, env as { CLERK_SECRET_KEY?: string });
      if (!authResult.ok) {
        return new Response(authResult.error, { status: authResult.status });
      }
      const roomCode = url.pathname.slice(6); // /raid/XXXXXX = 6 chars
      const doId = env.RAID_ROOMS.idFromName(roomCode);
      const room = env.RAID_ROOMS.get(doId);
      return room.fetch(req);
    }
    // Everything else goes through Hono
    return app.fetch(req, env, ctx);
  },
};

export default worker;

export { RaidRoom } from "./rooms/RaidRoom";
