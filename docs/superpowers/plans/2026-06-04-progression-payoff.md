# Progression Payoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make leveling up in Endless mode deliver a celebration moment plus a faint, derived mechanical tailwind (+1 max HP and +0.25 base damage per 5 levels, damage capped at +1.0), signed-in only.

**Architecture:** Three pure, level-derived helpers (`hpBonus`, `levelDmgBonus`, `detectLevelUp`) live in `utils/combatTuning.ts` and are unit-tested in isolation (no DOM, no renderHook). The player's `level` is hoisted into `GameProvider` (which already sits inside `ClerkProvider` and wraps the router), so it can thread the level into `usePlayerHealth` (max HP), `resetGameState` (run-start HP), and `useComboSystem.registerCorrectWord` → `rollDamage` (base damage). `GameProvider` owns level-up detection: it snapshots `level` before each `reloadPlayerStats()` and, after the new value lands, exposes a transient `levelUpEvent` that `App.tsx` renders via a new `LevelUpToast` celebration component reusing `sfxEngine.playArpeggio`.

**Tech Stack:** React 19, Vite, TypeScript, Tailwind, vitest

---

## File Structure

| File | Responsibility |
| --- | --- |
| `frontend/src/utils/combatTuning.ts` | Add pure `hpBonus(level)`, `levelDmgBonus(level)` (capped +1.0), `detectLevelUp(prev, next)`; add `level` param to `rollDamage` so base damage includes the level bonus. |
| `frontend/src/utils/combatTuning.test.ts` | Unit tests for the new pure helpers + the `rollDamage` level-bonus path (extends the existing file). |
| `frontend/src/hooks/usePlayerHealth.ts` | Max HP becomes `100 + hpBonus(level)`; accepts `level` arg; heal clamps to that max. |
| `frontend/src/hooks/usePlayerStats.ts` | Capture previous level across reloads and expose `prevLevelRef` / a way for the provider to detect the delta (or expose the raw level only — provider owns detection). |
| `frontend/src/context/GameProvider.tsx` | Call `usePlayerStats()`; thread `level` into `usePlayerHealth` and `resetGameState` (max HP) and into the combo damage call; wrap `reload` to snapshot+detect level-up and publish a `levelUpEvent`; surface `level`, `currentXp`, `xpToNextLevel`, `reloadPlayerStats`, `levelUpEvent`, `clearLevelUpEvent` through context. |
| `frontend/src/context/GameContext.ts` | Extend the context type + default value with the new fields. |
| `frontend/src/hooks/useComboSystem.ts` | `registerCorrectWord` accepts `level` and forwards it to `rollDamage`. |
| `frontend/src/components/TypingInterface.tsx` | Pass `comboLevel` from context into `registerComboCorrect(equippedWeapon, undefined, level)` at the existing call site. |
| `frontend/src/components/LevelUpToast.tsx` (new) | Lightweight celebration overlay: shows "Level Up!" + level number, and on a milestone shows the reward; plays `playArpeggio`. |
| `frontend/src/App.tsx` | Consume `level`/`currentXp`/`xpToNextLevel`/`reloadPlayerStats`/`levelUpEvent` from context instead of calling `usePlayerStats()` directly; mount `<LevelUpToast>` near the death popup. |

**Do NOT touch** `frontend/src/utils/calculateXP.ts` or `backend/src/core/xp.ts`. This feature derives HP/damage bonuses from the already-synced `level`; it changes no XP math. Keeping both XP files untouched preserves the XP-sync invariant.

---

## Task 1: Pure level-derived helpers in combatTuning

**Files:**
- Impl: `frontend/src/utils/combatTuning.ts`
- Test: `frontend/src/utils/combatTuning.test.ts`

Steps:

