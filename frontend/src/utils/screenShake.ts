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
