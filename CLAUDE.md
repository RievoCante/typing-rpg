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

## Git Workflow

- **Branch per feature off `dev`.** For any new feature/fix, create a branch from `dev` (e.g. `feature/raid-emotes`); never commit directly to `dev` or `main`.
- **One worktree per feature branch (agents).** This project runs many parallel AI agents, so each agent's branch MUST live in its own worktree to avoid clobbering other agents and the user's working copy. Agents: call `EnterWorktree` before editing; humans: `git worktree add`.
- **Agent merges feature → `dev`** once the feature is complete and CI passes (see Verification below), then deletes its worktree.
- **`dev` is the integration + test branch; `main` is production.** The user keeps their main checkout on `dev` and runs the local server there to test merged features — no need to enter agent worktrees. After testing, open a PR `dev → main`. Merging to `main` triggers backend CD (see Deployment).
- **Squash-merge `dev → main`, then re-sync.** Because the PR is squash-merged, merge `origin/main` back into `dev` afterward to keep history clean and avoid phantom commits in the next PR.

## Vault Sync (mandatory after merge → `dev`)

After merging a feature → `dev`, keep the product vault (`~/Workspace/ai-brain/business/typing-rpg/`, a separate git repo) current — but only when the change is **vault-worthy**.

- **Vault-worthy** = a new feature, OR a change to *documented product behavior* (game rules, modes, XP, user flow). **Skip** styling/layout, perf, refactors, and bug fixes — those are already captured in git + claude-mem and must NOT clutter the vault.
- **Owned spec files — edit directly** (one agent owns the file, so no parallel conflict):
  - `canonical/features/<feature>.md` — update the feature's spec, or add a new file for a brand-new feature.
  - `canonical/prd.md` — only if documented product behavior changed.
- **Shared files — NEVER edit directly.** `log.md` and `index.md` are append-at-top and conflict when parallel agents touch them. Instead **drop one inbox fragment**: `log-inbox/YYYY-MM-DD-<feature>.md` (see `log-inbox/_TEMPLATE.md`). Unique filename → zero conflicts. The fragment states what shipped and any `index.md` row to add. A later consolidation pass folds fragments into `log.md`/`index.md` and deletes them.
- **Commit + push the vault repo** after writing (it is separate from this repo; commit there too).

## Verification (CI order)

- **Frontend**: install → lint → format:check → typecheck → test → build
- **Backend**: install → typecheck → test

## Critical Rules

- **XP sync**: `frontend/src/utils/calculateXP.ts` MUST match `backend/src/core/xp.ts`.
- **Wordlist sync**: `backend/src/static/english_1k.json` MUST match `frontend/src/static/english/english_1k.json` — backend imports its own copy at module init for raid text.
- **Locked words**: pressing space after a correct word locks it — locked chars can't be deleted.
- **Daily**: 3 quotes, 1 attempt/day, 500 base XP (0.5–1.5× WPM multiplier).
- **Raid**: min 2 / max 3 players, 75-word texts, cooperative boss battle.
- **Middleware order** (`backend/src/index.ts`): Sentry → CORS → logger → Clerk auth → DB client → rate limiter.
- **Routing**: all routes in `frontend/src/main.tsx` via `createBrowserRouter`. `App.tsx` renders only `<GameContent />`.
- **Guest mode**: raid backend generates random `guest-xxx` ID and `Guest-XXX` username for unauthenticated players.

## Deployment

Backend CD (GitHub Actions, `main` only): `bunx wrangler d1 migrations apply typing-rpg-db --remote` → `bunx wrangler deploy`. Frontend is containerized (`docker-compose.yml`).
