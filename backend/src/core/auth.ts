// This file configures and exports the Clerk authentication middleware for Hono.

import { clerkMiddleware } from '@hono/clerk-auth';

// Initialize the Clerk middleware.
// It will automatically use the CLERK_SECRET_KEY from the environment (wrangler.toml).
// This middleware is responsible for verifying the session token from incoming requests.
export const authMiddleware = clerkMiddleware();

