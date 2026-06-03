# Full Typing Metrics (monkeytype-style) — Design

**Date:** 2026-06-03
**Branch:** `feature/full-typing-metrics`
**Status:** Approved (design)

## Goal

Track every per-test typing metric monkeytype captures **except per-keystroke timing**, persist
them on every solo session, and surface a small subset in the existing UI. Data accrues from day
one so richer displays (graphs, history detail) can be built later as a separate project.

## Scope

**In scope:** Daily + Endless (solo). New metrics captured per saved unit — per monster-kill in
Endless, per 3-quote run in Daily — accumulated across the silent 50-word block refills that
already happen mid-fight.

**Out of scope:**
- **Per-keystroke timing** (keydown/keyup timestamps) → no `keySpacing`/`keyDuration`/key-spacing
  consistency / key stats. Explicit line we are not crossing this round.
- **Raids.** They have their own `raid_players` stats model.
- **Backfill.** Old `game_sessions` rows keep null metrics; new columns are nullable.
- **Graphs / per-session detail view.** Data is stored now; rich display is a later project.

## Metrics

### Captured & persisted

| Metric | Definition | Source |
|---|---|---|
| `wpm` (net) | correct chars ÷5 per min | existing — unchanged |
| `raw_wpm` | **all** typed chars (correct+incorrect+extra) ÷5 per min | new |
| `accuracy` | keystroke-level: `correctKeypresses / (correct+incorrect) * 100` | new reducer counters |
| `consistency` | `kogasa(CoV of raw-WPM-per-second)` | per-second sampler |
| `correct_chars` | chars in fully-correct words + correct spaces | char breakdown |
| `incorrect_chars` | wrong chars where input/target overlap | char breakdown |
| `extra_chars` | chars typed past a word's end (overflow) | char breakdown |
| `missed_chars` | target chars never reached (word left short) | char breakdown |
| `duration_seconds` | elapsed wall-clock of the saved unit | existing `elapsedMinutes` ×60 |
| `afk_seconds` | count of whole seconds with no keypress | per-second sampler |
| `chart_data` (JSON) | per-second arrays: `{ wpm: number[], raw: number[], err: number[] }` | per-second sampler |

### Formulas (match monkeytype exactly)

- **kogasa (consistency):** `cov = stdDev / mean` (population std dev, ÷n); `consistency =
  100 * (1 - tanh(cov + cov³/3 + cov⁵/5))`. `NaN`/empty → `0`. CoV taken over the `raw[]`
  per-second array.
- **accuracy:** `correct / (correct + incorrect) * 100`, empty → `100`, rounded to integer.
- **raw_wpm:** `(allTypedChars / 5) / elapsedMinutes`, rounded.

## Architecture

Three layers: **collect** (frontend typing core), **persist** (payload + API + schema),
**display** (one overlay swap).

### 1. Collect

**a. Keystroke counters in the typing reducer** (`frontend/src/utils/typingReducer.ts`)
Add to `TypingState`: `keypressCorrect`, `keypressIncorrect` (integers, counts only — **no
timestamps**). Increment on each character-input action: correct keypress → `keypressCorrect++`,
wrong/overflow keypress → `keypressIncorrect++`. Reset with the rest of typing state on new
text/run. These are pure counters; they do not gate combo/damage (that stays on the existing
`characterMistake` event).

