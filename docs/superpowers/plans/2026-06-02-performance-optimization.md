# Performance Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut Typing RPG's initial load time and in-game CPU/GPU/heat without changing gameplay feel, by deferring the 1.1 MB 3D bundle off the critical path, bounding per-frame pixel cost, and stopping wasted React re-renders.

**Architecture:** Three independent tracks, each its own feature branch off `dev`: **(A) Runtime** — cap Canvas DPR, trim geometry, optionally idle-pause loops; **(B) Re-render** — memoize `Monster`, optionally split the `GameProvider` context; **(C) Bundle/load** — `React.lazy` every component that imports `three`, so `three-vendor` becomes an async chunk. Tracks don't touch the same files (except `Monster.tsx`, which Track A/B/C all touch — sequence those).

**Tech Stack:** React 19, Vite + `@vitejs/plugin-react-swc`, `@react-three/fiber` v9 + `three` v0.177 + `@react-three/drei`, Tailwind, Vitest (`environment: 'node'`, no jsdom — components are verified with `renderToString` from `react-dom/server` plus a `vi.mock('@react-three/fiber')` Canvas stub). Bun.

---

## Why these changes (evidence)

Measured from the current `dev` code:

| Problem | Evidence | Fix track |
|---|---|---|
| 3D engine blocks first load | `three-vendor` = **1,112 kB (309 kB gzip)**; `Monster` (App.tsx:7) + `BattleAvatar`→`PlayerAvatar3D` (TypingInterface.tsx:18) are **statically** imported, so the chunk is on the critical path even on the menu. | C |
| Two always-on 60 fps WebGL loops | During every Endless/Daily session both `<Monster>` and `<BattleAvatar>` render continuously; **no `dpr` cap** anywhere → each shades device-pixel-ratio² pixels (4–9× on retina). | A |
| `Monster` reconciles on every keystroke | `GameProvider`'s context value is one monolithic object; `remainingWords`/`playerHealth`/`killStreak` change constantly. `Monster` is **not** memoized (PlayerAvatar3D/RaidAvatar/RaidBoss3D already are). | B |
| High-poly idle scenes | `sphereGeometry args={[1, 32, 32]}` (slime body), `[1.1, 32, 32]` (boss), `[..,16,16]` eyes/pauldrons, re-tessellated each frame by the vertex stage. | A |

---

## Status (2026-06-02) — Phases 0–4 shipped to `dev`

Merged to `dev` (3 branches, then deleted): `perf/canvas-runtime` (Phases 1+4),
`perf/memo-monster` (Phase 2), `perf/lazy-three` (Phase 3). Integrated CI green:
lint 0 errors (1 pre-existing warning), format clean, tsc clean, 128 tests pass.

**Bundle, measured (gzip):** initial JS graph **556.6 kB → 295.2 kB (−261 kB)**.
`three-vendor` (250 kB gzip) is now async, no longer in `dist/index.html`.
Critical chunks now: index 91.9, react-vendor 94.0, sentry 87.9, clerk 21.3.

> Phase 3 needed a `vite.config.ts` chunking fix not in the original plan: the
> entry kept statically importing `three-vendor` because Rollup hoisted shared
> React + Vite's `__vitePreload` helper into it. Fix: match `node_modules/three`
> (not bare `three`), split `react-vendor`, and pin `__vitePreload` to
> react-vendor. (A bare-substring `three` match also wrongly swept every dep in
> any worktree dir named `*three*` — e.g. `perf-lazy-three` — into three-vendor.)

**Deferred:** Phase 5 (avatar `frameloop="demand"`, needs user sign-off on losing
the idle bob), Phase 6 (pause loop while paused/dead, marginal + runtime-gated),
Phase 7 (context split, measure-gated on Profiler data).

## Success Criteria (check at the end)

