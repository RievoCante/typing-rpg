# Endless Combat Mechanic Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In Endless mode, make each correctly-typed word deal damage to a fixed-HP monster, with a combo streak that raises crit chance — replacing the "remaining words = HP" model and the player-chosen word count with a continuous word stream.

**Architecture:** Monster gains a real `monsterHp` (per-tier) decoupled from the word pool. Each fully-correct word (`wordCompleted` reducer event) rolls a crit via a streak-based chance and subtracts damage; each wrong word (`wordMistake` event) deals 0 and resets the streak. Words become a continuous ~50-word stream that regenerates near its end and is **not** reset when a monster dies. Pure tuning + combo logic are isolated and unit-tested; UI (HP bar, combo meter, popups, SFX) reuses existing patterns.

**Tech Stack:** React 19 + TypeScript + Vite, Vitest, Tailwind. Frontend only — no backend/schema changes.

**Spec:** `docs/superpowers/specs/2026-06-02-endless-combat-mechanic-design.md`

**Scope:** Endless mode only. Daily and Raid are untouched. Compact potion UI, monster variety, and weapons are later phases — NOT in this plan.

**Before you start — read these files to load context (each task assumes you have):**
- `frontend/src/context/GameProvider.tsx` and `frontend/src/context/GameContext.ts` (game state)
- `frontend/src/components/TypingInterface.tsx` (`handleWordCompleted` ~line 119, text-gen effect ~line 161, `restartSession` ~line 190)
- `frontend/src/hooks/useTypingMechanics.ts` + `frontend/src/utils/typingReducer.ts` (`wordCompleted`/`wordMistake` events)
- `frontend/src/hooks/usePotionSystem.ts` + `frontend/src/hooks/usePotionPopups.ts` + `frontend/src/components/TypingPopups.tsx` (event→popup→SFX pattern to mirror)
- `frontend/src/hooks/useMonsterAttackLoop.ts` (tier config precedent)
- `frontend/src/App.tsx` (`generateNewMonster` ~line 75, spawn-after-defeat effect ~line 107)

**Run all frontend commands from `frontend/`.** Verification gate for the whole feature: `bun run lint && bun run format:check && bunx tsc --noEmit && bun run test`.

---

### Task 1: Combat tuning module (pure constants + helpers)

**Files:**
- Create: `frontend/src/utils/combatTuning.ts`
- Test: `frontend/src/utils/combatTuning.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/utils/combatTuning.test.ts
import { describe, it, expect } from 'vitest';
import {
  MONSTER_MAX_HP,
  BASE_DMG,
  CRIT_MULT,
  critChanceForStreak,
  rollDamage,
} from './combatTuning';

describe('combatTuning', () => {
  it('maps tiers to fixed HP', () => {
    expect(MONSTER_MAX_HP.normal).toBe(24);
    expect(MONSTER_MAX_HP['mini-boss']).toBe(48);
    expect(MONSTER_MAX_HP.boss).toBe(90);
  });

  it('ramps crit chance 1.5% per streak, capped at 75%', () => {
    expect(critChanceForStreak(0)).toBeCloseTo(0);
    expect(critChanceForStreak(5)).toBeCloseTo(0.075);
    expect(critChanceForStreak(20)).toBeCloseTo(0.3);
    expect(critChanceForStreak(50)).toBeCloseTo(0.75);
    expect(critChanceForStreak(100)).toBeCloseTo(0.75); // clamped
  });

  it('rollDamage returns crit damage when rng is below crit chance', () => {
    // streak 50 -> 75% crit; rng 0.1 < 0.75 => crit
    expect(rollDamage(50, () => 0.1)).toEqual({ damage: BASE_DMG * CRIT_MULT, crit: true });
  });

  it('rollDamage returns base damage when rng is above crit chance', () => {
    // streak 50 -> 75% crit; rng 0.9 > 0.75 => no crit
    expect(rollDamage(50, () => 0.9)).toEqual({ damage: BASE_DMG, crit: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test combatTuning`
Expected: FAIL — cannot find module `./combatTuning`.

- [ ] **Step 3: Write minimal implementation**