- [ ] In `combatTuning.test.ts`, add the failing tests below (extend imports + add the new `describe` blocks):
  ```ts
  // add to the existing top import from './combatTuning'
  // (append these names to the existing destructured import list):
  //   hpBonus, levelDmgBonus, detectLevelUp

  describe('hpBonus', () => {
    it('grants +1 max HP per 5 levels, uncapped', () => {
      expect(hpBonus(1)).toBe(0);
      expect(hpBonus(4)).toBe(0);
      expect(hpBonus(5)).toBe(1);
      expect(hpBonus(9)).toBe(1);
      expect(hpBonus(20)).toBe(4);
      expect(hpBonus(50)).toBe(10);
    });
  });

  describe('levelDmgBonus', () => {
    it('adds +0.25 base damage per 5 levels, capped at +1.0', () => {
      expect(levelDmgBonus(1)).toBeCloseTo(0);
      expect(levelDmgBonus(4)).toBeCloseTo(0);
      expect(levelDmgBonus(5)).toBeCloseTo(0.25);
      expect(levelDmgBonus(10)).toBeCloseTo(0.5);
      expect(levelDmgBonus(20)).toBeCloseTo(1.0); // 4 milestones * 0.25 = 1.0
      expect(levelDmgBonus(50)).toBeCloseTo(1.0); // capped
      expect(levelDmgBonus(100)).toBeCloseTo(1.0); // still capped
    });
  });

  describe('detectLevelUp', () => {
    it('flags no level-up when level is unchanged or decreased', () => {
      expect(detectLevelUp(5, 5)).toEqual({ leveledUp: false, milestoneReached: false, newLevel: 5 });
      expect(detectLevelUp(5, 4)).toEqual({ leveledUp: false, milestoneReached: false, newLevel: 4 });
    });
    it('flags a plain level-up that does not cross a multiple of 5', () => {
      expect(detectLevelUp(6, 7)).toEqual({ leveledUp: true, milestoneReached: false, newLevel: 7 });
    });
    it('flags a milestone when the new level crosses a multiple of 5', () => {
      expect(detectLevelUp(4, 5)).toEqual({ leveledUp: true, milestoneReached: true, newLevel: 5 });
      expect(detectLevelUp(9, 10)).toEqual({ leveledUp: true, milestoneReached: true, newLevel: 10 });
    });
    it('flags a milestone on a multi-level jump that crosses a multiple of 5', () => {
      // 8 -> 12 crosses 10
      expect(detectLevelUp(8, 12)).toEqual({ leveledUp: true, milestoneReached: true, newLevel: 12 });
      // 3 -> 11 crosses 5 and 10 -> still milestone, celebrate highest (derived from newLevel)
      expect(detectLevelUp(3, 11)).toEqual({ leveledUp: true, milestoneReached: true, newLevel: 11 });
    });
    it('flags a multi-level jump with no multiple of 5 crossed as a non-milestone level-up', () => {
      // 6 -> 9 crosses no multiple of 5
      expect(detectLevelUp(6, 9)).toEqual({ leveledUp: true, milestoneReached: false, newLevel: 9 });
    });
  });
  ```
- [ ] Run (expect FAIL — helpers undefined): `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bun run test src/utils/combatTuning.test.ts`
- [ ] Add the helpers to `combatTuning.ts` (place after `BASE_DMG`/`CRIT_MULT`, before `rollDamage`). COMPLETE code:
  ```ts
  // --- Level-derived progression payoff (Endless, signed-in only) ---
  // milestonesReached = floor(level / 5). Bonuses are DERIVED from level (no
  // backend state) so they're idempotent across multi-level jumps.

  const milestonesReached = (level: number): number =>
    Math.max(0, Math.floor(level / 5));

  // Max HP bonus: +1 per milestone, uncapped. Trivial vs base 100.
  export const hpBonus = (level: number): number => milestonesReached(level);

  // Base damage bonus: +0.25 per milestone, CAPPED at +1.0 (~level 20) so it
  // never outweighs streak/weapon power.
  export const levelDmgBonus = (level: number): number =>
    Math.min(1.0, 0.25 * milestonesReached(level));

  export interface LevelUpEvent {
    leveledUp: boolean;
    milestoneReached: boolean;
    newLevel: number;
  }

  // Pure level-up detection: leveledUp when next > prev; milestoneReached when
  // the jump crosses (or lands on) a new multiple of 5, i.e. floor(next/5) grew.
  export const detectLevelUp = (prev: number, next: number): LevelUpEvent => {
    const leveledUp = next > prev;
    const milestoneReached =
      leveledUp && milestonesReached(next) > milestonesReached(prev);
    return { leveledUp, milestoneReached, newLevel: next };
  };
  ```
