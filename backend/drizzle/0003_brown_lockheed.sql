CREATE TABLE `raid_rooms` (
	`room_code` text PRIMARY KEY NOT NULL,
	`host_id` text NOT NULL,
	`host_username` text NOT NULL,
	`status` text DEFAULT 'waiting' NOT NULL,
	`max_players` integer DEFAULT 4 NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
