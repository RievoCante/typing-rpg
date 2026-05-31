# Raid Player Avatars + Low-HP Warnings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the emoji raid avatars with procedural 3D characters (seeded per user, no editor) shown in the lobby and battle, and add low-HP visual warnings to player HP bars and the local typing box.

**Architecture:** A pure `avatarConfig` util deterministically derives a `PlayerAvatarConfig` from a user id (drop-in replacement for the old `pickEmoji`). A pure `raidHp` util maps an HP percentage to Tailwind color classes and a critical flag. `PlayerAvatar3D` is a self-contained `@react-three/fiber` `<Canvas>` rendering a character built from Three primitives, animated entirely in `useFrame` (idle bob, attack lunge, hurt flash/recoil, low-HP wobble/desaturate, death droop/fade) — modeled on the existing `SlimeModel.tsx` + `Monster.tsx` pattern. The avatar is wired into `RaidAvatar` (battle lanes), `RaidGame` (boss cluster + local strip), and `RaidLobbyScreen` (player list).

**Tech Stack:** React 19, `@react-three/fiber` ^9, `@react-three/drei` ^10, `three` ^0.177, Tailwind v4, Vitest 4 (node environment). Bun.

**Testing reality:** Vitest runs in the `node` environment (`vitest.config.ts`) with no jsdom/WebGL. Pure utils get full TDD unit tests. The r3f `<Canvas>` cannot render under `node`/`renderToString`, so visual components are verified by typecheck + production build + manual dev-server eyeballing, and the existing SSR lobby test mocks `PlayerAvatar3D`. Do **not** add jsdom/testing-library — it is out of scope and contrary to the project's existing test strategy.

---

### Task 1: `raidHp` util — HP → color/critical mapping

**Files:**
- Create: `frontend/src/utils/raidHp.ts`
- Test: `frontend/src/utils/raidHp.test.ts`

Thresholds (from approved design): green when `> 50`, amber when `25–50` (inclusive), red when `< 25`; "critical" (pulse) when `< 25` **and** alive; dead is always grey regardless of percent.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/utils/raidHp.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { hpStatus, hpColorClass, isCriticalHp } from './raidHp';

describe('hpStatus', () => {
  it('is healthy above 50', () => {
    expect(hpStatus(100)).toBe('healthy');
    expect(hpStatus(50.1)).toBe('healthy');
  });
  it('is caution from 25 to 50 inclusive', () => {
    expect(hpStatus(50)).toBe('caution');
    expect(hpStatus(25)).toBe('caution');
    expect(hpStatus(40)).toBe('caution');
  });
  it('is critical below 25', () => {
    expect(hpStatus(24.9)).toBe('critical');
    expect(hpStatus(0)).toBe('critical');
  });
});

describe('hpColorClass', () => {
  it('returns full literal Tailwind classes per band', () => {
    expect(hpColorClass(80)).toBe('bg-green-500');
    expect(hpColorClass(40)).toBe('bg-amber-500');
    expect(hpColorClass(10)).toBe('bg-red-500');
  });
  it('returns grey when not alive, regardless of percent', () => {
    expect(hpColorClass(80, false)).toBe('bg-gray-500');
    expect(hpColorClass(0, false)).toBe('bg-gray-500');
  });
});

