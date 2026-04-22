CREATE TABLE `raid_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`room_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`player_count` integer NOT NULL,
	`boss_base_hp` integer NOT NULL,
	`boss_max_hp` integer NOT NULL,
	`final_boss_hp` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_raid_sessions_room` ON `raid_sessions` (`room_id`);--> statement-breakpoint
CREATE TABLE `raid_players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`username` text NOT NULL,
	`damage_dealt` integer NOT NULL,
	`words_typed` integer NOT NULL,
	`words_correct` integer NOT NULL,
	`survived` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `raid_sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_raid_players_user` ON `raid_players` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_raid_players_session` ON `raid_players` (`session_id`);