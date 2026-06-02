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

**Be super concise and straight to the point.** Answer the question asked — nothing more. No preamble, no recap of the request, no summary of what you just did unless asked. Prefer the shortest correct answer; one word or one line when that suffices. Lead with the result. Use tables/bullets over prose. Skip filler ("Great question", "Sure", "I'll now…"). Show code/commands instead of describing them. Save output tokens without sacrificing correctness or readability.

## Git Workflow

- **Branch per feature off `dev`.** For any new feature/fix, create a branch from `dev` (e.g. `feature/raid-emotes`); never commit directly to `dev` or `main`.
- **One worktree per feature branch (agents).** This project runs many parallel AI agents, so each agent's branch MUST live in its own worktree to avoid clobbering other agents and the user's working copy. Agents: call `EnterWorktree` before editing; humans: `git worktree add`.
- **Agent merges feature → `dev`** once the feature is complete and CI passes (see Verification below). The merge isn't done until you've run the **Vault Sync** step below (or decided the change isn't vault-worthy) — treat it as part of the merge, not a separate task to be asked for. Then delete the worktree.
- **`dev` is the integration + test branch; `main` is production.** The user keeps their main checkout on `dev` and runs the local server there to test merged features — no need to enter agent worktrees. After testing, open a PR `dev → main`. Merging to `main` triggers backend CD (see Deployment).
- **Squash-merge `dev → main`, then re-sync.** Because the PR is squash-merged, merge `origin/main` back into `dev` afterward to keep history clean and avoid phantom commits in the next PR.

## Vault Sync (after merge → `dev`)

**This is automatic, not on-request.** After every merge to `dev`, decide whether the change is vault-worthy and act without waiting to be told:

- **Vault-worthy → invoke the `vault-update` skill.** A change is vault-worthy if a teammate reading the product vault would need it to understand what the product does: a new feature shipped, documented product behavior changed (game rules, modes, XP numbers, user flow, balance), or a feature was removed/reworked.
- **Not vault-worthy → skip silently.** Styling/layout, performance, refactors with no behavior change, and pure bug fixes are already captured by git + claude-mem. Don't run the skill for these.

When in doubt, lean toward running it — the skill itself re-applies this filter and holds the full procedure (owned-file edits, conflict-safe `log-inbox/` fragments, commit+push to the separate `ai-brain` repo). Never hand-edit `log.md`/`index.md` — the skill explains why.

## Verification (CI order)

- **Frontend**: install → lint → format:check → typecheck → test → build
- **Backend**: install → typecheck → test

## Critical Rules

- **XP sync**: `frontend/src/utils/calculateXP.ts` MUST match `backend/src/core/xp.ts`.
- **Wordlist sync**: `backend/src/static/english_1k.json` MUST match `frontend/src/static/english/english_1k.json` — backend imports its own copy at module init for raid text.
- **Avatar-schema sync**: the warrior `PlayerAvatarConfig` enums in `frontend/src/utils/avatarConfig.ts` MUST match the Zod schema in `backend/src/core/character.ts` (used by `PATCH /me/character` and raid `join` validation). Change both together.
- **Weapon-id sync**: the weapon ids in `frontend/src/utils/weapons.ts` (`WEAPON_POOL`) MUST match `WEAPON_IDS` in `backend/src/core/weapons.ts` (the persistent vault validates `/me/vault` unlock/select against it). Guarded by `backend/src/core/weapons.sync.test.ts`.
- **Locked words**: pressing space after a correct word locks it — locked chars can't be deleted.
- **Daily**: 3 quotes, 1 attempt/day, 500 base XP (0.5–1.5× WPM multiplier).
- **Raid**: min 2 / max 3 players, 75-word texts, cooperative boss battle.
- **Middleware order** (`backend/src/index.ts`): Sentry → CORS → logger → Clerk auth → DB client → rate limiter.
- **Routing**: all routes in `frontend/src/main.tsx` via `createBrowserRouter`. `App.tsx` renders only `<GameContent />`.
- **Guest mode**: raid backend generates random `guest-xxx` ID and `Guest-XXX` username for unauthenticated players.

## Deployment

Backend CD (GitHub Actions, `main` only): `bunx wrangler d1 migrations apply typing-rpg-db --remote` → `bunx wrangler deploy`. Frontend is containerized (`docker-compose.yml`).
