// This file defines shared TypeScript TYPES for the backend application.

import { AuthObject } from '@clerk/backend';
import { Context } from 'hono';
import { createDbClient } from '../db';
import { RaidRoom } from '../rooms/RaidRoom';

// TYPES for our Cloudflare environment bindings from wrangler.toml.
export type Bindings = {
  DB: D1Database;
  CLERK_SECRET_KEY: string;
  API_RATE_LIMITER: {
    limit(options: { key: string }): Promise<{ success: boolean }>;
  };
  SENTRY_DSN: string;
  MODE: string;
  RAIDS_KV: KVNamespace;
  RAID_ROOMS: DurableObjectNamespace<RaidRoom>;
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
