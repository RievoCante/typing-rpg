# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

Single-page typing RPG. Users type words to battle slimes. Two modes: **Daily** (3 quotes at increasing difficulty, one attempt per day) and **Endless** (continuous play, XP per session).

## Game Mechanics (Endless Mode)

**Player Health System:**
- Player has 100 HP max
- Vertical red health bar on left side of typing area
- Flashes when taking damage
- Shows kill streak counter (🔥)

**Monster Attack System:**
- Monster attacks periodically only after player starts typing
- Attack intervals: Normal=6s, Mini-boss=5s, Boss=4s
- Periodic damage: Normal=10, Mini-boss=15, Boss=20
- Word mistake damage: 5-15 (random) — triggers once when pressing space after typing a wrong word. Also applies on text completion if the final word has mistakes (no trailing space)
- "ATTACK!" popup in purple appears when taking periodic damage

**Healing Potion:**
- 30% chance to drop after defeating a monster
- Heals 25-50 HP (random)
- Popup appears with "Drink Potion" button
- Must click button to heal

**Death Punishment:**
- When HP reaches 0, death popup shows final stats
- "Try Again" button reloads page (session reset)
- All progress lost, kill streak resets

**Monster Spawning:**
- Monster persists when switching word counts or modes
- New monster only spawns after defeating current one
- 50/50 chance of Slime or Golem
- Random type (normal/mini-boss/boss), color, size, shape

## Infrastructure

- **Frontend env vars**: `VITE_API_URL`, `VITE_CLERK_PUBLISHABLE_KEY`
- **Backend env vars**: Clerk secret key (Cloudflare Worker secret), Sentry DSN from Worker secret
- **CI/CD** (`.github/workflows/ci.yml`): lint + format + typecheck + build on frontend; typecheck + tests on backend. Auto-deploys backend to Cloudflare Workers on push to `main` (runs D1 migrations first).
- **Branch strategy**: feature branches → `dev` → `main` (triggers deploy).

## Workflow

ALWAYS run format check and linting before considering a task complete.

- Frontend: `bun run lint && bun run format:check && bunx tsc --noEmit`
- Backend: `bun test`

## Domain-Specific Instructions

See @frontend/CLAUDE.md for frontend-specific rules and @backend/CLAUDE.md for backend-specific rules.

## gstack (recommended)

This project uses [gstack](https://github.com/garrytan/gstack) for AI-assisted workflows.
Install it for the best experience:

```bash
git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
cd ~/.claude/skills/gstack && ./setup --team
```

Skills like /qa, /ship, /review, /investigate, and /browse become available after install.
Use /browse for all web browsing. Use ~/.claude/skills/gstack/... for gstack file paths.
