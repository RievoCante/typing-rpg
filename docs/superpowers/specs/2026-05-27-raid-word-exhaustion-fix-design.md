---
type: design-spec
venture: typing-rpg
feature: raid-boss
topic: word-exhaustion-fix
date: 2026-05-27
status: approved
supersedes: none
---

# Raid Word Exhaustion Fix — Design

## Problem

The current raid constants make the boss mathematically unkillable through correct typing alone:

- `WORD_DAMAGE = 1`, `BOSS_MAX_HP = 100`
- Each player gets a fixed text of 25 words → max 25 damage per player
- 2 players: 50 max damage vs 100 HP boss → impossible to win
- 3 players: 75 max damage vs 100 HP boss → impossible to win

Playtest 2026-05-27 confirmed the symptom: boss stayed alive at 66/100 HP after both players consumed all 25 words and were left staring at completed text with no path to victory.

The bug lives in the spec itself (`~/Workspace/ai-brain/business/typing-rpg/canonical/features/raid-boss.md` lines 40–52, 102–107) — the 25-word count predates the damage/HP math being settled.

## Solution

Raise the per-player word count from 25 to 75, codified as a new constant `WORDS_PER_PLAYER`.

### Why 75

- 2 players × 75 × 1 = 150 max damage → 50 dmg margin against 100 HP boss
- 3 players × 75 × 1 = 225 max damage → 125 dmg margin
- ~60 WPM typist clears 75 words in ~75s; boss does 10 dmg every 6s, so a 100 HP player dies from passive boss attacks at ~60s — **text length stops being the binding constraint**, which restores the spec's intended loop (race the boss's attacks, not the word count).

### Why not the alternatives

- **Lower `BOSS_MAX_HP` or raise `WORD_DAMAGE`:** still caps total achievable damage at the text-length × per-word product. Same root cause, just a different threshold. Tight 2-player runs have zero margin.
- **Continuous text streaming:** correct long-term direction (no artificial cap, matches "type until end-condition" feel), but requires new server→client message type, frontend text-append handling, backend per-player word-position tracking, and tests. Disproportionate effort for a bug fix; revisit as a deliberate enhancement.

## Changes

### Code (one file)

`backend/src/rooms/RaidRoom.ts`

1. Add a new constant alongside the existing game constants (current block at lines ~43–50):
   ```ts
   const WORDS_PER_PLAYER = 75;
   ```

2. Line 359, change:
   ```ts
   this.state.texts.set(p.userId, generateText(25));
   ```
   to:
   ```ts
   this.state.texts.set(p.userId, generateText(WORDS_PER_PLAYER));
   ```

The `generateText(wordCount: number = 25)` default is left untouched — it's only called from this one site and the default is unused now that the call passes the constant explicitly.

### Documentation

`~/Workspace/ai-brain/business/typing-rpg/canonical/features/raid-boss.md` (canonical spec in the vault):

- Game constants table (lines 40–52): add `WORDS_PER_PLAYER | 75 | per-player text length`
- Game loop step 1 (line 58): "fresh 25-word text" → "fresh 75-word text"
- Text generation section (lines 102–107): "picks 25 random words" → "picks 75 random words (per `WORDS_PER_PLAYER`)"

`/Users/rievo/Workspace/typing-rpg/CLAUDE.md`:

- Critical Rules: "25-word texts" → "75-word texts"

### Not changed

- **Frontend:** text rendering is length-agnostic; receives `texts[userId]` and renders whatever string arrives.
- **WebSocket protocol:** no message-type or payload changes.
- **DB schema:** no column changes.
- **XP formula:** `RAID_BASE_XP` and `RAID_DAMAGE_MULTIPLIER` are unaffected — top-performer XP rises slightly because top damage caps higher, which matches the harder-to-cap design intent.
- **Tests:** no existing test hardcodes 25 (verified by grep). New constant change is covered indirectly by existing RaidRoom tests that exercise `handleStartGame` and `handleWordComplete`.

## Verification

1. `cd backend && node_modules/.bin/tsc --noEmit` — clean.
2. `cd backend && bun test` — 36/36 still pass.
3. Manual 2-tab playtest: both players type their full 75-word text; boss dies before either runs out of words (assuming neither dies first to passive attacks).
4. Manual 2-tab playtest with deliberate typos: confirm a mediocre run still has a path to victory.

## Out of scope (deferred, again)

- Continuous text streaming (option C from the brainstorm) — file under future enhancement; only revisit if the new 75-word run feels artificially capped in practice.
- Backend reconnect handler for mid-game `phase !== 'lobby'` re-joins — still waiting on real `[raid-ws] close` logs from a recurrence before designing.
- Vestigial route + component cleanup (`RaidGamePage.tsx`, `RaidLobbyPage.tsx`, `RaidResults.tsx`, `useRaidWebSocket.ts`, `RaidPlayerLane.tsx`).