```ts
// frontend/src/utils/combatTuning.ts
import type { MonsterTypeEnum } from '../context/GameContext';

// Fixed monster HP per tier. HP is decoupled from the words typed: each correct
// word deals BASE_DMG (or BASE_DMG * CRIT_MULT on a crit). Tuned so a "cold"
// normal monster (~1 dmg/word) dies in ~24 words (≈ today's default), while a
// hot combo accelerates kills. Phase 2 (monster variety) extends this map.
export const MONSTER_MAX_HP: Record<MonsterTypeEnum, number> = {
  normal: 24,
  'mini-boss': 48,
  boss: 90,
};

export const BASE_DMG = 1;
export const CRIT_MULT = 2;

// Crit chance rises 1.5% per consecutive correct word, capped at 75% (reached
// at streak 50). A wrong word resets the streak to 0 (see useComboSystem).
const CRIT_RAMP_PER_WORD = 0.015;
const CRIT_CHANCE_CAP = 0.75;

export const critChanceForStreak = (streak: number): number =>
  Math.min(CRIT_CHANCE_CAP, Math.max(0, streak) * CRIT_RAMP_PER_WORD);

export interface DamageRoll {
  damage: number;
  crit: boolean;
}

// Pure: rng is injectable so tests are deterministic. Defaults to Math.random.
export const rollDamage = (
  streak: number,
  rng: () => number = Math.random
): DamageRoll => {
  const crit = rng() < critChanceForStreak(streak);
  return { damage: crit ? BASE_DMG * CRIT_MULT : BASE_DMG, crit };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test combatTuning`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/combatTuning.ts frontend/src/utils/combatTuning.test.ts
git commit -m "feat(combat): add combat tuning module (HP tiers, crit curve, damage roll)"
```

---

### Task 2: Combo system hook

**Files:**
- Create: `frontend/src/hooks/useComboSystem.ts`
- Test: `frontend/src/hooks/useComboSystem.test.ts`

The hook owns the consecutive-correct-word streak. It mirrors the shape of `usePotionSystem`. Streak persists across monster kills — it is only reset by a wrong word or an explicit `reset()` (called from `resetGameState`).

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/hooks/useComboSystem.test.ts
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useComboSystem } from './useComboSystem';

describe('useComboSystem', () => {
  it('starts at streak 0 with 0 crit chance', () => {
    const { result } = renderHook(() => useComboSystem());
    expect(result.current.streak).toBe(0);
    expect(result.current.critChance).toBeCloseTo(0);
  });

  it('increments streak on correct word and returns a damage roll', () => {
    const { result } = renderHook(() => useComboSystem());
    let roll: { damage: number; crit: boolean } | undefined;
    act(() => {
      roll = result.current.registerCorrectWord(() => 0.99); // no crit
    });
    expect(result.current.streak).toBe(1);
    expect(roll).toEqual({ damage: 1, crit: false });
  });

  it('resets streak to 0 on a wrong word', () => {
    const { result } = renderHook(() => useComboSystem());
    act(() => {
      result.current.registerCorrectWord(() => 0.99);
      result.current.registerCorrectWord(() => 0.99);
    });
    expect(result.current.streak).toBe(2);
    act(() => result.current.registerWrongWord());
    expect(result.current.streak).toBe(0);
  });

  it('reset() clears the streak', () => {
    const { result } = renderHook(() => useComboSystem());
    act(() => result.current.registerCorrectWord(() => 0.99));
    act(() => result.current.reset());
    expect(result.current.streak).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test useComboSystem`
Expected: FAIL — cannot find module `./useComboSystem`.

- [ ] **Step 3: Write minimal implementation**

