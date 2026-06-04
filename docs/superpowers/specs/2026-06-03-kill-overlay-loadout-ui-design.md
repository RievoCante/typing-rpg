# Endless: kill-driven result overlay + in-typing-area loadout picker

Date: 2026-06-03
Branch: `feature/kill-overlay-loadout-ui` (off `dev`)
Scope: **Frontend only.** No XP-formula change, no backend schema change. The
existing `calculateEndlessXp` and `/sessions` save are reused, only their
*timing* moves.

## Problem

Two UX issues in Endless mode:

1. **Loadout placement.** `WeaponLoadoutPanel` renders in `EndlessOptions`
   (inside `ModeSelector`), *above* the battle, so the LOADOUT chips visually
   overlap the monster and health bar.

2. **Result-overlay timing.** The SUPER FAST result card
   (`KillResultOverlay`) currently fires when the player finishes a 50-word
   **text block** — not when a monster dies. XP and the backend session-save are
   also tied to that block boundary. Monster death is a separate, silent
   respawn with no feedback. The player wants the result card to celebrate
   **each monster kill**, and SPACE on the card to reset the words for the next
   monster.

## Current behavior (baseline)

- Endless text is a stream of 50-word blocks (`ENDLESS_BLOCK_WORDS = 50`,
  `TypingInterface.tsx`). Each correct word deals combo damage to the monster's
  HP; HP — not the word pool — decides death.
- Monster HP per tier: normal 24, mini-boss 48, boss 90, ×1.5 elite / ×2 rare
  (`combatTuning.ts`). Cold damage ≈ 1/word, so **fights routinely exceed 50
  words** (a rare boss ≈ 180 words). Block boundaries are crossed mid-fight.
- `useCompletionDetection` flips `isCompleted` when `cursorPosition >=
  textLength`. `useTypingCompletion` (endless branch) then: computes per-block
  stats, fires the backend save + `calculateEndlessXp`, sets `killResult` +
  `awaitingContinue` (shows the overlay). It explicitly does **not**
  `incrementMonstersDefeated`.
- Monster death (`monsterHp <= 0`) is handled in `GameProvider`: a one-shot
  effect sets `isCurrentMonsterDefeated`, `incrementMonstersDefeated`, grants
  variant rewards / weapon drop. A 1.2s timer then clears the defeat flag, and
  `App.tsx` spawns the next monster when the flag falls true→false. No overlay.

## Target behavior

The **fight** (monster spawn → monster death) becomes the unit of feedback and
reward.

### Part A — Loadout picker in the typing area, as a start-the-run gate

- Remove `<WeaponLoadoutPanel />` from `EndlessOptions`. `EndlessOptions` keeps
  only the difficulty dropdown.
- Render the loadout picker as an **overlay inside the typing-area box** — the
  same absolute-inset slot used by the "Click to start fighting!" banner and
  `KillResultOverlay` — restyled as a dark rounded card to match.
- The picker is shown when a **run has not yet started** (a new
  `loadoutPending` flag, see below) over a blurred, non-interactive typing
  surface. The "Click to start fighting!" banner is suppressed while the picker
  is up.
- **Clicking a weapon (or Fists) confirms the loadout and starts the run:** it
  calls `setLoadout(id)`, clears `loadoutPending`, and focuses the typing
  surface. The WPM clock still starts on the first keystroke (unchanged).
- The picker re-appears **only at run start** — entering Endless mode and after
  **player death** (the run resets to the loadout). It does **not** re-appear
  between monster kills within a run. (Decision: "Run start only".)
- Logged-out users: only **Fists** is selectable (others locked); clicking Fists
  starts the run. The "Sign in to collect & equip weapons" hint stays.

`loadoutPending` lifecycle (Endless only):
- Set `true` when Endless mode is (re)entered and after the player-death reset.
- Set `false` when the player clicks a loadout chip (run starts).
- Daily/raid never set it (no picker).

### Part B — Result overlay on kill, with fight-scoped stats

1. **Block boundary = silent seamless refill.** In Endless, when
   `cursorPosition >= textLength` and the monster is still alive, regenerate the
   text block with no overlay, no pause, no fight-stats reset. (Reuses the
   existing fade transition.) The endless path no longer routes block
   completion through the overlay/save logic in `useTypingCompletion`.

2. **Fight-scoped stats accumulator** (new `useFightStats` hook). Across the
   whole fight it tracks:
   - `fightStartTime` — set on the first keystroke of the fight.
   - `accumChars`, `accumCorrect`, `accumIncorrect` — totals from each
     **completed (silently refilled) block** this fight.
   - At any moment, fight totals = `accum*` + the in-progress block's partial
     stats from `analyzeWords(text, charStatus, overflow)`.
   - On a silent refill, the just-finished block's stats are folded into
     `accum*` before the text resets.
   - WPM uses the **existing formula** (`totalCharsIncludingSpaces / 5 /
     elapsedMinutes`) over fight totals and `Date.now() - fightStartTime`.
   - Accuracy = `correct / (correct + incorrect)` over fight totals.

