// This file defines the database schema using Drizzle ORM.

import { sql } from 'drizzle-orm';
import { text, integer, sqliteTable, index } from 'drizzle-orm/sqlite-core';

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
export const gameSessions = sqliteTable(
  'game_sessions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id')
      .notNull()
      .references(() => users.userId),
    mode: text('mode', { enum: ['daily', 'endless'] }).notNull(),
    wpm: integer('wpm').notNull(),
    totalWords: integer('total_words').notNull(),
    correctWords: integer('correct_words').notNull(),
    incorrectWords: integer('incorrect_words').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .default(sql`(strftime('%s', 'now'))`)
      .notNull(),
  },
  table => [
    // Covers the leaderboard GROUP BY + WHERE mode + date range + ORDER BY wpm
    index('idx_game_sessions_leaderboard').on(
      table.mode,
      table.createdAt,
      table.userId,
      table.wpm
    ),
  ]
);

export const raidSessions = sqliteTable('raid_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  roomId: text('room_id').notNull(),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  endedAt: integer('ended_at', { mode: 'timestamp' }),
  playerCount: integer('player_count').notNull(),
  bossBaseHp: integer('boss_base_hp').notNull(),
  bossMaxHp: integer('boss_max_hp').notNull(),
  finalBossHp: integer('final_boss_hp').notNull(),
  status: text('status', { enum: ['victory', 'defeat'] }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .default(sql`(strftime('%s', 'now'))`)
    .notNull(),
});

export const raidPlayers = sqliteTable('raid_players', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id')
    .notNull()
    .references(() => raidSessions.id),
  userId: text('user_id').notNull(),
  username: text('username').notNull(),
  damageDealt: integer('damage_dealt').notNull(),
  wordsTyped: integer('words_typed').notNull(),
  wordsCorrect: integer('words_correct').notNull(),
  survived: integer('survived', { mode: 'boolean' }).notNull(),
});