- [ ] Run (expect PASS): `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bun run test src/utils/combatTuning.test.ts`
- [ ] Format: `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bun run format`
- [ ] Commit:
  ```
  git add frontend/src/utils/combatTuning.ts frontend/src/utils/combatTuning.test.ts
  git commit -m "feat(progression): pure level-derived hp/damage/level-up helpers

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

## Task 2: Thread level damage bonus into `rollDamage`

**Files:**
- Impl: `frontend/src/utils/combatTuning.ts`
- Test: `frontend/src/utils/combatTuning.test.ts`

`rollDamage` gains a trailing optional `level` parameter (cleaner than a precomputed bonus — call sites already have `level`, and it keeps the cap logic encapsulated). Existing call signatures `rollDamage(streak, rng, weapon)` stay valid because `level` defaults to `1` (→ +0 bonus), so existing tests keep passing.

Steps:

- [ ] Add failing tests to `combatTuning.test.ts` inside the `combatTuning` describe:
  ```ts
  it('rollDamage adds the level damage bonus to a non-crit hit', () => {
    // streak 0, rng 0.99 → no crit. level 20 → +1.0 bonus. base = 1 + 0 + 1 = 2.
    expect(rollDamage(0, () => 0.99, null, 20)).toEqual({ damage: 2, crit: false });
  });

  it('rollDamage caps the level damage bonus at +1.0', () => {
    // level 50 also yields +1.0 (capped). base = 1 + 1 = 2.
    expect(rollDamage(0, () => 0.99, null, 50)).toEqual({ damage: 2, crit: false });
  });

  it('rollDamage stacks weapon bonus and level bonus on the base', () => {
    const weapon = { bonusDamage: 3, bonusCritChance: 0, critMultBonus: 0 };
    // base = 1 + 3 + 0.25 (level 5) = 4.25 → round → 4.
    expect(rollDamage(0, () => 0.99, weapon, 5)).toEqual({ damage: 4, crit: false });
  });

  it('rollDamage defaults level to 1 (no bonus) when omitted', () => {
    expect(rollDamage(0, () => 0.99)).toEqual({ damage: 1, crit: false });
  });
  ```
- [ ] Run (expect FAIL): `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bun run test src/utils/combatTuning.test.ts`
- [ ] Update `rollDamage` in `combatTuning.ts`. Replace the signature + `base` line. COMPLETE replacement of the function:
  ```ts
  // Pure: rng is injectable so tests are deterministic. An equipped weapon raises
  // crit chance (capped at 95% total), base damage, and crit multiplier. `level`
  // adds the faint level-derived base-damage bonus (capped +1.0; default 1 = +0).
  export const rollDamage = (
    streak: number,
    rng: () => number = Math.random,
    weapon: WeaponMods | null = null,
    level: number = 1
  ): DamageRoll => {
    const critChance = Math.min(
      TOTAL_CRIT_CHANCE_CAP,
      critChanceForStreak(streak) + (weapon?.bonusCritChance ?? 0)
    );
    const crit = rng() < critChance;
    const base = BASE_DMG + (weapon?.bonusDamage ?? 0) + levelDmgBonus(level);
    const mult = CRIT_MULT + (weapon?.critMultBonus ?? 0);
    return { damage: Math.round(crit ? base * mult : base), crit };
  };
  ```
- [ ] Run (expect PASS — new + all existing rollDamage tests): `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bun run test src/utils/combatTuning.test.ts`
- [ ] Format: `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bun run format`
- [ ] Commit:
  ```
  git add frontend/src/utils/combatTuning.ts frontend/src/utils/combatTuning.test.ts
  git commit -m "feat(progression): add capped level damage bonus to rollDamage

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

## Task 3: Thread `level` through `useComboSystem.registerCorrectWord`

**Files:**
- Impl: `frontend/src/hooks/useComboSystem.ts`
- Test: `frontend/src/hooks/useComboSystem.test.ts`

`registerCorrectWord` is a hook callback (not pure) — do NOT add renderHook tests. The combo *reducer* tests stay unchanged. The new behavior (forwarding `level` to `rollDamage`) is already covered by the pure `rollDamage` level tests in Task 2. We only add a comment-level reducer-test sanity check that the level path is wired by asserting `rollDamage` with a level arg directly (mirrors the existing `rollDamage (streak 0, rng=0.99)` block at the bottom of that test file).

