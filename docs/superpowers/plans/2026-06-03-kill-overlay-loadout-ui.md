# Kill-driven Result Overlay + In-Typing-Area Loadout Picker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]` checkboxes.

**Goal:** In Endless, fire the SUPER FAST result overlay on monster *death* (with per-fight WPM/accuracy/XP and SPACE-to-reset), make 50-word block boundaries a silent refill, and move the weapon loadout picker into the typing area as a click-to-start gate.

**Architecture:** The *fight* (spawn→death) becomes the feedback/reward unit. A new `useFightStats` hook accumulates chars/correct/incorrect + a fight start time across silently-refilled blocks; at death it produces `CompletionStats` reused by the existing `EndlessCompletionHandler` (save + XP). `useTypingCompletion` stops handling endless (daily/raid unchanged); a dedicated effect in `TypingInterface` folds finished blocks and refills text. `GameProvider` stops auto-respawning endless monsters after the death animation — the overlay's continue (SPACE/click) drives the next spawn. The loadout panel renders as a dark overlay card inside the typing box, gated by a `loadoutPending` flag.

**Tech Stack:** React 19, TypeScript, Vite, vitest, Tailwind.

---

## File map

| File | Change |
|------|--------|
| `frontend/src/hooks/useFightStats.ts` | **New.** Fight-scoped accumulator + pure `finalizeFightStats`. |
| `frontend/src/hooks/useFightStats.test.ts` | **New.** Unit tests for `finalizeFightStats`. |
| `frontend/src/hooks/useTypingCompletion.ts` | Early-return for endless (block completion no longer saves/XP/overlays); drop the dead endless branch in `loadNewText`. |
| `frontend/src/context/GameProvider.tsx` | Remove the endless 1.2s auto-clear-defeat timer (respawn now gated behind continue). |
| `frontend/src/components/TypingInterface.tsx` | Fight-stats wiring, silent block refill, death→overlay finalizer, continue→spawn, loadout overlay + `loadoutPending` lifecycle, input/blur guards. |
| `frontend/src/components/WeaponLoadoutPanel.tsx` | Render as a dark overlay card; add `onConfirm`; chip click sets loadout AND confirms. |
| `frontend/src/components/EndlessOptions.tsx` | Remove `<WeaponLoadoutPanel />`. |

---

## Task 1: `useFightStats` hook + pure finalizer (TDD)

**Files:**
- Create: `frontend/src/hooks/useFightStats.ts`
- Test: `frontend/src/hooks/useFightStats.test.ts`

- [ ] **Step 1: Write failing test** for `finalizeFightStats` covering: accum + current sum, WPM = chars/5/min rounded, zero-time guard, accuracy inputs.

```ts
import { describe, it, expect } from 'vitest';
import { finalizeFightStats } from './useFightStats';

describe('finalizeFightStats', () => {
  it('sums accumulated blocks with the in-progress block', () => {
    const stats = finalizeFightStats(
      { chars: 100, correct: 20, incorrect: 2 },
      { totalCharsIncludingSpaces: 50, correctWords: 10, incorrectWords: 1 },
      1, // minute
    );
    expect(stats.totalCharsIncludingSpaces).toBe(150);
    expect(stats.correctWords).toBe(30);
    expect(stats.incorrectWords).toBe(3);
    expect(stats.finalWpm).toBe(30); // 150/5/1
    expect(stats.elapsedMinutes).toBe(1);
  });

  it('returns 0 wpm when no time elapsed', () => {
    const stats = finalizeFightStats(
      { chars: 0, correct: 0, incorrect: 0 },
      { totalCharsIncludingSpaces: 25, correctWords: 5, incorrectWords: 0 },
      0,
    );
    expect(stats.finalWpm).toBe(0);
  });
});
```

- [ ] **Step 2: Run** `bun run test useFightStats` → FAIL (module not found).

- [ ] **Step 3: Implement** `frontend/src/hooks/useFightStats.ts`:

