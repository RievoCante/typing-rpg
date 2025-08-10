// This file is responsible for creating and exporting the D1 database client.

import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

/**
 * Creates a new Drizzle client instance for our D1 database.
 * @param d1 The D1 database binding.
 * @returns A Drizzle client instance with the schema applied.
 */
export const createDbClient = (d1: D1Database) => {
  return drizzle(d1, { schema });
};
