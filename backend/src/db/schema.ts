// This file defines the database schema using Drizzle ORM.

import { sql } from 'drizzle-orm';
import { text, integer, sqliteTable } from 'drizzle-orm/sqlite-core';

/**
 * The `users` table stores permanent player data.
 * It is linked to a Clerk user account via the `user_id`.
 */
export const users = sqliteTable('users', {
  // Clerk user ID as primary key.
  userId: text('user_id').primaryKey(),
  username: text('username').notNull(),
  level: integer('level').default(1).notNull(),
  xp: integer('xp').default(0).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .default(sql`(strftime('%s', 'now'))`)
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

/**
 * The `game_sessions` table logs the results of every game a user completes.
 * This provides a detailed history of player performance.
 */
export const gameSessions = sqliteTable('game_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id')
    .notNull()
    .references(() => users.userId), // Foreign key to the users table
  mode: text('mode', { enum: ['daily', 'endless'] }).notNull(),
  wpm: integer('wpm').notNull(),
  totalWords: integer('total_words').notNull(),
  correctWords: integer('correct_words').notNull(),
  incorrectWords: integer('incorrect_words').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .default(sql`(strftime('%s', 'now'))`)
    .notNull(),
});

