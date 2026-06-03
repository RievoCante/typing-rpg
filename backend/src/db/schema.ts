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
  // JSON-encoded cosmetic avatar config (see core/character.ts). Null until the
  // user customizes their character.
  character: text('character'),
  // Persistent weapon vault (Phase 3b). JSON array of unlocked weapon ids (see
  // core/weapons.ts WEAPON_IDS). Defaults to an empty collection.
  unlockedWeapons: text('unlocked_weapons').default('[]').notNull(),
  // Selected loadout weapon id (the Endless starting weapon); null = Fists.
  loadoutWeapon: text('loadout_weapon'),
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
    rawWpm: integer('raw_wpm'),
    accuracy: integer('accuracy'),
    consistency: integer('consistency'),
    correctChars: integer('correct_chars'),
    incorrectChars: integer('incorrect_chars'),
    extraChars: integer('extra_chars'),
    missedChars: integer('missed_chars'),
    durationSeconds: integer('duration_seconds'),
    afkSeconds: integer('afk_seconds'),
    chartData: text('chart_data'),
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

export const raidSessions = sqliteTable(
  'raid_sessions',
  {
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
  },
  table => [index('idx_raid_sessions_room').on(table.roomId)]
);

export const raidPlayers = sqliteTable(
  'raid_players',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sessionId: integer('session_id')
      .notNull()
      .references(() => raidSessions.id),
    // Plain text — may be a `guest-xxx` id. No FK to users so guests can be persisted.
    userId: text('user_id').notNull(),
    username: text('username').notNull(),
    damageDealt: integer('damage_dealt').notNull(),
    wordsTyped: integer('words_typed').notNull(),
    wordsCorrect: integer('words_correct').notNull(),
    survived: integer('survived', { mode: 'boolean' }).notNull(),
    xpAwarded: integer('xp_awarded').default(0).notNull(),
  },
  table => [
    index('idx_raid_players_user').on(table.userId),
    index('idx_raid_players_session').on(table.sessionId),
  ]
);

/**
 * The `analytics_events` table logs lightweight funnel beacons fired from the
 * client (`reached_game`, `started_typing`). Public + anonymous-friendly: keyed
 * by a client-generated `anon_id`; `user_id` is captured opportunistically only
 * when a Clerk token rides along. See handlers/events.ts.
 */
export const analyticsEvents = sqliteTable(
  'analytics_events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    event: text('event', { enum: ['reached_game', 'started_typing'] }).notNull(),
    anonId: text('anon_id').notNull(),
    userId: text('user_id'),
    mode: text('mode', { enum: ['daily', 'endless', 'raid'] }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .default(sql`(strftime('%s', 'now'))`)
      .notNull(),
  },
  table => [index('idx_analytics_events').on(table.event, table.createdAt)]
);

/**
 * Raid room registry for matchmaking.
 */
export const raidRooms = sqliteTable('raid_rooms', {
  roomCode: text('room_code').primaryKey(),
  hostId: text('host_id').notNull(),
  hostUsername: text('host_username').notNull(),
  status: text('status', { enum: ['waiting', 'active', 'ended'] }).default('waiting').notNull(),
  playerCount: integer('player_count').default(1).notNull(),
  maxPlayers: integer('max_players').default(3).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .default(sql`(strftime('%s', 'now'))`)
    .notNull(),
});