- [x] **Load:** `three-vendor` no longer referenced by `dist/index.html`; initial JS graph shrank **261 kB gzip** (≥ 250 kB target met).
- [x] **Runtime DPR:** all three `<Canvas>` surfaces use `dpr={[1,1.5]}` via shared `utils/canvas.ts`. (Hardware verify on retina pending — user.)
- [ ] **Re-render:** `Monster` absent from Profiler commits while typing — `memo` applied; **needs user Profiler confirmation on retina**.
- [x] **CI green:** lint / format:check / tsc / test (128) / build all pass.
- [ ] **No regression (manual checklist):** node-env smoke confirmed lazy chunks load + three.js executes (WebGL itself can't init in headless); **full visual pass pending on user's GPU**.
- [ ] **Measured CPU (user-run, retina):** capture before/after per Measurement Protocol (target ≥ 30% on 3D cost). **Needs user.**

---

## Measurement Protocol (use for Phase 0 baseline and final check)

Run from `frontend/`.

**Bundle:**
```bash
bun run build 2>&1 | tee /tmp/build-after.txt
# initial-load chunks are the ones referenced by index.html:
grep -oE '(assets/[^"]+\.js)' dist/index.html | sort -u
# is three on the critical path?
grep -o 'three-vendor[^"]*' dist/index.html && echo "STILL CRITICAL" || echo "three-vendor is async (good)"
```

**Runtime (user, on the retina Mac):**
1. `bun run dev`, open Endless, start typing, let it idle mid-word.
2. Chrome DevTools → Performance → record 5 s. Note scripting + GPU time, and FPS.
3. In console: `document.querySelector('canvas')` exists; check `Array.from(document.querySelectorAll('canvas')).length` (expect 2 in Endless). After Phase 1, confirm the renderer pixel ratio is capped.
4. Record CPU% from Activity Monitor (the browser GPU/renderer process) while idling on the typing screen.

> Headless/automated GPU profiling is unreliable for WebGL; runtime numbers are captured manually by the user. Bundle and re-render criteria are tool-verifiable.

---

## Branch strategy

Per project rules (branch per feature off `dev`, one worktree per branch, merge to `dev` when CI passes). Recommended: **three branches**, merged independently in this order so each ships value on its own and `Monster.tsx` conflicts are avoided:

1. `perf/canvas-runtime` → Phases 1, 4 (+ optional 5, 6)
2. `perf/memo-monster` → Phase 2
3. `perf/lazy-three` → Phase 3 (+ optional 7 context split, or split that to its own branch)

Phase 0 is measurement only (no branch). Do Phase 2 and Phase 3 after Phase 1 is merged so each rebases cleanly on the new `Monster.tsx`.

---

## Phase 0: Baseline capture (no code)

- [ ] **Step 1: Capture bundle baseline**

Run: `cd frontend && bun run build 2>&1 | tee /tmp/build-before.txt`
Record: the `three-vendor` size line and the list from `grep -oE '(assets/[^"]+\.js)' dist/index.html | sort -u`.
Expected: `three-vendor` ~1,112 kB and it (or the entry chunk that imports it) is in `index.html`.

- [ ] **Step 2: Capture runtime baseline** (user)

Follow the Measurement Protocol "Runtime" steps. Write the numbers (idle FPS, scripting+GPU ms over 5 s, renderer/browser CPU%) into a scratch note. These are the before-numbers for the final criterion.

---

## Phase 1: Cap Canvas DPR (Track A — biggest, safest runtime win)

**Files:**
- Create: `frontend/src/utils/canvas.ts`
- Create: `frontend/src/utils/canvas.test.ts`
- Modify: `frontend/src/components/Monster.tsx:77-80`
- Modify: `frontend/src/components/PlayerAvatar3D.tsx:292-296`
- Modify: `frontend/src/components/RaidBoss3D.tsx:135-139`

- [ ] **Step 1: Write the failing test for shared canvas defaults**

Create `frontend/src/utils/canvas.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { CANVAS_DPR, CANVAS_GL } from './canvas';

describe('canvas defaults', () => {
  it('caps dpr at 1.5 to bound per-frame pixel work', () => {
    expect(CANVAS_DPR).toEqual([1, 1.5]);
  });
  it('keeps a transparent, antialiased context', () => {
    expect(CANVAS_GL.alpha).toBe(true);
    expect(CANVAS_GL.antialias).toBe(true);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `cd frontend && bunx vitest run src/utils/canvas.test.ts`
Expected: FAIL — `Cannot find module './canvas'`.

- [ ] **Step 3: Create the shared defaults**

Create `frontend/src/utils/canvas.ts`:
```ts
// Shared <Canvas> defaults for every 3D surface (monster, warrior avatar, raid
// boss). Centralized so the resolution cap is identical everywhere.
//
// dpr is the single biggest runtime lever: an uncapped Canvas renders at the
// full device pixel ratio, so on a 2-3x retina display it shades 4-9x the
// pixels of its CSS box every frame. Two such canvases run continuously during
// an Endless/Daily session (monster + warrior), which is what spikes CPU/GPU.
// Capping at 1.5 keeps edges crisp while cutting per-frame pixel work ~2-4x.
export const CANVAS_DPR: [number, number] = [1, 1.5];

// WebGL context options shared by every Canvas. Matches the prior
// alpha + antialias setup; centralized so future changes apply everywhere.
export const CANVAS_GL = {
  alpha: true,
  antialias: true,
} as const;
```

- [ ] **Step 4: Run it, verify it passes**

Run: `cd frontend && bunx vitest run src/utils/canvas.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Apply to `Monster.tsx`**

Add to imports (top of file, with the other relative imports):
```tsx
import { CANVAS_DPR, CANVAS_GL } from '../utils/canvas';
```
Replace the `<Canvas>` opening tag (currently lines 77-80):
```tsx
          <Canvas
            camera={{ position: [0, 0, 4], fov: 50 }}
            dpr={CANVAS_DPR}
            gl={CANVAS_GL}
          >
```

- [ ] **Step 6: Apply to `PlayerAvatar3D.tsx`**

Add import (top, after the existing imports):
```tsx
import { CANVAS_DPR, CANVAS_GL } from '../utils/canvas';
```
Replace the `<Canvas>` opening tag (currently lines 292-296):
```tsx
    <Canvas
      camera={{ position: [0, 0, 3.6], fov: 50 }}
      dpr={CANVAS_DPR}
      gl={CANVAS_GL}
      style={{ width: '100%', height: '100%' }}
    >
```

- [ ] **Step 7: Apply to `RaidBoss3D.tsx`**

Add import (top):
```tsx
import { CANVAS_DPR, CANVAS_GL } from '../utils/canvas';
```
Replace the `<Canvas>` opening tag (currently lines 135-139):
```tsx
    <Canvas
      camera={{ position: [0, 0.3, 4.2], fov: 50 }}
      dpr={CANVAS_DPR}
      gl={CANVAS_GL}
      style={{ width: '100%', height: '100%' }}
    >
```

- [ ] **Step 8: Verify nothing broke**

Run: `cd frontend && bun run lint && bun run format:check && bunx tsc --noEmit && bun run test`
Expected: 0 errors, all existing tests + 2 new canvas tests pass.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/utils/canvas.ts frontend/src/utils/canvas.test.ts \
  frontend/src/components/Monster.tsx frontend/src/components/PlayerAvatar3D.tsx \
  frontend/src/components/RaidBoss3D.tsx
git commit -m "perf(3d): cap Canvas DPR at 1.5 via shared defaults"
```

**Acceptance:** All four `<Canvas>` surfaces (`Monster`, `PlayerAvatar3D` used by BattleAvatar/RaidAvatar/Customizer/Lobby, `RaidBoss3D`) use `dpr={[1,1.5]}`. Manual: in DevTools, `renderer.getPixelRatio() ≤ 1.5` on a retina screen; visuals unchanged to the eye.

---

## Phase 2: Memoize `Monster` (Track B — stop per-keystroke reconciliation)

**Files:**
- Modify: `frontend/src/components/Monster.tsx` (export + import)
- Create: `frontend/src/components/Monster.test.tsx`

> Do this on `perf/memo-monster`, branched after Phase 1 merges to `dev`.

- [ ] **Step 1: Write the render test (locks "renders without crashing")**

Create `frontend/src/components/Monster.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

// @react-three/fiber Canvas cannot server-render in the node test env; stub it.
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children?: unknown }) => (
    <div data-monster-canvas="true">{children as never}</div>
  ),
  useFrame: () => {},
}));
vi.mock('../hooks/useSfx', () => ({
  useSfx: () => ({ playExplosion: () => {} }),
}));
// GolemModel calls useGLTF.preload() at module load; stub drei so the import is safe.
vi.mock('@react-three/drei', () => ({
  useGLTF: Object.assign(
    () => ({ scene: { clone: () => ({ traverse: () => {} }) } }),
    { preload: () => {} }
  ),
}));

