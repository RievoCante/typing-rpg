# Raid Inline Mode Design

**Date:** 2026-04-23

## Context

Currently, clicking the "Raid" tab navigates to a separate `/raid` route, taking the user away from the main game page with its brick background, mode tabs, and shared layout. The user wants Raid to render inline — same page, same layout — just swapping the center content (monster, health bar, typing area) for raid-specific content when the Raid tab is active. After a raid ends, the results screen stays on the Raid tab with a "Back to Lobby" button (stays in raid mode, resets to room list).

## Goal

When the Raid tab is selected, show raid content within the same page layout. No route change. No separate page. The brick background, header, and mode selector tabs remain untouched.

## Approach: Raid as an In-Page Sub-Mode

Add `'raid'` to `GameMode` in `GameContext`. `ModeSelector` calls `setCurrentMode('raid')` instead of navigating. `App.tsx` renders `<RaidView>` in place of the normal game layout when `currentMode === 'raid'`.

## Architecture

### GameMode Type

`frontend/src/context/GameContext.ts`: extend `GameMode` from `'daily' | 'endless'` to `'daily' | 'endless' | 'raid'`.

### ModeSelector

Remove `navigate('/raid')` call and `useNavigate`/`useLocation` usage for Raid. Raid tab calls `setCurrentMode('raid')`. Update `activeIndex` logic: instead of checking `location.pathname.startsWith('/raid')`, check `currentMode === 'raid'`.

### App.tsx

When `currentMode === 'raid'`, render `<RaidView />` in place of the Monster + HealthBar + TypingInterface block. Surrounding layout (background, header, mode tabs) is unaffected.

### RaidView (new component: `frontend/src/components/RaidView.tsx`)

Owns two pieces of state:
- `phase: 'room-list' | 'in-room'` — top-level raid flow
- `activeRoomId: string | null` — set when a room is created or joined

**`phase === 'room-list'`**: Renders the room list UI (logic moved from `RaidLobbyPage`). Fetches `/api/raid/rooms` every 5 seconds. Create Room and Join Room buttons call the API and on success set `activeRoomId` + transition to `'in-room'`.

**`phase === 'in-room'`**: Renders the in-room experience (logic moved from `RaidRoomPage`). Establishes WebSocket via `useRaidSocket`, manages game state via `useRaidState`, auto-joins on connect. Sub-states are driven by `isPhase()` from `useRaidState`:
- `isPhase('lobby')` → `<RaidLobbyScreen>` (waiting room)
- `isPhase('playing')` → `<RaidGame>`
- `isPhase('finished')` → `<RaidResultScreen onPlayAgain={() => setPhase('room-list')} onHome={() => setCurrentMode('daily')} />`

### RaidResultScreen Changes

`RaidResultScreen` currently uses `useNavigate` internally for its "Home" button (`navigate('/')`). Since routes are removed, replace this with an `onHome` prop (callback). The existing `onPlayAgain` prop is reused — `RaidView` passes `() => setPhase('room-list')` to it.

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/context/GameContext.ts` | Add `'raid'` to `GameMode` type |
| `frontend/src/components/ModeSelector.tsx` | Raid tab → `setCurrentMode('raid')`; remove navigate/location |
| `frontend/src/App.tsx` | Render `<RaidView />` when `currentMode === 'raid'` |
| `frontend/src/main.tsx` | Remove `/raid` and `/raid/:roomId` routes and page imports |
| `frontend/src/components/RaidResultScreen.tsx` | Replace `useNavigate` + `navigate('/')` with `onHome` prop |
| `frontend/src/components/RaidView.tsx` | **New** — merges logic from `RaidLobbyPage` + `RaidRoomPage`; owns `phase` + `activeRoomId` state |

## Files Deleted

- `frontend/src/pages/RaidLobbyPage.tsx` — logic moves to `RaidView`
- `frontend/src/pages/RaidRoomPage.tsx` — logic moves to `RaidView`

## Files Reused As-Is

- `frontend/src/components/RaidLobbyScreen.tsx`
- `frontend/src/components/RaidGame.tsx`
- `frontend/src/hooks/useRaidSocket.ts`
- `frontend/src/hooks/useRaidState.ts`

## Verification

1. Click Raid tab → stays on same page, shows room list UI
2. Create Room → transitions to in-room lobby (waiting for players)
3. Host starts game → transitions to game UI inline
4. Game ends → results screen shows "Play Again" and "Home" buttons
5. "Play Again" → returns to room list within Raid tab
6. "Home" → switches to Daily mode
7. Switching to Daily/Endless tab mid-raid → normal game resumes, socket disconnects cleanly
8. Run: `bun run lint && bun run format:check && bunx tsc --noEmit`
