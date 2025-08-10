// This file defines shared TypeScript TYPES for the backend application.

import { AuthObject } from '@clerk/backend';
import { Context } from 'hono';
import { createDbClient } from '../db';

// TYPES for our Cloudflare environment bindings from wrangler.toml.
export type Bindings = {
  DB: D1Database;
  CLERK_SECRET_KEY: string;
};

// TYPES for the variables we will add to the Hono context.
export type Variables = {
  db: ReturnType<typeof createDbClient>;
  auth: AuthObject;
};

// CUSTOM, STRONGLY-TYPED CONTEXT for our application.
export type AppContext = Context<{
  Bindings: Bindings;
  Variables: Variables;
}>;
