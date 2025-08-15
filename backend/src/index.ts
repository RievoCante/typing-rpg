import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import { createDbClient } from './db';
import { getUser, createUser } from './handlers/user';
import { createSession, getSessions, getDailyStatus } from './handlers/sessions';
import { Bindings, Variables } from './core/types';
import { authMiddleware } from './core/auth';
import { kvRateLimit } from './core/rateLimit';
import { getAuth } from '@hono/clerk-auth';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>().basePath(
  '/api',
);

// MIDDLEWARE
app.use('*', cors());
app.use('*', logger());

// DB client middleware.
app.use('*', async (c, next) => {
  const db = createDbClient(c.env.DB);
  c.set('db', db);
  await next();
});

// Rate limit: per-user if signed in, else per-IP. No-op if KV not bound.
const keyFn = (c: any) => getAuth(c)?.userId ?? c.req.header('cf-connecting-ip') ?? 'anon';
const limiter = kvRateLimit(keyFn, { windowMs: 60_000, limit: 120, prefix: 'api' });

// ROUTES
app.get('/', (c) => c.text('Welcome to the Typing RPG API!'));

// user routes
app.get('/me', authMiddleware, limiter, getUser);
app.post('/me', authMiddleware, limiter, createUser);

// session routes
app.post('/sessions', authMiddleware, limiter,createSession);
app.get('/sessions', authMiddleware, limiter, getSessions);
app.get('/daily/status', authMiddleware, limiter, getDailyStatus);

export default app;