import { describe, it, expect } from 'vitest';
import { consistency, mean, populationStdDev } from './consistency';

describe('consistency (kogasa)', () => {
  it('mean and population std dev', () => {
    expect(mean([2, 4, 6])).toBe(4);
    expect(populationStdDev([2, 4, 6])).toBeCloseTo(1.632993, 4);
  });

  it('perfectly even samples → 100', () => {
    expect(consistency([50, 50, 50, 50])).toBe(100);
  });

  it('high variance → low consistency', () => {
    const even = consistency([50, 50, 50, 50]);
    const jittery = consistency([10, 90, 20, 80]);
    expect(jittery).toBeLessThan(even);
    expect(jittery).toBeGreaterThanOrEqual(0);
  });

  it('empty or single sample → 0', () => {
    expect(consistency([])).toBe(0);
    expect(consistency([42])).toBe(0);
  });
});
