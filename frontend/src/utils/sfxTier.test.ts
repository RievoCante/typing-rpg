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
