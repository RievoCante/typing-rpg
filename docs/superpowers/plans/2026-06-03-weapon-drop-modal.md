# Weapon Drop Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a weapon drops in Endless mode, show a center-screen modal (rarity-framed icon, name, effect lines) that the player dismisses with a single **Take** action (Space/Enter or button) before the kill-result overlay; remove mid-run auto-equip and the old floating drop popup.

**Architecture:** A dropped weapon becomes `pendingDrop` state in `useWeaponSystem`, surfaced through `GameContext`. `TypingInterface` renders a new `WeaponDropModal` at `z-50` while `pendingDrop` is set, gates the kill-result reveal until `pendingDrop` is null, and routes Space/Enter to take it. Persisting to the vault already happens via the existing `weapon-drop` event (`useWeaponVault`) — no backend changes. Auto-equip is removed so the loadout stays fixed for the whole run.

**Tech Stack:** React 19 + TypeScript, Vite, Tailwind, lucide-react icons, Vitest (node env — `renderToString` for components, pure-function tests for logic; no jsdom/renderHook).

---

## File Structure

**New files**
- `frontend/src/utils/weaponDropDisplay.ts` — pure display helpers: `weaponDropIcon(id)` (per-id Lucide glyph, drop-in slot for real art) and `weaponEffectLines(weapon)` (conditional effect strings).
- `frontend/src/utils/weaponDropDisplay.test.ts` — tests for both helpers.
- `frontend/src/components/WeaponDropModal.tsx` — presentational modal; props `{ weapon, onTake }`; self-positions `absolute inset-0 z-50`.
- `frontend/src/components/WeaponDropModal.test.tsx` — `renderToString` render test.

**Modified files**
- `frontend/src/hooks/useWeaponSystem.ts` — add `pendingDrop` + `clearPendingDrop`; remove auto-equip (and now-dead `equippedRef` / `weaponPower` import).
- `frontend/src/context/GameContext.ts` — add `pendingDrop` + `clearPendingDrop` to type + default.
- `frontend/src/context/GameProvider.tsx` — expose `pendingDrop` + `clearPendingDrop`.
- `frontend/src/components/TypingInterface.tsx` — render modal, gate kill-result reveal, top-priority keydown branch, remove old weapon popup wiring.
- `frontend/src/components/TypingPopups.tsx` — remove `WeaponPopups` export + now-unused imports.

**Deleted files**
- `frontend/src/hooks/useWeaponPopups.ts` — replaced by the modal.

Each weapon already carries `{ id, name, rarity, bonusDamage, bonusCritChance, critMultBonus }` (`frontend/src/utils/weapons.ts`). `RARITY_COLOR` is reused from there.

---

## Task 1: Pure display helpers (icon map + effect lines)

**Files:**
- Create: `frontend/src/utils/weaponDropDisplay.ts`
- Test: `frontend/src/utils/weaponDropDisplay.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/utils/weaponDropDisplay.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { weaponDropIcon, weaponEffectLines } from './weaponDropDisplay';
import { WEAPON_IDS, ALL_WEAPONS, type Weapon } from './weapons';

const byId = (id: string): Weapon =>
  ALL_WEAPONS.find(w => w.id === id) as Weapon;

describe('weaponEffectLines', () => {
  it('lists only non-zero stats, one line each', () => {
    // dragonfang: +5 dmg, +10% crit, +1x crit dmg (all three present)
    expect(weaponEffectLines(byId('dragonfang'))).toEqual([
      '+5 Damage',
      '+10% Crit Chance',
      '+1× Crit Damage',
    ]);
  });

  it('omits zero stats', () => {
    // wooden-club: +1 dmg only
    expect(weaponEffectLines(byId('wooden-club'))).toEqual(['+1 Damage']);
    // cracked-wand: +4% crit only
    expect(weaponEffectLines(byId('cracked-wand'))).toEqual([
      '+4% Crit Chance',
    ]);
  });

  it('returns an empty array when a weapon has no bonuses', () => {
    const none: Weapon = {
      id: 'x',
      name: 'X',
      rarity: 'common',
      bonusDamage: 0,
      bonusCritChance: 0,
      critMultBonus: 0,
    };
    expect(weaponEffectLines(none)).toEqual([]);
  });
});

describe('weaponDropIcon', () => {
  it('returns a component for every weapon id', () => {
    for (const id of WEAPON_IDS) {
      expect(typeof weaponDropIcon(id)).toBe('object'); // lucide forwardRef component
    }
  });

  it('falls back to a default for unknown ids', () => {
    expect(weaponDropIcon('not-a-weapon')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && bunx vitest run src/utils/weaponDropDisplay.test.ts`
