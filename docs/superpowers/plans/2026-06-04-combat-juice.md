# Combat Juice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Endless combat *feel* punchy — add damage-scaled screen shake on crit/kill, streak-tier-escalating SFX, a kill popup + damage-scaled crit popup, and a glow/pulse on the ComboMeter at high tiers — all driven by pure, unit-tested helpers.

**Architecture:** All juice is triggered off the existing window events (`combat-hit` with `{damage, crit}`, `combo-break`) plus the `isDefeated` flag already wired in `App.tsx`. The non-trivial math (shake decay, damage→intensity, streak→tier, tier→SFX params, popup selection, reduced-motion predicate) is extracted into PURE exported helpers in new util files and tested directly with vitest (no DOM/renderHook — this repo has no @testing-library/react or jsdom). React hooks/components are thin wrappers that call those helpers and apply CSS.

**Tech Stack:** React 19, Vite, TypeScript, Tailwind, vitest

---

## File Structure

| File | Create/Modify | Responsibility |
| --- | --- | --- |
| `frontend/src/utils/screenShake.ts` | Create | Pure helpers: `shakeForDamage`, `KILL_SHAKE`, `shakeOffset` (RAF decay math), `prefersReducedMotion` predicate, types |
| `frontend/src/utils/screenShake.test.ts` | Create | Unit tests for all screenShake pure helpers |
| `frontend/src/hooks/useScreenShake.ts` | Create | React hook: listens to `combat-hit`/`monster-killed`, runs RAF decay loop, returns a transform string + reduced-motion guard |
| `frontend/src/utils/sfxTier.ts` | Create | Pure: `streakTierFromCritChance`, `critSfxParams`, `hitSfxParams` (tier→pitch/layer mapping) |
| `frontend/src/utils/sfxTier.test.ts` | Create | Unit tests for tier + SFX-param mapping |
| `frontend/src/utils/sfxEngine.ts` | Modify (`playCrit` ~L169) | Accept tier param; escalate pitch/layers by tier |
| `frontend/src/utils/combatPopups.ts` | Create | Pure: `selectCritPopup` (damage→text/size/color), `killPopup` (variant→text/color) |
| `frontend/src/utils/combatPopups.test.ts` | Create | Unit tests for popup-selection helpers |
| `frontend/src/hooks/useCombatPopups.ts` | Modify (~L4 interface, ~L51 onHit) | Use pure helpers; add kill popup via `monster-killed` event; damage-scaled crit |
| `frontend/src/components/TypingPopups.tsx` | Modify (`CombatPopups` ~L83) | Render `kill` kind + per-popup size/color from item fields |
| `frontend/src/components/TypingInterface.tsx` | Modify (~L169) | Pass streak tier to crit SFX; dispatch `monster-killed` on defeat edge |
| `frontend/src/components/ComboMeter.tsx` | Modify (`tier` ~L5, JSX ~L27) | Add glow/pulse classes at Hot/BLAZING |
| `frontend/src/App.tsx` | Modify (~L190) | Wrap gameplay container transform with `useScreenShake`; fire `monster-killed` on defeat edge |

Event contract (already partially present):
- `combat-hit` → `CustomEvent<{ damage: number; crit: boolean }>` (dispatched in `TypingInterface.handleWordCompleted`).
- `monster-killed` → **new** `CustomEvent<{ variant: 'common'|'elite'|'rare'; damage: number }>` dispatched on the `isDefeated` false→true edge.

---

### Task 1: Pure screen-shake math + reduced-motion predicate

**Files:**
- Create: `frontend/src/utils/screenShake.ts`
- Test: `frontend/src/utils/screenShake.test.ts`

