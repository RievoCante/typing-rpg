# Raid Word Exhaustion Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise per-player raid text from 25 to 75 words via a new `WORDS_PER_PLAYER` constant so the boss is actually killable in 2-player and 3-player raids.

**Architecture:** One-line backend change (`generateText(25)` → `generateText(WORDS_PER_PLAYER)`) plus a new constant declaration. No frontend, protocol, schema, or XP changes. Doc updates in three places (canonical spec in the AI Brain vault, project CLAUDE.md, and game-loop comment in the spec).

**Tech Stack:** Cloudflare Workers Durable Object (`backend/src/rooms/RaidRoom.ts`), vitest, bun.

**Spec:** `/Users/rievo/Workspace/typing-rpg/docs/superpowers/specs/2026-05-27-raid-word-exhaustion-fix-design.md`

---

## Task 1: Add failing test for 75-word generation

**Files:**
- Modify: `/Users/rievo/Workspace/typing-rpg/backend/src/rooms/RaidRoom.test.ts`

The test asserts that when the host starts a game, each player's generated text contains exactly 75 words. The current code generates 25, so the test fails first — that's the red of the red-green-refactor cycle.

- [ ] **Step 1.1: Add the failing test**

Open `/Users/rievo/Workspace/typing-rpg/backend/src/rooms/RaidRoom.test.ts`. Find the existing test `it('uses flat 100 HP boss (no scaling per player count)', ...)` around line 61. Insert this new test directly after that block (before the `it('decreases boss HP by WORD_DAMAGE=1 on word_complete', ...)` test):

```ts
  it('generates WORDS_PER_PLAYER-length text (75 words) per player on game start', () => {
    const ws1 = { send: vi.fn() } as any;
    const ws2 = { send: vi.fn() } as any;
    (room as any).handlePlayerJoin(ws1, { userId: 'u1', username: 'Alice' });
    (room as any).handlePlayerJoin(ws2, { userId: 'u2', username: 'Bob' });
    (room as any).handleStartGame(ws1);
    const text1 = (room as any).state.texts.get('u1') as string;
    const text2 = (room as any).state.texts.get('u2') as string;
    expect(text1.split(' ').length).toBe(75);
    expect(text2.split(' ').length).toBe(75);
  });
```

- [ ] **Step 1.2: Run the test to verify it fails**

Run:
```bash
cd /Users/rievo/Workspace/typing-rpg/backend && node_modules/.bin/vitest run src/rooms/RaidRoom.test.ts -t "generates WORDS_PER_PLAYER-length text"
```

Expected output: 1 test failed with an assertion like `expected 25 to be 75` (because the current code still calls `generateText(25)`).

---

## Task 2: Add `WORDS_PER_PLAYER` constant and wire it into game start

**Files:**
- Modify: `/Users/rievo/Workspace/typing-rpg/backend/src/rooms/RaidRoom.ts`

Add a new constant alongside the existing game constants block, then update the single call site in `handleStartGame`.

- [ ] **Step 2.1: Add the `WORDS_PER_PLAYER` constant**

Open `/Users/rievo/Workspace/typing-rpg/backend/src/rooms/RaidRoom.ts`. Find the existing constants block at lines ~43–50 (it contains `BOSS_MAX_HP = 100`, `WORD_DAMAGE = 1`, `MISTAKE_DAMAGE_MIN = 5`, `MISTAKE_DAMAGE_MAX = 15`, etc.). Add this new line within that block (placement: directly after `const WORD_DAMAGE = 1;`):

```ts
const WORDS_PER_PLAYER = 75;
```

The block should look like:

```ts
const BOSS_MAX_HP = 100;
const WORD_DAMAGE = 1;
const WORDS_PER_PLAYER = 75;
const BOSS_ATTACK_INTERVAL_MS = 6000;
const BOSS_ATTACK_DAMAGE = 10;
const MISTAKE_DAMAGE_MIN = 5;
const MISTAKE_DAMAGE_MAX = 15;
```

(Adjust ordering to match whatever the existing constants look like — the surrounding constants and ordering may differ slightly; the point is `WORDS_PER_PLAYER = 75` lives in that block.)

- [ ] **Step 2.2: Replace the magic number at the call site**

In the same file, find line ~359 inside `handleStartGame`:

```ts
this.state.texts.set(p.userId, generateText(25));
```

Replace with:

```ts
this.state.texts.set(p.userId, generateText(WORDS_PER_PLAYER));
```

- [ ] **Step 2.3: Run the new test to verify it passes**

