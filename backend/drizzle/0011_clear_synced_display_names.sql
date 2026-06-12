-- Data cleanup: clear all display_name values.
-- The previous boot-sync (POST /me) overwrote display_name with the Clerk
-- firstName+lastName on every load, so existing values are stale sync data
-- rather than user-chosen names. The DB has no firstName column to compare
-- against, so we cannot selectively null only the auto-synced rows; clearing
-- all of them lets the leaderboard fall back to `username` until each user
-- sets a real display name via the customizer (PATCH /me).
UPDATE `users` SET `display_name` = NULL;
