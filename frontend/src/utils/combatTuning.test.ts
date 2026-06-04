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
  hpBonus,
  levelDmgBonus,
  detectLevelUp,
} from './combatTuning';

describe('combatTuning', () => {
  it('maps tiers to fixed HP', () => {
    expect(MONSTER_MAX_HP.normal).toBe(240);
    expect(MONSTER_MAX_HP['mini-boss']).toBe(480);
    expect(MONSTER_MAX_HP.boss).toBe(900);
  });

  it('scales HP by variant on top of tier HP', () => {
    expect(monsterMaxHp('normal')).toBe(240); // common default
    expect(monsterMaxHp('normal', 'common')).toBe(240);
    expect(monsterMaxHp('normal', 'elite')).toBe(360); // 240 * 1.5
    expect(monsterMaxHp('boss', 'rare')).toBe(1800); // 900 * 2
    expect(monsterMaxHp('mini-boss', 'elite')).toBe(720); // 480 * 1.5
  });

  it('grants a combo surge only for elite/rare kills', () => {
    expect(VARIANT_COMBO_SURGE.common).toBe(0);
    expect(VARIANT_COMBO_SURGE.elite).toBeGreaterThan(0);
    expect(VARIANT_COMBO_SURGE.rare).toBeGreaterThan(VARIANT_COMBO_SURGE.elite);
    expect(VARIANT_HP_MULT.rare).toBeGreaterThan(VARIANT_HP_MULT.elite);
  });

  it('ramps crit chance 1% per streak, capped at 50%', () => {
    expect(critChanceForStreak(0)).toBeCloseTo(0);
    expect(critChanceForStreak(5)).toBeCloseTo(0.05);
    expect(critChanceForStreak(20)).toBeCloseTo(0.2);
    expect(critChanceForStreak(50)).toBeCloseTo(0.5);
    expect(critChanceForStreak(100)).toBeCloseTo(0.5); // clamped
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
    // streak 0 → 0% streak crit, rng 0.99 → no crit. damage = 10 + 3 = 13.
    expect(rollDamage(0, () => 0.99, weapon)).toEqual({
      damage: 13,
      crit: false,
    });
  });

  it('rollDamage applies weapon crit multiplier bonus on a crit', () => {
    const weapon = { bonusDamage: 3, bonusCritChance: 0, critMultBonus: 0.5 };
    // streak 50 → 50% crit, rng 0.1 → crit. (10+3) * (2+0.5) = 32.5 → 33.
    expect(rollDamage(50, () => 0.1, weapon)).toEqual({
      damage: 33,
      crit: true,
    });
  });

  it('rollDamage lets a weapon crit-chance bonus crit at streak 0', () => {
    const weapon = { bonusDamage: 0, bonusCritChance: 0.5, critMultBonus: 0 };
    // streak 0 (0%) + 0.5 = 0.5. rng 0.4 < 0.5 → crit; without weapon: no crit.
    expect(rollDamage(0, () => 0.4, weapon).crit).toBe(true);
    expect(rollDamage(0, () => 0.4).crit).toBe(false);
  });

  it('rollDamage caps total crit chance at 70% even with a weapon', () => {
    const weapon = { bonusDamage: 0, bonusCritChance: 0.5, critMultBonus: 0 };
    // streak 50 (0.5) + 0.5 = 1.0 → capped 0.7.
    expect(rollDamage(50, () => 0.69, weapon).crit).toBe(true);
    expect(rollDamage(50, () => 0.71, weapon).crit).toBe(false);
  });

  it('rollDamage adds the level damage bonus to a non-crit hit', () => {
    // streak 0, rng 0.99 → no crit. level 20 → +1.0 bonus. base = 10 + 0 + 1 = 11.
    expect(rollDamage(0, () => 0.99, null, 20)).toEqual({
      damage: 11,
      crit: false,
    });
  });

  it('rollDamage caps the level damage bonus at +1.0', () => {
    // level 50 also yields +1.0 (capped). base = 10 + 1 = 11.
    expect(rollDamage(0, () => 0.99, null, 50)).toEqual({
      damage: 11,
      crit: false,
    });
  });

  it('rollDamage stacks weapon bonus and level bonus on the base', () => {
    const weapon = { bonusDamage: 3, bonusCritChance: 0, critMultBonus: 0 };
    // base = 10 + 3 + 0.25 (level 5) = 13.25 → round → 13.
    expect(rollDamage(0, () => 0.99, weapon, 5)).toEqual({
      damage: 13,
      crit: false,
    });
  });

  it('rollDamage defaults level to 1 (no bonus) when omitted', () => {
    expect(rollDamage(0, () => 0.99)).toEqual({ damage: 10, crit: false });
  });
});

describe('hpBonus', () => {
  it('grants +1 max HP per 5 levels, uncapped', () => {
    expect(hpBonus(1)).toBe(0);
    expect(hpBonus(4)).toBe(0);
    expect(hpBonus(5)).toBe(1);
    expect(hpBonus(9)).toBe(1);
    expect(hpBonus(20)).toBe(4);
    expect(hpBonus(50)).toBe(10);
  });
});

describe('levelDmgBonus', () => {
  it('adds +0.25 base damage per 5 levels, capped at +1.0', () => {
    expect(levelDmgBonus(1)).toBeCloseTo(0);
    expect(levelDmgBonus(4)).toBeCloseTo(0);
    expect(levelDmgBonus(5)).toBeCloseTo(0.25);
    expect(levelDmgBonus(10)).toBeCloseTo(0.5);
    expect(levelDmgBonus(20)).toBeCloseTo(1.0); // 4 milestones * 0.25 = 1.0
    expect(levelDmgBonus(50)).toBeCloseTo(1.0); // capped
    expect(levelDmgBonus(100)).toBeCloseTo(1.0); // still capped
  });
});

describe('detectLevelUp', () => {
  it('flags no level-up when level is unchanged or decreased', () => {
    expect(detectLevelUp(5, 5)).toEqual({
      leveledUp: false,
      milestoneReached: false,
      newLevel: 5,
    });
    expect(detectLevelUp(5, 4)).toEqual({
      leveledUp: false,
      milestoneReached: false,
      newLevel: 4,
    });
  });
  it('flags a plain level-up that does not cross a multiple of 5', () => {
    expect(detectLevelUp(6, 7)).toEqual({
      leveledUp: true,
      milestoneReached: false,
      newLevel: 7,
    });
  });
  it('flags a milestone when the new level crosses a multiple of 5', () => {
    expect(detectLevelUp(4, 5)).toEqual({
      leveledUp: true,
      milestoneReached: true,
      newLevel: 5,
    });
    expect(detectLevelUp(9, 10)).toEqual({
      leveledUp: true,
      milestoneReached: true,
      newLevel: 10,
    });
  });
  it('flags a milestone on a multi-level jump that crosses a multiple of 5', () => {
    // 8 -> 12 crosses 10
    expect(detectLevelUp(8, 12)).toEqual({
      leveledUp: true,
      milestoneReached: true,
      newLevel: 12,
    });
    // 3 -> 11 crosses 5 and 10 -> still milestone, celebrate highest (derived from newLevel)
    expect(detectLevelUp(3, 11)).toEqual({
      leveledUp: true,
      milestoneReached: true,
      newLevel: 11,
    });
  });
  it('flags a multi-level jump with no multiple of 5 crossed as a non-milestone level-up', () => {
    // 6 -> 9 crosses no multiple of 5
    expect(detectLevelUp(6, 9)).toEqual({
      leveledUp: true,
      milestoneReached: false,
      newLevel: 9,
    });
  });
});