```bash
cd /Users/rievo/Workspace/typing-rpg/backend && node_modules/.bin/vitest run src/rooms/RaidRoom.test.ts -t "generates WORDS_PER_PLAYER-length text"
```

Expected: 1 test passed.

- [ ] **Step 2.4: Run the full backend test suite**

```bash
cd /Users/rievo/Workspace/typing-rpg/backend && node_modules/.bin/vitest run
```

Expected: 37/37 tests pass (36 previous + 1 new). If anything else fails, stop and investigate — no other test should be affected by this change.

- [ ] **Step 2.5: Run typecheck**

```bash
cd /Users/rievo/Workspace/typing-rpg/backend && node_modules/.bin/tsc --noEmit
```

Expected: clean (no output, exit 0).

- [ ] **Step 2.6: Commit the code change**

```bash
cd /Users/rievo/Workspace/typing-rpg && git add backend/src/rooms/RaidRoom.ts backend/src/rooms/RaidRoom.test.ts && git commit -m "$(cat <<'EOF'
fix(raid): raise per-player text to 75 words so boss is killable

Current 25-word texts cap total achievable damage at 50 (2 players) or
75 (3 players) against a 100 HP boss, making victory mathematically
impossible. Introduces WORDS_PER_PLAYER=75 constant; under that, boss
attacks (10 dmg every 6s) become the binding constraint instead of
text length, restoring the spec's intended pacing.

Spec: docs/superpowers/specs/2026-05-27-raid-word-exhaustion-fix-design.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: commit succeeds, working tree clean for the modified files.

---

## Task 3: Update project CLAUDE.md

**Files:**
- Modify: `/Users/rievo/Workspace/typing-rpg/CLAUDE.md`

The engineering rules file currently advertises "25-word texts" as a critical-rule fact. Update it to match the new constant.

- [ ] **Step 3.1: Edit the Critical Rules section**

Open `/Users/rievo/Workspace/typing-rpg/CLAUDE.md`. Find the bullet under "Critical Rules" that reads:

```
- **Raid**: min 2 / max 3 players, 25-word texts, cooperative boss battle.
```

Replace with:

```
- **Raid**: min 2 / max 3 players, 75-word texts, cooperative boss battle.
```

- [ ] **Step 3.2: Commit**

```bash
cd /Users/rievo/Workspace/typing-rpg && git add CLAUDE.md && git commit -m "$(cat <<'EOF'
docs: bump raid text length to 75 words in CLAUDE.md

Matches WORDS_PER_PLAYER constant introduced in RaidRoom.ts.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Update canonical feature spec in the AI Brain vault

**Files:**
- Modify: `~/Workspace/ai-brain/business/typing-rpg/canonical/features/raid-boss.md`

The canonical spec lives in a separate vault repo. Three places mention 25 words and need updating.

- [ ] **Step 4.1: Update the Game constants table**

Open `~/Workspace/ai-brain/business/typing-rpg/canonical/features/raid-boss.md`. Find the "Game constants" table around lines 40–52. Add a new row directly under the `WORD_DAMAGE` row:

Current table (excerpt):

```markdown
| `BOSS_MAX_HP` | 100 | static, does not scale with party size |
| `BOSS_ATTACK_INTERVAL_MS` | 6000 | boss tick every 6s |
| `BOSS_ATTACK_DAMAGE` | 10 | dealt to **every alive player** per tick |
| `WORD_DAMAGE` | 1 | one correct word → boss HP -1 |
| `MISTAKE_DAMAGE_MIN` | 5 | inclusive |
```

After edit:

```markdown
| `BOSS_MAX_HP` | 100 | static, does not scale with party size |
| `BOSS_ATTACK_INTERVAL_MS` | 6000 | boss tick every 6s |
| `BOSS_ATTACK_DAMAGE` | 10 | dealt to **every alive player** per tick |
| `WORD_DAMAGE` | 1 | one correct word → boss HP -1 |
| `WORDS_PER_PLAYER` | 75 | per-player text length |
| `MISTAKE_DAMAGE_MIN` | 5 | inclusive |
```

- [ ] **Step 4.2: Update the game-loop step 1 comment**

In the same file, find the game-loop pseudocode block (around line 56–92). Inside step 1:

Current:

```
   → Each player gets a fresh 25-word text (see "Text generation").
```

After edit:

```
   → Each player gets a fresh 75-word text (see "Text generation").
```

- [ ] **Step 4.3: Update the Text generation section**

Find the "Text generation" section around lines 102–107.

Current:

