# Typing Overflow (Monkeytype-style) — Design

**Date:** 2026-06-01
**Status:** Approved
**Modes affected:** Daily, Endless, Raid (shared components)

## Problem

When a player types more characters than the current word contains, the cursor
walks forward into the *following* words' character slots, marking them red and
effectively skipping/consuming them. (Observed: typing `asfdasfsdfsafsdfsaf` on
the first word turned `too off we child order` red.)

Monkeytype instead **appends** the extra letters to the *active* word (rendered
in red), pushing the rest of the prompt right and wrapping to a new line when the
line fills. We want that behavior.

## Key constraints discovered

- **Completion is tied to `cursorPosition >= textLength`** (`useCompletionDetection.ts`).
  Finishing the last word ends the test, so the **last word cannot overflow**.
  Overflow is therefore *only* a mid-text event: it occurs when the cursor sits on
  a **boundary space** (`text[cursor] === ' '`) and the player types a non-space
  character.
- **Scoring is already word-based** (`analyzeWords`): a word contributes to WPM only
  if every char is `correct`/`locked`. So "overflow = error" needs only: force any
  word that carries overflow to be **incorrect**. It then contributes 0 WPM credit
  and +1 to `incorrectWords` (which already drives the monster-attack penalty). No
  new accuracy plumbing, no XP/backend contract change (WPM stays chars/5/min).
- Text renders in `font-mono`, so **rendered width == character count is exact**;
  line wrapping stays char-count based.

## Decisions (from brainstorming)

1. **Overflow only on the active word.** Extra letters belong to the current word and
   must not consume following words. Keep the locked-word mechanic and word-skip-on-space.
2. **Monkeytype-style scoring.** Overflow letters count as errors: the word becomes
   incorrect and never adds WPM/correct-char credit.
3. **All modes at once.** Daily, Endless, Raid share `TypingText` + `useTypingMechanics`.

## Architecture

The mechanics and layout logic are extracted into **pure modules** so they can be
unit-tested in the repo's node test environment (which has no DOM/testing-library):

- `utils/typingReducer.ts` — pure typing engine. Plain-object state
  (`charStatus`, `typedChars`, `cursorPosition`, `overflow`) + `inputChar` /
  `backspace` / `wordDeletion` / `spaceBar`, each returning `{ state, events }`.
  `useTypingMechanics` becomes a thin React shell that holds the state and fires
  callbacks from the returned events.
- `utils/typingLines.ts` — pure layout. `buildTypingLines(text, overflow, max)`
  returns display lines of tokens (`orig` | `overflow`) with `origStart`/`origEnd`
  bookkeeping for the cursor-line/viewport math. `TypingText` consumes it.

### Overflow state

`overflow: Record<number, string[]>` — sparse map from a **boundary space index**
(the space immediately after a word) to the extra letters typed there. Cleared on reset.

### Mechanics (`typingReducer.ts`)

- `inputChar`: if `text[cursor] === ' '` and key is non-space → append to
  `overflow[cursor]` (capped at `MAX_OVERFLOW = 20`), emit `characterMistake`, **do
  not advance**. Otherwise unchanged. Guarded so the cursor never passes `text.length`.
- `backspace`: if `overflow[cursor]` non-empty → pop one extra letter (no cursor move);
  else unchanged (respects locked chars).
- `spaceBar`: a boundary word carrying overflow is **incorrect** → emit `wordMistake`,
  lock the boundary space, advance (extras stay rendered). Correct/incorrect base-word
  paths and the mid-word skip path unchanged.
- `wordDeletion`: also clears overflow on the boundary it starts from.

### Scoring (`wordAnalysis.ts` + `usePerformanceTracking.ts`)

`analyzeWords(text, charStatus, overflow?)` forces any word whose trailing-boundary
bucket is non-empty to be incorrect. `usePerformanceTracking` threads `overflow` into
both the live and final calls (keeping live/final WPM aligned). Backward compatible —
`overflow` defaults to `{}`.

### Render (`TypingText.tsx`)

Consumes `buildTypingLines`. Overflow tokens render in red with the error underline.
The cursor still anchors on the original token whose index === `cursorPosition`; because
overflow tokens are emitted before the boundary space, a left-border cursor on that space
naturally sits after the last overflow letter. The 3-line scrolling viewport and
cursor-line tracking are preserved (now keyed by `origStart`/`origEnd`).

### Wiring

`TypingInterface` passes `overflow` to both `TypingText` and `usePerformanceTracking`.
`RaidGame` passes `overflow` to `TypingText`. Raid boss damage stays per-word
(`onWordMistake`), so an overflow word triggers exactly one boss attack on space.

## Testing

- `typingReducer.test.ts` — overflow append/no-advance, cap, backspace pops overflow,
  space penalizes overflow word + keeps extras, correct-word lock, incorrect base word,
  mid-word skip, word deletion (incl. overflow clear, locked boundary).
- `wordAnalysis.test.ts` — overflow word counted incorrect & excluded from WPM credit;
  no-overflow path unchanged.
- `typingLines.test.ts` — wrapping by char count, overflow inserted before boundary
  space, overflow width pushes wrapping, orig-index bookkeeping.

## Out of scope

- Backspacing across word boundaries / removing the locked-word mechanic (kept).
- Last-word overflow (impossible by completion design).
- Proportional-font layout (we are monospace).