import Monster from './Monster';

describe('Monster', () => {
  it('renders a slime canvas without crashing', () => {
    const html = renderToString(
      <Monster monsterFamily="slime" monsterType="normal" isDefeated={false} />
    );
    expect(html).toContain('data-monster-canvas');
  });
});
```

- [ ] **Step 2: Run it, verify it passes against current (un-memoized) Monster**

Run: `cd frontend && bunx vitest run src/components/Monster.test.tsx`
Expected: PASS. (This pins behavior before the memo change so we know memo doesn't alter output.)

- [ ] **Step 3: Wrap the component in `memo`**

In `frontend/src/components/Monster.tsx`:
- Change the React import to include `memo`:
```tsx
import { memo, useRef, useState, useEffect, useCallback } from 'react';
```
- Change the declaration from `export default function Monster(...)` to a named function `function Monster(...)` (remove `export default` on the function line), and add at the very bottom of the file:
```tsx
export default memo(Monster);
```
`Monster`'s props from App are all primitives (`monsterFamily`, `monsterType`, `isDefeated`, `color`, `scale`, `shape`), so the default shallow comparison is correct — it re-renders only on spawn/defeat, not on context-driven keystroke renders.

- [ ] **Step 4: Verify**

Run: `cd frontend && bun run lint && bun run format:check && bunx tsc --noEmit && bunx vitest run src/components/Monster.test.tsx`
Expected: PASS, no type/lint errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Monster.tsx frontend/src/components/Monster.test.tsx
git commit -m "perf(monster): memoize Monster to stop per-keystroke Canvas reconcile"
```