```ts
import { useRef, useCallback } from 'react';
import type { CompletionStats } from '../types/completion';
import type { WordAnalysisResult } from '../utils/wordAnalysis';

interface FightAccum {
  chars: number;
  correct: number;
  incorrect: number;
}

const EMPTY: FightAccum = { chars: 0, correct: 0, incorrect: 0 };

// Pure: combine the fight's accumulated completed-block totals with the
// in-progress block and elapsed time into CompletionStats. WPM uses the same
// chars/5/min rule as usePerformanceTracking so it matches the live number.
export function finalizeFightStats(
  accum: FightAccum,
  current: WordAnalysisResult,
  elapsedMinutes: number
): CompletionStats {
  const totalCharsIncludingSpaces =
    accum.chars + current.totalCharsIncludingSpaces;
  const correctWords = accum.correct + current.correctWords;
  const incorrectWords = accum.incorrect + current.incorrectWords;
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
  };
}

// Fight-scoped (monster spawn -> death) typing accumulator. Survives the silent
// 50-word block refills that happen mid-fight; reset on continue / new run.
export function useFightStats() {
  const accumRef = useRef<FightAccum>({ ...EMPTY });
  const startRef = useRef<number | null>(null);

  const startFightIfNeeded = useCallback(() => {
    if (startRef.current === null) startRef.current = Date.now();
  }, []);

  const foldBlock = useCallback((block: WordAnalysisResult) => {
    accumRef.current = {
      chars: accumRef.current.chars + block.totalCharsIncludingSpaces,
      correct: accumRef.current.correct + block.correctWords,
      incorrect: accumRef.current.incorrect + block.incorrectWords,
    };
  }, []);

  const finalize = useCallback(
    (current: WordAnalysisResult): CompletionStats => {
      const elapsedMinutes =
        startRef.current !== null
          ? (Date.now() - startRef.current) / 60000
          : 0;
      return finalizeFightStats(accumRef.current, current, elapsedMinutes);
    },
    []
  );

  const resetFight = useCallback(() => {
    accumRef.current = { ...EMPTY };
    startRef.current = null;
  }, []);

  return { startFightIfNeeded, foldBlock, finalize, resetFight };
}
```

- [ ] **Step 4: Run** `bun run test useFightStats` → PASS.
- [ ] **Step 5: Commit** `feat(endless): fight-scoped typing stats accumulator`.

---

## Task 2: Stop endless from completing on block boundaries

**Files:** Modify `frontend/src/hooks/useTypingCompletion.ts`.

- [ ] **Step 1:** Add an endless early-return as the first lines inside the effect (right after the `if (!isCompleted || isProcessingCompletion) return;` guard):

```ts
    if (!isCompleted || isProcessingCompletion) return;

    // Endless: block/text completion is a SILENT buffer refill, not a kill.
    // Kills are HP-based and finalized in TypingInterface's death handler
    // (save + XP + overlay happen there). The block-refill effect in
    // TypingInterface owns markAsProcessed + restartSession for endless.
    if (currentMode === 'endless') return;

    setIsProcessingCompletion(true);
```

- [ ] **Step 2:** In the `case 'loadNewText'` branch, remove the now-unreachable endless sub-branch, leaving only the raid timeout:

```ts
        case 'loadNewText':
        default:
          // Raid (and any other auto-advancing mode): keep the brief pause.
          setTimeout(() => {
            setIsProcessingCompletion(false);
            restartSession();
          }, 400);
          break;
```

- [ ] **Step 3: Run** `bunx tsc -b` → 0 errors (endless-only args become unused but are still referenced by daily/raid paths; no removals needed).
- [ ] **Step 4: Commit** `refactor(endless): block completion no longer ends the session`.

---

## Task 3: Gate endless respawn behind continue (remove auto-clear timer)

**Files:** Modify `frontend/src/context/GameProvider.tsx`.

- [ ] **Step 1:** Delete the endless death-animation auto-clear effect (the block that does `setTimeout(() => setIsCurrentMonsterDefeated(false), 1200)` for endless). Replace its comment region with a note:

```ts
  // Endless respawn is gated behind the post-kill results overlay: the defeat
  // flag stays true (monster shows its death state) until the player presses
  // Space, at which point TypingInterface calls resetDefeatState() -> App spawns
  // the next monster. (Daily/raid still clear via the remainingWords derive.)
```

- [ ] **Step 2: Run** `bunx tsc -b` → 0 errors.
- [ ] **Step 3: Commit** `feat(endless): hold dead monster until player continues`.