- [ ] Write failing test `frontend/src/utils/screenShake.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  shakeForDamage,
  KILL_SHAKE,
  shakeOffset,
  prefersReducedMotion,
  type ShakeSpec,
} from './screenShake';

describe('shakeForDamage', () => {
  it('scales magnitude with damage but clamps at the cap', () => {
    const small = shakeForDamage(1);
    const big = shakeForDamage(8);
    const huge = shakeForDamage(1000);
    expect(big.magnitude).toBeGreaterThan(small.magnitude);
    expect(small.magnitude).toBeGreaterThanOrEqual(2);
    expect(huge.magnitude).toBe(10); // clamped
    expect(huge.durationMs).toBe(160);
  });

  it('never returns a magnitude below the floor for damage 0', () => {
    expect(shakeForDamage(0).magnitude).toBe(2);
  });
});

describe('KILL_SHAKE', () => {
  it('is stronger and longer than a typical crit shake', () => {
    expect(KILL_SHAKE.magnitude).toBeGreaterThan(shakeForDamage(4).magnitude);
    expect(KILL_SHAKE.durationMs).toBeGreaterThanOrEqual(200);
  });
});

describe('shakeOffset', () => {
  const spec: ShakeSpec = { magnitude: 10, durationMs: 200 };

  it('is zero offset at or past the end of the shake', () => {
    expect(shakeOffset(spec, 200)).toEqual({ x: 0, y: 0, rotate: 0 });
    expect(shakeOffset(spec, 999)).toEqual({ x: 0, y: 0, rotate: 0 });
  });

  it('decays toward zero as elapsed grows', () => {
    const early = shakeOffset(spec, 20);
    const late = shakeOffset(spec, 180);
    const mag = (o: { x: number; y: number }) => Math.hypot(o.x, o.y);
    expect(mag(early)).toBeGreaterThan(mag(late));
  });

  it('keeps |x|,|y| within the current (decayed) magnitude', () => {
    const o = shakeOffset(spec, 0);
    expect(Math.abs(o.x)).toBeLessThanOrEqual(spec.magnitude);
    expect(Math.abs(o.y)).toBeLessThanOrEqual(spec.magnitude);
  });

  it('is deterministic for a given (spec, elapsed)', () => {
    expect(shakeOffset(spec, 50)).toEqual(shakeOffset(spec, 50));
  });
});

describe('prefersReducedMotion', () => {
  it('returns true when matchMedia reports a match', () => {
    expect(prefersReducedMotion(() => ({ matches: true }))).toBe(true);
  });
  it('returns false when no match', () => {
    expect(prefersReducedMotion(() => ({ matches: false }))).toBe(false);
  });
  it('returns false when matchMedia is unavailable (SSR-safe)', () => {
    expect(prefersReducedMotion(null)).toBe(false);
  });
});
```
- [ ] Run it, expect FAIL (module missing):
  `cd frontend && bun run test src/utils/screenShake.test.ts`
- [ ] Create `frontend/src/utils/screenShake.ts` (minimal implementation):
```ts
// Pure screen-shake math. The hook (useScreenShake) owns the RAF loop and DOM;
// everything here is deterministic and unit-tested. A "shake" is a magnitude
// (px) + duration (ms); shakeOffset(spec, elapsed) returns the decayed
// translate/rotate for a given moment, using a fixed pseudo-oscillation so the
// same (spec, elapsed) always yields the same offset.

export interface ShakeSpec {
  magnitude: number;
  durationMs: number;
}

export interface ShakeOffset {
  x: number;
  y: number;
  rotate: number;
}

const MIN_MAGNITUDE = 2; // floor so even a 1-dmg crit registers
const MAX_MAGNITUDE = 10; // clamp so huge crits don't nauseate
const CRIT_DURATION_MS = 160;

// Damage→shake: bigger crit = bigger shake, clamped to [MIN, MAX].
export function shakeForDamage(damage: number): ShakeSpec {
  const scaled = MIN_MAGNITUDE + Math.max(0, damage);
  return {
    magnitude: Math.min(MAX_MAGNITUDE, Math.max(MIN_MAGNITUDE, scaled)),
    durationMs: CRIT_DURATION_MS,
  };
}

// A kill hits harder and lingers a touch longer than any crit.
export const KILL_SHAKE: ShakeSpec = {
  magnitude: MAX_MAGNITUDE + 4,
  durationMs: 220,
};

// Decayed offset at `elapsedMs`. Linear decay to zero across durationMs; a
// fixed sine pair gives an oscillating jitter without per-frame randomness, so
// the result is pure/deterministic.
export function shakeOffset(spec: ShakeSpec, elapsedMs: number): ShakeOffset {
  if (elapsedMs >= spec.durationMs || elapsedMs < 0) {
    return { x: 0, y: 0, rotate: 0 };
  }
  const decay = 1 - elapsedMs / spec.durationMs; // 1 → 0
  const mag = spec.magnitude * decay;
  const phase = elapsedMs / 18; // ~one oscillation per frame-ish
  return {
    x: Math.sin(phase * 2.0) * mag,
    y: Math.cos(phase * 2.7) * mag,
    rotate: Math.sin(phase * 1.3) * decay * 0.6, // degrees
  };
}

// Reduced-motion predicate. mediaQuery is injectable so it is testable without
// jsdom: pass a function returning `{ matches }`, or null when unavailable.
export function prefersReducedMotion(
  query: (() => { matches: boolean }) | null = defaultReducedMotionQuery
): boolean {
  if (!query) return false;
  try {
    return query().matches;
  } catch {
    return false;
  }
}

function defaultReducedMotionQuery(): { matches: boolean } {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return { matches: false };
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)');
}
```
- [ ] Run it, expect PASS:
  `cd frontend && bun run test src/utils/screenShake.test.ts`