**Acceptance:** React DevTools Profiler — while typing in Endless, `Monster` is absent from commit lists; it appears only when a monster spawns or is defeated.

---

## Phase 3: Lazy-load `three-vendor` (Track C — biggest load-time win)

Defer every component that imports `three` behind `React.lazy` so the entry chunk no longer pulls `three-vendor`. The four static paths to `three` are: `Monster` (App), `BattleAvatar`→`PlayerAvatar3D` (TypingInterface), `RaidView` (App, raid subtree), `CharacterCustomizer` (Header modal).

**Files:**
- Modify: `frontend/src/App.tsx` (Monster + RaidView)
- Modify: `frontend/src/components/TypingInterface.tsx` (BattleAvatar)
- Modify: `frontend/src/components/Header.tsx` (CharacterCustomizer)

> Branch `perf/lazy-three`, after Phase 2 merges.

- [ ] **Step 1: Lazy `Monster` and `RaidView` in `App.tsx`**

- Update the React import (line 1) to add `lazy, Suspense`:
```tsx
import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
```
- Replace the value import `import Monster from './components/Monster';` (line 7) with a lazy const placed just below the other imports (keep the existing `import type { MonsterFamily } from './components/Monster';` — type imports are erased and don't bundle `three`):
```tsx
const Monster = lazy(() => import('./components/Monster'));
```
- Replace the value import `import RaidView from './components/RaidView';` (line 23) with:
```tsx
const RaidView = lazy(() => import('./components/RaidView'));
```
- Wrap `<RaidView />` (line 144) in Suspense (reuse the existing `LoadingScreen` as fallback):
```tsx
        {currentMode === 'raid' ? (
          <Suspense fallback={<LoadingScreen />}>
            <RaidView />
          </Suspense>
        ) : (
```
- Wrap `<Monster ... />` (lines 148-155) in Suspense with a fallback sized exactly like the monster box (avoids layout shift while the chunk streams):
```tsx
            <Suspense
              fallback={
                <div className="w-full max-w-md mx-auto py-4">
                  <div className="w-full aspect-[3/2]" />
                </div>
              }
            >
              <Monster
                monsterFamily={monsterFamily}
                monsterType={monsterType}
                isDefeated={isDefeated}
                color={monsterVisuals.color}
                scale={monsterVisuals.scale}
                shape={monsterShape}
              />
            </Suspense>
```

- [ ] **Step 2: Lazy `BattleAvatar` in `TypingInterface.tsx`**

- Ensure React import includes `lazy, Suspense` (add if missing).
- Replace `import BattleAvatar from './BattleAvatar';` (line 18) with:
```tsx
const BattleAvatar = lazy(() => import('./BattleAvatar'));
```
- Wrap `<BattleAvatar />` (line 371) in Suspense with a fallback matching its `h-44 w-28` box:
```tsx
        <div className="flex-shrink-0 flex items-center">
          <Suspense fallback={<div className="h-44 w-28" />}>
            <BattleAvatar />
          </Suspense>
        </div>
```

- [ ] **Step 3: Lazy `CharacterCustomizer` in `Header.tsx`**

- Add `lazy, Suspense` to the React import.
- Replace `import CharacterCustomizer from './CharacterCustomizer';` (line 11) with:
```tsx
const CharacterCustomizer = lazy(() => import('./CharacterCustomizer'));
```
- Wrap the mount (line 166) in Suspense (modal — `null` fallback is fine; the chunk loads in <100 ms after the button click):
```tsx
        <Suspense fallback={null}>
          <CharacterCustomizer onClose={() => setShowCustomizer(false)} />
        </Suspense>
```

- [ ] **Step 4: Build and verify three left the critical path**

Run:
```bash
cd frontend && bun run build
grep -o 'three-vendor[^"]*' dist/index.html && echo "STILL CRITICAL — investigate" || echo "three-vendor is async (good)"
```
Expected: the `grep` prints nothing → "three-vendor is async (good)". If it still appears, find the remaining static importer:
```bash
grep -rn "from '.*PlayerAvatar3D'\|from '.*RaidBoss3D'\|from '.*Monster'" src --include="*.tsx" | grep -v "import type" | grep -v "lazy("
```
and lazy-load that path too.

- [ ] **Step 5: Full verification**

Run: `cd frontend && bun run lint && bun run format:check && bunx tsc --noEmit && bun run test && bun run build`
Expected: all green. Existing component tests still import the components directly (unaffected by the lazy boundaries at usage sites).

- [ ] **Step 6: Manual smoke**

`bun run dev`: home page shell paints immediately; monster + warrior appear a beat later (chunk streaming). Switch to Raid → loads. Open Customizer → loads. No layout jump where the fallbacks sit.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/TypingInterface.tsx frontend/src/components/Header.tsx
git commit -m "perf(bundle): lazy-load three-vendor off the critical path"
```

**Acceptance:** `dist/index.html` no longer references `three-vendor`; initial JS graph (gzip) drops ≥ 250 kB vs. Phase 0 baseline; app still renders all 3D surfaces after a short async load with no layout shift.

---

## Phase 4: Trim idle geometry (Track A — marginal, low-risk)

Lower segment counts on the round primitives. Small win (these scenes are a few hundred tris) but free and reduces vertex work each frame.

**Files:**
- Modify: `frontend/src/components/SlimeModel.tsx` (lines 151, 167, 173)
- Modify: `frontend/src/components/RaidBoss3D.tsx` (lines 79, 88, 96)
- Modify: `frontend/src/components/PlayerAvatar3D.tsx` (lines 213, 218)

- [ ] **Step 1: SlimeModel** — body `sphereGeometry args={[1, 32, 32]}` → `args={[1, 24, 24]}` (line 151); both eyes `args={[0.15, 16, 16]}` → `args={[0.15, 12, 12]}` (lines 167, 173).

- [ ] **Step 2: RaidBoss3D** — body `args={[1.1, 32, 32]}` → `args={[1.1, 24, 24]}` (line 79); both eyes `args={[0.16, 16, 16]}` → `args={[0.16, 12, 12]}` (lines 88, 96).

- [ ] **Step 3: PlayerAvatar3D pauldrons** — both `sphereGeometry args={[pauldronR, 16, 16]}` → `args={[pauldronR, 12, 12]}` (lines 213, 218).

- [ ] **Step 4: Verify + manual**

Run: `cd frontend && bunx tsc --noEmit && bun run test && bun run build`
Manual: spheres still look round at game scale (24 segments is smooth at this size).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/SlimeModel.tsx frontend/src/components/RaidBoss3D.tsx frontend/src/components/PlayerAvatar3D.tsx
git commit -m "perf(3d): reduce idle-mesh segment counts"
```

**Acceptance:** No visible change to monster/boss/avatar roundness; build green.

---

## Phase 5 (OPTIONAL): Warrior avatar `frameloop="demand"` (Track A — eliminate one always-on loop)

The warrior idles with a subtle bob (`Math.sin(t*2)*0.06` in `PlayerAvatar3D.tsx:78`). Switching its Canvas to `frameloop="demand"` stops the second continuous loop during normal typing; it renders only when something changes. **Tradeoff:** loses the idle bob (the avatar holds a still pose between attacks/hurt). Only do this if Phase 0/1 runtime numbers show the avatar loop is still a meaningful cost after the DPR cap.

**Mechanism:** set `frameloop="demand"` on the avatar `<Canvas>`, drop the idle-bob line, and call R3F `invalidate()` whenever the avatar must animate (attack, hurt, hp tint, alive/dead). Attack/hurt are already time-boxed (`ATTACK_DURATION`/`HURT_DURATION` ms) so each needs a short `invalidate()` pump for its duration.

- [ ] **Step 1:** In `PlayerAvatar3D.tsx`, add `frameloop="demand"` to the `<Canvas>`.
- [ ] **Step 2:** Inside `WarriorModel`, import `useThree`, grab `const invalidate = useThree((s) => s.invalidate);`. Remove the `posY = Math.sin(t * 2) * 0.06;` idle line (or guard it behind a config flag).
- [ ] **Step 3:** Add an effect that pumps frames for the duration of an attack/hurt and on alive/critical change:
```tsx
useEffect(() => {
  let raf = 0;
  const until = Date.now() + Math.max(ATTACK_DURATION, HURT_DURATION) + 50;
  const pump = () => {
    invalidate();
    if (Date.now() < until) raf = requestAnimationFrame(pump);
  };
  pump();
  return () => cancelAnimationFrame(raf);
}, [isAttacking, isHurt, isAlive, critical, invalidate]);
```
- [ ] **Step 4:** Verify the attack lunge, hurt recoil, low-HP wobble, and death droop still animate; the avatar is static between events.
- [ ] **Step 5:** Commit `perf(avatar): demand-driven frameloop, drop idle bob`.

**Acceptance:** During idle typing only one continuous WebGL loop runs (monster). Avatar still animates on hit/attack/death. If the lost idle bob is unacceptable to the user, **skip this phase** and keep the DPR cap only.

---

## Phase 6 (OPTIONAL): Pause monster loop during results/death (Track A — small)

When the post-kill results overlay holds (`isPaused`) or the player is dead, the monster Canvas keeps animating an already-faded/empty scene. Thread `isPaused`/dead into `Monster` and set `frameloop={paused ? 'never' : 'always'}`.

- [ ] **Step 1:** Add an optional `paused?: boolean` prop to `Monster`; pass `frameloop={paused ? 'never' : 'always'}` to its `<Canvas>`.
- [ ] **Step 2:** In `App.tsx`, read `isPaused` and `isPlayerDead` from context (already partly read) and pass `paused={isPaused || isPlayerDead}` to `<Monster>`.
- [ ] **Step 3:** Verify the death fade still completes *before* the pause engages (the defeat animation runs while `isDefeated` is true and before the results overlay sets `isPaused`); if the fade is cut off, gate `paused` on `!isDefeated` so the fade finishes first.
- [ ] **Step 4:** Commit `perf(monster): freeze render loop while paused/dead`.

**Acceptance:** No animation regression on kill/defeat; monster loop is idle (0 rAF) while the results overlay is up.

---

## Phase 7 (OPTIONAL, measure-gated): Split the `GameProvider` context (Track B — higher risk)

`GameProvider`'s `contextValue` (`GameProvider.tsx:102-156`) bundles ~30 fields; any one change re-renders **all** consumers. After Phase 2 the expensive consumer (`Monster`'s Canvas) is insulated, so remaining re-renders hit only cheap DOM (health text, counters). **Only do this if the Profiler shows those DOM re-renders are material** (e.g. a heavy consumer like `TypingInterface` re-rendering per keystroke causes jank).

