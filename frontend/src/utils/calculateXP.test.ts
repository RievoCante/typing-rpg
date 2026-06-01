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
});

describe('calculateRaidXp', () => {
  it('adds base plus damage multiplier', () => {
    expect(calculateRaidXp(0)).toBe(300);
    expect(calculateRaidXp(10)).toBe(350);
  });
});
