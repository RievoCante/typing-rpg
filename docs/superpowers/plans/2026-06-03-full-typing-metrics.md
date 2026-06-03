# Full Typing Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture every monkeytype-style per-test metric except per-keystroke timing (raw WPM, keystroke-level accuracy, consistency, char breakdown, per-second WPM/error history, duration, AFK), persist them on every solo session, and switch the kill overlay's accuracy to keystroke-level.

**Architecture:** Three layers. **Collect** — keystroke counters fed by reducer events through a new fight/run-scoped `useSessionMetrics` hook (1 Hz sampler for per-second arrays + AFK), plus char breakdown added to the pure `analyzeWords`. **Persist** — new optional fields on `CompletionStats` → `SessionPayload` → bounded backend validation → new nullable `game_sessions` columns + JSON `chart_data`. **Display** — overlay accuracy swaps word-level → keystroke-level. WPM, word counts, XP, and daily/failure logic are untouched.

**Tech Stack:** React 19 + Vite + Vitest (frontend, Bun), Hono + Drizzle + D1 + Zod (backend, Bun).

**Spec:** `docs/superpowers/specs/2026-06-03-full-typing-metrics-design.md`

---

## Scope decisions locked by this plan

- **Daily metrics reflect the FINAL (3rd) quote**, mirroring the existing behavior where saved `correctWords`/`incorrectWords` are the final quote's (net `wpm` stays the 3-quote average — unchanged). This keeps daily XP/failure logic byte-for-byte identical. Full 3-quote aggregation is deferred.
- **Char breakdown is letter-only** (spaces excluded). Per reached word, per char: `correct`/`locked` → correctChars, `incorrect` → incorrectChars, `pending`/`skipped` → missedChars; overflow letters → extraChars.
- **rawWpm/accuracy count typed characters only** (the reducer's `characterInput` keystrokes incl. overflow), not spaces. Internally consistent; documented divergence from monkeytype which includes spaces.
- **chartData per-second `wpm`/`raw` are cumulative-average snapshots** (keystroke-derived), capped at 300 samples. For the future graph; the persisted scalar `wpm` is unchanged.

## File map

| File | Change |
|---|---|
| `frontend/src/utils/wordAnalysis.ts` | Add `correctChars/incorrectChars/extraChars/missedChars` to `WordAnalysisResult` + single-pass tally |
| `frontend/src/utils/consistency.ts` | **New** — `mean`, `populationStdDev`, `kogasa`, `consistency(samples)` |
| `frontend/src/types/completion.ts` | Extend `CompletionStats` (char breakdown + optional metrics), `SessionMetrics`, `ChartData`, `SessionPayload` |
| `frontend/src/hooks/useFightStats.ts` | Fold + finalize the 4 char-breakdown fields |
| `frontend/src/hooks/usePerformanceTracking.ts` | Pass char breakdown through `calculateFinalStats` |
| `frontend/src/hooks/useSessionMetrics.ts` | **New** — keystroke counters + 1 Hz sampler + finalize |
| `frontend/src/hooks/useTypingMechanics.ts` | Add `onKeypress(correct)` callback |
| `frontend/src/components/TypingInterface.tsx` | Wire `useSessionMetrics` (endless), merge metrics into stats, overlay accuracy |
| `frontend/src/hooks/useTypingCompletion.ts` | Wire metrics (daily), overlay accuracy |
| `frontend/src/handlers/EndlessCompletionHandler.ts` | Add new fields to payload |
| `frontend/src/handlers/DailyCompletionHandler.ts` | Add new fields to payload |
| `frontend/src/hooks/useApi.ts` | Extend `createSession` body type |
| `frontend/src/components/KillResultOverlay.tsx` | Comment: accuracy now keystroke-level |
| `backend/src/db/schema.ts` | New nullable columns on `gameSessions` |
| `backend/drizzle/` | New generated migration |
| `backend/src/handlers/sessions.ts` | Extend `sessionSchema` + insert new columns |

---

### Task 1: Char breakdown in `analyzeWords`

**Files:**
- Modify: `frontend/src/utils/wordAnalysis.ts`
- Test: `frontend/src/utils/wordAnalysis.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/utils/wordAnalysis.test.ts` (create the file with this content if it does not exist; if it exists, add only the `describe` block):

```ts
import { describe, it, expect } from 'vitest';
import { analyzeWords } from './wordAnalysis';
import type { CharStatus } from '../components/TypingText';

const status = (s: string): CharStatus[] => s.split('') as CharStatus[];
// status string legend: c=correct, l=locked, i=incorrect, p=pending, s=skipped

describe('analyzeWords char breakdown', () => {
  it('counts all-correct word as correctChars only', () => {
    // text "cat" typed correctly (locked after space-commit not present here)
    const text = 'cat';
    const cs: CharStatus[] = ['correct', 'correct', 'correct'];
    const r = analyzeWords(text, cs);
    expect(r.correctChars).toBe(3);
    expect(r.incorrectChars).toBe(0);
    expect(r.missedChars).toBe(0);
    expect(r.extraChars).toBe(0);
  });

  it('counts a wrong char inside a word', () => {
    const text = 'cat';
    const cs: CharStatus[] = ['correct', 'incorrect', 'correct'];
    const r = analyzeWords(text, cs);
    expect(r.correctChars).toBe(2);
    expect(r.incorrectChars).toBe(1);
    expect(r.incorrectWords).toBe(1);
  });

  it('counts overflow letters as extraChars and marks the word incorrect', () => {
    // "cat" fully correct but two overflow letters typed at the trailing boundary (index 3)
    const text = 'cat dog';
    const cs: CharStatus[] = [
      'correct', 'correct', 'correct', 'pending',
      'pending', 'pending', 'pending',
    ];
    const r = analyzeWords(text, cs, { 3: ['x', 'y'] }, 3);
    expect(r.extraChars).toBe(2);
    expect(r.incorrectWords).toBe(1); // overflow word is incorrect
    expect(r.correctChars).toBe(3); // the 3 base letters are still correct chars
  });

  it('counts pending/skipped chars in a reached word as missedChars', () => {
    // mid-word space skip: "cat" -> only 'c' typed, rest skipped, boundary locked
    const text = 'cat dog';
    const cs: CharStatus[] = [
      'correct', 'pending', 'pending', 'locked',
      'pending', 'pending', 'pending',
    ];
    const r = analyzeWords(text, cs, {}, 4);
    expect(r.correctChars).toBe(1);
    expect(r.missedChars).toBe(2);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && bun run test wordAnalysis`
Expected: FAIL — `correctChars` is `undefined`.

- [ ] **Step 3: Implement the breakdown**

In `frontend/src/utils/wordAnalysis.ts`, extend the interface:

```ts
export interface WordAnalysisResult {
  correctWords: number;
  incorrectWords: number;
  totalCharsIncludingSpaces: number;
  correctChars: number;
  incorrectChars: number;
  extraChars: number;
  missedChars: number;
}
```

Replace the body of the `for (const match of wordMatches)` loop and the accumulators. Add the four counters at the top (next to the existing three):

```ts
  let correctWords = 0;
  let incorrectWords = 0;
  let totalCharsIncludingSpaces = 0;
  let correctChars = 0;
  let incorrectChars = 0;
  let extraChars = 0;
  let missedChars = 0;
```

Inside the loop, replace everything from `let isWordCorrect = ...` through the `if (isWordCorrect) {...} else {...}` block with:

```ts
    // Per-character tally for this reached word (letter-only; spaces excluded).
    let wordCorrect = 0;
    let wordIncorrect = 0;
    let wordMissed = 0;
    for (let i = wordStartIndex; i < wordEndIndex; i++) {
      const status = charStatus[i];
      if (status === 'correct' || status === 'locked') wordCorrect++;
      else if (status === 'incorrect') wordIncorrect++;
      else wordMissed++; // 'pending' | 'skipped'
    }
    const wordExtra = overflow[wordEndIndex]?.length ?? 0;

    correctChars += wordCorrect;
    incorrectChars += wordIncorrect;
    missedChars += wordMissed;
    extraChars += wordExtra;

    // A word is correct only if every char is correct/locked and it carries no
    // overflow — identical to the previous definition.
    const isWordCorrect =
      wordExtra === 0 && wordIncorrect === 0 && wordMissed === 0;

    if (isWordCorrect) {
      correctWords++;
      totalCharsIncludingSpaces += word.length;
      if (wordEndIndex < text.length && text[wordEndIndex] === ' ') {
        totalCharsIncludingSpaces += 1;
      }
    } else {
      incorrectWords++;
    }
```

Update the `return`:

```ts
  return {
    correctWords,
    incorrectWords,
    totalCharsIncludingSpaces,
    correctChars,
    incorrectChars,
    extraChars,
    missedChars,
  };
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && bun run test wordAnalysis`
Expected: PASS (new + any existing cases).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/wordAnalysis.ts frontend/src/utils/wordAnalysis.test.ts
git commit -m "feat(metrics): add char breakdown to analyzeWords"
```

---

### Task 2: Consistency util (`kogasa`)

**Files:**
- Create: `frontend/src/utils/consistency.ts`
- Test: `frontend/src/utils/consistency.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/utils/consistency.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { consistency, mean, populationStdDev } from './consistency';

describe('consistency (kogasa)', () => {
  it('mean and population std dev', () => {
    expect(mean([2, 4, 6])).toBe(4);
    expect(populationStdDev([2, 4, 6])).toBeCloseTo(1.632993, 4);
  });

  it('perfectly even samples → 100', () => {
    expect(consistency([50, 50, 50, 50])).toBe(100);
  });

  it('high variance → low consistency', () => {
    const even = consistency([50, 50, 50, 50]);
    const jittery = consistency([10, 90, 20, 80]);
    expect(jittery).toBeLessThan(even);
    expect(jittery).toBeGreaterThanOrEqual(0);
  });

  it('empty or single sample → 0', () => {
    expect(consistency([])).toBe(0);
    expect(consistency([42])).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && bun run test consistency`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `frontend/src/utils/consistency.ts`:

```ts
// Consistency scoring, matching monkeytype's `kogasa`.
// consistency = 100 * (1 - tanh(cov + cov^3/3 + cov^5/5)), cov = stdDev/mean.
// Uses POPULATION std dev (divide by n). NaN/empty → 0.

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function populationStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const m = mean(values);
  const variance =
    values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function kogasa(cov: number): number {
  return (
    100 * (1 - Math.tanh(cov + cov ** 3 / 3 + cov ** 5 / 5))
  );
}

// Consistency over a samples array (e.g. raw WPM per second). <2 samples → 0.
export function consistency(samples: number[]): number {
  if (samples.length < 2) return 0;
  const m = mean(samples);
  if (m === 0) return 0;
  const cov = populationStdDev(samples) / m;
  const value = kogasa(cov);
  return Number.isFinite(value) ? Math.round(value) : 0;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && bun run test consistency`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/consistency.ts frontend/src/utils/consistency.test.ts
git commit -m "feat(metrics): add kogasa consistency util"
```

---

### Task 3: Extend `CompletionStats` + metric types

**Files:**
- Modify: `frontend/src/types/completion.ts`

No test (type-only). Verified by `tsc` in later tasks.

- [ ] **Step 1: Add types**

In `frontend/src/types/completion.ts`, add above `CompletionStats`:

```ts
/** Per-second history arrays for the future result graph. */
export interface ChartData {
  wpm: number[];
  raw: number[];
  err: number[];
}

/** Keystroke-derived metrics produced by useSessionMetrics.finalize(). */
export interface SessionMetrics {
  rawWpm: number;
  accuracy: number; // 0-100, keystroke-level
  consistency: number; // 0-100
  afkSeconds: number;
  chartData: ChartData;
}
```

Replace `CompletionStats` with:

```ts
export interface CompletionStats {
  correctWords: number;
  incorrectWords: number;
  totalCharsIncludingSpaces: number;
  finalWpm: number;
  elapsedMinutes: number;
  // Char breakdown (always present; from analyzeWords).
  correctChars: number;
  incorrectChars: number;
  extraChars: number;
  missedChars: number;
  // Keystroke-derived metrics (merged in at finalize sites; optional so pure
  // word-analysis paths and unit tests can omit them).
  metrics?: SessionMetrics;
}
```

Replace `SessionPayload` with:

```ts
export interface SessionPayload {
  mode: Mode;
  wpm: number;
  totalWords: number;
  correctWords: number;
  incorrectWords: number;
  /** Endless word-list difficulty; scales XP server-side. Omitted for daily. */
  difficulty?: EndlessDifficulty;
  // New metrics — all optional so older paths still compile.
  rawWpm?: number;
  accuracy?: number;
  consistency?: number;
  correctChars?: number;
  incorrectChars?: number;
  extraChars?: number;
  missedChars?: number;
  durationSeconds?: number;
  afkSeconds?: number;
  chartData?: ChartData;
}
```

- [ ] **Step 2: Commit** (compilation checked in Task 11/16)

```bash
git add frontend/src/types/completion.ts
git commit -m "feat(metrics): extend CompletionStats and SessionPayload types"
```

---

### Task 4: Fold char breakdown through `useFightStats`

**Files:**
- Modify: `frontend/src/hooks/useFightStats.ts`
- Test: `frontend/src/hooks/useFightStats.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/hooks/useFightStats.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { finalizeFightStats } from './useFightStats';
import type { WordAnalysisResult } from '../utils/wordAnalysis';

const block = (over: Partial<WordAnalysisResult>): WordAnalysisResult => ({
  correctWords: 0,
  incorrectWords: 0,
  totalCharsIncludingSpaces: 0,
  correctChars: 0,
  incorrectChars: 0,
  extraChars: 0,
  missedChars: 0,
  ...over,
});

describe('finalizeFightStats char breakdown', () => {
  it('sums char breakdown across accumulated blocks + current', () => {
    const accum = {
      chars: 10,
      correct: 2,
      incorrect: 1,
      correctChars: 8,
      incorrectChars: 2,
      extraChars: 1,
      missedChars: 0,
    };
    const current = block({
      correctChars: 4,
      incorrectChars: 1,
      extraChars: 0,
      missedChars: 3,
    });
    const r = finalizeFightStats(accum, current, 1);
    expect(r.correctChars).toBe(12);
    expect(r.incorrectChars).toBe(3);
    expect(r.extraChars).toBe(1);
    expect(r.missedChars).toBe(3);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && bun run test useFightStats`
Expected: FAIL — `FightAccum` has no `correctChars`, `finalizeFightStats` arg type mismatch.

- [ ] **Step 3: Implement**

In `frontend/src/hooks/useFightStats.ts`:

Replace `FightAccum` and `EMPTY`:

```ts
interface FightAccum {
  chars: number;
  correct: number;
  incorrect: number;
  correctChars: number;
  incorrectChars: number;
  extraChars: number;
  missedChars: number;
}

const EMPTY: FightAccum = {
  chars: 0,
  correct: 0,
  incorrect: 0,
  correctChars: 0,
  incorrectChars: 0,
  extraChars: 0,
  missedChars: 0,
};
```

In `finalizeFightStats`, after computing `incorrectWords`, add and return the breakdown:

```ts
  const totalCharsIncludingSpaces =
    accum.chars + current.totalCharsIncludingSpaces;
  const correctWords = accum.correct + current.correctWords;
  const incorrectWords = accum.incorrect + current.incorrectWords;
  const correctChars = accum.correctChars + current.correctChars;
  const incorrectChars = accum.incorrectChars + current.incorrectChars;
  const extraChars = accum.extraChars + current.extraChars;
  const missedChars = accum.missedChars + current.missedChars;
  const finalWpm =
    elapsedMinutes > 0
      ? Math.round(totalCharsIncludingSpaces / 5 / elapsedMinutes)
      : 0;
  return {
    correctWords,
    incorrectWords,
    totalCharsIncludingSpaces,
    finalWpm,
    elapsedMinutes,
    correctChars,
    incorrectChars,
    extraChars,
    missedChars,
  };
```

In `foldBlock`, sum the new fields:

```ts
  const foldBlock = useCallback((block: WordAnalysisResult) => {
    accumRef.current = {
      chars: accumRef.current.chars + block.totalCharsIncludingSpaces,
      correct: accumRef.current.correct + block.correctWords,
      incorrect: accumRef.current.incorrect + block.incorrectWords,
      correctChars: accumRef.current.correctChars + block.correctChars,
      incorrectChars: accumRef.current.incorrectChars + block.incorrectChars,
      extraChars: accumRef.current.extraChars + block.extraChars,
      missedChars: accumRef.current.missedChars + block.missedChars,
    };
  }, []);
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && bun run test useFightStats`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useFightStats.ts frontend/src/hooks/useFightStats.test.ts
git commit -m "feat(metrics): fold char breakdown through useFightStats"
```

---

### Task 5: Pass char breakdown through `usePerformanceTracking` (daily path)

**Files:**
- Modify: `frontend/src/hooks/usePerformanceTracking.ts`

- [ ] **Step 1: Update the interface and finalize**

In `frontend/src/hooks/usePerformanceTracking.ts`, replace the local `PerformanceStats` interface with an import-aligned shape by returning `CompletionStats` fields. Update `calculateFinalStats`'s destructure and return:

Change the destructure line:

```ts
    const {
      correctWords,
      incorrectWords,
      totalCharsIncludingSpaces,
      correctChars,
      incorrectChars,
      extraChars,
      missedChars,
    } = analyzeWords(text, charStatus, overflow);
```

Change the `return` object to include the breakdown:

```ts
    return {
      correctWords,
      incorrectWords,
      totalCharsIncludingSpaces,
      finalWpm,
      elapsedMinutes,
      correctChars,
      incorrectChars,
      extraChars,
      missedChars,
    };
```

Update the local `PerformanceStats` interface to add the four fields (or replace its return type annotation with `CompletionStats` imported from `../types/completion`). Add the four fields to `PerformanceStats`:

```ts
interface PerformanceStats {
  correctWords: number;
  incorrectWords: number;
  totalCharsIncludingSpaces: number;
  finalWpm: number;
  elapsedMinutes: number;
  correctChars: number;
  incorrectChars: number;
  extraChars: number;
  missedChars: number;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && bunx tsc -b`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/usePerformanceTracking.ts
git commit -m "feat(metrics): surface char breakdown from calculateFinalStats"
```

---

### Task 6: `useSessionMetrics` hook (keystroke counters + 1 Hz sampler)

**Files:**
- Create: `frontend/src/hooks/useSessionMetrics.ts`
- Test: `frontend/src/hooks/useSessionMetrics.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/hooks/useSessionMetrics.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessionMetrics } from './useSessionMetrics';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useSessionMetrics', () => {
  it('computes accuracy from keystroke counters', () => {
    const { result } = renderHook(() => useSessionMetrics());
    act(() => result.current.startIfNeeded());
    act(() => {
      for (let i = 0; i < 9; i++) result.current.recordKeypress(true);
      result.current.recordKeypress(false); // 9 correct / 1 wrong
    });
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    let m;
    act(() => {
      m = result.current.finalize(1); // 1 minute elapsed
    });
    expect(m.accuracy).toBe(90);
    expect(m.rawWpm).toBe(2); // 10 chars /5 /1min
  });

  it('samples once per second and counts AFK seconds', () => {
    const { result } = renderHook(() => useSessionMetrics());
    act(() => result.current.startIfNeeded());
    // second 1: activity
    act(() => {
      result.current.recordKeypress(true);
      vi.advanceTimersByTime(1000);
    });
    // second 2: no activity → AFK
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    let m;
    act(() => {
      m = result.current.finalize(2 / 60);
    });
    expect(m.chartData.raw.length).toBe(2);
    expect(m.afkSeconds).toBe(1);
  });

  it('reset clears counters and stops sampling', () => {
    const { result } = renderHook(() => useSessionMetrics());
    act(() => result.current.startIfNeeded());
    act(() => {
      result.current.recordKeypress(true);
      result.current.reset();
      vi.advanceTimersByTime(3000);
    });
    let m;
    act(() => {
      m = result.current.finalize(0);
    });
    expect(m.accuracy).toBe(100); // no keypresses after reset
    expect(m.chartData.raw.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && bun run test useSessionMetrics`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `frontend/src/hooks/useSessionMetrics.ts`:

```ts
import { useRef, useCallback, useMemo } from 'react';
import { consistency } from '../utils/consistency';
import type { SessionMetrics } from '../types/completion';

const MAX_SAMPLES = 300;

interface MetricsState {
  start: number | null;
  correct: number;
  incorrect: number;
  activeThisTick: boolean;
  prevIncorrect: number;
  afkSeconds: number;
  wpm: number[];
  raw: number[];
  err: number[];
  intervalId: ReturnType<typeof setInterval> | null;
}

const fresh = (): MetricsState => ({
  start: null,
  correct: 0,
  incorrect: 0,
  activeThisTick: false,
  prevIncorrect: 0,
  afkSeconds: 0,
  wpm: [],
  raw: [],
  err: [],
  intervalId: null,
});

// Fight (endless) / quote (daily) scoped keystroke metrics. Keystroke counts are
// monotonic and survive endless block refills; the 1 Hz sampler builds the
// per-second arrays + AFK seconds. No timestamps are collected per keystroke.
export function useSessionMetrics() {
  const ref = useRef<MetricsState>(fresh());

  const tick = useCallback(() => {
    const s = ref.current;
    if (s.start === null) return;
    const elapsedMin = (Date.now() - s.start) / 60000;
    const safeMin = elapsedMin > 0 ? elapsedMin : 1 / 60;
    const total = s.correct + s.incorrect;
    if (s.wpm.length < MAX_SAMPLES) {
      s.wpm.push(Math.round(s.correct / 5 / safeMin));
      s.raw.push(Math.round(total / 5 / safeMin));
      s.err.push(s.incorrect - s.prevIncorrect);
    }
    s.prevIncorrect = s.incorrect;
    if (!s.activeThisTick) s.afkSeconds += 1;
    s.activeThisTick = false;
  }, []);

  const startIfNeeded = useCallback(() => {
    const s = ref.current;
    if (s.start !== null) return;
    s.start = Date.now();
    s.intervalId = setInterval(tick, 1000);
  }, [tick]);

  const recordKeypress = useCallback((correct: boolean) => {
    const s = ref.current;
    if (correct) s.correct += 1;
    else s.incorrect += 1;
    s.activeThisTick = true;
  }, []);

  const finalize = useCallback((elapsedMinutes: number): SessionMetrics => {
    const s = ref.current;
    if (s.intervalId !== null) {
      clearInterval(s.intervalId);
      s.intervalId = null;
    }
    const total = s.correct + s.incorrect;
    const rawWpm =
      elapsedMinutes > 0 ? Math.round(total / 5 / elapsedMinutes) : 0;
    const accuracy =
      total > 0 ? Math.round((s.correct / total) * 100) : 100;
    return {
      rawWpm,
      accuracy,
      consistency: consistency(s.raw),
      afkSeconds: s.afkSeconds,
      chartData: { wpm: [...s.wpm], raw: [...s.raw], err: [...s.err] },
    };
  }, []);

  const reset = useCallback(() => {
    const s = ref.current;
    if (s.intervalId !== null) clearInterval(s.intervalId);
    ref.current = fresh();
  }, []);

  return useMemo(
    () => ({ startIfNeeded, recordKeypress, finalize, reset }),
    [startIfNeeded, recordKeypress, finalize, reset]
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && bun run test useSessionMetrics`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useSessionMetrics.ts frontend/src/hooks/useSessionMetrics.test.ts
git commit -m "feat(metrics): add useSessionMetrics keystroke + per-second sampler hook"
```

---

### Task 7: `onKeypress` callback in `useTypingMechanics`

**Files:**
- Modify: `frontend/src/hooks/useTypingMechanics.ts`
- Test: `frontend/src/hooks/useTypingMechanics.test.ts` (create if absent)

- [ ] **Step 1: Write the failing test**

Create/append `frontend/src/hooks/useTypingMechanics.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTypingMechanics } from './useTypingMechanics';

describe('useTypingMechanics onKeypress', () => {
  it('fires correct=true for a matching char and false for a wrong char', () => {
    const onKeypress = vi.fn();
    const { result } = renderHook(() =>
      useTypingMechanics({ text: 'ab', onKeypress })
    );
    act(() => result.current.handleCharacterInput('a')); // correct
    act(() => result.current.handleCharacterInput('z')); // wrong (expected 'b')
    expect(onKeypress).toHaveBeenNthCalledWith(1, true);
    expect(onKeypress).toHaveBeenNthCalledWith(2, false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && bun run test useTypingMechanics`
Expected: FAIL — `onKeypress` not called.

- [ ] **Step 3: Implement**

In `frontend/src/hooks/useTypingMechanics.ts`, add to the props interface:

```ts
  // Fires once per character keystroke reaching the engine (incl. overflow).
  // `correct` is true when the typed char matched, false otherwise.
  onKeypress?: (correct: boolean) => void;
```

Add `onKeypress` to the destructured params and to `dispatchEvents`:

```ts
export const useTypingMechanics = ({
  text,
  onCharacterInput,
  onWordCompleted,
  onWordMistake,
  onCharacterMistake,
  onKeypress,
}: UseTypingMechanicsProps) => {
```

```ts
  const dispatchEvents = useCallback(
    (events: TypingEvents) => {
      if (events.characterInput !== undefined) {
        onCharacterInput?.(events.characterInput);
        onKeypress?.(!events.characterMistake);
      }
      if (events.characterMistake) onCharacterMistake?.();
      if (events.wordCompleted) onWordCompleted?.();
      if (events.wordMistake) onWordMistake?.();
    },
    [onCharacterInput, onCharacterMistake, onWordCompleted, onWordMistake, onKeypress]
  );
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && bun run test useTypingMechanics`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useTypingMechanics.ts frontend/src/hooks/useTypingMechanics.test.ts
git commit -m "feat(metrics): add onKeypress callback to useTypingMechanics"
```

---

### Task 8: Wire `useSessionMetrics` into Endless (TypingInterface)

**Files:**
- Modify: `frontend/src/components/TypingInterface.tsx`

No new test (integration covered by manual verification in Task 14 + existing suite). Each step is an anchored edit.

- [ ] **Step 1: Instantiate the hook**

Add the import near the other hook imports (after line 47 `import { useFightStats }`):

```ts
import { useSessionMetrics } from '../hooks/useSessionMetrics';
```

After `const fightStats = useFightStats();` (line ~154) add:

```ts
  const sessionMetrics = useSessionMetrics();
```

- [ ] **Step 2: Count keystrokes**

In the `useTypingMechanics({...})` call (line ~230), add the `onKeypress` wiring:

```ts
  const typingMechanics = useTypingMechanics({
    text,
    onWordCompleted: handleWordCompleted,
    onWordMistake: handleWordMistake,
    onKeypress: sessionMetrics.recordKeypress,
  });
```

- [ ] **Step 3: Start sampling on first keypress**

In the keydown handler where typing starts (line ~570, the `if (!hasStartedTyping)` block that calls `performance.startSession()` and `fightStats.startFightIfNeeded()`), add:

```ts
        sessionMetrics.startIfNeeded();
```

immediately after `fightStats.startFightIfNeeded();`.

- [ ] **Step 4: Merge metrics into stats at death finalize**

In the endless death-finalizer effect (line ~410), replace the `const stats = fightStats.finalize(...)` assignment and the subsequent overlay accuracy. Change:

```ts
    const stats = fightStats.finalize(
      analyzeWords(
        text,
        charStatusRef.current,
        typingMechanics.overflow,
        cursorPositionRef.current
      )
    );
```

to:

```ts
    const baseStats = fightStats.finalize(
      analyzeWords(
        text,
        charStatusRef.current,
        typingMechanics.overflow,
        cursorPositionRef.current
      )
    );
    const metrics = sessionMetrics.finalize(baseStats.elapsedMinutes);
    const stats = { ...baseStats, metrics };
```

In the same effect's `setKillResult({...})`, change the accuracy line from:

```ts
        accuracy: accuracyPct(stats.correctWords, stats.incorrectWords),
```

to:

```ts
        accuracy: metrics.accuracy,
```

Add `sessionMetrics` to that effect's dependency array (alongside `fightStats`).

- [ ] **Step 5: Reset metrics at every fight-reset site**

There are four `fightStats.resetFight();` call sites in TypingInterface (handleContinue ~473, mode-change effect ~495, revive effect ~509, loadout-start effect ~501 region). Immediately after **each** `fightStats.resetFight();`, add:

```ts
      sessionMetrics.reset();
```

Add `sessionMetrics` to the dependency arrays of those `useEffect`/`useCallback` hooks that list `fightStats`.

- [ ] **Step 6: Typecheck + existing tests**

Run: `cd frontend && bunx tsc -b && bun run test`
Expected: no type errors; suite green.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/TypingInterface.tsx
git commit -m "feat(metrics): wire session metrics into endless mode"
```

---

### Task 9: Wire metrics into Daily (useTypingCompletion + reset)

**Files:**
- Modify: `frontend/src/components/TypingInterface.tsx`
- Modify: `frontend/src/hooks/useTypingCompletion.ts`

- [ ] **Step 1: Reset daily metrics on each new quote**

In `frontend/src/components/TypingInterface.tsx`, the text-change effect (lines ~274–297) runs on every new text. Add a daily-only metrics reset. Inside that effect body (which already calls `resetTypingState`, `resetSession`, etc.), add:

```ts
    if (currentMode === 'daily') sessionMetrics.reset();
```

Add `sessionMetrics` and `currentMode` to that effect's dependency array if not already present (`currentMode` already is).

- [ ] **Step 2: Pass metrics finalize into useTypingCompletion**

In the `useTypingCompletion({...})` call in TypingInterface (line ~363), add a prop:

```ts
    finalizeMetrics: sessionMetrics.finalize,
```

- [ ] **Step 3: Consume metrics in useTypingCompletion**

In `frontend/src/hooks/useTypingCompletion.ts`:

Add to `interface Args` (after `calculateFinalStats`):

```ts
  finalizeMetrics: (elapsedMinutes: number) => import('../types/completion').SessionMetrics;
```

Add `finalizeMetrics` to the destructured params in the hook signature.

After `const stats = calculateFinalStats();` and its null-guard, merge metrics:

```ts
    const metrics = finalizeMetrics(stats.elapsedMinutes);
    const fullStats = { ...stats, metrics };
```

Replace the later uses of `stats` that flow to the handler and overlay with `fullStats`:
- `await completionHandler.handleCompletion(stats, context)` → `handleCompletion(fullStats, context)`
- In the `nextQuote` case, change the `setKillResult` accuracy from:

```ts
            accuracy: computeAccuracy(stats.correctWords, stats.incorrectWords),
```

to:

```ts
            accuracy: metrics.accuracy,
```

(leave `getWpmTitle(stats.finalWpm)` and `wpm: stats.finalWpm` as-is). Add `finalizeMetrics` to the effect dependency array. The now-unused `computeAccuracy` import/function may be removed.

- [ ] **Step 4: Typecheck + tests**

Run: `cd frontend && bunx tsc -b && bun run test`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/TypingInterface.tsx frontend/src/hooks/useTypingCompletion.ts
git commit -m "feat(metrics): wire session metrics into daily mode + keystroke accuracy overlay"
```

---

### Task 10: Populate `SessionPayload` in both handlers

**Files:**
- Modify: `frontend/src/handlers/EndlessCompletionHandler.ts`
- Modify: `frontend/src/handlers/DailyCompletionHandler.ts`

- [ ] **Step 1: Endless handler**

In `frontend/src/handlers/EndlessCompletionHandler.ts`, expand the `payload` object in `handleCompletion`:

```ts
    const payload: SessionPayload = {
      mode: 'endless',
      wpm: Math.round(stats.finalWpm),
      totalWords,
      correctWords: stats.correctWords,
      incorrectWords: stats.incorrectWords,
      difficulty,
      rawWpm: stats.metrics?.rawWpm,
      accuracy: stats.metrics?.accuracy,
      consistency: stats.metrics?.consistency,
      correctChars: stats.correctChars,
      incorrectChars: stats.incorrectChars,
      extraChars: stats.extraChars,
      missedChars: stats.missedChars,
      durationSeconds: Math.round(stats.elapsedMinutes * 60),
      afkSeconds: stats.metrics?.afkSeconds,
      chartData: stats.metrics?.chartData,
    };
```

- [ ] **Step 2: Daily handler**

In `frontend/src/handlers/DailyCompletionHandler.ts`, expand the `payload` in `handleSuccess` (final-quote branch). Keep `wpm: avgWpm`:

```ts
    const payload: SessionPayload = {
      mode: 'daily',
      wpm: avgWpm,
      totalWords,
      correctWords: stats.correctWords,
      incorrectWords: stats.incorrectWords,
      rawWpm: stats.metrics?.rawWpm,
      accuracy: stats.metrics?.accuracy,
      consistency: stats.metrics?.consistency,
      correctChars: stats.correctChars,
      incorrectChars: stats.incorrectChars,
      extraChars: stats.extraChars,
      missedChars: stats.missedChars,
      durationSeconds: Math.round(stats.elapsedMinutes * 60),
      afkSeconds: stats.metrics?.afkSeconds,
      chartData: stats.metrics?.chartData,
    };
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && bunx tsc -b`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/handlers/EndlessCompletionHandler.ts frontend/src/handlers/DailyCompletionHandler.ts
git commit -m "feat(metrics): include new metrics in session payloads"
```

---

### Task 11: Extend `createSession` body type (API client)

**Files:**
- Modify: `frontend/src/hooks/useApi.ts`

- [ ] **Step 1: Update the body type**

In `frontend/src/hooks/useApi.ts`, replace the `createSession` body type with the full `SessionPayload`. Add at the top:

```ts
import type { SessionPayload } from '../types/completion';
```

Replace the `createSession` callback's parameter type:

```ts
  const createSession = useCallback(
    (body: SessionPayload) =>
      authFetch('/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    [authFetch]
  );
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && bunx tsc -b`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useApi.ts
git commit -m "feat(metrics): accept full SessionPayload in createSession"
```

---

### Task 12: Backend schema columns + migration

**Files:**
- Modify: `backend/src/db/schema.ts`
- Create: generated migration under `backend/drizzle/`

- [ ] **Step 1: Add nullable columns**

In `backend/src/db/schema.ts`, inside the `gameSessions` table definition, after `incorrectWords: integer('incorrect_words').notNull(),` add (all nullable, no `.notNull()`):

```ts
    rawWpm: integer('raw_wpm'),
    accuracy: integer('accuracy'),
    consistency: integer('consistency'),
    correctChars: integer('correct_chars'),
    incorrectChars: integer('incorrect_chars'),
    extraChars: integer('extra_chars'),
    missedChars: integer('missed_chars'),
    durationSeconds: integer('duration_seconds'),
    afkSeconds: integer('afk_seconds'),
    chartData: text('chart_data'),
```

- [ ] **Step 2: Generate the migration**

Run: `cd backend && bunx drizzle-kit generate`
Expected: a new `drizzle/NNNN_*.sql` file adding the 10 columns. Inspect it to confirm it only `ALTER TABLE game_sessions ADD COLUMN ...` (no table drops/recreates).

- [ ] **Step 3: Apply locally + verify**

Run: `cd backend && bunx wrangler d1 migrations apply typing-rpg-db --local`
Then verify: `bunx wrangler d1 execute typing-rpg-db --local --command "PRAGMA table_info(game_sessions);"`
Expected: the new columns listed.

- [ ] **Step 4: Commit**

```bash
git add backend/src/db/schema.ts backend/drizzle/
git commit -m "feat(metrics): add game_sessions metric columns + migration"
```

---

### Task 13: Backend validation + insert

**Files:**
- Modify: `backend/src/handlers/sessions.ts`
- Test: `backend/src/handlers/sessions.test.ts` (or the existing sessions test file)

- [ ] **Step 1: Write the failing test**

Locate the existing sessions handler test (search `backend` for `createSession` / `sessions`). Add cases asserting (a) a payload with the new fields validates and the columns persist, and (b) a payload omitting them still succeeds. Mirror the existing test's harness. Skeleton (adapt imports/mocks to the existing file's style):

```ts
import { describe, it, expect } from 'vitest';
import { sessionSchema } from './sessions';

describe('sessionSchema metrics fields', () => {
  it('accepts new optional metric fields', () => {
    const r = sessionSchema.safeParse({
      mode: 'endless',
      wpm: 80,
      totalWords: 20,
      correctWords: 19,
      incorrectWords: 1,
      rawWpm: 85,
      accuracy: 95,
      consistency: 72,
      correctChars: 95,
      incorrectChars: 5,
      extraChars: 1,
      missedChars: 0,
      durationSeconds: 15,
      afkSeconds: 0,
      chartData: { wpm: [70, 80], raw: [75, 85], err: [0, 1] },
    });
    expect(r.success).toBe(true);
  });

  it('still accepts a payload without metric fields', () => {
    const r = sessionSchema.safeParse({
      mode: 'daily',
      wpm: 60,
      totalWords: 30,
      correctWords: 29,
      incorrectWords: 1,
    });
    expect(r.success).toBe(true);
  });

  it('rejects out-of-range accuracy', () => {
    const r = sessionSchema.safeParse({
      mode: 'endless',
      wpm: 80,
      totalWords: 1,
      correctWords: 1,
      incorrectWords: 0,
      accuracy: 150,
    });
    expect(r.success).toBe(false);
  });
});
```

This requires exporting `sessionSchema`. In `backend/src/handlers/sessions.ts` change `const sessionSchema = z.object({` to `export const sessionSchema = z.object({`.

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && bun run test sessions`
Expected: FAIL — new fields rejected / `sessionSchema` not exported.

- [ ] **Step 3: Extend the schema + insert**

In `backend/src/handlers/sessions.ts`, extend `sessionSchema` with the new optional, bounded fields:

```ts
export const sessionSchema = z.object({
  mode: z.enum(['daily', 'endless']),
  wpm: z.number().int().nonnegative().max(300),
  totalWords: z.number().int().nonnegative().max(2000),
  correctWords: z.number().int().nonnegative().max(2000),
  incorrectWords: z.number().int().nonnegative().max(2000),
  difficulty: z
    .enum(['beginner', 'common', 'intermediate', 'advanced'])
    .optional(),
  rawWpm: z.number().int().nonnegative().max(600).optional(),
  accuracy: z.number().int().min(0).max(100).optional(),
  consistency: z.number().int().min(0).max(100).optional(),
  correctChars: z.number().int().nonnegative().max(10000).optional(),
  incorrectChars: z.number().int().nonnegative().max(10000).optional(),
  extraChars: z.number().int().nonnegative().max(10000).optional(),
  missedChars: z.number().int().nonnegative().max(10000).optional(),
  durationSeconds: z.number().int().nonnegative().max(3600).optional(),
  afkSeconds: z.number().int().nonnegative().max(3600).optional(),
  chartData: z
    .object({
      wpm: z.array(z.number().int()).max(300),
      raw: z.array(z.number().int()).max(300),
      err: z.array(z.number().int()).max(300),
    })
    .optional(),
});
```

Update the destructure and the insert. Replace the destructure line:

```ts
  const {
    mode,
    wpm,
    totalWords,
    correctWords,
    incorrectWords,
    difficulty,
    rawWpm,
    accuracy,
    consistency,
    correctChars,
    incorrectChars,
    extraChars,
    missedChars,
    durationSeconds,
    afkSeconds,
    chartData,
  } = parsed.data;
```

Replace the insert `.values({...})` with:

```ts
      .values({
        userId,
        mode,
        wpm,
        totalWords,
        correctWords,
        incorrectWords,
        rawWpm,
        accuracy,
        consistency,
        correctChars,
        incorrectChars,
        extraChars,
        missedChars,
        durationSeconds,
        afkSeconds,
        chartData: chartData ? JSON.stringify(chartData) : null,
      })
```

XP logic (`calculateXpDelta(mode, incorrectWords, wpm, difficulty)`) is unchanged.

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && bun run test sessions`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/handlers/sessions.ts backend/src/handlers/sessions.test.ts
git commit -m "feat(metrics): validate + persist new session metrics in backend"
```

---

### Task 14: Manual verification (real app)

**Files:** none (verification only).

- [ ] **Step 1: Run backend + frontend**

Run backend: `cd backend && bun run dev` (separate terminal).
Run frontend: `cd frontend && bun run dev`.

- [ ] **Step 2: Endless run**

Play an Endless fight to a monster kill. Confirm the overlay shows an accuracy that now reflects keystroke errors (type some wrong letters then backspace-fix them — accuracy should drop below 100 even though the final words are correct, proving keystroke-level).

- [ ] **Step 3: Verify DB row**

Run: `cd backend && bunx wrangler d1 execute typing-rpg-db --local --command "SELECT mode, wpm, raw_wpm, accuracy, consistency, correct_chars, incorrect_chars, extra_chars, missed_chars, duration_seconds, afk_seconds, length(chart_data) AS chart_len FROM game_sessions ORDER BY id DESC LIMIT 3;"`
Expected: newest row has populated metric columns and non-null `chart_data`.

- [ ] **Step 4: Daily run** (if a daily attempt is available)

Complete the 3-quote daily. Confirm a row with `mode=daily` has populated metrics (reflecting the final quote) and `wpm` is the 3-quote average.

State the observed values in your report.

---

### Task 15: Full CI verification + merge to dev

**Files:** none (verification + merge).

- [ ] **Step 1: Frontend CI**

Run: `cd frontend && bun install && bun run lint && bun run format:check && bunx tsc -b && bun run test && bun run build`
Expected: all green.

- [ ] **Step 2: Backend CI**

Run: `cd backend && bun install && bunx tsc -b && bun run test`
Expected: all green. (If backend uses a different typecheck script, use `bun run typecheck`.)

- [ ] **Step 3: Merge to dev**

Per project workflow (squash not required for dev):

```bash
git checkout dev && git pull origin dev
git merge --no-ff feature/full-typing-metrics -m "Merge feature/full-typing-metrics: capture full typing metrics"
git push origin dev
```

- [ ] **Step 4: Vault sync decision**

This ships new tracked product data (per-session accuracy, consistency, raw WPM, char breakdown, AFK, per-second history) — **vault-worthy**. Invoke the `vault-update` skill to record the expanded session metrics. Then remove the worktree.

---

## Self-review notes

- **Spec coverage:** raw WPM (T6/T10/T13), keystroke accuracy (T6 + overlay T8/T9), consistency (T2/T6), char breakdown (T1/T4/T5/T10/T13), per-second chartData (T6/T13), duration (T10 `durationSeconds`), AFK (T6/T10), storage columns A (T12), validation (T13), overlay swap (T8/T9). All covered.
- **Type consistency:** `SessionMetrics`/`ChartData`/`CompletionStats`/`SessionPayload` defined once in T3 and consumed by T6/T9/T10/T11; `finalize(elapsedMinutes)` signature consistent across T6/T8/T9; `recordKeypress(correct)`/`startIfNeeded()`/`reset()` names consistent T6↔T7↔T8↔T9.
- **Known limitations (documented):** daily metrics reflect the final quote; rawWpm/accuracy exclude spaces; sampler throttles under tab-blur. All intentional for v1.