If warranted, split into two providers/contexts that share the same subtree:
- **`GameActionsContext`** — stable callbacks/setters (`setCurrentMode`, `decrementRemainingWords`, `incrementMonstersDefeated`, `resetDefeatState`, `damagePlayer`, `healPlayer`, `drinkPotion`, `registerCorrectWord`, setters, `resetGameState`, …). Memoized once; never changes identity.
- **`GameStateContext`** — fast-changing values (`remainingWords`, `playerHealth`, `killStreak`, `potionCount`, `monstersDefeated`, `isCurrentMonsterDefeated`, `hasStartedTyping`, `isPaused`, monster type, settings).

Components subscribe only to what they use. This is a broad refactor touching `useGameContext` and every consumer — **plan it as its own branch with the full 199-test suite as the regression gate**, and write it up as a separate detailed plan if pursued (out of scope for the bite-sized steps here).

**Acceptance:** Profiler shows keystroke-driven renders confined to components that read the changed state; all 199 tests pass; no gameplay change.

---

## Phase 8: Final verification + vault sync

- [ ] **Step 1: Full CI on each merged branch**

`cd frontend && bun run lint && bun run format:check && bunx tsc --noEmit && bun run test && bun run build` → all green. (Backend untouched.)

- [ ] **Step 2: Re-measure** against Phase 0 using the Measurement Protocol. Fill in the Success Criteria checkboxes with actual numbers.

