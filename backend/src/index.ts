import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import * as Sentry from "@sentry/node";
import { sentry } from "@hono/sentry";

import { createDbClient } from "./db";
import { getUser, createUser } from "./handlers/user";
import {
  createSession,
  getSessions,
  getDailyStatus,
} from "./handlers/sessions";
import {
  getLevelLeaderboard,
  getTodayDailyWpmLeaderboard,
} from "./handlers/leaderboard";
import { Bindings, Variables } from "./core/types";
import { authMiddleware } from "./core/auth";
import { kvRateLimit } from "./core/rateLimit";
import { clerkMiddleware, getAuth } from "@hono/clerk-auth";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>().basePath(
  "/api"
);

// MIDDLEWARE
// Note: Sentry DSN is hardcoded for Cloudflare Workers deployment
// This is acceptable since: 1) DSN is server-side only, 2) Cloudflare Workers
// don't easily support build-time env vars, 3) DSN is safe to expose (it's for sending, not reading data)
// For production best practice, consider using Cloudflare Workers secrets
app.use(
  "*",
  sentry({
    dsn: "https://fc88096eb65c14e942c6098e5271b73a@o4510185802629120.ingest.us.sentry.io/4510220039028736",
    environment: "production",
    tracesSampleRate: 0.1,
  })
);
app.use("*", cors());
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

// session routes
app.post("/sessions", authMiddleware, limiter, createSession);
app.get("/sessions", authMiddleware, limiter, getSessions);
app.get("/daily/status", authMiddleware, limiter, getDailyStatus);

// leaderboard routes (public)
app.get("/leaderboard/levels", limiter, getLevelLeaderboard);
app.get("/leaderboard/today-wpm", limiter, getTodayDailyWpmLeaderboard);

export default app;