Steps:

- [ ] Add a failing assertion to the existing bottom `describe` in `useComboSystem.test.ts` (this documents the level-bonus contract the hook relies on):
  ```ts
  describe('rollDamage with level bonus (streak 0, rng=0.99)', () => {
    it('level 20 adds +1.0 → damage=2', () => {
      expect(rollDamage(0, () => 0.99, null, 20)).toEqual({ damage: 2, crit: false });
    });
  });
  ```
- [ ] Run (expect PASS already — `rollDamage` from Task 2 supports it; this guards the contract the hook depends on): `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bun run test src/hooks/useComboSystem.test.ts`
- [ ] Update `registerCorrectWord` in `useComboSystem.ts` to accept and forward `level`. COMPLETE replacement of the callback:
  ```ts
  const registerCorrectWord = useCallback(
    (
      weapon: Weapon | null = null,
      rng: () => number = Math.random,
      level: number = 1
    ): DamageRoll => {
      // Roll BEFORE dispatching so the roll uses the current streak value.
      // useReducer dispatch is synchronous for the state snapshot we read here.
      // `level` adds the faint level-derived base-damage bonus (see rollDamage).
      const roll = rollDamage(state.streak, rng, weapon, level);
      dispatch({ type: 'CORRECT_WORD' });
      return roll;
    },
    [state.streak]
  );
  ```
- [ ] Run (expect PASS, all reducer + rollDamage tests): `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bun run test src/hooks/useComboSystem.test.ts`
- [ ] Format: `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bun run format`
- [ ] Commit:
  ```
  git add frontend/src/hooks/useComboSystem.ts frontend/src/hooks/useComboSystem.test.ts
  git commit -m "feat(progression): forward player level into combo rollDamage

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

## Task 4: Level-derived max HP in `usePlayerHealth`

**Files:**
- Impl: `frontend/src/hooks/usePlayerHealth.ts`
- Test: none new (hook is not pure; the `hpBonus` math is already covered by Task 1). Verify via typecheck + full suite at the gate.

`usePlayerHealth` accepts a `level` argument; max HP = `100 + hpBonus(level)`. Initial state, heal clamp, and reset all use the derived max. The exported `maxPlayerHealth` reflects it.

Steps:

- [ ] Replace the body of `usePlayerHealth.ts`. COMPLETE file:
  ```ts
  import { useCallback, useState } from 'react';
  import { hpBonus } from '../utils/combatTuning';

  const BASE_PLAYER_HEALTH = 100;
  const MISTAKE_DAMAGE_MIN = 2;
  const MISTAKE_DAMAGE_MAX = 5;

  // `level` adds the faint level-derived max-HP bonus (+1 per 5 levels, uncapped).
  // Defaults to 1 (no bonus) for guests / pre-load. Max HP = 100 + hpBonus(level).
  export function usePlayerHealth(level: number = 1) {
    const maxPlayerHealth = BASE_PLAYER_HEALTH + hpBonus(level);
    const [playerHealth, setPlayerHealth] = useState<number>(maxPlayerHealth);
    const [isPlayerDead, setIsPlayerDead] = useState<boolean>(false);

    const damagePlayer = useCallback((amount: number) => {
      setPlayerHealth(prev => {
        const next = Math.max(0, prev - amount);
        if (next <= 0) setIsPlayerDead(true);
        return next;
      });
    }, []);

    const healPlayer = useCallback(
      (amount: number) => {
        setPlayerHealth(prev => Math.min(maxPlayerHealth, prev + amount));
      },
      [maxPlayerHealth]
    );

    const resetPlayerHealth = useCallback(() => {
      setPlayerHealth(maxPlayerHealth);
      setIsPlayerDead(false);
    }, [maxPlayerHealth]);

    const damagePlayerFromMistake = useCallback(() => {
      const damage =
        Math.floor(
          Math.random() * (MISTAKE_DAMAGE_MAX - MISTAKE_DAMAGE_MIN + 1)
        ) + MISTAKE_DAMAGE_MIN;
      damagePlayer(damage);
    }, [damagePlayer]);

    return {
      playerHealth,
      maxPlayerHealth,
      isPlayerDead,
      damagePlayer,
      healPlayer,
      resetPlayerHealth,
      damagePlayerFromMistake,
    };
  }
  ```
- [ ] Run typecheck (expect PASS): `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bunx tsc -b`
- [ ] Format: `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bun run format`
- [ ] Commit:
  ```
  git add frontend/src/hooks/usePlayerHealth.ts
  git commit -m "feat(progression): level-derived max HP in usePlayerHealth

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