- [ ] Format: `cd frontend && bun run format`
- [ ] Commit:
```
git add frontend/src/utils/screenShake.ts frontend/src/utils/screenShake.test.ts
git commit -m "feat(juice): pure screen-shake decay + reduced-motion helpers

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `useScreenShake` hook (RAF loop, event-driven, reduced-motion guard)

No test for the hook itself (no renderHook/jsdom). The math is already covered by Task 1; this task is the thin wrapper. Verified via typecheck + manual.

**Files:**
- Create: `frontend/src/hooks/useScreenShake.ts`

- [ ] Create `frontend/src/hooks/useScreenShake.ts`:
```ts
import { useEffect, useRef, useState } from 'react';
import {
  shakeForDamage,
  shakeOffset,
  KILL_SHAKE,
  prefersReducedMotion,
  type ShakeSpec,
} from '../utils/screenShake';

// Drives a transient CSS transform on the gameplay container. Listens for
// `combat-hit` (crit only) and `monster-killed` window events, then runs a
// requestAnimationFrame decay loop using the pure shakeOffset math. Honors
// prefers-reduced-motion: when set, returns 'none' and never starts a loop.
export function useScreenShake(): string {
  const [transform, setTransform] = useState('none');
  const rafRef = useRef<number | null>(null);
  const reducedRef = useRef(false);

  useEffect(() => {
    reducedRef.current = prefersReducedMotion();

    const run = (spec: ShakeSpec) => {
      if (reducedRef.current) return;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      const start = performance.now();
      const step = (now: number) => {
        const elapsed = now - start;
        if (elapsed >= spec.durationMs) {
          rafRef.current = null;
          setTransform('none');
          return;
        }
        const o = shakeOffset(spec, elapsed);
        setTransform(
          `translate(${o.x.toFixed(2)}px, ${o.y.toFixed(2)}px) rotate(${o.rotate.toFixed(3)}deg)`
        );
        rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    };

    const onHit = (e: Event) => {
      const detail = (e as CustomEvent<{ damage: number; crit: boolean }>)
        .detail;
      if (!detail?.crit) return; // only crits shake
      run(shakeForDamage(detail.damage));
    };
    const onKill = () => run(KILL_SHAKE);

    window.addEventListener('combat-hit', onHit as EventListener);
    window.addEventListener('monster-killed', onKill as EventListener);
    return () => {
      window.removeEventListener('combat-hit', onHit as EventListener);
      window.removeEventListener('monster-killed', onKill as EventListener);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return transform;
}
```
- [ ] Typecheck: `cd frontend && bunx tsc -b`
- [ ] Format: `cd frontend && bun run format`
- [ ] Commit:
```
git add frontend/src/hooks/useScreenShake.ts
git commit -m "feat(juice): useScreenShake hook (RAF decay, reduced-motion guard)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Wire shake transform + `monster-killed` event into App.tsx

No new test (event dispatch + transform attach; covered by typecheck + manual).

**Files:**
- Modify: `frontend/src/App.tsx` (import block ~L36-45, defeat-edge effect ~L158-165, container ~L190)

- [ ] Add the hook import after the existing hook imports (after `useDocumentTitle` import, ~L45):
```ts
import { useScreenShake } from './hooks/useScreenShake';
```
- [ ] Inside `GameContent`, after `const isDefeated = isCurrentMonsterDefeated;` (~L76), add:
```ts
  const shakeTransform = useScreenShake();
```
- [ ] Fire `monster-killed` on the defeat false→true edge. Modify the existing defeat-edge effect (~L158-165) so the body reads:
```ts
  const wasDefeatedRef = useRef(false);
  useEffect(() => {
    if (wasDefeatedRef.current && !isDefeated && monstersDefeated > 0) {
      generateNewMonster();
    }
    // Defeat just started (false -> true): fire the kill event for screen shake
    // + kill popup. Endless only — Daily/Raid juice is out of scope.
    if (!wasDefeatedRef.current && isDefeated && currentMode === 'endless') {
      window.dispatchEvent(
        new CustomEvent('monster-killed', {
          detail: { variant: monsterVariant },
        })
      );
    }
    wasDefeatedRef.current = isDefeated;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDefeated, monstersDefeated]);
```
- [ ] Attach the transform to the gameplay container at L190. Change:
```tsx
      <div className="relative z-10">
```
  to:
```tsx
      <div
        className="relative z-10"
        style={{ transform: shakeTransform, willChange: 'transform' }}
      >
```
- [ ] Typecheck: `cd frontend && bunx tsc -b`
- [ ] Format: `cd frontend && bun run format`
- [ ] Commit:
```
git add frontend/src/App.tsx
git commit -m "feat(juice): attach screen-shake transform + fire monster-killed event

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Pure streak-tier + SFX-param mapping

**Files:**
- Create: `frontend/src/utils/sfxTier.ts`
- Test: `frontend/src/utils/sfxTier.test.ts`

Tier thresholds mirror `ComboMeter.tier`: `<=0 crit` → Combo, `>0 && <0.4` → Heating, `>=0.4 && <0.75` → Hot, `>=0.75` → BLAZING.

- [ ] Write failing test `frontend/src/utils/sfxTier.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  streakTierFromCritChance,
  critSfxParams,
  hitSfxParams,
  type ComboTier,
} from './sfxTier';

describe('streakTierFromCritChance', () => {
  it('maps crit chance to the named ComboMeter tiers', () => {
    expect(streakTierFromCritChance(0)).toBe('combo');
    expect(streakTierFromCritChance(0.1)).toBe('heating');
    expect(streakTierFromCritChance(0.4)).toBe('hot');
    expect(streakTierFromCritChance(0.6)).toBe('hot');
    expect(streakTierFromCritChance(0.75)).toBe('blazing');
    expect(streakTierFromCritChance(0.95)).toBe('blazing');
  });
});

describe('critSfxParams', () => {
  it('raises pitch with tier', () => {
    const combo = critSfxParams('combo');
    const blazing = critSfxParams('blazing');
    expect(blazing.pitchMult).toBeGreaterThan(combo.pitchMult);
  });
  it('adds an extra layer only at blazing', () => {
    expect(critSfxParams('hot').extraLayer).toBe(false);
    expect(critSfxParams('blazing').extraLayer).toBe(true);
  });
  it('pitchMult is ordered across all tiers', () => {
    const order: ComboTier[] = ['combo', 'heating', 'hot', 'blazing'];
    const pitches = order.map(t => critSfxParams(t).pitchMult);
    for (let i = 1; i < pitches.length; i++) {
      expect(pitches[i]).toBeGreaterThan(pitches[i - 1]);
    }
  });
});

describe('hitSfxParams', () => {
  it('also escalates pitch by tier', () => {
    expect(hitSfxParams('blazing').pitchMult).toBeGreaterThan(
      hitSfxParams('combo').pitchMult
    );
  });
});
```
- [ ] Run it, expect FAIL:
  `cd frontend && bun run test src/utils/sfxTier.test.ts`
- [ ] Create `frontend/src/utils/sfxTier.ts`:
```ts
// Maps the combo streak's crit chance to the named tiers ComboMeter shows
// (Combo / Heating / Hot / BLAZING) and to SFX parameters, so a hotter streak
// literally sounds hotter. Pure + unit-tested; sfxEngine consumes the params.

export type ComboTier = 'combo' | 'heating' | 'hot' | 'blazing';

// Thresholds mirror components/ComboMeter.tsx::tier so audio + visuals agree.
export function streakTierFromCritChance(critChance: number): ComboTier {
  if (critChance >= 0.75) return 'blazing';
  if (critChance >= 0.4) return 'hot';
  if (critChance > 0) return 'heating';
  return 'combo';
}

export interface SfxParams {
  pitchMult: number; // multiplies base note frequencies
  extraLayer: boolean; // adds a brighter octave layer at the top tier
}

const CRIT_PITCH: Record<ComboTier, number> = {
  combo: 1.0,
  heating: 1.12,
  hot: 1.26,
  blazing: 1.5,
};

export function critSfxParams(tier: ComboTier): SfxParams {
  return { pitchMult: CRIT_PITCH[tier], extraLayer: tier === 'blazing' };
}

const HIT_PITCH: Record<ComboTier, number> = {
  combo: 1.0,
  heating: 1.06,
  hot: 1.14,
  blazing: 1.24,
};

export function hitSfxParams(tier: ComboTier): SfxParams {
  return { pitchMult: HIT_PITCH[tier], extraLayer: tier === 'blazing' };
}
```
- [ ] Run it, expect PASS:
  `cd frontend && bun run test src/utils/sfxTier.test.ts`
- [ ] Format: `cd frontend && bun run format`
- [ ] Commit:
```
git add frontend/src/utils/sfxTier.ts frontend/src/utils/sfxTier.test.ts
git commit -m "feat(juice): pure streak-tier to SFX-param mapping

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Escalate `playCrit` by tier in sfxEngine

No new unit test (Web Audio has no DOM-free harness here; the mapping it consumes is tested in Task 4). Verified via typecheck. The param is **optional with a default**, so existing callers stay valid until Task 7 rewires them.

**Files:**
- Modify: `frontend/src/utils/sfxEngine.ts` (`playCrit` ~L167-171)

- [ ] Add the import at the top of `frontend/src/utils/sfxEngine.ts` (after the `export const` block, e.g. below L8 `const DEFAULT_SFX_VOLUME = 0.25;`):
```ts
import { critSfxParams, type ComboTier } from './sfxTier';
```
- [ ] Replace the existing `playCrit` (~L167-171) with a tier-aware version:
```ts
// Short, bright punchy cue for a critical hit. The streak tier raises the pitch
// (a hotter streak sounds hotter) and, at BLAZING, layers a brighter octave on
// top. Defaults to 'combo' so callers that don't pass a tier behave as before.
export function playCrit(tier: ComboTier = 'combo') {
  const { pitchMult, extraLayer } = critSfxParams(tier);
  const base = [1047, 1568].map(f => f * pitchMult);
  playArpeggio(base, 0.06, 0.35);
  if (extraLayer) {
    // Brighter octave shimmer for the top tier.
    playArpeggio(
      base.map(f => f * 2),
      0.05,
      0.16
    );
  }
}
```
- [ ] Typecheck: `cd frontend && bunx tsc -b`
- [ ] Format: `cd frontend && bun run format`
- [ ] Commit:
```
git add frontend/src/utils/sfxEngine.ts
git commit -m "feat(juice): escalate crit SFX pitch/layer by streak tier

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Pure popup-selection helpers (kill + damage-scaled crit)

**Files:**
- Create: `frontend/src/utils/combatPopups.ts`
- Test: `frontend/src/utils/combatPopups.test.ts`

- [ ] Write failing test `frontend/src/utils/combatPopups.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { selectCritPopup, killPopup } from './combatPopups';

describe('selectCritPopup', () => {
  it('includes the damage number in the text', () => {
    expect(selectCritPopup(7).text).toBe('CRIT 7!');
  });

  it('scales size up with damage (bigger crit = bigger text)', () => {
    const small = selectCritPopup(1);
    const big = selectCritPopup(50);
    expect(big.sizePx).toBeGreaterThan(small.sizePx);
  });

  it('clamps size to a max so a huge crit stays on screen', () => {
    expect(selectCritPopup(9999).sizePx).toBe(48);
  });

  it('floors size for tiny crits', () => {
    expect(selectCritPopup(0).sizePx).toBe(24);
  });

  it('always tags kind=crit', () => {
    expect(selectCritPopup(3).kind).toBe('crit');
  });
});

describe('killPopup', () => {
  it('shows DEFEATED', () => {
    expect(killPopup('common').text).toBe('DEFEATED');
  });

  it('colors by variant', () => {
    expect(killPopup('common').color).toBe('#f87171'); // red-400
    expect(killPopup('elite').color).toBe('#fbbf24'); // amber-400
    expect(killPopup('rare').color).toBe('#a78bfa'); // violet-400
  });

  it('always tags kind=kill', () => {
    expect(killPopup('rare').kind).toBe('kill');
  });
});
```
- [ ] Run it, expect FAIL:
  `cd frontend && bun run test src/utils/combatPopups.test.ts`
- [ ] Create `frontend/src/utils/combatPopups.ts`:
```ts
import type { MonsterVariant } from '../context/GameContext';

// Pure popup selection for combat juice. useCombatPopups consumes these and the
// TypingPopups CombatPopups component renders the returned text/size/color.

export interface CritPopupSpec {
  kind: 'crit';
  text: string;
  sizePx: number;
}

const CRIT_MIN_PX = 24;
const CRIT_MAX_PX = 48;

// Bigger crit number = bigger/brighter text, clamped so a huge crit still fits.
export function selectCritPopup(damage: number): CritPopupSpec {
  const sizePx = Math.min(
    CRIT_MAX_PX,
    Math.max(CRIT_MIN_PX, CRIT_MIN_PX + Math.max(0, damage) * 0.5)
  );
  return { kind: 'crit', text: `CRIT ${damage}!`, sizePx };
}

export interface KillPopupSpec {
  kind: 'kill';
  text: string;
  color: string;
}

// Variant-colored kill popup (common red, elite amber, rare violet — matching
// the death-burst palette in Monster.tsx::VARIANT_BURST).
const KILL_COLOR: Record<MonsterVariant, string> = {
  common: '#f87171',
  elite: '#fbbf24',
  rare: '#a78bfa',
};

export function killPopup(variant: MonsterVariant): KillPopupSpec {
  return { kind: 'kill', text: 'DEFEATED', color: KILL_COLOR[variant] };
}
```
- [ ] Run it, expect PASS:
  `cd frontend && bun run test src/utils/combatPopups.test.ts`
- [ ] Format: `cd frontend && bun run format`
- [ ] Commit:
```
git add frontend/src/utils/combatPopups.ts frontend/src/utils/combatPopups.test.ts
git commit -m "feat(juice): pure kill + damage-scaled crit popup selectors

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Wire popups + tier SFX into useCombatPopups & TypingInterface

No new unit test (the pure helpers are covered in Tasks 4 & 6; this is wiring). Verified via typecheck.

**Files:**
- Modify: `frontend/src/hooks/useCombatPopups.ts` (interface ~L4-11, spawn ~L23, onHit ~L51-57)
- Modify: `frontend/src/components/TypingInterface.tsx` (~L169-173)

- [ ] In `frontend/src/hooks/useCombatPopups.ts`, replace the imports (L1-2) with:
```ts
import { useEffect, useRef, useState } from 'react';
import { playCrit, playComboBreak } from '../utils/sfxEngine';
import { selectCritPopup, killPopup } from '../utils/combatPopups';
import { streakTierFromCritChance } from '../utils/sfxTier';
import type { MonsterVariant } from '../context/GameContext';
```
- [ ] Replace the `CombatPopupItem` interface (~L4-11) with one carrying per-popup size/color and the new `kill` kind:
```ts
export interface CombatPopupItem {
  id: number;
  topPct: number;
  leftPct: number;
  show: boolean;
  text: string;
  kind: 'crit' | 'break' | 'kill';
  sizePx?: number; // crit: damage-scaled font size
  color?: string; // kill: variant color
}
```
- [ ] Replace `spawn`'s signature + push (the `spawn` closure ~L23-30) so it accepts optional style fields:
```ts
    const spawn = (
      text: string,
      kind: 'crit' | 'break' | 'kill',
      holdMs: number,
      style?: { sizePx?: number; color?: string }
    ) => {
      const left = 50 + (Math.random() * 12 - 6);
      const top = 32 + (Math.random() * 10 - 5);
      const id = ++idRef.current;
      setPopups(prev => [
        ...prev,
        {
          id,
          topPct: top,
          leftPct: left,
          show: false,
          text,
          kind,
          sizePx: style?.sizePx,
          color: style?.color,
        },
      ]);
```
  (Leave the three `setTimeout` calls that follow unchanged.)
- [ ] Replace the `onHit` handler (~L51-57) so it uses the pure helpers + tier SFX, and add a `monster-killed` listener. Replace the block from `const onHit` through the `return () => { ... }` cleanup (~L51-68) with:
```ts
    const onHit = (e: Event) => {
      const detail = (e as CustomEvent<{
        damage: number;
        crit: boolean;
        critChance?: number;
      }>).detail;
      if (!detail?.crit) return; // only crits pop
      playCrit(streakTierFromCritChance(detail.critChance ?? 0));
      const spec = selectCritPopup(detail.damage);
      spawn(spec.text, 'crit', 700, { sizePx: spec.sizePx });
    };
    const onBreak = () => {
      playComboBreak();
      spawn('Combo broken', 'break', 600);
    };
    const onKill = (e: Event) => {
      const variant =
        (e as CustomEvent<{ variant?: MonsterVariant }>).detail?.variant ??
        'common';
      const spec = killPopup(variant);
      spawn(spec.text, 'kill', 800, { color: spec.color });
    };

    window.addEventListener('combat-hit', onHit as EventListener);
    window.addEventListener('combo-break', onBreak as EventListener);
    window.addEventListener('monster-killed', onKill as EventListener);
    return () => {
      window.removeEventListener('combat-hit', onHit as EventListener);
      window.removeEventListener('combo-break', onBreak as EventListener);
      window.removeEventListener('monster-killed', onKill as EventListener);
    };
```
- [ ] In `frontend/src/components/TypingInterface.tsx`, include the streak's crit chance in the `combat-hit` detail so the SFX tier is accurate. The combo system exposes `critChance` (see `useComboSystem`). Confirm the hook's `critChance` is destructured where `registerComboCorrect` is (search the file); if not already destructured, add `critChance: comboCritChance` to that destructure. Then change the dispatch (~L171-173):
```tsx
      window.dispatchEvent(
        new CustomEvent('combat-hit', {
          detail: { damage, crit, critChance: comboCritChance },
        })
      );
```
  Note: `comboCritChance` reflects the streak *before* this word's increment, which matches the roll that produced `damage` — correct for tier audio.
- [ ] Typecheck: `cd frontend && bunx tsc -b`
- [ ] Run the popup + tier tests still green:
  `cd frontend && bun run test src/utils/combatPopups.test.ts src/utils/sfxTier.test.ts`
- [ ] Format: `cd frontend && bun run format`
- [ ] Commit:
```
git add frontend/src/hooks/useCombatPopups.ts frontend/src/components/TypingInterface.tsx
git commit -m "feat(juice): kill popup, damage-scaled crit popup, tier crit SFX wiring

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Render kill + damage-scaled crit in CombatPopups

No new unit test (presentational; covered by Task 6 selectors + typecheck).

**Files:**
- Modify: `frontend/src/components/TypingPopups.tsx` (`CombatPopups` ~L83-110)

- [ ] Replace the `CombatPopups` component (~L83-110) so each item renders its own size/color and the `kill` kind:
```tsx
export function CombatPopups({ popups }: { popups: CombatPopupItem[] }) {
  return (
    <>
      {popups.map(popup => (
        <div key={popup.id} className="fixed inset-0 pointer-events-none z-40">
          <div
            className={`absolute transition-all ${popup.show ? 'opacity-100 -translate-y-3 scale-125' : 'opacity-0 translate-y-0 scale-95'} duration-500 ease-out`}
            style={{
              top: `${popup.topPct}%`,
              left: `${popup.leftPct}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <span
              className={`font-extrabold select-none drop-shadow ${
                popup.kind === 'crit'
                  ? 'text-pink-400'
                  : popup.kind === 'kill'
                    ? 'text-2xl tracking-wider'
                    : 'text-gray-400 text-base'
              }`}
              style={{
                ...(popup.kind === 'crit' && popup.sizePx
                  ? { fontSize: `${popup.sizePx}px` }
                  : {}),
                ...(popup.kind === 'kill' && popup.color
                  ? { color: popup.color }
                  : {}),
              }}
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
- [ ] Typecheck: `cd frontend && bunx tsc -b`
- [ ] Format: `cd frontend && bun run format`
- [ ] Commit:
```
git add frontend/src/components/TypingPopups.tsx
git commit -m "feat(juice): render kill popup + per-crit damage-scaled size

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: ComboMeter glow/pulse at Hot/BLAZING

No new unit test (the threshold logic already lives in the local `tier` helper, which only emits class strings; covered by typecheck + manual). If desired, the `tier`→glow class could be extracted, but the spec only needs the glow rendered, so we keep it inline.

**Files:**
- Modify: `frontend/src/components/ComboMeter.tsx` (`tier` ~L5-20, JSX ~L27-48)

- [ ] Extend the `tier` helper (~L5-20) to also return a `glow` class. Replace the function body so each return includes a `glow` field:
```tsx
// Tier purely for label/colour feel; crit math lives in combatTuning.
function tier(streak: number, critChance: number) {
  if (streak <= 0)
    return { label: 'Combo', color: 'text-gray-500', fill: 0, glow: '' };
  if (critChance >= 0.75)
    return {
      label: '🔥 BLAZING',
      color: 'text-pink-400',
      fill: 100,
      glow: 'combo-glow-blazing',
    };
  if (critChance >= 0.4)
    return {
      label: '🔥 Hot',
      color: 'text-orange-400',
      fill: (critChance / 0.75) * 100,
      glow: 'combo-glow-hot',
    };
  return {
    label: 'Heating',
    color: 'text-yellow-300',
    fill: (critChance / 0.75) * 100,
    glow: '',
  };
}
```
- [ ] Apply the glow class to the meter bar wrapper. Change the bar container `<div>` (~L38-42) to include `${t.glow}`:
```tsx
      <div
        className={`h-2 w-full overflow-hidden rounded-full ${t.glow} ${
          theme === 'dark' ? 'bg-gray-800' : 'bg-gray-200'
        }`}
      >
```
- [ ] Add the keyframes + glow classes to the global stylesheet. Append to `frontend/src/index.css`:
```css
/* Combo meter glow/pulse at Hot / BLAZING tiers (combat juice). */
@keyframes combo-pulse-hot {
  0%,
  100% {
    box-shadow: 0 0 6px 1px rgba(251, 146, 60, 0.55);
  }
  50% {
    box-shadow: 0 0 12px 3px rgba(251, 146, 60, 0.85);
  }
}
@keyframes combo-pulse-blazing {
  0%,
  100% {
    box-shadow: 0 0 8px 2px rgba(244, 114, 182, 0.65);
  }
  50% {
    box-shadow: 0 0 18px 5px rgba(244, 114, 182, 1);
  }
}
.combo-glow-hot {
  animation: combo-pulse-hot 1.1s ease-in-out infinite;
}
.combo-glow-blazing {
  animation: combo-pulse-blazing 0.7s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .combo-glow-hot,
  .combo-glow-blazing {
    animation: none;
  }
}
```
  (If `frontend/src/index.css` does not exist, locate the global stylesheet imported in `main.tsx` and append there instead.)
- [ ] Typecheck: `cd frontend && bunx tsc -b`
- [ ] Format: `cd frontend && bun run format`
- [ ] Commit:
```
git add frontend/src/components/ComboMeter.tsx frontend/src/index.css
git commit -m "feat(juice): ComboMeter pulsing glow at Hot/BLAZING (reduced-motion safe)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 10: Full verification gate

**Files:** none (verification only)

- [ ] Run the full gate:
  `cd frontend && bun run lint && bun run format:check && bunx tsc -b && bun run test`
- [ ] Confirm: lint 0 errors (1 pre-existing unused-eslint-disable warning acceptable), format:check passes, `tsc -b` clean, all tests green (new suites: `screenShake`, `sfxTier`, `combatPopups`).
- [ ] If anything fails, fix → re-run the gate (do NOT claim done on a red gate).
- [ ] Final commit only if the gate produced uncommitted fixes:
```
git add -A
git commit -m "chore(juice): verification fixes

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-review notes

Spec coverage check (spec sections 1-4):

| Spec requirement | Task | Pure helper tested |
| --- | --- | --- |
| Screen shake on crit, damage-scaled | 1,2,3 | `shakeForDamage`, `shakeOffset` |
| Stronger one-shot kill shake | 1,2,3 | `KILL_SHAKE` |
| Transform on `App.tsx:190` container (background excluded) | 3 | n/a (wiring) |
| `prefers-reduced-motion` disables shake | 1,2 | `prefersReducedMotion` predicate (injectable) |
| SFX escalation by streak tier (Combo→Heating→Hot→BLAZING) | 4,5,7 | `streakTierFromCritChance`, `critSfxParams` |
| Kill popup (variant-colored) | 6,7,8 | `killPopup` |
| Damage-scaled crit popup | 6,7,8 | `selectCritPopup` |
| ComboMeter glow/pulse at Hot/BLAZING | 9 | inline (CSS); reduced-motion guarded in CSS |
| Endless only; Raid out of scope | 3,7 (`currentMode === 'endless'` guard on kill event; crit/break events already endless-only in TypingInterface) | — |

Constraint compliance:
- No `@testing-library/react` / no jsdom: every test imports a PURE function and asserts outputs (mirrors `useComboSystem.test.ts`). No `renderHook`, no DOM render assertions. `prefersReducedMotion` takes an injectable query fn so the reduced-motion guard is tested without `window.matchMedia`.
- Single-file test runs use `bun run test <path>` (never bare `bun test`).
- `bun run format` runs after every source edit; full gate is `lint && format:check && tsc -b && test`.
- Typecheck is `bunx tsc -b` throughout (never `tsc --noEmit`).
- Every commit message ends with the `Co-Authored-By: Claude Opus 4.8` trailer.
- Each task leaves the app compiling and tests green (the new `playCrit` tier param defaults to `'combo'`, and `combat-hit` `critChance` is optional, so Tasks 5/7 never break intermediate states).

Open confirmation (flagged in spec as "optional, confirm on review"):
- A non-crit hit "tick" SFX/popup was intentionally NOT implemented — spec marks it optional and the existing design keeps non-crit hits quiet to avoid per-word spam. Add later if review requests it.
