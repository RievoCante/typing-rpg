# Frontend CLAUDE.md

This file provides guidance for the frontend (`frontend/`).

## Commands

```bash
bun run dev          # Start Vite dev server
bun run build        # Production build
bun run lint         # ESLint
bun run format       # Prettier write
bun run format:check # Prettier check (used in CI)
bun run test         # Run vitest tests
bunx tsc --noEmit    # Type check
```

## Critical Rules

- **IMPORTANT**: `utils/calculateXP.ts` MUST stay in sync with `backend/src/core/xp.ts`. Any change to XP logic requires updating BOTH files.
- **IMPORTANT**: The `locked` word mechanic is core gameplay. Words become `locked` when space is pressed after a correctly typed word. Locked characters cannot be deleted.
- **IMPORTANT**: Daily mode is exactly 3 quotes at increasing difficulty, with only one attempt per day.

## Verification

Before finishing any frontend task, run: `bun run lint && bun run format:check && bunx tsc --noEmit`