## Task 5: `LevelUpToast` celebration component

**Files:**
- Impl: `frontend/src/components/LevelUpToast.tsx` (new)
- Test: none (pure-presentation component; no @testing-library/react / jsdom available — do NOT add a render test). The celebration trigger logic it depends on (`detectLevelUp`) is tested in Task 1.

The toast auto-dismisses after a short window via `setTimeout`, plays `playArpeggio` on mount, and shows the milestone reward when `milestoneReached` is true. It reads the bonuses via `hpBonus`/`levelDmgBonus` so the displayed reward matches the applied math.

Steps:

- [ ] Create `frontend/src/components/LevelUpToast.tsx`. COMPLETE file:
  ```tsx
  import { useEffect } from 'react';
  import { playArpeggio } from '../utils/sfxEngine';
  import { hpBonus, levelDmgBonus } from '../utils/combatTuning';

  interface LevelUpToastProps {
    level: number;
    milestone: boolean;
    onDismiss: () => void;
  }

  // Subtle level-up celebration moment (Endless, signed-in only). Plain level-up
  // = "Level Up!" + number; milestone (every 5 levels) = bigger note + the reward
  // granted. Auto-dismisses; reuses the chiptune arpeggio family for SFX.
  export default function LevelUpToast({
    level,
    milestone,
    onDismiss,
  }: LevelUpToastProps) {
    useEffect(() => {
      // Ascending arpeggio — brighter/longer for a milestone.
      if (milestone) {
        playArpeggio([523, 659, 784, 1047, 1319], 0.09, 0.32);
      } else {
        playArpeggio([659, 988], 0.07, 0.26);
      }
      const t = setTimeout(onDismiss, milestone ? 2600 : 1800);
      return () => clearTimeout(t);
    }, [milestone, onDismiss]);

    const hp = hpBonus(level);
    const dmg = levelDmgBonus(level);

    return (
      <div
        className="pointer-events-none fixed inset-x-0 top-24 z-50 flex justify-center"
        role="status"
        aria-live="polite"
      >
        <div className="animate-bounce rounded-lg border-2 border-yellow-400 bg-slate-900/90 px-6 py-3 text-center shadow-lg">
          <div className="text-lg font-bold tracking-wide text-yellow-300">
            {milestone ? 'Milestone!' : 'Level Up!'}
          </div>
          <div className="text-2xl font-extrabold text-white">Lv {level}</div>
          {milestone && (
            <div className="mt-1 text-xs text-emerald-300">
              +{hp} Max HP · +{dmg.toFixed(2)} Base DMG
            </div>
          )}
        </div>
      </div>
    );
  }
  ```
