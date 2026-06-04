# Funnel & Retention Queries

Ready-to-run SQL for the homepage→game→retention funnel. The `reached_game` /
`started_typing` counts come from the new `analytics_events` beacon; finished-battle
and 7-day return are **derived from the existing `game_sessions` table** — no extra
instrumentation.

Run each against production D1 (`typing-rpg-db`):

```bash
bunx wrangler d1 execute typing-rpg-db --remote --command "<SQL>"
```

(Use `--local` instead of `--remote` to query the local dev DB.)

---

## 1. Top-of-funnel (new beacon)

Distinct visitors who reached the game vs. started typing, last 30 days, by mode:

```sql
SELECT event, mode, COUNT(DISTINCT anon_id) AS visitors
FROM analytics_events
WHERE created_at >= strftime('%s','now') - 30*24*3600
GROUP BY event, mode
ORDER BY event, mode;
```

> **The key ratio:** compare `reached_game` distinct visitors against the Cloudflare
> Web Analytics pageview total for the same window (read from the CF dashboard — it
> can't be queried here). That `reached_game / pageviews` ratio is the
> homepage→game conversion that was invisible before this beacon, and the
> `started_typing / reached_game` ratio tells you how many who saw the game actually
> played. Note the funnel is approximate by design: anonymous visitors are keyed by
> `anon_id` and never appear in `game_sessions` (which is keyed by Clerk `user_id`).

---

## 2. Finished-battle (existing data)

Completed battles per mode per UTC day, last 30 days:

```sql
SELECT mode, DATE(created_at,'unixepoch') AS day, COUNT(*) AS finishes
FROM game_sessions
WHERE created_at >= strftime('%s','now') - 30*24*3600
GROUP BY mode, day
ORDER BY day DESC, mode;
```

Total finishes by mode (single window):

```sql
SELECT mode, COUNT(*) AS finishes
FROM game_sessions
WHERE created_at >= strftime('%s','now') - 30*24*3600
GROUP BY mode;
```

---

## 3. 7-day return (signed-in)

Users active on ≥2 distinct UTC days within the last 7 days (a return proxy):

```sql
SELECT user_id, COUNT(DISTINCT DATE(created_at,'unixepoch')) AS active_days
FROM game_sessions
WHERE created_at >= strftime('%s','now') - 7*24*3600
GROUP BY user_id
HAVING active_days >= 2
ORDER BY active_days DESC;
```

Count of returning users (single number):

```sql
SELECT COUNT(*) AS returning_users FROM (
  SELECT user_id
  FROM game_sessions
  WHERE created_at >= strftime('%s','now') - 7*24*3600
  GROUP BY user_id
  HAVING COUNT(DISTINCT DATE(created_at,'unixepoch')) >= 2
);
```

---

## Notes

- `analytics_events.user_id` is populated only when a signed-in user's request
  happened to carry a Clerk token; most beacon rows are anonymous (`user_id IS NULL`),
  which is expected. Use `anon_id` for funnel/visitor counts.
- Once raid persists its own sessions to `raid_sessions` / `raid_players`, finished-raid
  counts can be added here analogously.
