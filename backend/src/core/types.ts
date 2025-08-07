// This file defines shared TypeScript types for the backend application.

import { Context } from 'hono';
import { createDbClient } from '../db';

// Define the types for our Cloudflare environment bindings from wrangler.toml.
export type Bindings = {
  DB: D1Database;
  // Add other secret bindings here, e.g., CLERK_SECRET_KEY: string;
};

// Define the types for the variables we will add to the Hono context.
export type Variables = {
  db: ReturnType<typeof createDbClient>;
  // When we add auth, we'll add the user type here: e.g., user: AuthUser;
};

// Create a custom, strongly-typed Context for our application.
export type AppContext = Context<{
  Bindings: Bindings;
  Variables: Variables;
}>;