- [ ] Run typecheck (expect PASS): `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bunx tsc -b`
- [ ] Format: `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bun run format`
- [ ] Commit:
  ```
  git add frontend/src/components/LevelUpToast.tsx
  git commit -m "feat(progression): LevelUpToast celebration component

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

## Task 6: Hoist `level` into `GameProvider` + own level-up detection + wire HP/reset

**Files:**
- Impl: `frontend/src/context/GameProvider.tsx`, `frontend/src/context/GameContext.ts`
- Test: none new (detection is `detectLevelUp`, tested in Task 1; provider wiring is verified by typecheck + the App consumer in Task 8).

`GameProvider` already sits inside `ClerkProvider` and wraps the router, so it may call `usePlayerStats()` (which uses `useApi`→`useAuth`). It becomes the single owner of `level`. It:
1. Passes `level` to `usePlayerHealth(level)` and into `resetGameState`'s max-HP reset.
2. Wraps `reload` as `reloadPlayerStats`: snapshot `level` before, run reload, and on the next render compare via `detectLevelUp` to publish a transient `levelUpEvent`.
3. Exposes `level`, `currentXp`, `xpToNextLevel`, `reloadPlayerStats`, `playerLevel` (alias for the combo damage call), `levelUpEvent`, `clearLevelUpEvent`.

Detection approach (no extra renders racing): keep a `prevLevelRef`. Each time `reload` resolves, `usePlayerStats.level` updates; a `useEffect` on `level` computes `detectLevelUp(prevLevelRef.current, level)`, and if `leveledUp && level > 1-baseline` (i.e. not the initial 1→N hydration), sets `levelUpEvent`. Guard the first hydration with a `hydratedRef` so the initial load (1 → real level) does not fire a toast.

Steps:

- [ ] In `GameContext.ts`, extend the context type + default. Add these fields to the type interface (near the existing `isSignedIn`/level-related fields) and to the default value object. COMPLETE additions to the **type**:
  ```ts
  level: number;
  currentXp: number;
  xpToNextLevel: number;
  reloadPlayerStats: () => Promise<void> | void;
  levelUpEvent: import('../utils/combatTuning').LevelUpEvent | null;
  clearLevelUpEvent: () => void;
  ```
  COMPLETE additions to the **default value** object:
  ```ts
  level: 1,
  currentXp: 0,
  xpToNextLevel: 20,
  reloadPlayerStats: () => {},
  levelUpEvent: null,
  clearLevelUpEvent: () => {},
  ```
- [ ] In `GameProvider.tsx`, add imports near the top:
  ```ts
  import { usePlayerStats } from '../hooks/usePlayerStats';
  import { detectLevelUp, type LevelUpEvent } from '../utils/combatTuning';
  ```
- [ ] Inside `GameProvider`, after the existing state hooks and before `const combo = useComboSystem();`, add player-stats ownership + detection state:
  ```ts
  const {
    level,
    currentXp,
    xpToNextLevel,
    reload: reloadPlayerStatsRaw,
  } = usePlayerStats();
  const [levelUpEvent, setLevelUpEvent] = useState<LevelUpEvent | null>(null);
  const clearLevelUpEvent = useCallback(() => setLevelUpEvent(null), []);
  const prevLevelRef = useRef<number>(level);
  const hydratedRef = useRef<boolean>(false);

  // Detect level-ups on each /me sync. The first hydration (initial 1 -> real
  // level) is swallowed so refreshing the page never fires a celebration.
  // Signed-in only: guests have no persistent level (usePlayerStats stays at 1).
  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      prevLevelRef.current = level;
      return;
    }
    const evt = detectLevelUp(prevLevelRef.current, level);
    prevLevelRef.current = level;
    if (evt.leveledUp) setLevelUpEvent(evt);
  }, [level]);

  const reloadPlayerStats = useCallback(
    () => reloadPlayerStatsRaw(),
    [reloadPlayerStatsRaw]
  );
  ```
- [ ] Change the health hook call to pass the level:
  ```ts
  const health = usePlayerHealth(level);
  ```
- [ ] In `resetGameState`, replace the two hardcoded `MONSTER_MAX_HP.normal` lines? No — those are the *monster* HP and must stay. The **player** HP reset is `health.resetPlayerHealth()`, which already derives from `usePlayerHealth(level)`'s max (Task 4). Confirm `resetGameState` still calls `health.resetPlayerHealth()` (it does at line ~222) — no change needed there because the max is now level-derived inside the hook. Add a one-line comment above `health.resetPlayerHealth();` in `resetGameState`:
  ```ts
  // Restores to the level-derived max HP (100 + hpBonus(level)) via usePlayerHealth.
  health.resetPlayerHealth();
  ```
- [ ] In the combo damage call exposed through context, thread level. Find `registerComboCorrect: combo.registerCorrectWord,` in the `contextValue` and replace with a level-bound wrapper. Add this `useCallback` near the other derived callbacks (after `combo` is defined):
  ```ts
  // Bind the current player level into the combo damage roll so base damage
  // includes the level bonus without TypingInterface needing to know about it.
  const { registerCorrectWord: registerComboCorrectRaw } = combo;
  const registerComboCorrect = useCallback(
    (
      weapon: Parameters<typeof registerComboCorrectRaw>[0] = null,
      rng: Parameters<typeof registerComboCorrectRaw>[1] = Math.random
    ) => registerComboCorrectRaw(weapon, rng, level),
    [registerComboCorrectRaw, level]
  );
  ```
  Then in `contextValue` replace `registerComboCorrect: combo.registerCorrectWord,` with `registerComboCorrect,` and add the new context fields:
  ```ts
  level,
  currentXp,
  xpToNextLevel,
  reloadPlayerStats,
  levelUpEvent,
  clearLevelUpEvent,
  ```
- [ ] Update the `useMemo` dependency array for `contextValue`: replace `combo.registerCorrectWord` with `registerComboCorrect`, and add `level`, `currentXp`, `xpToNextLevel`, `reloadPlayerStats`, `levelUpEvent`, `clearLevelUpEvent`.
- [ ] Run typecheck (expect PASS): `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bunx tsc -b`
- [ ] Format: `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bun run format`
- [ ] Commit:
  ```
  git add frontend/src/context/GameProvider.tsx frontend/src/context/GameContext.ts
  git commit -m "feat(progression): hoist level into GameProvider, detect level-ups, wire HP/damage

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