> NOTE: between this task and Task 4, endless will not respawn (continue isn't wired yet). That's expected; Task 4 completes the loop. Do not test endless gameplay until Task 4 lands.

---

## Task 4: TypingInterface — fight stats, silent refill, death overlay, continue→spawn

**Files:** Modify `frontend/src/components/TypingInterface.tsx`.

- [ ] **Step 1: Imports + constant.** Add:

```ts
import { useFightStats } from '../hooks/useFightStats';
import { analyzeWords } from '../utils/wordAnalysis';
import { getWpmTitle } from '../utils/wpmTitle';
import WeaponLoadoutPanel from './WeaponLoadoutPanel';
```

Add near `ENDLESS_BLOCK_WORDS`:

```ts
// Matches the monster death-animation window; the result overlay reveals after it.
const DEATH_ANIM_MS = 1200;

// Word-level accuracy as a 0-100 integer (100 when nothing typed).
function accuracyPct(correct: number, incorrect: number): number {
  const total = correct + incorrect;
  return total > 0 ? Math.round((correct / total) * 100) : 100;
}
```

- [ ] **Step 2: Pull extra context fields.** Add `monsterHp`, `isCurrentMonsterDefeated`, `resetDefeatState`, `isPlayerDead` (already present), `currentMonsterVariant` not needed. Update the `useGameContext()` destructure to include `monsterHp`, `isCurrentMonsterDefeated`, `resetDefeatState`.

- [ ] **Step 3: Instantiate fight stats + new state/refs.** After the popup hooks:

```ts
  const fightStats = useFightStats();
  const [loadoutPending, setLoadoutPending] = useState(
    currentMode === 'endless'
  );
  const prevDefeatedRef = useRef(false);
  const fightFinalizedRef = useRef(false);
  const wasDeadRef = useRef(false);
```

- [ ] **Step 4: Start the fight clock on first keystroke.** In `handleKeyDown`'s character branch, add `fightStats.startFightIfNeeded();` next to `performance.startSession()`:

```ts
      if (!hasStartedTyping) {
        setHasStartedTyping(true);
        performance.startSession();
        fightStats.startFightIfNeeded();
        trackEvent('started_typing', currentMode);
      }
```

- [ ] **Step 5: Input guards.** At the top of `handleKeyDown`, after `if (isPlayerDead) return;`:

```ts
    // Pre-run loadout gate: ignore typing until the player picks a loadout.
    if (loadoutPending) {
      if (e.key !== 'Tab') e.preventDefault();
      return;
    }
```

And after the existing `awaitingContinue` block, before `if (key === 'Tab') return;`, add a guard for the death-animation window (defeated but overlay not shown yet):

```ts
    // Endless: monster is dead and playing its death animation; freeze input
    // until the results overlay appears (then the awaitingContinue branch runs).
    if (currentMode === 'endless' && isCurrentMonsterDefeated) {
      e.preventDefault();
      return;
    }
```

- [ ] **Step 6: Silent block refill effect** (endless, monster alive). Add after the existing text-reset effect:

```ts
  // Endless: when the player exhausts a 50-word block but the monster is still
  // alive, fold the finished block's stats into the fight and refill the buffer
  // silently — no overlay, no pause, no fight-stats reset. Guarded by
  // monsterHp > 0 so a kill that lands on the last word of a block is owned by
  // the death finalizer instead (avoids a wrong, post-refill stats snapshot).
  useEffect(() => {
    if (currentMode !== 'endless') return;
    if (!completion.isCompleted) return;
    if (awaitingContinue || isCurrentMonsterDefeated || monsterHp <= 0) return;
    completion.markAsProcessed();
    fightStats.foldBlock(
      analyzeWords(text, charStatusRef.current, typingMechanics.overflow)
    );
    restartSession();
  }, [
    currentMode,
    completion,
    awaitingContinue,
    isCurrentMonsterDefeated,
    monsterHp,
    fightStats,
    text,
    typingMechanics.overflow,
    restartSession,
    charStatusRef,
  ]);
```

- [ ] **Step 7: Death finalizer effect** (endless kill → save + XP + overlay). Add:

```ts
  // Endless: when the monster dies (defeat flag rises), finalize the fight:
  // snapshot per-fight stats, save the session + preview XP via the endless
  // handler, then reveal the SUPER FAST overlay after the death animation.
  // GameProvider already counted the kill, so we never incrementMonstersDefeated.
  useEffect(() => {
    if (currentMode !== 'endless') {
      prevDefeatedRef.current = isCurrentMonsterDefeated;
      return;
    }
    const rising = isCurrentMonsterDefeated && !prevDefeatedRef.current;
    prevDefeatedRef.current = isCurrentMonsterDefeated;
    if (!rising || !hasStartedTyping || fightFinalizedRef.current) return;
    fightFinalizedRef.current = true;

    const stats = fightStats.finalize(
      analyzeWords(text, charStatusRef.current, typingMechanics.overflow)
    );
    let revealId: number | undefined;
    (async () => {
      const result = await completionHandler.handleCompletion(stats);
      if (result.action === 'saveError') {
        setSaveError(result.message ?? 'Failed to save. Please retry.');
        setPendingRetrySave(() => result.retrySave ?? null);
      }
      if (typeof result.xpDelta === 'number') setEarnedXp(result.xpDelta);
      reloadPlayerStats();
      setKillResult({
        title: getWpmTitle(stats.finalWpm),
        wpm: stats.finalWpm,
        accuracy: accuracyPct(stats.correctWords, stats.incorrectWords),
        xp: typeof result.xpDelta === 'number' ? result.xpDelta : undefined,
      });
      revealId = window.setTimeout(() => setAwaitingContinue(true), DEATH_ANIM_MS);
    })();
    return () => {
      if (revealId) window.clearTimeout(revealId);
    };
  }, [
    currentMode,
    isCurrentMonsterDefeated,
    hasStartedTyping,
    fightStats,
    text,
    typingMechanics.overflow,
    completionHandler,
    reloadPlayerStats,
    charStatusRef,
  ]);
```

- [ ] **Step 8: Rewrite `handleContinue`** to drive the next fight (endless) and reset fight state:

```ts
  const handleContinue = useCallback(() => {
    if (!awaitingContinue) return;
    setAwaitingContinue(false);
    setKillResult(null);
    if (currentMode === 'endless') {
      fightStats.resetFight();
      fightFinalizedRef.current = false;
      prevDefeatedRef.current = false;
      resetDefeatState(); // flag falls -> App spawns the next monster
      restartSession(); // fresh 50-word buffer
    }
    containerRef.current?.focus();
  }, [awaitingContinue, currentMode, fightStats, resetDefeatState, restartSession]);
```

- [ ] **Step 9: Loadout lifecycle effects.** Add:

```ts
  // Show the loadout picker at the start of every endless run: on entering
  // endless, and again after a death reset (revive). Reset fight stats too.
  useEffect(() => {
    if (currentMode === 'endless') {
      setLoadoutPending(true);
      fightStats.resetFight();
      fightFinalizedRef.current = false;
      prevDefeatedRef.current = false;
    } else {
      setLoadoutPending(false);
    }
  }, [currentMode, fightStats]);

  useEffect(() => {
    if (currentMode !== 'endless') return;
    if (wasDeadRef.current && !isPlayerDead) {
      setLoadoutPending(true);
      setAwaitingContinue(false);
      setKillResult(null);
      fightStats.resetFight();
      fightFinalizedRef.current = false;
      prevDefeatedRef.current = false;
    }
    wasDeadRef.current = isPlayerDead;
  }, [currentMode, isPlayerDead, fightStats]);

  const handleLoadoutConfirm = useCallback(() => {
    setLoadoutPending(false);
    containerRef.current?.focus();
  }, []);
```

- [ ] **Step 10: surfaceBlurred + banner + overlay render.** Update `surfaceBlurred`:

```ts
  const surfaceBlurred =
    !isFocused ||
    awaitingContinue ||
    isProcessingCompletion ||
    isPlayerDead ||
    dailyLocked ||
    loadoutPending ||
    (currentMode === 'endless' && isCurrentMonsterDefeated);
```

Update the "Click to start fighting!" banner visibility to `visible={!isFocused && !dailyLocked && !loadoutPending}`.

Add the loadout overlay inside the `mx-auto w-full max-w-2xl relative` div (sibling to the KillResultOverlay slot):

```tsx
          {currentMode === 'endless' && loadoutPending && (
            <WeaponLoadoutPanel onConfirm={handleLoadoutConfirm} />
          )}
```

- [ ] **Step 11: Run** `bunx tsc -b && bun run lint` → 0 errors (1 known pre-existing `useCompletionDetection` warning OK).
- [ ] **Step 12: Commit** `feat(endless): kill-driven result overlay with per-fight stats`.

---

## Task 5: WeaponLoadoutPanel as an overlay card with click-to-start

**Files:** Modify `frontend/src/components/WeaponLoadoutPanel.tsx`.

- [ ] **Step 1:** Add an `onConfirm` prop and confirm-on-pick. Replace the component signature and the two selectable `onClick`s:

```tsx
interface WeaponLoadoutPanelProps {
  // Called after the player picks a loadout chip — confirms the choice and
  // starts the run. When omitted, picking just sets the loadout (legacy inline use).
  onConfirm?: () => void;
}

export default function WeaponLoadoutPanel({
  onConfirm,
}: WeaponLoadoutPanelProps) {
```

Fists `onClick`: `onClick={() => { setLoadout(null); onConfirm?.(); }}`.
Weapon `onClick`: `onClick={() => { setLoadout(w.id); onConfirm?.(); }}`.

- [ ] **Step 2:** Wrap the panel as a dark overlay card (mirrors KillResultOverlay). Replace the outer `<div className="flex w-full max-w-md ...">` wrapper with:

```tsx
  return (
    <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-20 rounded-lg pointer-events-auto">
      <div className="px-6 py-5 rounded-xl backdrop-blur-sm bg-black/40 flex flex-col items-center gap-3 drop-shadow text-center max-w-md">
        <span className="text-amber-300 font-bold uppercase tracking-wide text-sm">
          Choose your weapon
        </span>
        {!isSignedIn && (
          <span className="text-[0.7rem] text-gray-300">
            Sign in to collect &amp; equip weapons
          </span>
        )}
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {/* chips unchanged below */}
```

Force a dark chip palette (the card is dark regardless of theme). Replace the `dark` branch usage in chip classNames with the dark styles unconditionally (drop the `useThemeContext` light branches inside this component) and close the two wrapper divs at the end:

```tsx
        </div>
        <span className="text-xs text-gray-300">
          Pick a weapon to start fighting
        </span>
      </div>
    </div>
  );
```

Concretely the chip class strings become (Fists selected/unselected, locked, weapon selected/unselected) the dark variants only:
- selected: `border-amber-400 bg-amber-900/40 text-amber-200`
- unselected: `border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500`
- locked: `cursor-not-allowed border-gray-800 bg-gray-900 text-gray-600`
- weapon selected keeps `${RARITY_COLOR[w.rarity]}` appended.

Remove the now-unused `useThemeContext` import and `theme`/`dark` locals.

- [ ] **Step 3: Run** `bunx tsc -b && bun run lint` → 0 errors.
- [ ] **Step 4: Commit** `feat(weapons): loadout picker as in-typing-area start gate`.

---

## Task 6: Remove the loadout panel from EndlessOptions

**Files:** Modify `frontend/src/components/EndlessOptions.tsx`.

- [ ] **Step 1:** Delete the `import WeaponLoadoutPanel` line and the `{/* Pre-run weapon loadout picker (Phase 3b) */}` + `<WeaponLoadoutPanel />` block. The component now renders only the difficulty dropdown row.
- [ ] **Step 2: Run** `bunx tsc -b && bun run lint` → 0 errors.
- [ ] **Step 3: Commit** `refactor(endless): drop loadout panel from mode options`.

---

## Task 7: Full verification

- [ ] **Step 1:** `cd frontend && bunx tsc -b && bun run lint && bun run format:check && bun run test && bun run build` — all green (1 pre-existing lint warning, 1 pre-existing chunk-size warning allowed).
- [ ] **Step 2: Manual (Endless, signed in):** loadout card shows in the typing box at run start over a blurred surface; clicking a weapon starts the run; words refill silently mid-fight with no pause; killing a monster shows SUPER FAST (fight WPM/accuracy/XP) after the death animation; SPACE resets words + spawns the next monster; dying → loadout card returns. Logged-out: Fists-only card, kill overlay still shows.
- [ ] **Step 3:** Merge to `dev` per CLAUDE.md once CI passes; remove worktree.

---

## Self-review notes

- **Spec coverage:** Part A (loadout overlay + click-to-start + run-start-only reshow) → Tasks 5, 6, 4(steps 9-10). Part B (silent refill, fight stats, kill overlay after anim, SPACE reset, daily untouched) → Tasks 1-4. Respawn gating → Task 3 + Task 4(step 8).
- **Type consistency:** `finalizeFightStats`/`finalize` return `CompletionStats` (matches `completionHandler.handleCompletion` + `EndlessCompletionHandler`). `WordAnalysisResult` is the `analyzeWords` return type. `accuracyPct` mirrors `computeAccuracy` in useTypingCompletion.
- **Race guards:** silent-refill effect bails on `monsterHp <= 0` / `isCurrentMonsterDefeated`; death finalizer is one-shot via `fightFinalizedRef`; child-before-parent effect order means the `monsterHp <= 0` guard (state, not flag) is the reliable discriminator.
- **Edge cases:** logged-out (Fists-only, client stats), fast kill (<1 block, accum=0), zero-time WPM guard, player can't die during overlay (attack loop pauses while defeated).
