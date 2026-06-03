import { describe, it, expect } from 'vitest';
import { calculateEndlessXp, calculateRaidXp } from './calculateXP';

// These expected values MUST match backend/src/core/xp.ts calculateXpDelta('endless', ...).
// If this test fails after a backend XP change, the frontend mirror is out of sync.
describe('calculateEndlessXp', () => {
  it('awards base XP at target WPM with no mistakes', () => {
    expect(calculateEndlessXp(0, 60)).toBe(100);
  });

  it('caps the WPM multiplier at 1.25x', () => {
    expect(calculateEndlessXp(0, 120)).toBe(125);
    expect(calculateEndlessXp(0, 1000)).toBe(125);
  });

  it('floors the WPM multiplier at 0.5x', () => {
    expect(calculateEndlessXp(0, 30)).toBe(50);
    expect(calculateEndlessXp(0, 0)).toBe(50);
  });

  it('applies step penalties for incorrect words', () => {
    expect(calculateEndlessXp(1, 60)).toBe(80); // 0.8x
    expect(calculateEndlessXp(3, 60)).toBe(60); // 0.6x
    expect(calculateEndlessXp(5, 60)).toBe(40); // 0.4x
    expect(calculateEndlessXp(7, 60)).toBe(20); // 0.2x
    expect(calculateEndlessXp(9, 60)).toBe(0); // zeroed out
  });

  it('defaults to the beginner (1x) multiplier when difficulty omitted', () => {
    expect(calculateEndlessXp(0, 60)).toBe(100);
  });

  it('applies the per-difficulty multiplier', () => {
    expect(calculateEndlessXp(0, 60, 'beginner')).toBe(100); // *1.0
    expect(calculateEndlessXp(0, 60, 'common')).toBe(150); // *1.5
    expect(calculateEndlessXp(0, 60, 'intermediate')).toBe(200); // *2.0
    expect(calculateEndlessXp(0, 60, 'advanced')).toBe(300); // *3.0
  });

  it('stacks difficulty with WPM and step penalties', () => {
    // base 100 * advanced 3.0 * 0.8 (1 mistake) * 1.25 (120 WPM cap) = 300
    expect(calculateEndlessXp(1, 120, 'advanced')).toBe(300);
  });

  it('defaults to the common (1x) variant when variant omitted', () => {
    expect(calculateEndlessXp(0, 60, 'beginner')).toBe(100);
  });

  it('applies the per-rarity variant multiplier (elite pays most)', () => {
    expect(calculateEndlessXp(0, 60, 'beginner', 'common')).toBe(100); // *1.0
    expect(calculateEndlessXp(0, 60, 'beginner', 'rare')).toBe(175); // *1.75
    expect(calculateEndlessXp(0, 60, 'beginner', 'elite')).toBe(300); // *3.0
  });

  it('stacks variant with difficulty, WPM, and step penalties', () => {
    // base 100 * common-diff 1.5 * 0.8 (1 mistake) * 1.25 (120 WPM cap) * elite 3.0 = 450
    expect(calculateEndlessXp(1, 120, 'common', 'elite')).toBe(450);
  });
});

describe('calculateRaidXp', () => {
  it('adds base plus damage multiplier', () => {
    expect(calculateRaidXp(0)).toBe(300);
    expect(calculateRaidXp(10)).toBe(350);
  });
});
