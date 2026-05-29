import { describe, it, expect } from 'vitest';
import { countdownRemaining } from './countdownRemaining';

describe('countdownRemaining', () => {
  it('rounds up to whole seconds remaining', () => {
    expect(countdownRemaining(10_000, 5_500)).toBe(5); // 4.5s -> ceil 5
    expect(countdownRemaining(10_000, 6_000)).toBe(4);
  });

  it('returns 0 at or past the end (never negative)', () => {
    expect(countdownRemaining(5_000, 5_000)).toBe(0);
    expect(countdownRemaining(1_000, 5_000)).toBe(0);
  });
});
