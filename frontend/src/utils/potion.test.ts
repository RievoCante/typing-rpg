import { describe, it, expect } from 'vitest';
import {
  shouldDropPotion,
  rollHealAmount,
  POTION_MIN_HEAL,
  POTION_MAX_HEAL,
  POTION_DROP_CHANCE,
  WORDS_PER_DROP_CHECK,
} from './potion';

describe('shouldDropPotion', () => {
  const lucky = () => POTION_DROP_CHANCE - 0.01; // roll succeeds
  const unlucky = () => POTION_DROP_CHANCE + 0.01; // roll fails

  it('never drops on a non-checkpoint word, even with a lucky roll', () => {
    for (const n of [1, 2, 3, 4, 6, 7, 8, 9]) {
      expect(shouldDropPotion(n, lucky)).toBe(false);
    }
  });

  it('never drops at count 0', () => {
    expect(shouldDropPotion(0, lucky)).toBe(false);
  });

  it('drops on a checkpoint word when the roll succeeds', () => {
    expect(shouldDropPotion(WORDS_PER_DROP_CHECK, lucky)).toBe(true);
    expect(shouldDropPotion(WORDS_PER_DROP_CHECK * 2, lucky)).toBe(true);
  });

  it('does not drop on a checkpoint word when the roll fails', () => {
    expect(shouldDropPotion(WORDS_PER_DROP_CHECK, unlucky)).toBe(false);
  });
});

describe('rollHealAmount', () => {
  it('returns the minimum at rng 0', () => {
    expect(rollHealAmount(() => 0)).toBe(POTION_MIN_HEAL);
  });

  it('returns the maximum at rng approaching 1', () => {
    expect(rollHealAmount(() => 0.999999)).toBe(POTION_MAX_HEAL);
  });

  it('stays within bounds across the range', () => {
    for (let r = 0; r < 1; r += 0.05) {
      const amount = rollHealAmount(() => r);
      expect(amount).toBeGreaterThanOrEqual(POTION_MIN_HEAL);
      expect(amount).toBeLessThanOrEqual(POTION_MAX_HEAL);
    }
  });
});
