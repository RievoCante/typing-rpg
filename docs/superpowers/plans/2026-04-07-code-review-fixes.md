# Code Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the five critical/important issues identified in the April 2026 code review: CORS restriction, leaderboard SQL aggregation, PRNG-seeded daily quotes, awaited session saves with server-side xpDelta, and deletion of the duplicated XP frontend utility.

**Architecture:** Backend fixes (CORS, leaderboard) are independent. Frontend fixes are chained: the PRNG quote fix is standalone; the session-save fix threads through `DailyCompletionHandler` → `CompletionResult` type → `TypingInterface`. Deleting `calculateXP.ts` is the last step after both handlers consume server xpDelta.

**Tech Stack:** Hono (backend), Drizzle ORM + D1 SQLite, React 19 + TypeScript, Vitest (backend unit tests)

---

## Files to Modify

| File | Change |
|------|--------|
| `backend/src/index.ts` | Restrict CORS to `typingrpg.com` + localhost |
| `backend/src/handlers/leaderboard.ts` | Replace JS dedup/sort with SQL GROUP BY + MAX |
| `frontend/src/utils/textGenerator.ts` | PRNG seeded by UTC date string instead of day-of-week |
| `frontend/src/types/completion.ts` | Add `saveError` action and optional `retrySave` to `CompletionResult` |
| `frontend/src/handlers/DailyCompletionHandler.ts` | Await `createSession`, use server `xpDelta`, throw/return on error |
| `frontend/src/handlers/EndlessCompletionHandler.ts` | Await `createSession` with 3-try retry, use server `xpDelta` |
| `frontend/src/components/TypingInterface.tsx` | Handle `saveError` action, show retry banner, clear on success |
| `frontend/src/utils/calculateXP.ts` | **Delete** |

---

## Task 1: Restrict CORS Origin

**Files:**
- Modify: `backend/src/index.ts:40`

- [ ] **Step 1: Replace the wildcard `cors()` call**

In `backend/src/index.ts`, change line 40 from:
```ts
app.use("*", cors());
```
to:
```ts
app.use("*", cors({
  origin: ["https://typingrpg.com", "http://localhost:5173"],
}));
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd backend && bun run tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/index.ts
git commit -m "fix: restrict CORS to typingrpg.com and localhost"
```

---

## Task 2: Leaderboard SQL Aggregation

**Files:**
- Modify: `backend/src/handlers/leaderboard.ts`

- [ ] **Step 1: Add `max` and `sql` to the Drizzle imports**

In `backend/src/handlers/leaderboard.ts`, change line 2 from:
```ts
import { and, desc, eq, gte, lt } from "drizzle-orm";
```
to:
```ts
import { and, desc, eq, gte, lt, max } from "drizzle-orm";
```

- [ ] **Step 2: Replace the `getTodayDailyWpmLeaderboard` function body**

Replace the entire `getTodayDailyWpmLeaderboard` function (lines 49–132) with:

```ts
// GET /api/leaderboard/today-wpm?limit=50&offset=0
export const getTodayDailyWpmLeaderboard = async (c: AppContext) => {
  const url = new URL(c.req.url);
  const limitParam = url.searchParams.get("limit");
  const offsetParam = url.searchParams.get("offset");
  let limit = Number.parseInt(limitParam || "50", 10);
  let offset = Number.parseInt(offsetParam || "0", 10);
  if (!Number.isFinite(limit) || limit <= 0) limit = 50;
  if (limit > 100) limit = 100;
  if (!Number.isFinite(offset) || offset < 0) offset = 0;

  // UTC day window
  const now = new Date();
  const dayStartMs = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  const dayEndMs = dayStartMs + 86_400_000;
  const dayStart = new Date(dayStartMs);
  const dayEnd = new Date(dayEndMs);

  const db = c.get("db");
  try {
    const maxWpm = max(gameSessions.wpm).as("wpm");

    const rows = await db
      .select({
        userId: gameSessions.userId,
        username: users.username,
        wpm: maxWpm,
      })
      .from(gameSessions)
      .innerJoin(users, eq(users.userId, gameSessions.userId))
      .where(
        and(
          eq(gameSessions.mode, "daily"),
          gte(gameSessions.createdAt, dayStart),
          lt(gameSessions.createdAt, dayEnd)
        )
      )
      .groupBy(gameSessions.userId, users.username)
      .orderBy(desc(maxWpm))
      .limit(limit)
      .offset(offset);

    const items = rows.map((r, idx) => ({
      rank: offset + idx + 1,
      username: r.username,
      wpm: r.wpm ?? 0,
    }));

    return c.json({ success: true, items });
  } catch (e) {
    console.error("getTodayDailyWpmLeaderboard error", e);
    return c.json({ error: "Failed to load leaderboard" }, 500);
  }
};
```

