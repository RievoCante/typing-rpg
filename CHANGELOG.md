# Changelog

All notable changes to typing-rpg are documented here.

## [0.1.0.0] - 2026-04-19

### Added
- **Leaderboard** — Daily WPM and level leaderboards. Top players ranked by best WPM for the UTC day; all-time leaders ranked by level/XP.
- **Sentry error monitoring** — Frontend and backend error tracking with 10% trace sampling.
- **Random slime visuals** — Each defeated monster spawns a new slime with a randomized color (7 options) and size (small/medium/large).
- **Frontend test suite** — vitest added to frontend; PRNG/textGenerator tests with pinned-date determinism. Added to CI.
- **Backend XP unit tests** — Full coverage of XP calculation, level-up thresholds, and step penalties.
- **Security scanning** — Dependabot, CodeQL, and dependency management workflows.
- **Docker support** — Dockerfile and docker-compose for local development.

### Fixed
- **Daily session save race** — `completeCurrentQuote` (localStorage write) now runs only after the server confirms the session, preventing false "already completed today" state. Retry banner on failure.
- **CORS** — Restricted from wildcard `*` to `["https://typingrpg.com", "http://localhost:5173"]`.
- **Leaderboard dedup** — Replaced JS Map + in-memory sort with SQL `GROUP BY userId + MAX(wpm) + ORDER BY + LIMIT/OFFSET`.
- **Daily quote consistency** — Replaced day-of-week index with mulberry32 PRNG seeded by UTC date + difficulty string. All users on the same UTC day now see the same quotes.
- **XP race condition** — Wrapped session INSERT + user SELECT + user UPDATE in a single D1 transaction, preventing concurrent completions from silently overwriting each other's XP.
- **Session schema bounds** — Added `.max(300)` on wpm and `.max(2000)` on word counts to prevent leaderboard manipulation.
- **Completion detection double-fire** — Removed `hasProcessedCompletion` from useEffect deps in `useCompletionDetection`; was causing `onTextChange` to fire spuriously on each completion mark.
- **handleRetrySave modal** — Retry-after-save-failure now correctly opens the congrats modal on success.
- **SlimeModel per-frame allocation** — Moved `Color` computation to `useMemo`; hoisted hit-flash `Color('#ff4d4d')` as a module-level constant.
- **GameProvider re-renders** — Wrapped `contextValue` in `useMemo` to prevent unnecessary re-renders of Monster/SlimeModel on every keystroke.

### Changed
- CI pipeline now runs frontend tests in addition to lint, format, typecheck, and build.
- Added composite index `idx_game_sessions_leaderboard` on `(mode, created_at, user_id, wpm)` for leaderboard query performance.
- Moved `SessionPayload`/`SessionResponse` types to shared `types/completion.ts`.
- Endless mode session save is fully fire-and-forget with 4-attempt retry; UI no longer blocks on save.
