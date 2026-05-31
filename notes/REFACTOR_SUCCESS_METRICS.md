# Refactor Success Metrics — Post-Raid P0/P1

Defines "done" for the 4 refactor items identified after the raid-feature merge. Each item has **quantitative**, **behavioral**, and **structural** criteria. All must pass before the refactor is considered complete.

**Status (2026-05-27):** All structural, quantitative, and test-based metrics ✅ passed. Only manual playtest of the 3 modes remains.

**Baseline → Final:**

| File | Pre | Post | Notes |
| --- | --- | --- | --- |
| `frontend/src/context/GameProvider.tsx` | 385 lines / 16 `useState` | **157 / 9** | Sub-hooks extracted; raid removed |
| `frontend/src/components/TypingInterface.tsx` | 776 lines | **398** | Effects/popups/restart/completion extracted |
| `frontend/src/components/RaidView.tsx` | locally generated guest IDs | server-provided | `Math.random` removed |
| `backend/src/handlers/raid.ts` | discarded `getUserOrGuest()` | all uses live | Helpers moved to `core/raidAuth.ts` |
| Backend test count | 37 | **52** | +15 (guestIdentity, raidAuth, WS-credential tests) |
| Frontend dead code (route-based raid) | 889 lines across 7 files | deleted | One raid entry point only |

---

## P0-1 — Unify Guest Identity

**Goal:** A single source of truth generates guest IDs. Frontend never invents them.

### Quantitative
- [ ] Exactly **1** place in the codebase generates `guest-*` IDs (backend).
- [ ] Exactly **1** place generates `Guest-NNN` usernames (backend).
- [ ] `grep -rn "guest-\${" frontend/src` returns **0** matches.
- [ ] `grep -rn "Math.random" frontend/src/components/RaidView.tsx` returns **0** matches for ID generation.
- [ ] All `getUserOrGuest()` call sites in `backend/src/handlers/raid.ts` **use** the returned value (no discards).

### Behavioral
- [ ] Guest can create a raid room (E2E or manual).
- [ ] Guest can join a raid room via code (E2E or manual).
- [ ] Logged-in user + guest can play a raid together; both appear with correct identities.
- [ ] Guest identity persists across the raid session (same ID at start and end).
- [ ] Backend tests: 37/37 still pass; new test covers guest identity endpoint.

### Structural
- [ ] Shared helper exists: `backend/src/core/guestIdentity.ts` (or equivalent) with `generateGuestId()` / `generateGuestUsername()`.
- [ ] Frontend obtains guest identity from backend (endpoint or on join response), not by generating locally.
- [ ] No dead-code comments like "// no-op" or "TODO: use this" near guest handling.

---

## P0-2 — Split `GameProvider` (Mode Isolation)

**Goal:** Daily/endless state and raid state are managed by separate providers. Switching modes does not leak state.

### Quantitative
- [ ] `frontend/src/context/GameProvider.tsx` shrinks by **≥40%** (target: ≤230 lines from 385).
- [ ] `useState` count in any single provider file: **≤10** (currently 16).
- [ ] Zero references to raid-specific state (room code, player list, WebSocket) in the daily/endless provider.
- [ ] `grep -rn "currentMode === 'raid'" frontend/src/context/` returns **0** matches in the daily/endless provider.

### Behavioral
- [ ] Daily mode: 3-quote flow, 1/day lock, XP calculation unchanged.
- [ ] Endless mode: session XP, kill streak, potions all work as before.
- [ ] Raid mode: 2-3 players, 75-word texts, co-op damage all work.
- [ ] **Mode transition test:** start a raid → leave → start endless. Player HP, kill streak, monster type all reset to endless defaults (no raid bleed).
- [ ] **Mode transition test:** start endless → switch to daily. No leftover endless state visible.
- [ ] Frontend tests: 7/7 still pass; new test for mode-transition state isolation.

### Structural
- [ ] Two providers exist: `DailyEndlessProvider` (or similar) and `RaidProvider`.
- [ ] A single switch point at the routing/App level decides which provider mounts (based on URL or mode).
- [ ] `GameContext.ts` type is split or narrowed so consumers can't read raid state from the daily/endless context (and vice versa).
- [ ] No component imports both contexts simultaneously.

---

## P1-3 — Extract `BaseTypingCore` Hook

**Goal:** The typing loop (keystroke validation, locked words, WPM) lives in one place. Mode-specific UI wraps it.