Expected: FAIL — `Failed to resolve import './weaponDropDisplay'`.

- [ ] **Step 3: Write minimal implementation**

Create `frontend/src/utils/weaponDropDisplay.ts`:

```ts
import {
  Sword,
  Swords,
  Wand2,
  Flame,
  Snowflake,
  Target,
  Gavel,
  Skull,
  type LucideIcon,
} from 'lucide-react';
import type { Weapon } from './weapons';

// Per-weapon-id Lucide glyph for the drop modal. This is a drop-in slot: swap
// for real PNG art later without touching the modal layout. Unknown ids fall
// back to a generic sword.
const ICON_BY_ID: Record<string, LucideIcon> = {
  'wooden-club': Gavel,
  'cracked-wand': Wand2,
  'iron-sword': Sword,
  'hunters-bow': Target,
  'flaming-blade': Flame,
  'frost-spear': Snowflake,
  dragonfang: Swords,
  soulreaper: Skull,
};

export function weaponDropIcon(id: string): LucideIcon {
  return ICON_BY_ID[id] ?? Sword;
}

// Human-readable effect lines for a weapon — one per non-zero stat. Drives the
// drop modal's effect list (mirrors the loadout panel's stat summary, but one
// line per effect).
export function weaponEffectLines(weapon: Weapon): string[] {
  const lines: string[] = [];
  if (weapon.bonusDamage > 0) lines.push(`+${weapon.bonusDamage} Damage`);
  if (weapon.bonusCritChance > 0)
    lines.push(`+${Math.round(weapon.bonusCritChance * 100)}% Crit Chance`);
  if (weapon.critMultBonus > 0)
    lines.push(`+${weapon.critMultBonus}× Crit Damage`);
  return lines;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && bunx vitest run src/utils/weaponDropDisplay.test.ts`
Expected: PASS (3 + 2 assertions).

Note: lucide-react icons are `forwardRef` objects, so `typeof === 'object'`. If your lucide version exports plain function components, change the assertion to `expect(weaponDropIcon(id)).toBeDefined()` for every id.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/weaponDropDisplay.ts frontend/src/utils/weaponDropDisplay.test.ts
git commit -m "feat(weapons): add weapon-drop display helpers (icon map + effect lines)"
```

---

## Task 2: WeaponDropModal component

**Files:**
- Create: `frontend/src/components/WeaponDropModal.tsx`
- Test: `frontend/src/components/WeaponDropModal.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/WeaponDropModal.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import WeaponDropModal from './WeaponDropModal';
import { ALL_WEAPONS, type Weapon } from '../utils/weapons';

const dragonfang = ALL_WEAPONS.find(w => w.id === 'dragonfang') as Weapon;
const noop = () => {};