```ts
// frontend/src/hooks/useComboSystem.ts
import { useCallback, useRef, useState } from 'react';
import { critChanceForStreak, rollDamage, type DamageRoll } from '../utils/combatTuning';

// Endless combo streak: consecutive correct words raise crit chance. A wrong
// word resets it to 0. The streak deliberately PERSISTS across monster kills —
// it represents the player's typing flow, not a monster's state — so nothing
// here resets on defeat; only registerWrongWord() and reset() (run restart) do.
export function useComboSystem() {
  const [streak, setStreak] = useState<number>(0);
  // Ref mirrors the latest streak so registerCorrectWord can roll damage against
  // the current value without a stale closure, matching usePotionSystem's style.
  const streakRef = useRef<number>(0);
  streakRef.current = streak;

  // Call on a fully-correct word. Rolls damage against the CURRENT streak, then
  // increments. rng is injectable for tests. Returns the roll so the caller can
  // apply damage + drive popups/SFX.
  const registerCorrectWord = useCallback(
    (rng: () => number = Math.random): DamageRoll => {
      const roll = rollDamage(streakRef.current, rng);
      setStreak(prev => prev + 1);
      return roll;
    },
    []
  );

  const registerWrongWord = useCallback(() => setStreak(0), []);
  const reset = useCallback(() => setStreak(0), []);

  return {
    streak,
    critChance: critChanceForStreak(streak),
    registerCorrectWord,
    registerWrongWord,
    reset,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test useComboSystem`
Expected: PASS (4 tests).

> Note: if `@testing-library/react`'s `renderHook` is not already a dependency, check existing hook tests (e.g. `useRaidState.test.ts`) for the project's established hook-testing approach and match it. Do not add new deps without confirming.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useComboSystem.ts frontend/src/hooks/useComboSystem.test.ts
git commit -m "feat(combat): add useComboSystem streak/crit hook"
```

---

### Task 3: Monster HP state in GameProvider / GameContext

**Files:**
- Modify: `frontend/src/context/GameContext.ts` (add fields to interface + default)
- Modify: `frontend/src/context/GameProvider.tsx` (state, damageMonster, HP-by-tier init, defeat detection, reset, combo wiring, context value)

Goal: add `monsterHp` + `monsterMaxHp` + `damageMonster(amount)`; initialize HP from `currentMonsterType` whenever it changes (App's `generateNewMonster` already calls `setCurrentMonsterType`); change defeat detection to fire on `monsterHp <= 0`; expose the combo system; reset everything in `resetGameState`.

- [ ] **Step 1: Add context type fields**

In `frontend/src/context/GameContext.ts`, add to the `GameContextType` interface (near the monster fields):

```ts
  // Endless monster HP (decoupled from words; see utils/combatTuning.ts)
  monsterHp: number;
  monsterMaxHp: number;
  damageMonster: (amount: number) => void;
  // Endless combo streak
  comboStreak: number;
  comboCritChance: number;
```

And add matching defaults to the `createContext` default object:

```ts
  monsterHp: 0,
  monsterMaxHp: 0,
  damageMonster: () => {},
  comboStreak: 0,
  comboCritChance: 0,
```

- [ ] **Step 2: Wire state + logic in GameProvider**

In `frontend/src/context/GameProvider.tsx`:

1. Add imports:
```ts
import { useComboSystem } from '../hooks/useComboSystem';
import { MONSTER_MAX_HP } from '../utils/combatTuning';
```

2. Add state + combo hook (near the other monster state):
```ts
  const [monsterMaxHp, setMonsterMaxHp] = useState<number>(
    MONSTER_MAX_HP.normal
  );
  const [monsterHp, setMonsterHp] = useState<number>(MONSTER_MAX_HP.normal);
  const combo = useComboSystem();
```

3. Initialize HP whenever the monster type changes (a new monster spawned). Add:
```ts
  // A new monster (type set by App.generateNewMonster) starts at full HP for
  // its tier. Endless only; daily/raid never set these.
  useEffect(() => {
    const max = MONSTER_MAX_HP[currentMonsterType];
    setMonsterMaxHp(max);
    setMonsterHp(max);
  }, [currentMonsterType]);
```

4. Add `damageMonster`:
```ts
  const damageMonster = useCallback((amount: number) => {
    setMonsterHp(prev => Math.max(0, prev - amount));
  }, []);
```

5. Replace the words-based defeat detection effect (currently GameProvider.tsx ~lines 68-73) with HP-based detection:
```ts
  // Defeat the instant monster HP hits zero, so the UI fires its defeat
  // animation before the next monster spawns.
  useEffect(() => {
    if (monsterHp <= 0 && !isCurrentMonsterDefeated && monsterMaxHp > 0) {
      setIsCurrentMonsterDefeated(true);
    }
  }, [monsterHp, monsterMaxHp, isCurrentMonsterDefeated]);
