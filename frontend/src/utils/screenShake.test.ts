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