## Task 7: TypingInterface uses the level-bound combo call

**Files:**
- Impl: `frontend/src/components/TypingInterface.tsx`
- Test: none (the wrapper is bound in the provider; the rollDamage level path is tested in Task 2).

The existing call `registerComboCorrect(equippedWeapon)` (TypingInterface.tsx ~line 169) now resolves to the level-bound provider wrapper from Task 6, so **no signature change is needed at the call site** — the level is injected by the provider. Verify the destructured `registerComboCorrect` still comes from `useGameContext()` and the call passes only `equippedWeapon`.

Steps:

- [ ] Confirm (no edit expected) line ~169 reads `const { damage, crit } = registerComboCorrect(equippedWeapon);` and `registerComboCorrect` is destructured from `useGameContext()`. If a future refactor passes an `rng`, it must remain `registerComboCorrect(equippedWeapon, rng)` — the level is appended by the provider wrapper, never by this component.
- [ ] Run typecheck (expect PASS): `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bunx tsc -b`
- [ ] No code change → no separate commit. (If the typecheck surfaces a type mismatch on the wrapper signature, narrow the wrapper's param types in Task 6 to match `registerComboCorrect`'s usage here, then re-run.)

---

## Task 8: App consumes level from context + mounts `LevelUpToast`

**Files:**
- Impl: `frontend/src/App.tsx`
- Test: none (presentation wiring; verified at the gate).