describe('WeaponDropModal', () => {
  it('renders the weapon name, effect lines, and Take action', () => {
    const html = renderToString(
      <WeaponDropModal weapon={dragonfang} onTake={noop} />
    );
    expect(html).toContain('Dragonfang');
    expect(html).toContain('+5 Damage');
    expect(html).toContain('+10% Crit Chance');
    expect(html).toContain('Take');
    expect(html).toContain('Press SPACE to take');
  });

  it('applies the rarity color class', () => {
    const html = renderToString(
      <WeaponDropModal weapon={dragonfang} onTake={noop} />
    );
    // legendary -> text-amber-400 (RARITY_COLOR)
    expect(html).toContain('text-amber-400');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && bunx vitest run src/components/WeaponDropModal.test.tsx`
Expected: FAIL — `Failed to resolve import './WeaponDropModal'`.

- [ ] **Step 3: Write minimal implementation**

Create `frontend/src/components/WeaponDropModal.tsx`:

```tsx
import type { LucideIcon } from 'lucide-react';
import { RARITY_COLOR, type Weapon, type WeaponRarity } from '../utils/weapons';
import {
  weaponDropIcon,
  weaponEffectLines,
} from '../utils/weaponDropDisplay';

// Rarity -> icon frame border/glow classes.
const RARITY_FRAME: Record<WeaponRarity, string> = {
  common: 'border-gray-400 shadow-gray-500/30',
  rare: 'border-sky-400 shadow-sky-500/40',
  epic: 'border-violet-400 shadow-violet-500/40',
  legendary: 'border-amber-400 shadow-amber-500/50',
};

interface WeaponDropModalProps {
  weapon: Weapon;
  onTake: () => void;
}

// Center-screen weapon-drop celebration (Endless). Renders on top of the kill
// flow (z-50) and gates the kill-result overlay until the player takes it via
// Space/Enter (handled in TypingInterface) or this Take button. The icon is a
// rarity-framed Lucide glyph — a drop-in slot for real art later.
export default function WeaponDropModal({
  weapon,
  onTake,
}: WeaponDropModalProps) {
  const Icon: LucideIcon = weaponDropIcon(weapon.id);
  const lines = weaponEffectLines(weapon);
  return (
    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 rounded-lg pointer-events-auto">
      <div className="px-8 py-6 rounded-xl backdrop-blur-sm bg-black/40 flex flex-col items-center gap-4 drop-shadow text-center max-w-sm">
        <span className="text-[0.7rem] uppercase tracking-widest text-gray-300">
          Weapon dropped
        </span>
        <div
          className={`flex h-24 w-24 items-center justify-center rounded-2xl border-2 bg-black/30 shadow-lg ${RARITY_FRAME[weapon.rarity]}`}
        >
          <Icon size={48} className={RARITY_COLOR[weapon.rarity]} aria-hidden />
        </div>
        <div className={`text-2xl font-bold ${RARITY_COLOR[weapon.rarity]}`}>
          {weapon.name}
        </div>
        <div className="flex flex-col items-center gap-0.5 text-sm text-gray-200">
          {lines.length > 0 ? (
            lines.map(line => <span key={line}>{line}</span>)
          ) : (
            <span className="text-gray-400">No bonuses</span>
          )}
        </div>
        <button
          type="button"
          onClick={onTake}
          className="mt-1 rounded-lg bg-amber-500 px-6 py-2 font-bold text-black transition-colors hover:bg-amber-400"
        >
          Take
        </button>
        <span className="text-[0.7rem] text-gray-300 animate-pulse">
          Press SPACE to take
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && bunx vitest run src/components/WeaponDropModal.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/WeaponDropModal.tsx frontend/src/components/WeaponDropModal.test.tsx
git commit -m "feat(weapons): add WeaponDropModal (rarity-framed icon, effects, Take)"
```

---

## Task 3: useWeaponSystem — pendingDrop + remove auto-equip

**Files:**
- Modify: `frontend/src/hooks/useWeaponSystem.ts`

No new unit test: this project has no jsdom/renderHook (see `useComboSystem.test.ts` note), so stateful hook behavior is verified by typecheck + the integration in Task 6 + manual QA. The pure surface is already covered in Task 1.

- [ ] **Step 1: Replace the import line**

In `frontend/src/hooks/useWeaponSystem.ts`, change line 3 from:

```ts
import { rollWeaponDrop, weaponPower, type Weapon } from '../utils/weapons';
```

to (drop `weaponPower` — auto-equip is being removed):

```ts
import { rollWeaponDrop, type Weapon } from '../utils/weapons';
```

- [ ] **Step 2: Remove the equipped ref and add pendingDrop state**

Delete the `equippedRef` block (lines 19-22):

```ts
  // Ref mirror so tryDrop can compare against the latest equipped weapon without
  // changing identity (keeps the GameProvider effect dep stable).
  const equippedRef = useRef<Weapon | null>(null);
  equippedRef.current = equippedWeapon;
```

Immediately after the `const [equippedWeapon, setEquippedWeapon] = useState<Weapon | null>(loadoutWeapon);` block, add:

```ts
  // The most recent unacknowledged drop (Endless). Drives the weapon-drop modal;
  // cleared by clearPendingDrop (the player's "Take") or a run reset. Does NOT
  // equip — the loadout stays fixed for the whole run.
  const [pendingDrop, setPendingDrop] = useState<Weapon | null>(null);
```

- [ ] **Step 3: Rewrite tryDrop (no auto-equip) and reset (clear pendingDrop)**

Replace the `tryDrop` callback (originally lines 33-51) with:

```ts
  // Roll a drop for a kill of `variant`. On a hit, sets it as the pending drop
  // (surfaced to the modal) and fires `weapon-drop` (picked up by useWeaponVault
  // to persist the find for signed-in players). No auto-equip: the run's weapon
  // stays the chosen loadout. No-op when nothing drops. rng injectable for tests.
  const tryDrop = useCallback(
    (variant: MonsterVariant, rng: () => number = Math.random) => {
      const dropped = rollWeaponDrop(variant, rng);
      if (!dropped) return;
      setPendingDrop(dropped);
      window.dispatchEvent(
        new CustomEvent('weapon-drop', {
          detail: {
            id: dropped.id,
            name: dropped.name,
            rarity: dropped.rarity,
            equipped: false,
          },
        })
      );
    },
    []
  );

  // Acknowledge the pending drop (player's "Take"). Persisting already happened
  // via the weapon-drop event; this just dismisses the modal.
  const clearPendingDrop = useCallback(() => setPendingDrop(null), []);
```

Replace the `reset` callback (originally line 54) with:

```ts
  // Restore to the current loadout and drop any unacknowledged drop (death/restart).
  const reset = useCallback(() => {
    setEquippedWeapon(loadoutRef.current);
    setPendingDrop(null);
  }, []);
```

- [ ] **Step 4: Export the new values**

Change the return (originally line 64) from:

```ts
  return { equippedWeapon, tryDrop, reset, equipLoadout };
```

to:

```ts
  return {
    equippedWeapon,
    tryDrop,
    reset,
    equipLoadout,
    pendingDrop,
    clearPendingDrop,
  };
```

- [ ] **Step 5: Verify `useRef` is still imported**

`loadoutRef` still uses `useRef`, so keep the `useRef` import in line 1 (`import { useCallback, useRef, useState } from 'react';`). No change needed — confirm it compiles.

- [ ] **Step 6: Typecheck**

Run: `cd frontend && bunx tsc -b`
Expected: PASS (no unused `weaponPower` / `equippedRef` errors). If `tsc` reports `weaponPower` or `equippedRef` unused, you missed a deletion in Steps 1-2.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/hooks/useWeaponSystem.ts
git commit -m "feat(weapons): track pendingDrop and remove mid-run auto-equip"
```

---

## Task 4: Surface pendingDrop through GameContext

**Files:**
- Modify: `frontend/src/context/GameContext.ts`

- [ ] **Step 1: Add to the interface**

In `frontend/src/context/GameContext.ts`, in `GameContextType`, directly after the `equippedWeapon: Weapon | null;` line (and its comment), add:

```ts
  // Pending Endless weapon drop awaiting the player's "Take" (the drop modal);
  // null = none. Gates the kill-result overlay until acknowledged.
  pendingDrop: Weapon | null;
  clearPendingDrop: () => void;
```

- [ ] **Step 2: Add to the default context value**

In the `createContext<GameContextType>({ ... })` default object, directly after `equippedWeapon: null,`, add:

```ts
  pendingDrop: null,
  clearPendingDrop: () => {},
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && bunx tsc -b`
Expected: FAIL — `GameProvider.tsx` `contextValue` is now missing `pendingDrop` / `clearPendingDrop`. (Fixed in Task 5.) This confirms the type wiring is enforced.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/context/GameContext.ts
git commit -m "feat(weapons): add pendingDrop + clearPendingDrop to GameContext type"
```

---

## Task 5: Provide pendingDrop in GameProvider

**Files:**
- Modify: `frontend/src/context/GameProvider.tsx`

- [ ] **Step 1: Destructure the new values from the weapon hook**

In `frontend/src/context/GameProvider.tsx`, change (originally line 76):

```ts
  const { tryDrop: tryDropWeapon, equipLoadout } = weapon;
```

to:

```ts
  const { tryDrop: tryDropWeapon, equipLoadout, pendingDrop, clearPendingDrop } =
    weapon;
```

- [ ] **Step 2: Add to the context value object**

In the `contextValue` `useMemo` object, directly after `equippedWeapon: weapon.equippedWeapon,`, add:

```ts
      pendingDrop,
      clearPendingDrop,
```

- [ ] **Step 3: Add to the `useMemo` dependency array**

In the dependency array, directly after `weapon.equippedWeapon,`, add:

```ts
      pendingDrop,
      clearPendingDrop,
```

(`clearPendingDrop` is a stable `useCallback`, but list it for lint correctness.)

- [ ] **Step 4: Typecheck**

Run: `cd frontend && bunx tsc -b`
Expected: PASS (Task 4's missing-property error is resolved).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/context/GameProvider.tsx
git commit -m "feat(weapons): expose pendingDrop + clearPendingDrop from GameProvider"
```

---

## Task 6: Wire the modal into TypingInterface (render, gate, keydown) + remove old popup

**Files:**
- Modify: `frontend/src/components/TypingInterface.tsx`

- [ ] **Step 1: Update imports**

In `frontend/src/components/TypingInterface.tsx`:

Add a modal import near the other component imports (e.g. after the `KillResultOverlay` import, line 17):

```ts
import WeaponDropModal from './WeaponDropModal';
```

Remove `WeaponPopups` from the `TypingPopups` import group (originally lines 24-31) so it reads:

```ts
import {
  HitPopups,
  AttackPopups,
  PotionPopups,
  CombatPopups,
  SaveErrorBanner,
} from './TypingPopups';
```

Remove the `useWeaponPopups` import (originally line 42):

```ts
import { useWeaponPopups } from '../hooks/useWeaponPopups';
```

- [ ] **Step 2: Consume pendingDrop from context**

In the `useGameContext()` destructure block (the one that includes `isCurrentMonsterDefeated, resetDefeatState` around line 100), add `pendingDrop` and `clearPendingDrop` to the destructured names.

- [ ] **Step 3: Remove the old weapon popup hook call**

Delete (originally line 151):

```ts
  const weaponPopups = useWeaponPopups();
```

- [ ] **Step 4: Add a take handler that restores typing focus**

Near the other `useCallback` handlers (e.g. just after `handleContinue`, around line 488), add:

```ts
  // Acknowledge the dropped weapon. Clicking the Take button can drop focus off
  // the typing surface, so restore it — the kill-result overlay reveals next.
  const handleTakeDrop = useCallback(() => {
    clearPendingDrop();
    containerRef.current?.focus();
  }, [clearPendingDrop]);
```

- [ ] **Step 5: Gate the kill-result reveal behind pendingDrop**

In the reveal effect (originally lines 454-462), add a guard and dependency. Change:

```ts
  useEffect(() => {
    if (currentMode !== 'endless') return;
    if (!killResult || awaitingContinue) return;
    const id = window.setTimeout(
      () => setAwaitingContinue(true),
      DEATH_ANIM_MS
    );
    return () => window.clearTimeout(id);
  }, [currentMode, killResult, awaitingContinue]);
```

to:

```ts
  useEffect(() => {
    if (currentMode !== 'endless') return;
    if (!killResult || awaitingContinue) return;
    // Hold the post-kill overlay until the player takes any dropped weapon.
    if (pendingDrop) return;
    const id = window.setTimeout(
      () => setAwaitingContinue(true),
      DEATH_ANIM_MS
    );
    return () => window.clearTimeout(id);
  }, [currentMode, killResult, awaitingContinue, pendingDrop]);
```

- [ ] **Step 6: Add the top-priority keydown branch**

In `handleKeyDown`, directly after `const { key } = e;` (originally line 528) and BEFORE the `if (awaitingContinue) {` block, insert:

```ts
    // Top priority: a weapon just dropped. Capture all keys (no leak into the
    // typing buffer); Space/Enter takes it and reveals the kill result next.
    if (pendingDrop) {
      if (key === 'Tab') return;
      e.preventDefault();
      if (key === ' ' || key === 'Enter') handleTakeDrop();
      return;
    }
```

- [ ] **Step 7: Render the modal above the kill-result overlay**

In the render, directly after the `KillResultOverlay` wrapper `<div>` block (originally lines 673-679) and still inside the `mx-auto w-full max-w-2xl relative` container, add:

```tsx
          {currentMode === 'endless' && pendingDrop && (
            <WeaponDropModal weapon={pendingDrop} onTake={handleTakeDrop} />
          )}
```

(The modal is `absolute inset-0 z-50`, so it self-positions over the typing panel and sits above `KillResultOverlay` at `z-20`.)

- [ ] **Step 8: Remove the old WeaponPopups render**

Delete (originally line 710):

```tsx
      <WeaponPopups popups={weaponPopups} />
```

- [ ] **Step 9: Typecheck + lint + format**

Run: `cd frontend && bunx tsc -b && bun run lint && bun run format:check`
Expected: PASS. If lint flags `pendingDrop`/`clearPendingDrop` as unused, a wiring step was missed.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/components/TypingInterface.tsx
git commit -m "feat(weapons): show weapon-drop modal and gate kill result on Take"
```

---

## Task 7: Remove the obsolete WeaponPopups component + hook

**Files:**
- Modify: `frontend/src/components/TypingPopups.tsx`
- Delete: `frontend/src/hooks/useWeaponPopups.ts`

- [ ] **Step 1: Remove WeaponPopups from TypingPopups.tsx**

In `frontend/src/components/TypingPopups.tsx`:

Delete the now-unused import (line 5):

```ts
import type { WeaponPopupItem } from '../hooks/useWeaponPopups';
```

Delete the `RARITY_COLOR` import (line 6) — it is used ONLY by `WeaponPopups` in this file:

```ts
import { RARITY_COLOR } from '../utils/weapons';
```

Delete the entire `WeaponPopups` function (originally starting `export function WeaponPopups({ popups }: { popups: WeaponPopupItem[] }) {` around line 85, through its closing `}`).

- [ ] **Step 2: Delete the hook file**

```bash
git rm frontend/src/hooks/useWeaponPopups.ts
```

- [ ] **Step 3: Confirm no remaining references**

Run: `cd frontend && grep -rn "useWeaponPopups\|WeaponPopups\|WeaponPopupItem" src`
Expected: NO output (all references removed).

- [ ] **Step 4: Typecheck + lint + format**

Run: `cd frontend && bunx tsc -b && bun run lint && bun run format:check`
Expected: PASS (no unused `RARITY_COLOR`, no dangling imports).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/TypingPopups.tsx
git commit -m "refactor(weapons): remove obsolete floating weapon-drop popup"
```

---

## Task 8: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full frontend CI gate**

Run: `cd frontend && bun install && bun run lint && bun run format:check && bunx tsc -b && bun run test && bun run build`
Expected: All PASS. The new tests (`weaponDropDisplay.test.ts`, `WeaponDropModal.test.tsx`) run green; build succeeds.

- [ ] **Step 2: Manual smoke (dev server)**

Run: `cd frontend && bun run dev`, play Endless until a weapon drops, and confirm:
- Modal appears center-screen on top of everything, before the kill-result overlay.
- Space/Enter OR the Take button dismisses it; then the kill-result overlay appears.
- The equipped weapon in `WeaponSlot` does NOT change mid-run (no auto-equip).
- The old floating "Found …" popup no longer appears.
- A kill with no drop goes straight to the kill-result overlay.
- After death/restart, no stale modal shows.

Note: after Take, the kill-result overlay currently reveals after the existing `DEATH_ANIM_MS` timer. If that post-Take delay feels sluggish in QA, that's a follow-up tuning tweak (reveal immediately when `pendingDrop` clears), not a correctness bug.

- [ ] **Step 3: Commit any QA fixes, then finish the branch**

Use superpowers:finishing-a-development-branch to merge into `dev` (then the Vault Sync step per project CLAUDE.md — this is a user-facing feature change, so it is vault-worthy).

---

## Self-Review

**Spec coverage:**
- Modal on weapon drop, Endless only, rarity icon + name + effects → Tasks 1, 2, 6 (render gated on `currentMode === 'endless' && pendingDrop`).
- Single Take (Space/Enter or button) → Task 6 (keydown branch + button `onTake`).
- Per-id Lucide icon, rarity frame, drop-in slot → Tasks 1, 2.
- Conditional effect lines via non-zero stats, `RARITY_COLOR` → Tasks 1, 2.
- Modal `z-50` above `KillResultOverlay`; gates `awaitingContinue` until `pendingDrop` null → Task 6 (Steps 5, 7).
- Top-priority input, no typing leak → Task 6 Step 6.
- Remove auto-equip; loadout fixed for run → Task 3.
- Take → persistent vault via existing event; no backend changes → Task 3 (event still fired) + untouched `useWeaponVault`.
- Remove floating drop popup; other popups untouched → Tasks 6, 7 (only `WeaponPopups` removed; Hit/Attack/Potion/Combat kept).
- Edge cases (guests, no-drop, restart) → Task 8 Step 2; restart clears via `weapon.reset()` (Task 3).

**Placeholder scan:** none — every code step contains full content.

**Type consistency:** `pendingDrop: Weapon | null` and `clearPendingDrop: () => void` are identical across `useWeaponSystem` return (Task 3), `GameContextType` (Task 4), `GameProvider` (Task 5), and `TypingInterface` consumption (Task 6). Helper names `weaponDropIcon` / `weaponEffectLines` match between Task 1, their tests, and Task 2.
