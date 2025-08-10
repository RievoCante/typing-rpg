import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import { createDbClient } from './db';
import { getUser, createUser } from './handlers/user';
import { Bindings, Variables } from './core/types';
import { authMiddleware } from './core/auth';

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

// ROUTES
// test route
app.get('/', (c) => c.text('Welcome to the Typing RPG API!'));

// user routes
app.get('/me', authMiddleware, getUser);
app.post('/me', authMiddleware, createUser)

export default app;