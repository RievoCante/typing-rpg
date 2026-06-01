import { describe, it, expect } from 'vitest';
import { pickMonsterType } from './monsterSpawn';

describe('pickMonsterType', () => {
  it('only spawns normal monsters for the first three fights (0-2 defeated)', () => {
    for (const defeated of [0, 1, 2]) {
      expect(pickMonsterType(defeated, () => 0)).toBe('normal');
      expect(pickMonsterType(defeated, () => 0.99)).toBe('normal');
    }
  });

  it('mixes in occasional mini-bosses for 3-6 defeated', () => {
    for (const defeated of [3, 4, 5, 6]) {
      expect(pickMonsterType(defeated, () => 0.1)).toBe('mini-boss'); // < 0.25
      expect(pickMonsterType(defeated, () => 0.9)).toBe('normal'); // >= 0.25
    }
  });

  it('spawns a mini-boss / boss mix at 7+ defeated', () => {
    expect(pickMonsterType(7, () => 0.1)).toBe('boss'); // < 0.5
    expect(pickMonsterType(7, () => 0.9)).toBe('mini-boss'); // >= 0.5
    expect(pickMonsterType(20, () => 0.49)).toBe('boss');
    expect(pickMonsterType(20, () => 0.5)).toBe('mini-boss');
  });

  it('never spawns a boss before the 7th-defeat threshold', () => {
    for (let defeated = 0; defeated <= 6; defeated++) {
      for (const r of [0, 0.2, 0.5, 0.9]) {
        expect(pickMonsterType(defeated, () => r)).not.toBe('boss');
      }
    }
  });
});
