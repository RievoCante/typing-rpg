ALTER TABLE `game_sessions` ADD `raw_wpm` integer;--> statement-breakpoint
ALTER TABLE `game_sessions` ADD `accuracy` integer;--> statement-breakpoint
ALTER TABLE `game_sessions` ADD `consistency` integer;--> statement-breakpoint
ALTER TABLE `game_sessions` ADD `correct_chars` integer;--> statement-breakpoint
ALTER TABLE `game_sessions` ADD `incorrect_chars` integer;--> statement-breakpoint
ALTER TABLE `game_sessions` ADD `extra_chars` integer;--> statement-breakpoint
ALTER TABLE `game_sessions` ADD `missed_chars` integer;--> statement-breakpoint
ALTER TABLE `game_sessions` ADD `duration_seconds` integer;--> statement-breakpoint
ALTER TABLE `game_sessions` ADD `afk_seconds` integer;--> statement-breakpoint
ALTER TABLE `game_sessions` ADD `chart_data` text;