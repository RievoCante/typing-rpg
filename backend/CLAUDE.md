# Backend CLAUDE.md

This file provides guidance for the backend (`backend/`).

## Commands

```bash
bun run dev          # Apply local D1 migrations + start wrangler dev server
bun test             # Run tests (vitest)
bun run test:watch   # Vitest in watch mode
bun run db:gen       # Generate Drizzle migration files
```

The backend dev command runs `wrangler d1 migrations apply typing-rpg-db --local && wrangler dev src/index.ts --local`.

## Critical Rules

- **IMPORTANT**: Middleware order in `index.ts` MUST NOT change: Sentry → CORS → logger → Clerk auth (`clerkMiddleware`) → DB client → rate limiter.
- **IMPORTANT**: `authMiddleware` validates Clerk JWT and returns 401 if unauthenticated. Do not change this behavior.
- **IMPORTANT**: XP calculation logic differs by mode. Daily base is 500 XP (WPM multiplier 0.5–1.5×, no error penalty). Endless base is 100 XP (WPM multiplier 0.5–1.25×, step penalties for incorrect words). Level-up formula starts at 20 XP and grows 20% per level.

## Database Migrations

- Use Drizzle ORM. Migration files live in `backend/drizzle/`.
- Run `bun run db:gen` to generate migration files after schema changes.
- Run `bun run dev` to apply migrations locally.
- DB binding name is `DB` (Cloudflare D1).

## Verification

Before finishing any backend task, run: `bun test`