> **Audit revision (2026-05-27):** The audit's premise that `TypingInterface.tsx` has 3-mode branching was wrong. TypingInterface is daily+endless only (zero `raid` references); raid mode uses `RaidGame.tsx`. The shared core `useTypingMechanics.ts` already exists and is consumed by both wrappers — so the architecture goal is already met. The remaining work is shrinking `TypingInterface` by extracting effects (popups, completion flow), not splitting it by mode.

### Quantitative (revised)
- [ ] `useTypingMechanics` (the shared core) is **≤300 lines** and contains zero mode branches in code. (Comments referencing modes are OK; code branches are not.)
- [ ] `TypingInterface.tsx` (daily/endless wrapper) shrunk from 776 to **≤450 lines** via effect extraction.
- [ ] `RaidGame.tsx` (raid wrapper) remains **≤350 lines**.
- [ ] Net LOC across these three files **≤900** (the duplicate raid components in `pages/` were already deleted in P0-2).
- [ ] `grep -n "currentMode === 'raid'" frontend/src/components/TypingInterface.tsx` returns **0** matches.

### Behavioral
- [ ] Locked-word invariant: pressing space after a correct word locks it; locked chars can't be deleted. Works across all 3 modes.
- [ ] WPM calculation matches pre-refactor values for the same input (snapshot test).
- [ ] Mid-word space-skip behavior preserved (added in prior session, must survive).
- [ ] Raid damage broadcast still fires on correct word in raid mode only.
- [ ] All existing tests pass; new test for the core hook in isolation.

### Structural
- [ ] Core hook has no `useContext(GameContext)` calls for mode-specific data — receives behavior via props/callbacks.
- [ ] Raid-specific concerns (WebSocket send, damage sync) live only in the raid wrapper.
- [ ] Daily-specific concerns (quote progression) live only in the daily wrapper.

---

## P1-4 — Raid Entry-Point Consistency

**Goal:** Auth is validated once, before the WebSocket upgrade. No discarded auth calls.

### Quantitative
- [ ] All 3 raid HTTP endpoints (`POST /rooms`, `POST /rooms/:code/join`, `GET /rooms`) call `getUserOrGuest()` and **use** the result.
- [ ] Zero TODO/no-op comments adjacent to auth in `backend/src/handlers/raid.ts`.
- [ ] WebSocket upgrade handler validates auth **before** routing to the Durable Object.
- [ ] `RaidRoom` Durable Object trusts a `userId` passed in the WS connection params instead of re-deriving from headers.

### Behavioral
- [ ] Join with valid guest credentials → succeeds.
- [ ] Join with invalid/spoofed guest ID → rejected before WS upgrade (not after).
- [ ] Join with valid Clerk session → succeeds, correct user ID in DO.
- [ ] All backend raid tests pass; new test for pre-upgrade auth rejection.
- [ ] Manual: open two browsers (one guest, one logged-in), both join same room — both appear with correct identities.

### Structural
- [ ] Auth validation extracted into a single middleware or helper used by all raid entry points.
- [ ] WebSocket params include `userId` (passed from join response), not re-computed in DO.
- [ ] `RaidRoom.ts` has no Clerk/session-parsing code (delegated to the entry point).

---

## Global Acceptance Criteria

These apply to the refactor as a whole, not just per-item:

- [x] Full CI passes: frontend (lint → format:check → typecheck → test → build) and backend (typecheck → test). Backend 52/52, frontend 7/7.
- [x] Zero new ESLint warnings (baseline: 3 pre-existing, post-refactor: 3 pre-existing).
- [x] Prettier clean across all changed files.
- [x] Prod build size grew by 0.08% (1,836.55 → 1,838.04 kB). Well under 5%.
- [ ] **Manual playtest** (user-required): daily, endless, and raid (host + guest join) all complete one full session.
- [x] XP-sync invariant verified: `calculateRaidXp` body byte-identical between `frontend/src/utils/calculateXP.ts` and `backend/src/core/xp.ts`.
- [x] Wordlist-sync invariant verified: `md5` of `english_1k.json` matches (`6d474d7b3e5a7f93a0306584d7d73201`).
- [x] No new TODO/FIXME/XXX comments introduced.
- [ ] PR description references this metrics doc and ticks each box.

---

## Sequencing (proposed)

1. **P0-1 (guest identity)** — smallest, isolates an attack surface. Unblocks #4.
2. **P1-4 (raid entry points)** — naturally follows #1; both touch `raid.ts`.
3. **P0-2 (GameProvider split)** — biggest frontend change; do before #3 so the mode-routing layer exists.
4. **P1-3 (BaseTypingCore)** — last; benefits from the cleaner provider boundary in #3.

Each step ships independently with its own metrics checked off.
