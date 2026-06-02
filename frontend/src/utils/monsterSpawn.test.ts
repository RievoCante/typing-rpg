import { describe, it, expect } from 'vitest';
import {
  pickMonsterType,
  pickMonsterVariant,
  pickMonsterFamily,
  FAMILY_WEIGHTS,
} from './monsterSpawn';
import type { MonsterFamily } from '../components/Monster';

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

describe('pickMonsterVariant', () => {
  it('only spawns common for the first three fights (0-2 defeated)', () => {
    for (const defeated of [0, 1, 2]) {
      expect(pickMonsterVariant(defeated, () => 0)).toBe('common');
      expect(pickMonsterVariant(defeated, () => 0.99)).toBe('common');
    }
  });

  it('spawns elite (~12%) but never rare for 3-7 defeated', () => {
    for (const defeated of [3, 5, 7]) {
      expect(pickMonsterVariant(defeated, () => 0)).toBe('elite'); // bottom of band
      expect(pickMonsterVariant(defeated, () => 0.119)).toBe('elite'); // < 0.12
      expect(pickMonsterVariant(defeated, () => 0.12)).toBe('common'); // >= 0.12
      expect(pickMonsterVariant(defeated, () => 0.9)).toBe('common');
      // rare is locked before 8 defeats
      for (const r of [0, 0.01, 0.04, 0.049]) {
        expect(pickMonsterVariant(defeated, () => r)).not.toBe('rare');
      }
    }
  });

  it('unlocks rare (~5%) at 8+ defeated with elite band stacked above it', () => {
    // rare band [0, 0.05)
    expect(pickMonsterVariant(8, () => 0)).toBe('rare');
    expect(pickMonsterVariant(8, () => 0.049)).toBe('rare');
    // elite band [0.05, 0.17)
    expect(pickMonsterVariant(8, () => 0.05)).toBe('elite');
    expect(pickMonsterVariant(8, () => 0.169)).toBe('elite');
    // common above
    expect(pickMonsterVariant(8, () => 0.17)).toBe('common');
    expect(pickMonsterVariant(20, () => 0.99)).toBe('common');
  });

  it('keeps the elite band a constant 12% width whether or not rare is unlocked', () => {
    // pre-unlock: elite occupies [0, 0.12)
    expect(pickMonsterVariant(5, () => 0.11)).toBe('elite');
    // post-unlock: elite occupies [0.05, 0.17) — same width, shifted above rare
    expect(pickMonsterVariant(8, () => 0.16)).toBe('elite');
  });
});

describe('pickMonsterFamily', () => {
  it('has weights that sum to 1', () => {
    const total = FAMILY_WEIGHTS.reduce((s, f) => s + f.weight, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('maps each cumulative band to its family (slime/golem common, mushroom/crystal rarer)', () => {
    // bands: slime [0,0.35) golem [0.35,0.70) mushroom [0.70,0.88) crystal [0.88,1)
    expect(pickMonsterFamily(() => 0)).toBe('slime');
    expect(pickMonsterFamily(() => 0.349)).toBe('slime');
    expect(pickMonsterFamily(() => 0.35)).toBe('golem');
    expect(pickMonsterFamily(() => 0.699)).toBe('golem');
    expect(pickMonsterFamily(() => 0.7)).toBe('mushroom');
    expect(pickMonsterFamily(() => 0.879)).toBe('mushroom');
    expect(pickMonsterFamily(() => 0.88)).toBe('crystal');
    expect(pickMonsterFamily(() => 0.999)).toBe('crystal');
  });

  it('returns the last family when rng yields 1 (out-of-band guard)', () => {
    expect(pickMonsterFamily(() => 1)).toBe('crystal');
  });

  it('reaches every family across the unit interval', () => {
    const seen = new Set<MonsterFamily>();
    for (let i = 0; i < 100; i++) seen.add(pickMonsterFamily(() => i / 100));
    expect(seen).toEqual(new Set(['slime', 'golem', 'mushroom', 'crystal']));
  });
});