```markdown
- On `start_game`, `RaidRoom.generateText()` picks 25 random words from the 1k list (uniform random; frequency-ordered list is fine since we sample uniformly) and assigns one text per player.
```

After edit:

```markdown
- On `start_game`, `RaidRoom.generateText()` picks 75 random words from the 1k list (uniform random; frequency-ordered list is fine since we sample uniformly) and assigns one text per player. The word count is set by `WORDS_PER_PLAYER`.
```

- [ ] **Step 4.4: Bump the spec's `updated` frontmatter date**

At the top of the file, find:

```yaml
updated: 2026-05-27
```

If the date is already `2026-05-27`, leave it. Otherwise update to today's date in `YYYY-MM-DD` format.

- [ ] **Step 4.5: Commit in the vault (if it is a git repo)**

Run:

```bash
cd ~/Workspace/ai-brain && git rev-parse --is-inside-work-tree 2>/dev/null && echo "is-git-repo" || echo "not-git-repo"
```

If output is `is-git-repo`:

```bash
cd ~/Workspace/ai-brain && git add business/typing-rpg/canonical/features/raid-boss.md && git commit -m "$(cat <<'EOF'
typing-rpg(raid): document WORDS_PER_PLAYER=75 constant

Adds the constant to the game-constants table and updates the two
prose references (game loop step 1, text-generation section) from
"25 words" to "75 words". Matches the implementation in
backend/src/rooms/RaidRoom.ts.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

If output is `not-git-repo`: skip the commit; the file save is sufficient. Note the change in your handoff.

---

## Task 5: Verification — full CI parity locally

**Files:** none modified — this is a verification gate.

Per `/Users/rievo/Workspace/typing-rpg/CLAUDE.md`, verification follows CI order: install → typecheck → test for backend; install → lint → format:check → typecheck → test → build for frontend. The frontend is unchanged but we run it anyway to catch any accidental cross-effect.

- [ ] **Step 5.1: Backend typecheck + test (re-confirm)**

```bash
cd /Users/rievo/Workspace/typing-rpg/backend && node_modules/.bin/tsc --noEmit && node_modules/.bin/vitest run
```

Expected: typecheck clean, 37/37 tests pass.

- [ ] **Step 5.2: Frontend lint, format, typecheck, test, build**

```bash
cd /Users/rievo/Workspace/typing-rpg/frontend && node_modules/.bin/eslint "src/**/*.{ts,tsx}" && node_modules/.bin/prettier --check "src/**/*.{ts,tsx,css}" && node_modules/.bin/tsc --noEmit && node_modules/.bin/vitest run && node_modules/.bin/vite build
```

Expected:
- ESLint: 3 pre-existing warnings only (in `PixelArtBackground.tsx` ×2, `useCompletionDetection.ts` ×1). No new warnings, no errors.
- Prettier: clean.
- TypeScript: clean.
- Vitest: 7/7 pass.
- Vite build: succeeds with 3 pre-existing rollup warnings about `RaidStats`/`RaidState` not exported from `useRaidWebSocket.ts` (vestigial routes — deferred cleanup).

If any of these emit *new* failures or warnings beyond the pre-existing list above, stop and investigate before proceeding.

- [ ] **Step 5.3: Manual playtest (final acceptance gate)**

Start the backend dev server and frontend dev server in two terminals (commands per the project's existing dev workflow — do not start them from this plan if user is doing it themselves). Open two browser tabs to the frontend, create a raid in one tab, join from the other, start the game, and confirm:

- Both players' text panels show 75 words (count visually or by completing the run).
- A perfect 2-player run ends in victory (boss HP reaches 0 before either player exhausts their text *and* before either player dies to passive boss attacks).
- A run with ordinary typos still has a path to victory — confirms the new headroom isn't a mirage.

If the playtest reveals an issue, file it as a deferred bug rather than rolling back; the headline fix (boss is killable) is correct and the playtest may surface a separate problem.

---

## Self-review notes

- **Spec coverage:** Spec defines exactly one code change (Task 2), three doc updates (Task 3 for CLAUDE.md, Task 4 for canonical spec; the design doc itself was committed during brainstorming). The "Not changed" list in the spec — frontend, protocol, schema, XP, tests — is enforced by the task list: no task touches any of those files.
- **Placeholder scan:** All code and shell commands are concrete. No "TBD", no "add error handling", no "similar to Task N".
- **Type consistency:** `WORDS_PER_PLAYER` is the only new identifier; named consistently across Task 1 (test), Task 2 (code), Task 4 (spec doc).
