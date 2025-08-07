import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import { createDbClient } from './db';
import { getUser } from './handlers/user';
import { Bindings, Variables } from './core/types';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>().basePath(
  '/api',
);

// --- Middleware ---
app.use('*', cors());
app.use('*', logger());

// DB client middleware.
app.use('*', async (c, next) => {
  const db = createDbClient(c.env.DB);
  c.set('db', db);
  await next();
});

// --- API Routes ---
app.get('/', (c) => c.text('Welcome to the Typing RPG API!'));
app.get('/me', getUser);

export default app;
