# Endless Difficulty Dropdown + 4 Word-List Tiers

**Date:** 2026-06-01
**Status:** Approved, implementing
**Branch:** `feature/endless-difficulty-dropdown` → `dev`

## Problem

Endless "Beginner" maps to `english_1k.json` (1000 words), a written/educational
frequency list that includes uncommon-feeling words like `oxygen`, `syllable`,
`fraction`. It feels harder than "Beginner" implies. Separately, the difficulty
picker is a 3-button segmented control with no room to grow.

## Goal

1. Make Beginner genuinely easy by using monkeytype's 200-word `english.json`.
2. Replace the segmented difficulty control with a dropdown so the catalog can grow.

Out of scope for v1: punctuation/numbers modifiers, other languages.

## Tier System (4 word lists)

| Value          | Dropdown label      | Word list             |
| -------------- | ------------------- | --------------------- |
| `beginner`     | Beginner (200)      | `english.json` (new)  |
| `common`       | Common (1k)         | `english_1k.json`     |
| `intermediate` | Intermediate (5k)   | `english_5k.json`     |
| `advanced`     | Advanced (10k)      | `english_10k.json`    |

`beginner` shifts from 1k → 200 (the fix). New value `common` takes the 1k slot.

## Changes

### 1. Data file
Add `frontend/src/static/english/english.json` — the monkeytype default English
(200 words, ordered by frequency), converted to the repo schema
`{ name, orderedByFrequency, words[] }`. Frontend-only; **backend untouched**.
The wordlist-sync invariant (`backend/english_1k` ↔ `frontend/english_1k`) is
unaffected because raid still uses `english_1k`, which does not change.

### 2. Types
Add `'common'` to the `endlessDifficulty` union in:
- `frontend/src/context/GameContext.ts` (type + default — default stays `'beginner'`)
- `frontend/src/hooks/useEndlessSettings.ts` (union, `VALID_DIFFICULTIES`, default)
- `frontend/src/utils/textGenerator.ts` (param union + `switch`)

No localStorage migration: every previously stored value remains valid. The
meaning of a stored `beginner` intentionally shifts to the easier 200-word list.

### 3. textGenerator switch
```
beginner     -> english.json   (200)
common       -> english_1k     (1000)
intermediate -> english_5k     (5000)
advanced     -> english_10k    (10000)
```

### 4. New component `DifficultyDropdown.tsx`
Replaces the inline difficulty buttons in `EndlessOptions.tsx`. Custom themed
dropdown, no new deps:
- Trigger button: current label + chevron.
- Absolutely-positioned menu, 4 options, checkmark on active.
- Click-outside-to-close; keyboard accessible (Enter/Space/Escape).
- Matches existing dark/light theme tokens.
- Word-count `[10 25 50 100]` segmented control stays unchanged to its left.

### 5. Cleanup
Delete `frontend/src/components/DifficultySelector.tsx` — dead code (nothing
imports it; `EndlessOptions` renders its own buttons).

## Verification (frontend CI order)
install → lint → format:check → typecheck → test → build, then a visual check in
the dev server (dropdown opens, selects, persists across reload, text generates
from the right list).
