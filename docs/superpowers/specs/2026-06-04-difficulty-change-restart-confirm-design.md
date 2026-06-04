# Difficulty change restarts the run (with confirm)

**Date:** 2026-06-04
**Mode affected:** Endless only (difficulty is Endless-only)

## Problem

Changing difficulty mid-run silently swapped the word pool on the next text
block — difficulty effectively changed during a live run. We don't want
difficulty to change during a run. Instead, changing difficulty should restart
the run, gated by a confirmation popup once the run is underway.

## Behavior

When the player selects a difficulty in `DifficultyDropdown`:

| Condition | Result |
|---|---|
| Same as current | No-op (close dropdown) |
| Different, run **not** started | Apply instantly, no popup |
| Different, run **started** | Open confirm modal; apply only on confirm |

**Run-started signal:** `hasStartedTyping || monstersDefeated > 0` (both in `GameContext`).

**Confirm modal copy:** title "Restart run?", body "Changing difficulty will
restart your current run. Your progress this run will be lost." Buttons
"Restart" (confirm) / "Keep playing" (cancel). Cancel is focused by default so a
stray Enter doesn't wipe the run. Esc / backdrop click = cancel.

**On confirm:** `setEndlessDifficulty(pending)` → dispatch a `restart-run`
window event → close modal + dropdown.

**On cancel:** close modal; difficulty and run unchanged.

## Architecture (Approach A — window event)

Mirrors the existing `monster-killed` `CustomEvent` pattern so the dropdown
doesn't need access to the monster-generation logic that lives in `GameContent`.

- **`resolveDifficultySelection(current, next, runStarted)`** — pure function
  exported from `DifficultyDropdown.tsx`, returns `'noop' | 'apply' | 'confirm'`.
  Holds the decision so it's unit-testable without a DOM.
- **`ConfirmDialog.tsx`** — generic, theme-aware blocking overlay reusing the
  `WeaponDropModal` overlay/card styling. Props: `title`, `message`,
  `confirmLabel`, `cancelLabel`, `onConfirm`, `onCancel`. `role="dialog"`,
  `aria-modal`, Esc/backdrop = cancel.
- **`DifficultyDropdown`** — holds `pendingDifficulty` state; reads
  `hasStartedTyping` / `monstersDefeated`; routes selections through
  `resolveDifficultySelection`; renders `ConfirmDialog` when confirming.
- **`GameContent` (App.tsx)** — `useEffect` listens for `restart-run` and calls
  the existing `handleDeathRestart()` (`resetGameState()` + `generateNewMonster(0)`).
  The difficulty change separately retriggers `TypingInterface`'s existing
  regen effect, so the fresh run starts on the new word pool — no double-spawn.

**Removed:** the silent mid-block word-pool swap. Difficulty now only changes
via this restart path.

## Tests

- `resolveDifficultySelection` — node unit tests for all three branches.
- `ConfirmDialog` — SSR smoke render (title/message/buttons present).
- Existing `DifficultyDropdown` SSR test stays green (handler not exercised in SSR).
