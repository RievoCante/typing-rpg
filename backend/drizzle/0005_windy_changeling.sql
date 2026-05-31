PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_raid_players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`username` text NOT NULL,
	`damage_dealt` integer NOT NULL,
	`words_typed` integer NOT NULL,
	`words_correct` integer NOT NULL,
	`survived` integer NOT NULL,
	`xp_awarded` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `raid_sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_raid_players`("id", "session_id", "user_id", "username", "damage_dealt", "words_typed", "words_correct", "survived", "xp_awarded") SELECT "id", "session_id", "user_id", "username", "damage_dealt", "words_typed", "words_correct", "survived", "xp_awarded" FROM `raid_players`;--> statement-breakpoint
DROP TABLE `raid_players`;--> statement-breakpoint
ALTER TABLE `__new_raid_players` RENAME TO `raid_players`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_raid_players_user` ON `raid_players` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_raid_players_session` ON `raid_players` (`session_id`);--> statement-breakpoint
CREATE TABLE `__new_raid_rooms` (
	`room_code` text PRIMARY KEY NOT NULL,
	`host_id` text NOT NULL,
	`host_username` text NOT NULL,
	`status` text DEFAULT 'waiting' NOT NULL,
	`player_count` integer DEFAULT 1 NOT NULL,
	`max_players` integer DEFAULT 3 NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_raid_rooms`("room_code", "host_id", "host_username", "status", "player_count", "max_players", "created_at") SELECT "room_code", "host_id", "host_username", "status", "player_count", "max_players", "created_at" FROM `raid_rooms`;--> statement-breakpoint
DROP TABLE `raid_rooms`;--> statement-breakpoint
ALTER TABLE `__new_raid_rooms` RENAME TO `raid_rooms`;