```

6. In `resetGameState`, reset HP + combo. Add inside the callback body:
```ts
    setMonsterMaxHp(MONSTER_MAX_HP.normal);
    setMonsterHp(MONSTER_MAX_HP.normal);
    combo.reset();
```
and add `combo` to its dependency array.

7. Expose in the context value object (and add to the `useMemo` deps): `monsterHp`, `monsterMaxHp`, `damageMonster`, `comboStreak: combo.streak`, `comboCritChance: combo.critChance`. Also expose the combo actions for Task 6 wiring — add `registerComboCorrect: combo.registerCorrectWord` and `registerComboWrong: combo.registerWrongWord` to the value (and to `GameContextType` + defaults in step 1: `registerComboCorrect: (rng?: () => number) => import('../utils/combatTuning').DamageRoll` is awkward in the default — instead type it as `registerComboCorrect: (rng?: () => number) => { damage: number; crit: boolean }` and default to `() => ({ damage: 1, crit: false })`; `registerComboWrong: () => void` default `() => {}`).

- [ ] **Step 3: Typecheck**

Run: `bunx tsc --noEmit`
Expected: PASS (no type errors). Fix any missing context-default/interface mismatches.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/context/GameContext.ts frontend/src/context/GameProvider.tsx
git commit -m "feat(combat): add monster HP + combo state to game context"
```

---

### Task 4: Health bar reads monster HP

**Files:**
- Modify: `frontend/src/components/HealthBar.tsx`

- [ ] **Step 1: Switch the source from words to HP**

Replace the `useGameContext` destructure and percentage math (HealthBar.tsx lines 10-17):

```tsx
  const { monsterHp, monsterMaxHp } = useGameContext();

  const validHp = Math.max(0, Math.min(monsterHp, monsterMaxHp));
  const healthPercentage = monsterMaxHp > 0 ? (validHp / monsterMaxHp) * 100 : 0;
  const clampedHealth = Math.max(0, Math.min(100, healthPercentage));
```

Delete the stale `remainingWords`-based comment block (lines 12-13, 19-21). Everything below (the bar markup) is unchanged.

- [ ] **Step 2: Typecheck + lint**

Run: `bunx tsc --noEmit && bun run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/HealthBar.tsx
git commit -m "feat(combat): health bar reflects monster HP not remaining words"
```

---

### Task 5: Apply damage + combo on each word (core wiring)

**Files:**
- Modify: `frontend/src/components/TypingInterface.tsx` (`handleWordCompleted` ~line 119; the `onWordMistake` wiring ~line 135)

This is the heart of the feature. On a correct word: roll combo damage, apply to monster, dispatch a `combat-hit` event. On a wrong word: reset combo, dispatch `combo-break`. (Wrong words already call `damagePlayerFromMistake` via `onWordMistake` — keep that; just add the combo reset.)

- [ ] **Step 1: Pull the new context values**

In `TypingInterface.tsx`, add to the `useGameContext()` destructure: `damageMonster`, `registerComboCorrect`, `registerComboWrong`.

- [ ] **Step 2: Update `handleWordCompleted`**

Replace the body (currently TypingInterface.tsx lines 119-130). Note: `decrementRemainingWords()` is removed from the damage path — words no longer drive HP. Keep `registerCorrectWord()` (potion drop) and the `word-hit` flash event.

```tsx
  const handleWordCompleted = useCallback(() => {
    triggerHit();
    if (currentMode === 'endless') {
      // Combo-driven damage to the monster.
      const { damage, crit } = registerComboCorrect();
      damageMonster(damage);
      window.dispatchEvent(
        new CustomEvent('combat-hit', { detail: { damage, crit } })
      );
      // Potions still drop on the per-correct-word clock.
      registerCorrectWord();
    }
    // Notify the monster model to flash red.
    try {
      window.dispatchEvent(new Event('word-hit'));
    } catch {
      /* ignore */
    }
  }, [
    triggerHit,
    currentMode,
    registerComboCorrect,
    damageMonster,
    registerCorrectWord,
  ]);
```