- [ ] **Step 3: Merge each `perf/*` branch → `dev`** per project workflow (fast-forward/merge when CI passes), delete worktrees.

- [ ] **Step 4: Vault sync.** These are perf/refactor changes (not documented product behavior), so per `CLAUDE.md` they are **not vault-worthy** — skip `vault-update` unless a gameplay-visible change (e.g. Phase 5 removing the idle bob) is judged user-facing, in which case run the `vault-update` skill noting the visual change.

---

## Self-Review notes

- **Spec coverage:** all three requested tracks (load, runtime, re-render) covered — C=Phase 3, A=Phases 1/4/5/6, B=Phases 2/7.
- **Type/name consistency:** shared `CANVAS_DPR`/`CANVAS_GL` names used identically across Monster/PlayerAvatar3D/RaidBoss3D; lazy consts reuse each component's existing default export.
- **Testing reality:** node test env (no jsdom) means runtime DPR/frameloop/re-render effects are verified by build + manual Profiler/CPU, not unit tests. Unit tests cover what `renderToString` can (canvas-defaults values, components render without crashing). This is called out per phase rather than faked.
- **Risk order:** DPR cap and memo are near-zero risk and ship first; lazy-load is medium (fallback sizing) but tool-verifiable; the context split is gated behind measurement because Phase 2 likely makes it low-ROI.