describe('isCriticalHp', () => {
  it('is true only when below 25 and alive', () => {
    expect(isCriticalHp(10, true)).toBe(true);
    expect(isCriticalHp(10, false)).toBe(false);
    expect(isCriticalHp(30, true)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && bun run test -- raidHp`
Expected: FAIL — `Failed to resolve import "./raidHp"` / module not found.

- [ ] **Step 3: Write minimal implementation**

Create `frontend/src/utils/raidHp.ts`:

```ts
// HP → visual feedback mapping for raid player health bars.
// Color classes are returned as COMPLETE literal strings so Tailwind's
// content scanner (it reads .ts files) keeps them in the build.

export const HP_THRESHOLDS = {
  HEALTHY: 50, // strictly above -> green
  CAUTION: 25, // [25, 50] -> amber; below -> red
} as const;

export type HpStatus = 'healthy' | 'caution' | 'critical';

export function hpStatus(percent: number): HpStatus {
  if (percent > HP_THRESHOLDS.HEALTHY) return 'healthy';
  if (percent >= HP_THRESHOLDS.CAUTION) return 'caution';
  return 'critical';
}

// Tailwind bg-* class for an HP bar fill. Dead players are always grey.
export function hpColorClass(percent: number, isAlive = true): string {
  if (!isAlive) return 'bg-gray-500';
  switch (hpStatus(percent)) {
    case 'healthy':
      return 'bg-green-500';
    case 'caution':
      return 'bg-amber-500';
    case 'critical':
      return 'bg-red-500';
  }
}

// Whether to apply a pulsing/critical emphasis: below 25% and still alive.
export function isCriticalHp(percent: number, isAlive = true): boolean {
  return isAlive && hpStatus(percent) === 'critical';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && bun run test -- raidHp`
Expected: PASS (3 describe blocks, all green).

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/utils/raidHp.ts src/utils/raidHp.test.ts
git commit -m "feat(raid): add raidHp util for low-HP color + critical mapping"
```

---

### Task 2: `avatarConfig` util — deterministic per-user avatar config

**Files:**
- Create: `frontend/src/utils/avatarConfig.ts`
- Test: `frontend/src/utils/avatarConfig.test.ts`

This replaces `pickEmoji`/`AVATAR_EMOJIS` (currently in `RaidGame.tsx:25-33`). The `PlayerAvatarConfig` knobs are exactly what a future customization editor will expose; for now they are seeded deterministically from the user id.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/utils/avatarConfig.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  avatarConfigFromSeed,
  BODY_SHAPES,
  EYE_STYLES,
  ACCESSORIES,
} from './avatarConfig';

describe('avatarConfigFromSeed', () => {
  it('is deterministic — same seed yields identical config', () => {
    expect(avatarConfigFromSeed('user_2abc')).toEqual(
      avatarConfigFromSeed('user_2abc')
    );
  });

  it('always produces values from the allowed sets', () => {
    for (const seed of ['a', 'guest-xy12', 'user_2abc', 'ZZZ', '0']) {
      const c = avatarConfigFromSeed(seed);
      expect(BODY_SHAPES).toContain(c.bodyShape);
      expect(EYE_STYLES).toContain(c.eyeStyle);
      expect(ACCESSORIES).toContain(c.accessory);
      expect(c.bodyColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(c.accessoryColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('produces variation across different seeds', () => {
    const seeds = Array.from({ length: 40 }, (_, i) => `user_${i}`);
    const shapes = new Set(seeds.map(s => avatarConfigFromSeed(s).bodyShape));
    const colors = new Set(seeds.map(s => avatarConfigFromSeed(s).bodyColor));
    expect(shapes.size).toBeGreaterThan(1);
    expect(colors.size).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && bun run test -- avatarConfig`
Expected: FAIL — `Failed to resolve import "./avatarConfig"`.

- [ ] **Step 3: Write minimal implementation**

Create `frontend/src/utils/avatarConfig.ts`:

```ts
// Deterministic, editor-free player avatar configuration. Seeded from the
// user id so each player has a stable identity. These knobs are exactly what
// a future customization editor (+ users.character persistence) will expose.

export type BodyShape = 'round' | 'square';
export type EyeStyle = 'dot' | 'wide' | 'sleepy';
export type Accessory = 'none' | 'antenna' | 'horn' | 'crown';

export interface PlayerAvatarConfig {
  bodyShape: BodyShape;
  bodyColor: string; // hex #rrggbb
  eyeStyle: EyeStyle;
  accessory: Accessory;
  accessoryColor: string; // hex #rrggbb
}

export const BODY_SHAPES: BodyShape[] = ['round', 'square'];
export const EYE_STYLES: EyeStyle[] = ['dot', 'wide', 'sleepy'];
export const ACCESSORIES: Accessory[] = ['none', 'antenna', 'horn', 'crown'];

// Friendly palette — deliberately avoids the boss reds so players read as allies.
export const BODY_COLORS: string[] = [
  '#38bdf8', // sky
  '#34d399', // emerald
  '#a78bfa', // violet
  '#fbbf24', // amber
  '#f472b6', // pink
  '#22d3ee', // cyan
  '#fb923c', // orange
  '#4ade80', // green
];

export const ACCESSORY_COLORS: string[] = [
  '#f8fafc', // near-white
  '#fde047', // gold
  '#fca5a5', // soft red
  '#c4b5fd', // lilac
];

// 32-bit string hash (same base algorithm as the old pickEmoji, so existing
// users keep a consistent identity feel; extended to drive multiple knobs).
function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

// Derive an independent index per knob by mixing the base hash with a salt,
// so two knobs don't move in lockstep.
function pick<T>(arr: T[], hash: number, salt: number): T {
  const mixed = ((hash ^ (salt * 2654435761)) >>> 0) % arr.length;
  return arr[mixed];
}

export function avatarConfigFromSeed(seed: string): PlayerAvatarConfig {
  const h = hashSeed(seed);
  return {
    bodyShape: pick(BODY_SHAPES, h, 1),
    bodyColor: pick(BODY_COLORS, h, 2),
    eyeStyle: pick(EYE_STYLES, h, 3),
    accessory: pick(ACCESSORIES, h, 4),
    accessoryColor: pick(ACCESSORY_COLORS, h, 5),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && bun run test -- avatarConfig`
Expected: PASS (determinism, allowed-values, variation).

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/utils/avatarConfig.ts src/utils/avatarConfig.test.ts
git commit -m "feat(raid): add deterministic avatarConfig util (replaces pickEmoji)"
```

---

### Task 3: `PlayerAvatar3D` procedural character component

**Files:**
- Create: `frontend/src/components/PlayerAvatar3D.tsx`

No unit test (node env cannot render a `<Canvas>`). Verified by typecheck + build here, and visually once wired in Task 4/5. Pattern copied from `SlimeModel.tsx` (in-Canvas model + `useFrame` animation + material flash) and `Monster.tsx` (Canvas + lights wrapper). Exported component is wrapped in `memo` so it does not reconcile on unrelated parent re-renders (e.g. every keystroke in `RaidGame`).

- [ ] **Step 1: Create the component**

Create `frontend/src/components/PlayerAvatar3D.tsx`:

```tsx
import { memo, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Group, Color, MeshPhongMaterial } from 'three';
import type { PlayerAvatarConfig } from '../utils/avatarConfig';

const HURT_COLOR = new Color('#ff4d4d');
const GRAY = new Color('#6b7280');
const HURT_DURATION = 220; // ms
const ATTACK_DURATION = 220; // ms — matches RaidAvatar swing timing
const CRITICAL_HP = 25;

interface ModelProps {
  config: PlayerAvatarConfig;
  isAlive: boolean;
  hpPercent: number;
  isAttacking: boolean;
  isHurt: boolean;
}

function PlayerAvatarModel({
  config,
  isAlive,
  hpPercent,
  isAttacking,
  isHurt,
}: ModelProps) {
  const groupRef = useRef<Group>(null);
  const bodyMatRef = useRef<MeshPhongMaterial | null>(null);
  const attackTimeRef = useRef(0);
  const hurtTimeRef = useRef(0);

  const baseColor = useMemo(
    () => new Color(config.bodyColor),
    [config.bodyColor]
  );

  // Capture rising edges of the transient trigger props (same approach as
  // SlimeModel's hit flash): record a timestamp, decay it inside useFrame.
  useEffect(() => {
    if (isAttacking) attackTimeRef.current = Date.now();
  }, [isAttacking]);
  useEffect(() => {
    if (isHurt) hurtTimeRef.current = Date.now();
  }, [isHurt]);

  const critical = isAlive && hpPercent < CRITICAL_HP;

  useFrame(state => {
    const g = groupRef.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const now = Date.now();

    let posY = 0;
    let posZ = 0;
    let rotZ = 0;
    let rotX = 0;
    let scale = 1;

    if (isAlive) {
      posY = Math.sin(t * 2) * 0.06; // idle bob

      const aEl = now - attackTimeRef.current; // attack lunge + pop
      if (attackTimeRef.current > 0 && aEl < ATTACK_DURATION) {
        const k = 1 - aEl / ATTACK_DURATION;
        posZ += 0.5 * k;
        scale += 0.18 * k;
      }

      if (critical) rotZ = Math.sin(t * 9) * 0.12; // low-HP wobble
    } else {
      rotX = 0.9; // death droop forward
      posY = -0.25;
      scale = 0.85;
    }

    const hEl = now - hurtTimeRef.current;
    const hurting = hurtTimeRef.current > 0 && hEl < HURT_DURATION;
    if (hurting && isAlive) posZ -= 0.25 * (1 - hEl / HURT_DURATION); // recoil

    g.position.set(0, posY, posZ);
    g.rotation.set(rotX, 0, rotZ);
    g.scale.setScalar(scale);

    const mat = bodyMatRef.current;
    if (mat) {
      if (hurting) {
        const k = 1 - hEl / HURT_DURATION;
        mat.color.copy(baseColor).lerp(HURT_COLOR, k);
        mat.emissive.copy(HURT_COLOR);
        mat.emissiveIntensity = 0.2 + 0.6 * k;
      } else if (!isAlive) {
        mat.color.copy(baseColor).lerp(GRAY, 0.7);
        mat.emissive.set('#000000');
        mat.emissiveIntensity = 0;
      } else if (critical) {
        mat.color.copy(baseColor).lerp(GRAY, 0.5); // desaturate when critical
        mat.emissive.set('#000000');
        mat.emissiveIntensity = 0;
      } else {
        mat.color.copy(baseColor);
        mat.emissive.set('#000000');
        mat.emissiveIntensity = 0;
      }
    }
  });

  // Eye geometry tweaks per style.
  const eyeScaleY = config.eyeStyle === 'sleepy' ? 0.4 : 1;
  const eyeR = config.eyeStyle === 'wide' ? 0.16 : 0.12;
  const eyeX = config.eyeStyle === 'wide' ? 0.34 : 0.28;

  return (
    <group ref={groupRef}>
      <mesh>
        {config.bodyShape === 'square' ? (
          <boxGeometry args={[1.3, 1.3, 1.3]} />
        ) : (
          <sphereGeometry args={[0.9, 32, 32]} />
        )}
        <meshPhongMaterial
          ref={bodyMatRef}
          color={config.bodyColor}
          shininess={80}
          transparent
          opacity={0.95}
          specular="#ffffff"
        />
        {/* Eyes are children of the body so they inherit its transform. */}
        <mesh position={[-eyeX, 0.18, 0.82]} scale={[1, eyeScaleY, 1]}>
          <sphereGeometry args={[eyeR, 16, 16]} />
          <meshPhongMaterial color="#111111" />
        </mesh>
        <mesh position={[eyeX, 0.18, 0.82]} scale={[1, eyeScaleY, 1]}>
          <sphereGeometry args={[eyeR, 16, 16]} />
          <meshPhongMaterial color="#111111" />
        </mesh>
      </mesh>

      {config.accessory === 'antenna' && (
        <group position={[0, 0.95, 0]}>
          <mesh position={[0, 0.15, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.4, 8]} />
            <meshPhongMaterial color={config.accessoryColor} />
          </mesh>
          <mesh position={[0, 0.4, 0]}>
            <sphereGeometry args={[0.1, 16, 16]} />
            <meshPhongMaterial color={config.accessoryColor} />
          </mesh>
        </group>
      )}
      {config.accessory === 'horn' && (
        <mesh position={[0, 1.05, 0]}>
          <coneGeometry args={[0.18, 0.5, 16]} />
          <meshPhongMaterial color={config.accessoryColor} />
        </mesh>
      )}
      {config.accessory === 'crown' && (
        <mesh position={[0, 1.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.28, 0.07, 8, 24]} />
          <meshPhongMaterial color={config.accessoryColor} />
        </mesh>
      )}
    </group>
  );
}

export interface PlayerAvatar3DProps {
  config: PlayerAvatarConfig;
  isAlive: boolean;
  hpPercent: number;
  isAttacking?: boolean;
  isHurt?: boolean;
}

// Self-contained avatar: fills its parent box (give the parent a width/height).
function PlayerAvatar3D({
  config,
  isAlive,
  hpPercent,
  isAttacking = false,
  isHurt = false,
}: PlayerAvatar3DProps) {
  return (
    <Canvas
      camera={{ position: [0, 0.2, 3.2], fov: 50 }}
      gl={{ alpha: true, antialias: true }}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.6} />
      <pointLight position={[3, 4, 5]} intensity={0.9} />
      <pointLight position={[-3, -2, -3]} intensity={0.25} color="#ffffff" />
      <PlayerAvatarModel
        config={config}
        isAlive={isAlive}
        hpPercent={hpPercent}
        isAttacking={isAttacking}
        isHurt={isHurt}
      />
    </Canvas>
  );
}

export default memo(PlayerAvatar3D);
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && bunx tsc --noEmit`
Expected: 0 errors. (Pre-existing lint warnings elsewhere are fine; this step is types only.)

- [ ] **Step 3: Lint + format**

Run: `cd frontend && bun run lint && bun run format:check`
Expected: 0 errors. If `format:check` flags the new file, run `bun run format` then re-check. Pre-existing warnings in `PixelArtBackground.tsx` / `useCompletionDetection.ts` are acceptable; no NEW warnings from this file.

- [ ] **Step 4: Commit**

```bash
cd frontend && git add src/components/PlayerAvatar3D.tsx
git commit -m "feat(raid): add procedural 3D PlayerAvatar3D character component"
```

---

### Task 4: Battle wiring — `RaidAvatar` + `RaidGame`

**Files:**
- Modify: `frontend/src/components/RaidAvatar.tsx` (replace emoji render, add hurt state, color HP bar)
- Modify: `frontend/src/components/RaidGame.tsx` (remove `pickEmoji`/`AVATAR_EMOJIS`, pass `config`, color local strip + critical ring)

Both files are edited in one commit because changing `RaidAvatar`'s `emoji` prop to `config` breaks `RaidGame`'s call sites until they are updated together — keeping the tree compiling.

- [ ] **Step 1: Rewrite `RaidAvatar.tsx`**

Replace the entire contents of `frontend/src/components/RaidAvatar.tsx` with:

```tsx
import { memo, useEffect, useState } from 'react';
import type {
  RaidPlayer,
  RaidHitEvent,
  RaidWordHit,
} from '../hooks/useRaidState';
import type { PlayerAvatarConfig } from '../utils/avatarConfig';
import { hpColorClass, isCriticalHp } from '../utils/raidHp';
import PlayerAvatar3D from './PlayerAvatar3D';

interface Props {
  player: RaidPlayer;
  config: PlayerAvatarConfig;
  lastHit: RaidHitEvent | null;
  lastWordHit: RaidWordHit | null;
}

type Popup = { id: number; damage: number; kind: 'mistake' | 'boss' };

function RaidAvatar({ player, config, lastHit, lastWordHit }: Props) {
  const [popups, setPopups] = useState<Popup[]>([]);
  const [swing, setSwing] = useState(false);
  const [hurt, setHurt] = useState(false);

  useEffect(() => {
    if (!lastHit) return;
    const target = lastHit.targets.find(t => t.playerId === player.userId);
    if (!target) return;
    const popup: Popup = {
      id: lastHit.id,
      damage: target.damage,
      kind: lastHit.kind,
    };
    setPopups(prev => [...prev, popup]);
    setHurt(true);
    const popupTimer = setTimeout(() => {
      setPopups(prev => prev.filter(p => p.id !== popup.id));
    }, 900);
    const hurtTimer = setTimeout(() => setHurt(false), 300);
    return () => {
      clearTimeout(popupTimer);
      clearTimeout(hurtTimer);
    };
  }, [lastHit, player.userId]);

  useEffect(() => {
    if (!lastWordHit || lastWordHit.playerId !== player.userId) return;
    setSwing(true);
    const timer = setTimeout(() => setSwing(false), 220);
    return () => clearTimeout(timer);
  }, [lastWordHit, player.userId]);

  const hpPercent = player.maxHp > 0 ? (player.hp / player.maxHp) * 100 : 0;
  const isAlive = player.isAlive;

  return (
    <div
      className={`relative flex flex-col items-center w-32 ${!isAlive ? 'opacity-50' : ''}`}
    >
      <div className="relative h-24 w-24">
        <PlayerAvatar3D
          config={config}
          isAlive={isAlive}
          hpPercent={hpPercent}
          isAttacking={swing}
          isHurt={hurt}
        />
        {swing && (
          <div
            className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 text-2xl animate-raid-hit"
            aria-hidden
          >
            ⚔️
          </div>
        )}
      </div>
      <p className="mt-1 text-xs font-semibold text-gray-200 truncate max-w-full">
        {player.username}
      </p>
      <div className="w-full mt-1 h-1.5 bg-gray-700 rounded overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${hpColorClass(hpPercent, isAlive)} ${isCriticalHp(hpPercent, isAlive) ? 'animate-pulse' : ''}`}
          style={{ width: `${hpPercent}%` }}
        />
      </div>
      <p className="mt-1 text-[10px] text-gray-400">
        {player.hp}/{player.maxHp} · {player.damageDealt} dmg
      </p>
      {!isAlive && (
        <span className="mt-1 text-[10px] px-1.5 py-0.5 rounded bg-red-800 text-red-200">
          DEAD
        </span>
      )}

      {/* Hit popups */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center">
        {popups.map((p, idx) => (
          <div
            key={p.id}
            className={`absolute text-xl font-extrabold animate-raid-hit ${p.kind === 'boss' ? 'text-red-400' : 'text-orange-300'}`}
            style={{
              transform: `translateY(${-idx * 8}px)`,
              textShadow: '0 0 6px rgba(0,0,0,0.7)',
            }}
          >
            -{p.damage}
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(RaidAvatar);
```

- [ ] **Step 2: Update `RaidGame.tsx` — remove emoji helpers**

In `frontend/src/components/RaidGame.tsx`, delete the emoji helper block (currently lines 25-33):

```tsx
const AVATAR_EMOJIS = ['🧙', '🥷', '🤺'];

function pickEmoji(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return AVATAR_EMOJIS[hash % AVATAR_EMOJIS.length];
}
```

- [ ] **Step 3: Update `RaidGame.tsx` — imports**

Add these imports alongside the existing import block (after the `RaidAvatar` import on line 5 and the type import from `useRaidState`):

```tsx
import {
  avatarConfigFromSeed,
  type PlayerAvatarConfig,
} from '../utils/avatarConfig';
import { hpColorClass, isCriticalHp } from '../utils/raidHp';
```

- [ ] **Step 4: Update `RaidGame.tsx` — memoized config map**

Inside the component, just after the `otherPlayers` `useMemo` (currently lines 57-60), add a stable config map keyed by user id (rebuilds only when the `players` array changes, not on keystrokes):

```tsx
const avatarConfigs = useMemo(() => {
  const m = new Map<string, PlayerAvatarConfig>();
  for (const p of players) m.set(p.userId, avatarConfigFromSeed(p.userId));
  return m;
}, [players]);
```

- [ ] **Step 5: Update `RaidGame.tsx` — avatar call sites**

Replace the two `<RaidAvatar ... emoji={pickEmoji(...)} ... />` call sites (currently lines 153-160 and 167-174) with:

```tsx
          {otherPlayers[0] && (
            <RaidAvatar
              player={otherPlayers[0]}
              config={avatarConfigs.get(otherPlayers[0].userId)!}
              lastHit={lastHit}
              lastWordHit={lastWordHit}
            />
          )}
```

and

```tsx
          {otherPlayers[1] && (
            <RaidAvatar
              player={otherPlayers[1]}
              config={avatarConfigs.get(otherPlayers[1].userId)!}
              lastHit={lastHit}
              lastWordHit={lastWordHit}
            />
          )}
```

(The `👹` boss `<div>` between them and the `bossShake` logic are unchanged.)

- [ ] **Step 6: Update `RaidGame.tsx` — local critical flag + typing-box ring**

Just after the `localHpPercent` computation (currently lines 130-133), add:

```tsx
const localCritical = isCriticalHp(localHpPercent, isLocalAlive);
```

Then on the focusable typing container (currently the `<div ref={containerRef} ...>` at lines 180-185), append a red ring when critical. Replace its `className` with:

```tsx
          className={`p-6 bg-gray-800 rounded-lg shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${!isLocalAlive ? 'opacity-50' : ''} ${localCritical ? 'ring-2 ring-red-500' : ''}`}
```

- [ ] **Step 7: Update `RaidGame.tsx` — local status-strip HP bar color**

Replace the local strip HP fill `<div>` (currently lines 238-242, the inner bar with `bg-green-500`) with:

```tsx
            <div
              className={`h-full transition-all duration-300 ${hpColorClass(localHpPercent, isLocalAlive)} ${localCritical ? 'animate-pulse' : ''}`}
              style={{ width: `${localHpPercent}%` }}
            />
```

- [ ] **Step 8: Typecheck**

Run: `cd frontend && bunx tsc --noEmit`
Expected: 0 errors. (If `Map.get(...)!` non-null assertion trips a lint rule later, it is guarded by the preceding `otherPlayers[0] &&` / `otherPlayers[1] &&` truthiness — the player is in `players`, hence in the map.)

- [ ] **Step 9: Run full frontend test + lint + format**

Run: `cd frontend && bun run test && bun run lint && bun run format:check`
Expected: all tests PASS (no test imports `RaidGame`/`RaidAvatar`, so the prop change does not break the suite), lint 0 errors, format clean (run `bun run format` first if needed).

- [ ] **Step 10: Commit**

```bash
cd frontend && git add src/components/RaidAvatar.tsx src/components/RaidGame.tsx
git commit -m "feat(raid): render 3D avatars in battle + low-HP warnings"
```

---

### Task 5: Lobby wiring — `RaidLobbyScreen` + SSR test guard

**Files:**
- Modify: `frontend/src/components/RaidLobbyScreen.tsx` (render an avatar before each username)
- Modify: `frontend/src/components/RaidLobbyScreen.test.tsx` (mock `PlayerAvatar3D` so `renderToString` does not hit the `<Canvas>`, add a wiring assertion)

**Caveat resolved here:** the existing lobby test uses `react-dom/server` `renderToString` in the `node` environment. An r3f `<Canvas>` cannot server-render, so the test mocks `PlayerAvatar3D` to a lightweight stub. The stub renders no user id, so the existing "never renders the userId" assertions still hold.

- [ ] **Step 1: Update the SSR test to mock the avatar (do this first so the suite stays green)**

In `frontend/src/components/RaidLobbyScreen.test.tsx`, change the imports on lines 1-3 and add the mock. Replace:

```tsx
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import RaidLobbyScreen from './RaidLobbyScreen';
```

with:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

// The lobby renders a 3D <Canvas> avatar per player; @react-three/fiber cannot
// server-render under the node test environment, so stub it with a marker we
// can count. The stub emits no user id, preserving the userId-absence asserts.
vi.mock('./PlayerAvatar3D', () => ({
  default: () => <i data-avatar="true" />,
}));

import RaidLobbyScreen from './RaidLobbyScreen';
```

- [ ] **Step 2: Add a wiring assertion to the test**

Append this test inside the `describe('RaidLobbyScreen', ...)` block in `frontend/src/components/RaidLobbyScreen.test.tsx` (e.g. after the existing "renders each player by username" test):

```tsx
  it('renders one avatar per player', () => {
    const html = renderToString(
      <RaidLobbyScreen
        {...baseProps}
        players={[mkPlayer('u1', 'Alice'), mkPlayer('u2', 'Bob')]}
        isHost={false}
      />
    );
    expect((html.match(/data-avatar/g) ?? []).length).toBe(2);
  });
```

- [ ] **Step 3: Run the test to verify it FAILS (avatar not wired yet)**

Run: `cd frontend && bun run test -- RaidLobbyScreen`
Expected: the new "renders one avatar per player" test FAILS (`expected 0 to be 2`) because `RaidLobbyScreen` does not render the avatar yet. The other lobby tests still PASS.

- [ ] **Step 4: Wire the avatar into `RaidLobbyScreen.tsx`**

In `frontend/src/components/RaidLobbyScreen.tsx`, add imports after line 1 (`import { useState } from 'react';`):

```tsx
import { avatarConfigFromSeed } from '../utils/avatarConfig';
import PlayerAvatar3D from './PlayerAvatar3D';
```

Then replace the player `<li>` (currently lines 56-63) with an avatar + name row:

```tsx
              {players.map(p => (
                <li
                  key={p.userId}
                  className="p-3 bg-gray-700 rounded flex items-center gap-3"
                >
                  <div className="h-10 w-10 shrink-0">
                    <PlayerAvatar3D
                      config={avatarConfigFromSeed(p.userId)}
                      isAlive
                      hpPercent={100}
                    />
                  </div>
                  <span>
                    {p.username}
                    {p.isHost && (
                      <span className="text-yellow-400 text-sm ml-2">
                        (Host)
                      </span>
                    )}
                  </span>
                </li>
              ))}
```

- [ ] **Step 5: Run the lobby test to verify it PASSES**

Run: `cd frontend && bun run test -- RaidLobbyScreen`
Expected: all lobby tests PASS, including "renders one avatar per player" (count = 2) and the unchanged username/host/error assertions.

- [ ] **Step 6: Typecheck + lint + format**

Run: `cd frontend && bunx tsc --noEmit && bun run lint && bun run format:check`
Expected: 0 errors (run `bun run format` first if `format:check` flags the edits).

- [ ] **Step 7: Commit**

```bash
cd frontend && git add src/components/RaidLobbyScreen.tsx src/components/RaidLobbyScreen.test.tsx
git commit -m "feat(raid): show 3D avatars in lobby; mock avatar in SSR test"
```

---

### Task 6: Full verification + manual eyeball pass

**Files:** none (verification only).

- [ ] **Step 1: Run the full frontend CI sequence**

Run (from `frontend/`):

```bash
bun run lint && bun run format:check && bunx tsc --noEmit && bun run test && bun run build
```

Expected: lint 0 errors (3 pre-existing warnings in `PixelArtBackground.tsx:77/:122` and `useCompletionDetection.ts:47` are acceptable; no NEW warnings), `format:check` clean, `tsc` 0 errors, all tests PASS (new raidHp + avatarConfig suites + updated lobby suite), production `build` succeeds (this is what actually compiles the r3f component).

- [ ] **Step 2: Manual eyeball verification in the dev server**

Run: `cd frontend && bun run dev`

Then verify in the browser (two clients / a 2-player raid, guest mode is fine):

1. **Lobby** — each player row shows a distinct 3D avatar; the same user is visually stable across reloads (deterministic seed); host shows the `(Host)` badge.
2. **Battle** — teammate lanes render the 3D avatar (no emoji); the boss is still `👹`.
3. **Attack** — landing a word makes the attacker's avatar lunge/pop (and the `⚔️` cue flashes).
4. **Hurt** — when a player takes damage, their avatar flashes red + recoils alongside the existing damage popup.
5. **Low HP** — below 25% HP the avatar wobbles + desaturates, the lane HP bar turns red + pulses; the local strip bar turns amber (25–50%) / red+pulse (<25%) and the typing box shows a red ring when local HP is critical.
6. **Death** — a downed player's avatar droops + fades and goes grey; the `DEAD` badge and `opacity-50` lane still apply.

- [ ] **Step 3: Finish the branch**

Use the `superpowers:finishing-a-development-branch` skill to decide merge/PR. (Work is on `dev`; the repo's flow squash-merges `dev` → `main` via PR.)

---

## Self-Review

**Spec coverage** (against the approved design in the session handoff):
- Procedural r3f avatars, seeded per user, no editor → Tasks 2 + 3 (`avatarConfigFromSeed`, `PlayerAvatar3D`). ✅
- Lobby + battle placement → Tasks 4 (battle) + 5 (lobby). ✅
- Animation set: idle bob, attack lunge+pop, hit flash+recoil, low-HP wobble+desaturate, death fade+droop → Task 3 `useFrame`. ✅
- Low-HP warnings #2: HP bar colors + pulse (lanes + local strip) + critical typing-box ring → Tasks 1 (`raidHp`) + 4. ✅
- Remove `pickEmoji`/`AVATAR_EMOJIS` → Task 4 Step 2. ✅
- Boss stays emoji; local typing area/status strip kept (no scope creep) → Task 4 keeps `👹` and the strip. ✅
- `react-dom/server` Canvas test caveat resolved → Task 5 mocks `PlayerAvatar3D`. ✅
- Deferred (not in this plan, by design): customization editor + `users.character` persistence; #4 mid-game reconnect fix. ✅

**Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to Task N" — every code step contains complete code. ✅

**Type consistency:** `PlayerAvatarConfig` (fields `bodyShape`, `bodyColor`, `eyeStyle`, `accessory`, `accessoryColor`) is defined in Task 2 and consumed identically in Tasks 3/4/5. `avatarConfigFromSeed(seed: string)` signature matches all call sites. `hpColorClass(percent, isAlive?)` / `isCriticalHp(percent, isAlive?)` signatures match all call sites. `RaidAvatar` prop rename `emoji` → `config` is applied at the definition (Task 4 Step 1) and both call sites (Task 4 Step 5). `PlayerAvatar3DProps` (`config`, `isAlive`, `hpPercent`, `isAttacking?`, `isHurt?`) matches usage in `RaidAvatar` and `RaidLobbyScreen`. ✅