- [ ] **Step 3: Add a wrong-word combo reset**

The mechanics hook takes a single `onWordMistake`. Replace the inline `onWordMistake: damagePlayerFromMistake` (TypingInterface.tsx ~line 135) with a wrapper that both damages the player AND breaks the combo (Endless only):

```tsx
  const handleWordMistake = useCallback(() => {
    damagePlayerFromMistake();
    if (currentMode === 'endless') {
      registerComboWrong();
      window.dispatchEvent(new Event('combo-break'));
    }
  }, [damagePlayerFromMistake, currentMode, registerComboWrong]);
```

Then pass `onWordMistake: handleWordMistake` into `useTypingMechanics`.

- [ ] **Step 4: Typecheck + lint + run existing tests**

Run: `bunx tsc --noEmit && bun run lint && bun run test`
Expected: PASS. (No unit test for this wiring — it is integration glue verified manually in Task 9 + the dev-server smoke test in Task 10.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/TypingInterface.tsx
git commit -m "feat(combat): deal combo damage on correct word, break combo on mistake"
```

---

### Task 6: Continuous word stream (decouple text from monster death)

**Files:**
- Modify: `frontend/src/components/TypingInterface.tsx` (text-gen effect ~line 161; `restartSession` usage)
- Read first: `frontend/src/hooks/useTypingCompletion.ts` (it calls `incrementMonstersDefeated` and triggers `restartSession` on monster defeat — that text reset must NOT happen in Endless)

Today each monster defeat regenerates the text (via `restartSession`/`restartKey`). For a continuous stream, monster death must NOT reset the text; only buffer exhaustion (cursor reaching the end of the current block) regenerates it.

- [ ] **Step 1: Read and identify the defeat→text-reset path**

Open `useTypingCompletion.ts` and `TypingInterface.tsx`. Find where, in Endless, a monster defeat leads to `restartSession()` / `setRestartKey`. Confirm the exact call site. (In Daily this regeneration is correct and must stay.)

- [ ] **Step 2: Stop regenerating text on Endless monster defeat**

Change the logic so that in Endless mode, monster defeat does **not** call `restartSession()`. Monster defeat should still: `incrementMonstersDefeated()`, run the defeat animation, and let `App.generateNewMonster` spawn the next monster with fresh HP (Task 3 effect). The typed text continues uninterrupted.

Concretely: gate the defeat-triggered `restartSession()` on `currentMode !== 'endless'` (keep Daily behavior intact). Verify no other state tied to `restartKey` (potion reset, etc.) is needed on Endless monster death — `monstersDefeated` already drives the `hasStartedTyping` reset effect in GameProvider.

- [ ] **Step 3: Regenerate the stream when the block nears its end**

The text-gen effect (TypingInterface.tsx ~161) currently generates `endlessWordCount` words keyed on `restartKey`. Change Endless generation to a fixed block size and regenerate when the cursor approaches the end. Add a constant and a trigger:

```tsx
const ENDLESS_BLOCK_WORDS = 50;
// Regenerate when within this many words of the block end so typing never stalls.
const STREAM_REFILL_THRESHOLD = 10;
```

Approach: keep the existing effect for the FIRST block (and Daily), but for Endless drive regeneration off cursor progress instead of `restartKey`. When `text.length - cursorPosition` is small (fewer than ~`STREAM_REFILL_THRESHOLD` words remain), generate a fresh `ENDLESS_BLOCK_WORDS`-word block and swap it in, resetting the typing state for the new block (the player simply continues onto fresh words). Use `generateText('endless', undefined, ENDLESS_BLOCK_WORDS, endlessDifficulty)` — note `endlessWordCount` is being removed in Task 8, so do not reference it.

> Implementation note for the executor: the simplest correct version is a "swap at boundary" — when the player finishes the current block (cursor at end), immediately generate and set a new block. Because monster HP is independent of the block, monsters die mid-block and the block boundary is just a seamless text refresh. Keep the ~150ms transition fade only if it does not interrupt fast typists; if it causes a stall, drop the fade for Endless refills. Confirm by smoke test (Task 10) that typing never blocks waiting for words.

- [ ] **Step 4: Typecheck + lint + tests**

Run: `bunx tsc --noEmit && bun run lint && bun run test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/TypingInterface.tsx frontend/src/hooks/useTypingCompletion.ts
git commit -m "feat(combat): continuous word stream; monster death no longer resets text in endless"
```

---

### Task 7: Combo meter UI

**Files:**
- Create: `frontend/src/components/ComboMeter.tsx`
- Modify: `frontend/src/components/TypingInterface.tsx` (render it in Endless, near the typing area)

Presentational only — reads `comboStreak` + `comboCritChance` from context. Optimize for "fun/addicting" feel (Q4): escalating color + a fill bar + a brief glow when a new tier is reached. Labels are the implementer's call; suggested tiers below.

- [ ] **Step 1: Create the component**

```tsx
// frontend/src/components/ComboMeter.tsx
import { useGameContext } from '../hooks/useGameContext';
import { useThemeContext } from '../hooks/useThemeContext';

// Tier purely for label/colour feel; crit math lives in combatTuning.
// Tune freely for the most satisfying ramp.
function tier(streak: number, critChance: number) {
  if (streak <= 0) return { label: '', color: '', fill: 0 };
  if (critChance >= 0.75) return { label: '🔥 BLAZING', color: 'text-pink-400', fill: 100 };
  if (critChance >= 0.4) return { label: '🔥 Hot', color: 'text-orange-400', fill: critChance / 0.75 * 100 };
  return { label: 'Heating', color: 'text-yellow-300', fill: critChance / 0.75 * 100 };
}

export default function ComboMeter() {
  const { comboStreak, comboCritChance } = useGameContext();
  const { theme } = useThemeContext();
  if (comboStreak <= 0) return null;
  const t = tier(comboStreak, comboCritChance);

  return (
    <div className="mx-auto mb-2 flex w-full max-w-xs flex-col items-center gap-1 select-none">
      <div className="flex items-center gap-2 text-sm font-extrabold">
        <span className={t.color}>{t.label}</span>
        <span className={theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}>
          ×{comboStreak}
        </span>
        <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>
          {Math.round(comboCritChance * 100)}% crit
        </span>
      </div>
      <div
        className={`h-2 w-full overflow-hidden rounded-full ${
          theme === 'dark' ? 'bg-gray-800' : 'bg-gray-200'
        }`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-pink-500 transition-all duration-200"
          style={{ width: `${t.fill}%` }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Render it in Endless**

In `TypingInterface.tsx`, import `ComboMeter` and render `{currentMode === 'endless' && <ComboMeter />}` just above the typing text / health bar area (match the existing layout placement of `HealthBar`).

- [ ] **Step 3: Typecheck + lint**

Run: `bunx tsc --noEmit && bun run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ComboMeter.tsx frontend/src/components/TypingInterface.tsx
git commit -m "feat(combat): add combo meter UI"
```

---

### Task 8: Combat-hit + combo-break popups and SFX

**Files:**
- Modify: `frontend/src/utils/sfxEngine.ts` (add `playCrit`, `playComboBreak` mirroring `playPotionDrop`)
- Create: `frontend/src/hooks/useCombatPopups.ts` (mirror `usePotionPopups.ts`)
- Modify: `frontend/src/components/TypingPopups.tsx` (add a `CombatPopups` renderer)
- Modify: `frontend/src/components/TypingInterface.tsx` (use the hook + render `CombatPopups`)

- [ ] **Step 1: Add SFX cues**

Read `sfxEngine.ts` and the existing `playPotionDrop` / `playPotionHeal` synthesis. Add two exported functions in the same style: `playCrit()` (a short bright/punchy cue) and `playComboBreak()` (a soft low/descending cue — subtle, per Q2). Match the existing WebAudio pattern; do not add libraries.

- [ ] **Step 2: Create the popups hook**

```ts
// frontend/src/hooks/useCombatPopups.ts
import { useEffect, useRef, useState } from 'react';
import { playCrit, playComboBreak } from '../utils/sfxEngine';

export interface CombatPopupItem {
  id: number;
  topPct: number;
  leftPct: number;
  show: boolean;
  text: string;
  kind: 'crit' | 'break';
}

const FADE_MS = 500;

// Listens for `combat-hit` ({ damage, crit }) and `combo-break` window events
// (dispatched from TypingInterface) and emits floating popups + SFX. Only crits
// pop a number — non-crit hits stay quiet to avoid spamming every word.
export function useCombatPopups() {
  const [popups, setPopups] = useState<CombatPopupItem[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    const spawn = (text: string, kind: 'crit' | 'break', holdMs: number) => {
      // Center-ish, near the monster, with a little jitter.
      const left = 50 + (Math.random() * 12 - 6);
      const top = 32 + (Math.random() * 10 - 5);
      const id = ++idRef.current;
      setPopups(prev => [...prev, { id, topPct: top, leftPct: left, show: false, text, kind }]);
      setTimeout(() => setPopups(prev => prev.map(p => (p.id === id ? { ...p, show: true } : p))), 10);
      setTimeout(() => setPopups(prev => prev.map(p => (p.id === id ? { ...p, show: false } : p))), 10 + holdMs);
      setTimeout(() => setPopups(prev => prev.filter(p => p.id !== id)), 10 + holdMs + FADE_MS);
    };

    const onHit = (e: Event) => {
      const detail = (e as CustomEvent<{ damage: number; crit: boolean }>).detail;
      if (!detail?.crit) return; // only crits pop
      playCrit();
      spawn(`CRIT ${detail.damage}!`, 'crit', 700);
    };
    const onBreak = () => {
      playComboBreak();
      spawn('Combo broken', 'break', 600);
    };

    window.addEventListener('combat-hit', onHit as EventListener);
    window.addEventListener('combo-break', onBreak as EventListener);
    return () => {
      window.removeEventListener('combat-hit', onHit as EventListener);
      window.removeEventListener('combo-break', onBreak as EventListener);
    };
  }, []);

  return popups;
}
```

- [ ] **Step 3: Add the renderer**

In `TypingPopups.tsx`, add (mirroring `PotionPopups`):

```tsx
import type { CombatPopupItem } from '../hooks/useCombatPopups';

export function CombatPopups({ popups }: { popups: CombatPopupItem[] }) {
  return (
    <>
      {popups.map(popup => (
        <div key={popup.id} className="fixed inset-0 pointer-events-none z-40">
          <div
            className={`absolute transition-all ${popup.show ? 'opacity-100 -translate-y-3 scale-125' : 'opacity-0 translate-y-0 scale-95'} duration-500 ease-out`}
            style={{ top: `${popup.topPct}%`, left: `${popup.leftPct}%`, transform: 'translate(-50%, -50%)' }}
          >
            <span
              className={`font-extrabold select-none drop-shadow ${
                popup.kind === 'crit' ? 'text-pink-400 text-2xl' : 'text-gray-400 text-base'
              }`}
            >
              {popup.text}
            </span>
          </div>
        </div>
      ))}
    </>
  );
}
```

- [ ] **Step 4: Wire into TypingInterface**

Import `useCombatPopups` and `CombatPopups`; add `const combatPopups = useCombatPopups();` near `potionPopups`; render `<CombatPopups popups={combatPopups} />` alongside `<PotionPopups .../>`.

- [ ] **Step 5: Typecheck + lint**

Run: `bunx tsc --noEmit && bun run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/utils/sfxEngine.ts frontend/src/hooks/useCombatPopups.ts frontend/src/components/TypingPopups.tsx frontend/src/components/TypingInterface.tsx
git commit -m "feat(combat): crit + combo-break popups and SFX"
```

---

### Task 9: Remove the player-chosen word count

**Files:**
- Modify: `frontend/src/hooks/useEndlessSettings.ts` (drop the word-count slice + `WORD_COUNT_KEY`)
- Modify: `frontend/src/context/GameContext.ts` + `GameProvider.tsx` (drop `endlessWordCount` / `setEndlessWordCount`)
- Modify: the settings UI component that renders the word-count selector (find it), and `TypingInterface.tsx` if it still references `endlessWordCount`
- Modify: `frontend/src/utils/textGenerator.ts` only if you choose to drop the now-unused `endlessWordCount` param (optional; safe to leave the param and stop passing it)

- [ ] **Step 1: Find every reference**

Run: `cd frontend && grep -rn "endlessWordCount\|WORD_COUNT_KEY\|VALID_WORD_COUNTS\|setEndlessWordCount" src`
Make a list. Expect hits in `useEndlessSettings.ts`, `GameContext.ts`, `GameProvider.tsx`, `TypingInterface.tsx`, and a settings/dropdown component.

- [ ] **Step 2: Remove the word-count selector UI**

Delete the word-count selector control from the settings component (keep the difficulty selector). If the component becomes trivial, leave its structure intact — do not over-refactor.

- [ ] **Step 3: Remove the state + storage**

In `useEndlessSettings.ts` delete `WORD_COUNT_KEY`, `DEFAULT_WORD_COUNT`, `VALID_WORD_COUNTS`, `getStoredWordCount`, the `endlessWordCount` state, and `setEndlessWordCount`; return only difficulty. Remove `endlessWordCount`/`setEndlessWordCount` from `GameContextType`, the context default, and the GameProvider context value. Ensure Task 6's stream uses the `ENDLESS_BLOCK_WORDS` constant, not `endlessWordCount`.

- [ ] **Step 4: Typecheck + lint + tests**

Run: `bunx tsc --noEmit && bun run lint && bun run test`
Expected: PASS. The compiler will flag any missed references — fix them.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(combat): remove player-chosen word count (continuous stream)"
```

---

### Task 10: Full verification + manual smoke test

**Files:** none (verification only)

- [ ] **Step 1: Run the full frontend CI gate**

Run: `cd frontend && bun run lint && bun run format:check && bunx tsc --noEmit && bun run test`
Expected: all PASS. If `format:check` fails, run `bun run format` and re-check, then amend/commit.

- [ ] **Step 2: Manual smoke test in the dev server**

Run: `cd frontend && bun run dev`. In Endless mode, verify:
- Monster has an HP bar that drains by ~1 per correct word (more on crits).
- Typing fast/clean raises the combo meter; crit% climbs; crits pop a pink "CRIT N!" with sound.
- A wrong word resets the combo to 0 with a subtle flash/sound.
- Killing a monster spawns the next WITHOUT resetting the text you're typing; the word stream never runs out.
- The word-count selector is gone; the difficulty selector still works.
- Potions still drop and heal; player still takes monster attacks; Daily mode is unchanged.

- [ ] **Step 3: Commit any formatting fixups**

```bash
git add -A && git commit -m "chore(combat): formatting + verification fixups" || echo "nothing to commit"
```

---

## Self-Review (completed by plan author)

**Spec coverage:** §1 fixed HP → Tasks 1,3,4. §2 continuous stream → Task 6. §3 combo crit → Tasks 1,2,5. §4 remove word count → Task 9. UI (HP bar/combo meter/popups) → Tasks 4,7,8. SFX → Task 8. Resolved Q1 (0 dmg on wrong) → Task 5 (wrong words never call `damageMonster`). Q2 subtle break → Task 8. Q3 ~50-word block → Task 6. Q4 fun labels → Task 7. Q5 no XP change → no task touches XP. ✅
**Placeholders:** none — every code step has concrete code; integration-only tasks (5,6,9) name exact files/functions/grep commands. Tasks 5/6 are integration glue with no unit test by design; covered by the Task 10 smoke test.
**Type consistency:** `registerComboCorrect`/`registerComboWrong` exposed in Task 3 and consumed in Task 5; `DamageRoll {damage,crit}` consistent across Tasks 1/2/5/8; `combat-hit`/`combo-break` event names consistent across Tasks 5 and 8; `MONSTER_MAX_HP`/`monsterHp`/`monsterMaxHp` consistent across Tasks 1/3/4. ✅

## Known follow-ups (NOT in this plan)
- The last word of a block never fires `wordCompleted` (no trailing space) — Task 6's near-end refill keeps the cursor away from that edge; confirm in smoke test.
- Endless session XP may rise as runs get longer (Q5 deferred — revisit if it inflates).
- Compact potion UI, monster variety (Phase 2), weapons + loot (Phase 3).