3. **Monster death → result overlay.** `GameProvider` still detects
   `monsterHp <= 0`, grants rewards, and plays the **1.2s death animation**.
   The respawn is **gated behind continue** instead of auto-firing: after the
   animation, surface a death signal to `TypingInterface`, which:
   - reads fight totals, computes WPM / accuracy,
   - calls `calculateEndlessXp(fightIncorrect, fightWpm, endlessDifficulty)`,
   - fires the backend session save (background, same handler as today),
   - sets `killResult` + `awaitingContinue` → overlay shows. (Decision: overlay
     **after** the 1.2s death animation.)

4. **SPACE / click on the overlay → next fight.** Clears the overlay, triggers
   the next-monster spawn, regenerates the words (fresh block), and resets the
   fight accumulator + `fightStartTime`.

5. **Daily mode is untouched** — it keeps quote-completion → overlay → next
   quote.

## Respawn-gating change (GameProvider + App)

Today `App.tsx` spawns the next monster automatically when the defeat flag falls
true→false (after the 1.2s timer). New flow:

- On death: set defeat flag, grant rewards, play the 1.2s animation as today.
- After the animation, **do not auto-spawn.** Hold in a "defeated, awaiting
  continue" state and signal `TypingInterface` to show the overlay.
- The next spawn is triggered **only** by the overlay's continue action
  (SPACE/click) via an explicit `continueAfterKill()` (or equivalent) that calls
  `generateNewMonster` + word refill + fight-stats reset.

Exact wiring (event vs. context flag vs. callback) is an implementation
decision for the plan; the contract is: **death no longer auto-respawns;
continue does.**

## Components & responsibilities

| Unit | Responsibility | Change |
|------|----------------|--------|
| `EndlessOptions.tsx` | Pre-run difficulty only | Remove loadout panel |
| `WeaponLoadoutPanel.tsx` | Loadout picker UI | Restyle as in-typing-area card; click confirms + starts run; takes an `onConfirm`/start callback |
| `TypingInterface.tsx` | Battle surface, overlays, run/fight orchestration | Mount loadout overlay (gated by `loadoutPending`); silent refill on block end; drive fight stats; show kill overlay on death signal; continue → next fight |
| `useFightStats.ts` (new) | Fight-scoped chars/correct/incorrect/startTime accumulator | New |
| `GameProvider.tsx` | Monster HP, death, respawn | Gate respawn behind continue; expose death-awaiting signal + `loadoutPending`/continue API |
| `App.tsx` | Monster spawn wiring | Spawn on continue, not on defeat-flag fall |
| `useTypingCompletion.ts` / `EndlessCompletionHandler` | Completion → save/XP/overlay | Endless: stop firing overlay/save on block completion; expose a reusable "finalize fight" save path callable on kill |

## Edge cases

- **Player dies mid-fight.** Player-death already short-circuits typing
  (`isPlayerDead`). On death the run resets and `loadoutPending` is set true so
  the picker re-appears for the next run. No kill overlay is shown.
- **Monster dies exactly at a block boundary.** Death handling runs off the HP
  effect, independent of block completion; the silent-refill path checks
  "monster alive" so it won't refill a dead monster's text.
- **Logged-out player.** No vault; only Fists. Kill overlay still shows
  (client-side stats); session save no-ops/falls back exactly as the current
  endless save does for guests.
- **Very fast kill (<1 block, e.g. a few words).** Fight totals come from the
  in-progress block partial alone; `accum*` stays zero. Works unchanged.
- **WPM with zero elapsed time** (instant): guarded by the existing
  `elapsedMinutes > 0` check (returns 0).

## Out of scope

- XP formula changes (frontend/backend `calculateXP`↔`xp.ts` invariant
  untouched).
- Backend schema / new endpoints.
- Mid-run weapon swapping, multi-slot loadout, guest vault, weapon visuals on
  the avatar (all previously deferred).
- Daily/raid behavior.

## Verification

- Frontend CI order: `bun install && bunx tsc -b && bun run lint && bun run
  format:check && bun run test && bun run build`.
- New unit tests: `useFightStats` accumulation across simulated block refills;
  fight WPM/accuracy/XP computed at a kill matches expected values.
- Manual (Endless, signed in): loadout card shows in the typing area at run
  start over the blurred surface; clicking a weapon starts the run; words refill
  silently mid-fight with no pause; killing a monster shows SUPER FAST with that
  fight's WPM/accuracy/XP after the death animation; SPACE resets the words and
  spawns the next monster; dying resets to the loadout picker. Logged-out:
  Fists-only picker, kill overlay still shows.
