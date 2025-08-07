// This file configures Drizzle Kit for database migrations.

import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  // Drizzle requires a 'dialect' property. For D1, it's 'sqlite'.
  dialect: 'sqlite',
  driver: 'd1-http',
  dbCredentials: {
    // These credentials should be stored in a .env file in the backend directory.
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
    token: process.env.CLOUDFLARE_API_TOKEN!,
  },
  verbose: true,
  strict: true,
});