`App.tsx` currently calls `usePlayerStats()` directly. Switch it to read `level`, `currentXp`, `xpToNextLevel`, `reloadPlayerStats`, `levelUpEvent`, `clearLevelUpEvent` from `useGameContext()` so there is one source of truth (the provider's instance that also drives HP/damage). Mount `<LevelUpToast>` next to the death popup, signed-in only.

Steps:

- [ ] Remove the `usePlayerStats` import (line 17) and its call (lines ~57-59). Add `LevelUpToast` import:
  ```ts
  import LevelUpToast from './components/LevelUpToast';
  ```
- [ ] In the `useGameContext()` destructure (currently lines ~60-67), add the new fields:
  ```ts
  const {
    currentMode,
    monstersDefeated,
    isCurrentMonsterDefeated,
    spawnMonster,
    isPlayerDead,
    resetGameState,
    level,
    currentXp,
    xpToNextLevel,
    reloadPlayerStats,
    levelUpEvent,
    clearLevelUpEvent,
  } = useGameContext();
  ```
- [ ] The existing JSX already references `level`, `currentXp`, `xpToNextLevel`, and passes `reloadPlayerStats={reloadPlayerStats}` to `TypingInterface` — those now resolve to the context values. No change to `<PlayerLevel>` / `<TypingInterface>` props.
- [ ] Mount the toast just after the death popup line (~245). The toast is already gated to Endless+signed-in because `levelUpEvent` only fires for the signed-in persistent level in Endless; wrap in `<SignedIn>` as belt-and-suspenders:
  ```tsx
  {/* Subtle level-up celebration (Endless, signed-in only) */}
  <SignedIn>
    {levelUpEvent?.leveledUp && (
      <LevelUpToast
        level={levelUpEvent.newLevel}
        milestone={levelUpEvent.milestoneReached}
        onDismiss={clearLevelUpEvent}
      />
    )}
  </SignedIn>
  ```
  (`SignedIn` is already imported at the top of `App.tsx`.)
- [ ] Run typecheck (expect PASS): `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bunx tsc -b`
- [ ] Format: `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bun run format`
- [ ] Commit:
  ```
  git add frontend/src/App.tsx
  git commit -m "feat(progression): consume level from context + mount LevelUpToast

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

## Task 9: Final verification gate

**Files:** none (verification only).

Steps:

- [ ] Lint: `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bun run lint`
- [ ] Format check: `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bun run format:check`
- [ ] Typecheck: `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bunx tsc -b`
- [ ] Full test suite: `cd /Users/rievo/Workspace/typing-rpg/.claude/worktrees/feature+full-typing-metrics/frontend && bun run test`
- [ ] All green → feature complete. Do NOT run `bun test` (bare); always `bun run test`.

---

## Self-review notes

Spec coverage check (against `docs/superpowers/specs/2026-06-04-progression-payoff-design.md`):

- **Level-up moment** — `detectLevelUp` (Task 1, tested) feeds `levelUpEvent` published by `GameProvider` (Task 6) and rendered by `LevelUpToast` (Task 5), mounted in `App.tsx` (Task 8). Reuses `sfxEngine.playArpeggio`. First hydration (page load) is swallowed via `hydratedRef` so it never false-fires.
- **Milestone every 5** — `milestoneReached` in `detectLevelUp` is true exactly when `floor(next/5) > floor(prev/5)`, covering single-level crossings (4→5) and multi-level jumps (8→12, 3→11). Multi-level jumps celebrate the highest milestone because the displayed bonuses are derived from `newLevel` (idempotent `floor(level/5)`).
- **Max HP +1 per milestone (uncapped)** — `hpBonus(level) = floor(level/5)` (Task 1, tested: 4→0, 5→1, 20→4, 50→10). Applied as `100 + hpBonus(level)` in `usePlayerHealth` (Task 4) for initial HP, heal clamp, and reset; `resetGameState` resets player HP through that same hook (Task 6), so both former hardcoded-100 paths now use the derived max.
- **Base damage +0.25 per milestone, capped +1.0** — `levelDmgBonus(level) = min(1.0, 0.25*floor(level/5))` (Task 1, tested: 5→0.25, 20→1.0, 50→1.0 capped).
- **Wiring into `rollDamage`** — `base = BASE_DMG + (weapon?.bonusDamage ?? 0) + levelDmgBonus(level)` (Task 2, tested), with a new `level` param defaulting to 1 (preserves existing call sites/tests). Threaded from the call site: `useComboSystem.registerCorrectWord(weapon, rng, level)` (Task 3) bound to the player level by `GameProvider`'s `registerComboCorrect` wrapper (Task 6), so `TypingInterface`'s existing `registerComboCorrect(equippedWeapon)` call needs no change (Task 7).
- **Wiring into max HP** — covered above (Tasks 4 + 6).
- **Guest exclusion** — guests' `usePlayerStats` level stays at 1 (no `/me` persistence), so `hpBonus`/`levelDmgBonus` = 0 and `detectLevelUp` never flags a level-up; the toast is additionally wrapped in `<SignedIn>` (Task 8). Signed-in only, as specified.
- **No XP-math drift** — `calculateXP.ts` / `backend/src/core/xp.ts` are untouched; all bonuses derive from the already-synced `level`. Noted at the top of File Structure.
- **Codebase test constraints honored** — only pure functions are unit-tested (`hpBonus`, `levelDmgBonus`, `detectLevelUp`, `rollDamage`); no `@testing-library/react`/jsdom/renderHook/DOM tests; tests mirror `useComboSystem.test.ts` style; single-file runs use `bun run test <path>`; `bun run format` precedes each commit; final gate is `lint && format:check && tsc -b && test`.
