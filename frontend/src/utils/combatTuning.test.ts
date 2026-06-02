import { describe, it, expect } from 'vitest';
import {
  MONSTER_MAX_HP,
  BASE_DMG,
  CRIT_MULT,
  critChanceForStreak,
  rollDamage,
  monsterMaxHp,
  VARIANT_HP_MULT,
  VARIANT_COMBO_SURGE,
} from './combatTuning';

describe('combatTuning', () => {
  it('maps tiers to fixed HP', () => {
    expect(MONSTER_MAX_HP.normal).toBe(24);
    expect(MONSTER_MAX_HP['mini-boss']).toBe(48);
    expect(MONSTER_MAX_HP.boss).toBe(90);
  });

  it('scales HP by variant on top of tier HP', () => {
    expect(monsterMaxHp('normal')).toBe(24); // common default
    expect(monsterMaxHp('normal', 'common')).toBe(24);
    expect(monsterMaxHp('normal', 'elite')).toBe(36); // 24 * 1.5
    expect(monsterMaxHp('boss', 'rare')).toBe(180); // 90 * 2
    expect(monsterMaxHp('mini-boss', 'elite')).toBe(72); // 48 * 1.5
  });

  it('grants a combo surge only for elite/rare kills', () => {
    expect(VARIANT_COMBO_SURGE.common).toBe(0);
    expect(VARIANT_COMBO_SURGE.elite).toBeGreaterThan(0);
    expect(VARIANT_COMBO_SURGE.rare).toBeGreaterThan(VARIANT_COMBO_SURGE.elite);
    expect(VARIANT_HP_MULT.rare).toBeGreaterThan(VARIANT_HP_MULT.elite);
  });

  it('ramps crit chance 1.5% per streak, capped at 75%', () => {
    expect(critChanceForStreak(0)).toBeCloseTo(0);
    expect(critChanceForStreak(5)).toBeCloseTo(0.075);
    expect(critChanceForStreak(20)).toBeCloseTo(0.3);
    expect(critChanceForStreak(50)).toBeCloseTo(0.75);
    expect(critChanceForStreak(100)).toBeCloseTo(0.75); // clamped
  });

  it('rollDamage returns crit damage when rng is below crit chance', () => {
    expect(rollDamage(50, () => 0.1)).toEqual({
      damage: BASE_DMG * CRIT_MULT,
      crit: true,
    });
  });

  it('rollDamage returns base damage when rng is above crit chance', () => {
    expect(rollDamage(50, () => 0.9)).toEqual({
      damage: BASE_DMG,
      crit: false,
    });
  });

  it('rollDamage adds weapon bonus damage to a non-crit hit', () => {
    const weapon = { bonusDamage: 3, bonusCritChance: 0, critMultBonus: 0 };
    // streak 0 → 0% streak crit, rng 0.99 → no crit. damage = 1 + 3 = 4.
    expect(rollDamage(0, () => 0.99, weapon)).toEqual({
      damage: 4,
      crit: false,
    });
  });

  it('rollDamage applies weapon crit multiplier bonus on a crit', () => {
    const weapon = { bonusDamage: 3, bonusCritChance: 0, critMultBonus: 0.5 };
    // streak 50 → 75% crit, rng 0.1 → crit. (1+3) * (2+0.5) = 10.
    expect(rollDamage(50, () => 0.1, weapon)).toEqual({
      damage: 10,
      crit: true,
    });
  });

  it('rollDamage lets a weapon crit-chance bonus crit at streak 0', () => {
    const weapon = { bonusDamage: 0, bonusCritChance: 0.5, critMultBonus: 0 };
    // streak 0 (0%) + 0.5 = 0.5. rng 0.4 < 0.5 → crit; without weapon: no crit.
    expect(rollDamage(0, () => 0.4, weapon).crit).toBe(true);
    expect(rollDamage(0, () => 0.4).crit).toBe(false);
  });

  it('rollDamage caps total crit chance at 95% even with a weapon', () => {
    const weapon = { bonusDamage: 0, bonusCritChance: 0.5, critMultBonus: 0 };
    // streak 50 (0.75) + 0.5 = 1.25 → capped 0.95.
    expect(rollDamage(50, () => 0.94, weapon).crit).toBe(true);
    expect(rollDamage(50, () => 0.96, weapon).crit).toBe(false);
  });
});
