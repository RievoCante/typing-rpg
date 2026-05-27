# Typing RPG

Type words to battle monsters. Modes: **Daily** (3 quotes, 1/day), **Endless** (XP per session), **Raid** (co-op, 2-3 players, guest mode supported).

Monorepo: `frontend/` (React 19 + Vite) and `backend/` (Hono + Cloudflare Workers + D1 + Drizzle). Bun everywhere. Root `package.json` is empty — no root scripts.

## Knowledge sources (read from vault)

Product/feature specs live in the AI Brain vault, **not in this repo**:

- **Product spec (PRD):** `~/Workspace/ai-brain/business/typing-rpg/canonical/prd.md`
- **Feature specs:** `~/Workspace/ai-brain/business/typing-rpg/canonical/features/<feature>.md` (e.g. `raid-boss.md`)
- **Venture index + rules:** `~/Workspace/ai-brain/business/typing-rpg/index.md` and `CLAUDE.md`

Read those for product/feature-level questions. This file holds engineering rules only. Never duplicate vault content here.

## Response Style

Keep responses short and concise. Save output tokens without sacrificing readability.

## Verification (CI order)

- **Frontend**: install → lint → format:check → typecheck → test → build
- **Backend**: install → typecheck → test

## Critical Rules

- **XP sync**: `frontend/src/utils/calculateXP.ts` MUST match `backend/src/core/xp.ts`.
- **Wordlist sync**: `backend/src/static/english_1k.json` MUST match `frontend/src/static/english/english_1k.json` — backend imports its own copy at module init for raid text.
- **Locked words**: pressing space after a correct word locks it — locked chars can't be deleted.
- **Daily**: 3 quotes, 1 attempt/day, 500 base XP (0.5–1.5× WPM multiplier).
- **Raid**: min 2 / max 3 players, 25-word texts, cooperative boss battle.
- **Middleware order** (`backend/src/index.ts`): Sentry → CORS → logger → Clerk auth → DB client → rate limiter.
- **Routing**: all routes in `frontend/src/main.tsx` via `createBrowserRouter`. `App.tsx` renders only `<GameContent />`.
- **Guest mode**: raid backend generates random `guest-xxx` ID and `Guest-XXX` username for unauthenticated players.

## Deployment

Backend CD (GitHub Actions, `main` only): `bunx wrangler d1 migrations apply typing-rpg-db --remote` → `bunx wrangler deploy`. Frontend is containerized (`docker-compose.yml`).