**b. Char breakdown** (`frontend/src/utils/wordAnalysis.ts`)
Extend `WordAnalysisResult` with `correctChars`, `incorrectChars`, `extraChars`, `missedChars`.
Compute them in the existing single pass over `charStatus` (already iterates words/chars):
- `correctChars` — chars in correct words + counted spaces (already effectively `totalCharsIncludingSpaces`'s basis; split out cleanly).
- `incorrectChars` — positions with status `incorrect`/`skipped` within reached words.
- `extraChars` — `sum(overflow[boundary].length)` for reached words.
- `missedChars` — for a reached word left short of its target length, the untyped tail count.
`totalCharsIncludingSpaces` and the existing correct/incorrect **word** counts are unchanged
(WPM and XP keep their current behavior).

**c. Per-second sampler** (new hook `frontend/src/hooks/usePerSecondSampler.ts`)
A 1 Hz interval (started on fight/run start, cleared on finalize/reset) that each tick pushes one
snapshot: net WPM so far, raw WPM so far, errors-this-second (delta of cumulative
`keypressIncorrect`). Tracks whether any keypress occurred in the tick → AFK seconds. Arrays
capped at 300 entries (drop further samples; a daily 3-quote run is the only thing approaching
this — log if capped, never silently truncate without the cap being explicit).

**d. Accumulation across block refills** (`frontend/src/hooks/useFightStats.ts`)
Extend `FightAccum` and `finalizeFightStats` to also fold the new char-breakdown fields and to
carry the keypress counters + per-second arrays through silent block refills (same pattern as the
existing `chars/correct/incorrect` fold). On `finalize`, compute `accuracy`, `raw_wpm`,
`consistency`, `afk_seconds`, and assemble `chart_data`.

`CompletionStats` (`frontend/src/types/completion.ts`) gains the new fields so both the Endless
(`finalizeFightStats`) and Daily (`useTypingCompletion`) paths produce the same shape.

### 2. Persist

**a. Payload** (`frontend/src/types/completion.ts` `SessionPayload`)
Add: `rawWpm`, `accuracy`, `consistency`, `correctChars`, `incorrectChars`, `extraChars`,
`missedChars`, `durationSeconds`, `afkSeconds`, `chartData` (object). All optional in the type so
older code paths compile, but populated by both handlers.

**b. Completion handlers**
- `frontend/src/handlers/EndlessCompletionHandler.ts` — include new fields from the finalized
  fight stats.
- `frontend/src/handlers/DailyCompletionHandler.ts` — same; note daily `wpm` stays the rounded
  3-quote average (unchanged), and the new per-second/char fields aggregate across the 3 quotes
  the same way `useFightStats` aggregates across blocks.

**c. API client** (`frontend/src/hooks/useApi.ts`) — pass the new fields through `POST /sessions`.

**d. Backend validation + insert** (`backend/src/handlers/sessions.ts`)
Extend `sessionSchema` (all new fields **optional**, bounded: `rawWpm` int 0–600, `accuracy`
0–100, `consistency` 0–100, char counts int 0–10000, `durationSeconds` 0–3600, `afkSeconds`
0–3600, `chartData` object of three number arrays each ≤300 length). Insert into the new columns.
XP logic (`calculateXpDelta`) is **unchanged** — still keyed off `incorrectWords`/`wpm`/`difficulty`.
`chartData` stored as JSON string (`JSON.stringify` on insert).

**e. Schema + migration** (`backend/src/db/schema.ts` + new Drizzle migration)
Add to `gameSessions` (all nullable, no defaults so old rows are valid):
`rawWpm`, `accuracy`, `consistency`, `correctChars`, `incorrectChars`, `extraChars`,
`missedChars`, `durationSeconds`, `afkSeconds` (all `integer`), `chartData` (`text`, JSON).
Generate migration via `drizzle-kit`; CD applies it on merge to `main`.

### 3. Display (minimal)

`frontend/src/components/KillResultOverlay.tsx` — swap the "ACCURACY" value from the current
word-level `accuracyPct(correctWords, incorrectWords)` to the new keystroke-level `accuracy`.
No new rows, no graphs. Everything else captured this round is stored only.

## Data flow

```
keystroke → typingReducer (keypressCorrect/Incorrect++)
          → usePerSecondSampler (1 Hz: wpm/raw/err snapshots, afk)
silent block refill → useFightStats.foldBlock (chars, words, char-breakdown carried)
monster death / 3rd quote → finalize → CompletionStats (+ accuracy, raw_wpm, consistency, chart_data, afk)
          → SessionPayload → useApi POST /sessions
          → backend validate → insert game_sessions (new columns) → XP unchanged
overlay → reads accuracy (keystroke-level) from CompletionStats
```

## Testing

- `wordAnalysis.test.ts` — add cases for `correctChars`/`incorrectChars`/`extraChars`/`missedChars`
  (correct word, word with wrong char, word with overflow, word left short).
- `useFightStats.test.ts` — extend: new fields accumulate across folded blocks; accuracy/raw/
  consistency computed from accumulated counters; zero-time guard.
- New `consistency.test.ts` (or colocated) — kogasa against known monkeytype values (e.g. perfect
  even pacing → ~100; high variance → low; empty → 0).
- New `usePerSecondSampler.test.ts` — interval pushes one sample/sec, error delta, AFK tick
  counting, 300-cap behavior.
- Backend `sessions` test — payload with new optional fields validates and inserts; payload
  without them (old client) still succeeds; out-of-bounds rejected; `chartData` round-trips.
- Reducer test — keypress counters increment correctly and reset.

## Risks / notes

- **Sampler accuracy under tab-blur:** `setInterval` throttles in background tabs, skewing
  per-second arrays and AFK. Acceptable for v1 (typing requires focus); note for later.
- **`chart_data` size:** capped at 300 samples × 3 arrays; JSON stays small (<5 KB). Cap is
  explicit and logged, never silent.
- **No XP/WPM behavior change:** net WPM, word counts, and XP formula are untouched; this is
  purely additive capture plus one overlay number swap.
- **Old rows / old clients:** all new columns nullable, all new payload fields optional — no
  backfill, no break.
