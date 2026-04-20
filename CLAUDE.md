# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Frontend (`cd frontend`)
```bash
bun run dev          # Start Vite dev server
bun run build        # Production build
bun run lint         # ESLint
bun run format       # Prettier write
bun run format:check # Prettier check (used in CI)
bun run test         # Run vitest tests
bunx tsc --noEmit    # Type check
```

### Backend (`cd backend`)
```bash
bun run dev          # Apply local D1 migrations + start wrangler dev server
bun test             # Run tests (vitest)
bun run test:watch   # Vitest in watch mode
bun run db:gen       # Generate Drizzle migration files
```

The backend dev command runs `wrangler d1 migrations apply typing-rpg-db --local && wrangler dev src/index.ts --local`.

## Architecture

### Overview
Single-page app. Users type words to battle slimes. Two modes: **Daily** (3 quotes at increasing difficulty, one attempt per day) and **Endless** (continuous play, XP per session).

### Frontend (`frontend/src/`)
- **`App.tsx`** — root layout with `ThemeProvider` > `GameProvider` > `GameContent`. All gameplay UI is on one page.
- **`context/`** — `GameContext` holds `currentMode`, word counts (`totalWords`/`remainingWords`), and `monstersDefeated`. `ThemeContext` holds light/dark theme.
- **`hooks/useTypingMechanics.ts`** — core typing engine. Tracks `charStatus` per character (`pending | correct | incorrect | locked`). Words become `locked` when space is pressed after a correctly typed word — locked characters cannot be deleted.
- **`hooks/useCompletionDetection.ts`** — detects when cursor reaches end of text; guards against duplicate completion calls.
- **`handlers/DailyCompletionHandler.ts`** — Daily mode: checks failure threshold, advances through 3 quote difficulties, submits session API call (fire-and-forget) on 3rd completion, calculates optimistic XP.
- **`handlers/EndlessCompletionHandler.ts`** — Endless mode: submits session on every text completion, calculates optimistic XP.
- **`hooks/useApi.ts`** — Clerk-authenticated API client. Reads `VITE_API_URL` from env, prepends `/api` to all paths.
- **`utils/calculateXP.ts`** — mirrors backend XP logic for optimistic display (must stay in sync with `backend/src/core/xp.ts`).
- **`components/TypingText.tsx`** — Displays typing text with 3-line viewport. Implements MonkeyType-style scrolling with smart viewport: cursor starts on first line, transitions to middle position after completing first line, then stays centered while text scrolls. Fixed height container (4.5em) with overflow hidden.
- **`components/SlimeModel.tsx` / `Monster.tsx`** — Three.js 3D slime with hit/defeat animations.
- **`static/english/`** — word lists (1k, 5k, 10k words, quotes) used by `utils/textGenerator.ts`.

### Backend (`backend/src/`)
- **Runtime**: Bun + Cloudflare Workers (Hono framework). All routes prefixed `/api`.
- **`index.ts`** — middleware chain: Sentry → CORS → logger → Clerk auth (`clerkMiddleware`) → DB client → rate limiter. Routes: `/me` (GET/POST), `/sessions` (GET/POST), `/daily/status`, `/leaderboard/levels`, `/leaderboard/today-wpm`.
- **`db/schema.ts`** — two tables: `users` (Clerk `userId` PK, `username`, `level`, `xp`) and `game_sessions` (`userId` FK, `mode`, `wpm`, `totalWords`, `correctWords`, `incorrectWords`).
- **`core/xp.ts`** — XP calculation: Daily base 500 XP (WPM multiplier 0.5–1.5×, no error penalty); Endless base 100 XP (WPM multiplier 0.5–1.25×, step penalties for incorrect words). Level-up formula: starts at 20 XP, grows 20% per level.
- **`core/auth.ts`** — `authMiddleware` validates Clerk JWT and returns 401 if unauthenticated.
- **`core/rateLimit.ts`** — per-user (if signed in) or per-IP rate limiter using Cloudflare KV (120 req/min).
- **Migrations**: Drizzle ORM, migration files in `backend/drizzle/`. DB binding name is `DB` (Cloudflare D1).

### Infrastructure
- **Frontend env vars**: `VITE_API_URL`, `VITE_CLERK_PUBLISHABLE_KEY`
- **Backend env vars**: Clerk secret key (Cloudflare Worker secret), Sentry DSN from Worker secret
- **CI/CD** (`.github/workflows/ci.yml`): lint + format + typecheck + build on frontend; typecheck + tests on backend. Auto-deploys backend to Cloudflare Workers on push to `main` (runs D1 migrations first).
- **Branch strategy**: feature branches → `dev` → `main` (triggers deploy).

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