Note: `userId` is removed from the response (reduces information exposure). If any frontend code reads `items[n].userId`, remove that reference.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd backend && bun run tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/handlers/leaderboard.ts
git commit -m "fix: replace in-memory leaderboard dedup with SQL GROUP BY MAX"
```

---

## Task 3: PRNG-Seeded Daily Quotes

**Files:**
- Modify: `frontend/src/utils/textGenerator.ts`

- [ ] **Step 1: Replace the date-index logic with a PRNG seeded by UTC date string**

Replace the entire contents of `frontend/src/utils/textGenerator.ts` with:

```ts
// This utility provides functions for generating text for the typing game.

import dailyQuotesData from '../static/english/english_quotes_1.json';
import english1kData from '../static/english/english_1k.json';

interface DailyQuotesData {
  easy: string[];
  medium: string[];
  hard: string[];
}

interface WordListData {
  words: string[];
}

const typedDailyQuotesData = dailyQuotesData as DailyQuotesData;
const typedEnglish1kData = english1kData as WordListData;

// Returns the current UTC date as "YYYY-MM-DD".
// All users in the same UTC day see the same daily quotes.
const getUtcDateString = (): string => {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Simple deterministic hash of a string to a 32-bit integer seed.
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

// Mulberry32 PRNG — cheap, deterministic, good distribution.
function mulberry32(seed: number): () => number {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Returns the daily quote for the given difficulty.
// Seeded by UTC date + difficulty so easy/medium/hard all differ,
// and every user on the same UTC day sees the same quote.
export const getDailyQuote = (
  difficulty: 'easy' | 'medium' | 'hard'
): string => {
  const quotes = typedDailyQuotesData[difficulty];
  if (!quotes || quotes.length === 0) return 'Failed to load daily quote.';

  const seed = hashString(`${getUtcDateString()}-${difficulty}`);
  const rand = mulberry32(seed);
  const quoteIndex = Math.floor(rand() * quotes.length);
  return quotes[quoteIndex] || 'Failed to load quote.';
};

export const generateText = (
  mode: 'daily' | 'endless',
  difficulty?: 'easy' | 'medium' | 'hard'
): string => {
  if (mode === 'daily') {
    return getDailyQuote(difficulty ?? 'easy');
  }

  // Endless mode: 25 random words
  const wordList = typedEnglish1kData.words;
  if (!wordList || wordList.length === 0) return 'Word list is empty or not found.';

  const selectedWords: string[] = [];
  for (let i = 0; i < 25; i++) {
    selectedWords.push(wordList[Math.floor(Math.random() * wordList.length)]);
  }
  return selectedWords.join(' ');
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && bun run tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Smoke-test in browser**

Start dev server (`cd frontend && bun run dev`), switch to Daily mode, confirm a quote loads. Open browser console and run:

```js
// Confirm same quote on same UTC date
const { getDailyQuote } = await import('/src/utils/textGenerator.ts');
console.log(getDailyQuote('easy'));  // should be non-empty and stable on refresh
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/utils/textGenerator.ts
git commit -m "fix: use PRNG seeded by UTC date for consistent daily quotes"
```

---

## Task 4: Awaited Session Save + Server xpDelta + Remove Duplicate XP File

This task is done in four sub-steps that must be applied together (the TypeScript compiler will enforce it).

**Files:**
- Modify: `frontend/src/types/completion.ts`
- Modify: `frontend/src/handlers/DailyCompletionHandler.ts`
- Modify: `frontend/src/handlers/EndlessCompletionHandler.ts`
- Modify: `frontend/src/components/TypingInterface.tsx`
- Delete: `frontend/src/utils/calculateXP.ts`

### 4a: Extend `CompletionResult` type

- [ ] **Step 1: Add `saveError` action and `retrySave` to `CompletionResult`**

Replace the contents of `frontend/src/types/completion.ts` with:

```ts
export interface CompletionStats {
  correctWords: number;
  incorrectWords: number;
  totalCharsIncludingSpaces: number;
  finalWpm: number;
  elapsedMinutes: number;
}

export interface CompletionResult {
  action: 'retry' | 'nextQuote' | 'showModal' | 'loadNewText' | 'saveError';
  message?: string;
  newAttempts?: number;
  xpDelta?: number;
  /** Only set when action === 'saveError'. Calling this retries the server save. */
  retrySave?: () => Promise<CompletionResult>;
}

export interface CompletionContext {
  currentAttempts: number;
  completedQuotes: number;
  hasShownDailyCompletion: boolean;
  currentDifficulty: 'easy' | 'medium' | 'hard';
}

export type Mode = 'daily' | 'endless';
```

### 4b: Update `DailyCompletionHandler`

- [ ] **Step 2: Rewrite `DailyCompletionHandler` to await the save**

Key invariant: `completeCurrentQuote` for the **final** (3rd) quote must only be called *after* the server confirms the save. This prevents `isCompletedToday` from being written to `localStorage` before success, which would lock the user out of retrying.

Replace the entire contents of `frontend/src/handlers/DailyCompletionHandler.ts` with:

```ts
import {
  checkDailyFailure,
  getDailyFailureMessage,
  getDailySuccessMessage,
} from '../utils/dailyFailureDetection';
import type {
  CompletionStats,
  CompletionResult,
  CompletionContext,
} from '../types/completion';

interface SessionPayload {
  mode: 'daily' | 'endless';
  wpm: number;
  totalWords: number;
  correctWords: number;
  incorrectWords: number;
}

interface SessionResponse {
  success: boolean;
  session: { xpDelta: number };
}

export class DailyCompletionHandler {
  constructor(
    private completeCurrentQuote: (wpm: number, attempts: number) => void,
    private getAverageWPM: () => number,
    private onShowModal: () => void,
    private createSession: (body: SessionPayload) => Promise<Response>
  ) {}

  async handleCompletion(
    stats: CompletionStats,
    context: CompletionContext
  ): Promise<CompletionResult> {
    const failed = checkDailyFailure(stats.incorrectWords);
    if (failed) {
      return this.handleFailure(stats, context);
    }
    return this.handleSuccess(stats, context);
  }

  private handleFailure(
    stats: CompletionStats,
    context: CompletionContext
  ): CompletionResult {
    const failureMessage = getDailyFailureMessage(
      stats.incorrectWords,
      context.currentDifficulty
    );
    return {
      action: 'retry',
      message: `Attempt ${context.currentAttempts + 1} - ${failureMessage}`,
      newAttempts: context.currentAttempts + 1,
    };
  }

  private async handleSuccess(
    stats: CompletionStats,
    context: CompletionContext
  ): Promise<CompletionResult> {
    const successMessage = getDailySuccessMessage(
      stats.incorrectWords,
      context.currentDifficulty
    );
    console.log(successMessage);

    const willCompleteDaily =
      context.completedQuotes >= 2 && !context.hasShownDailyCompletion;

    if (!willCompleteDaily) {
      // Not the final quote — safe to record stats immediately
      this.completeCurrentQuote(stats.finalWpm, context.currentAttempts);
      return {
        action: 'nextQuote',
        message: `${context.currentDifficulty} quote completed! Moving to next difficulty.`,
        newAttempts: 1,
      };
    }

    // Final (3rd) quote — compute true 3-quote average without calling
    // completeCurrentQuote yet (that would mark isCompletedToday = true in
    // localStorage before the server confirms).
    const prevAvg = this.getAverageWPM(); // average of the 2 completed quotes
    const avgWpm = Math.round(
      (prevAvg * context.completedQuotes + stats.finalWpm) /
        (context.completedQuotes + 1)
    );
    const totalWords = stats.correctWords + stats.incorrectWords;
    const payload: SessionPayload = {
      mode: 'daily',
      wpm: avgWpm,
      totalWords,
      correctWords: stats.correctWords,
      incorrectWords: stats.incorrectWords,
    };

    // Build a closure that does the save AND the post-save side-effects.
    // Stored as retrySave so TypingInterface can call it again on failure.
    const performSaveAndComplete = async (): Promise<CompletionResult> => {
      try {
        const response = await this.createSession(payload);
        if (!response.ok) throw new Error(`Server returned ${response.status}`);
        const data = (await response.json()) as SessionResponse;
        const xpEarned = data.session?.xpDelta ?? 0;
        // Server confirmed — now safe to write localStorage
        this.completeCurrentQuote(stats.finalWpm, context.currentAttempts);
        this.onShowModal();
        return { action: 'showModal', xpDelta: xpEarned };
      } catch (e) {
        const message =
          e instanceof Error ? e.message : 'Network error — please retry.';
        return {
          action: 'saveError',
          message,
          retrySave: performSaveAndComplete,
        };
      }
    };

    return performSaveAndComplete();
  }
}
```

### 4c: Update `EndlessCompletionHandler`

- [ ] **Step 3: Rewrite `EndlessCompletionHandler` with silent retry and server xpDelta**

Replace the entire contents of `frontend/src/handlers/EndlessCompletionHandler.ts` with:

```ts
import type { CompletionStats, CompletionResult } from '../types/completion';

interface SessionPayload {
  mode: 'daily' | 'endless';
  wpm: number;
  totalWords: number;
  correctWords: number;
  incorrectWords: number;
}

interface SessionResponse {
  success: boolean;
  session: { xpDelta: number };
}

const RETRY_DELAYS_MS = [500, 1500, 3000];

export class EndlessCompletionHandler {
  constructor(
    private createSession: (body: SessionPayload) => Promise<Response>
  ) {}

  async handleCompletion(stats: CompletionStats): Promise<CompletionResult> {
    const totalWords = stats.correctWords + stats.incorrectWords;
    const payload: SessionPayload = {
      mode: 'endless',
      wpm: Math.round(stats.finalWpm),
      totalWords,
      correctWords: stats.correctWords,
      incorrectWords: stats.incorrectWords,
    };

    // Fire save in background with up to 3 retries — UI doesn't block.
    const xpEarned = await this.saveWithRetry(payload);

    return {
      action: 'loadNewText',
      message: `Session completed! +${xpEarned} XP`,
      xpDelta: xpEarned,
    };
  }

  /** Attempts the save up to 3 times with delays. Returns server xpDelta, or 0 on total failure. */
  private async saveWithRetry(payload: SessionPayload): Promise<number> {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      if (attempt > 0) {
        await new Promise(res => setTimeout(res, RETRY_DELAYS_MS[attempt - 1]));
      }
      try {
        const response = await this.createSession(payload);
        if (!response.ok) continue;
        const data = (await response.json()) as SessionResponse;
        return data.session?.xpDelta ?? 0;
      } catch {
        // network error — retry
      }
    }
    console.error('Failed to save endless session after retries');
    return 0;
  }
}
```

### 4d: Update `TypingInterface` to handle `saveError`

- [ ] **Step 4: Add `saveError` state and retry banner to `TypingInterface`**

In `frontend/src/components/TypingInterface.tsx`:

**4d-i.** Add two state variables after the `isFocused` state (around line 69):
```ts
const [saveError, setSaveError] = useState<string | null>(null);
const [pendingRetrySave, setPendingRetrySave] = useState<
  (() => Promise<CompletionResult>) | null
>(null);
```

**4d-ii.** In the big `useEffect` completion handler (the `(async () => { ... })()` block), replace the existing `switch` block's `case 'showModal':` and add a `saveError` case. Change the entire `(async () => { ... })()` block (starting at line 249) to:

```ts
(async () => {
  const result: CompletionResult =
    await completionHandler.handleCompletion(stats, context);

  if (result.action === 'saveError') {
    setSaveError(result.message ?? 'Failed to save. Please retry.');
    setPendingRetrySave(() => result.retrySave ?? null);
    setIsProcessingCompletion(false);
    return;
  }

  if (typeof result.xpDelta === 'number') setEarnedXp(result.xpDelta);

  // Background refresh - don't block UI
  reloadPlayerStats();

  switch (result.action) {
    case 'retry':
      if (result.newAttempts !== undefined)
        setCurrentAttempts(result.newAttempts);
      setTimeout(() => {
        setIsProcessingCompletion(false);
        initializeNewText();
      }, 1000);
      break;
    case 'nextQuote':
      if (result.newAttempts !== undefined)
        setCurrentAttempts(result.newAttempts);
      setIsProcessingCompletion(false);
      setCelebrateText('Next challenge!');
      setCelebrating(true);
      setTimeout(() => setCelebrating(false), 1000);
      break;
    case 'showModal':
      setIsProcessingCompletion(false);
      break;
    case 'loadNewText':
    default:
      if (currentMode === 'endless') {
        setCelebrateText(getWpmTitle(stats.finalWpm));
        setCelebrating(true);
        setTimeout(() => setCelebrating(false), 1000);
      }
      setTimeout(() => {
        setIsProcessingCompletion(false);
        initializeNewText();
      }, 1000);
      break;
  }
})();
```

**4d-iii.** Add a `handleRetrySave` callback after the existing `handleModalClose` function (around line 360):

```ts
const handleRetrySave = useCallback(async () => {
  if (!pendingRetrySave) return;
  setSaveError(null);
  const result = await pendingRetrySave();
  if (result.action === 'saveError') {
    setSaveError(result.message ?? 'Failed to save. Please retry.');
    setPendingRetrySave(() => result.retrySave ?? null);
    return;
  }
  if (typeof result.xpDelta === 'number') setEarnedXp(result.xpDelta);
  setPendingRetrySave(null);
  reloadPlayerStats();
}, [pendingRetrySave, reloadPlayerStats]);
```

**4d-iv.** Add the save-error banner to the JSX, just before the closing `</>` of the return statement (after the `{hitVisible && ...}` block):

```tsx
{saveError && (
  <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-lg bg-red-700 text-white shadow-xl">
    <span className="text-sm">{saveError}</span>
    <button
      type="button"
      onClick={handleRetrySave}
      className="px-3 py-1 rounded bg-white text-red-700 text-sm font-semibold hover:bg-red-100 transition-colors"
    >
      Retry
    </button>
  </div>
)}
```

### 4e: Delete the duplicate XP file

- [ ] **Step 5: Delete `frontend/src/utils/calculateXP.ts`**

```bash
git rm frontend/src/utils/calculateXP.ts
```

- [ ] **Step 6: Verify TypeScript compiles with no references to `calculateXP`**

```bash
cd frontend && bun run tsc --noEmit
```
Expected: no errors. If any import of `calculateXP` remains, remove it.

- [ ] **Step 7: Run the frontend build to confirm no bundling errors**

```bash
cd frontend && bun run build
```
Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/types/completion.ts \
        frontend/src/handlers/DailyCompletionHandler.ts \
        frontend/src/handlers/EndlessCompletionHandler.ts \
        frontend/src/components/TypingInterface.tsx
git commit -m "fix: await daily session save, use server xpDelta, remove duplicate XP util"
```

---

## Task 5: End-to-End Verification

- [ ] **Step 1: Run backend type-check and tests**

```bash
cd backend && bun run tsc --noEmit && bun run test
```
Expected: 0 type errors, all tests pass.

- [ ] **Step 2: Run frontend build**

```bash
cd frontend && bun run build
```
Expected: build succeeds with no errors.

- [ ] **Step 3: Manual smoke test — daily save error path**

Start the dev server (`cd frontend && bun run dev`). Open browser DevTools → Network tab. Set your connection to Offline. Complete a daily quote (all three difficulties). Confirm:
- Error banner appears ("Failed to save. Please retry.")
- No confetti modal appears
- `localStorage` does NOT contain a `daily_progress_*` key marked as `isCompletedToday: true`

Re-enable network, click "Retry" in the banner. Confirm:
- XP popup appears
- Congrats modal opens

- [ ] **Step 4: Final commit + push**

```bash
git push origin dev
```
