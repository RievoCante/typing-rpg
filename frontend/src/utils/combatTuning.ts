import type { MonsterTypeEnum, MonsterVariant } from '../context/GameContext';

// Fixed monster HP per tier. HP is decoupled from the words typed: each correct
// word deals BASE_DMG (or BASE_DMG * CRIT_MULT on a crit). Tuned so a "cold"
// normal monster (~1 dmg/word) dies in ~24 words (≈ today's default), while a
// hot combo accelerates kills. Phase 2 (monster variety) extends this map.
export const MONSTER_MAX_HP: Record<MonsterTypeEnum, number> = {
  normal: 24,
  'mini-boss': 48,
  boss: 90,
};

export const BASE_DMG = 1;
export const CRIT_MULT = 2;

// Monster variants (Endless). HP stacks on top of the tier HP, so an elite
// boss = 90 * 1.5 = 135. Scale multiplies the randomized visual scale, and the
// combo surge is granted on kill (see GameProvider reward wiring).
export const VARIANT_HP_MULT: Record<MonsterVariant, number> = {
  common: 1,
  elite: 1.5,
  rare: 2,
};

export const VARIANT_SCALE_MULT: Record<MonsterVariant, number> = {
  common: 1,
  elite: 1.15,
  rare: 1.3,
};

// Combo streak granted when a variant monster is killed (0 for common).
export const VARIANT_COMBO_SURGE: Record<MonsterVariant, number> = {
  common: 0,
  elite: 8,
  rare: 15,
};

// Effective max HP for a tier + variant combination (Endless).
export const monsterMaxHp = (
  type: MonsterTypeEnum,
  variant: MonsterVariant = 'common'
): number => Math.round(MONSTER_MAX_HP[type] * VARIANT_HP_MULT[variant]);

// Crit chance rises 1.5% per consecutive correct word, capped at 75% (reached
// at streak 50). A wrong word halves the streak (see useComboSystem).
const CRIT_RAMP_PER_WORD = 0.015;
const CRIT_CHANCE_CAP = 0.75;
// Hard ceiling once a weapon's crit bonus is added on top of the streak chance.
const TOTAL_CRIT_CHANCE_CAP = 0.95;

export const critChanceForStreak = (streak: number): number =>
  Math.min(CRIT_CHANCE_CAP, Math.max(0, streak) * CRIT_RAMP_PER_WORD);

export interface DamageRoll {
  damage: number;
  crit: boolean;
}

// Combat modifiers a weapon contributes (subset of utils/weapons.Weapon, kept
// local so combatTuning has no hard dependency on the weapon pool).
export interface WeaponMods {
  bonusDamage: number;
  bonusCritChance: number;
  critMultBonus: number;
}

// Pure: rng is injectable so tests are deterministic. An equipped weapon raises
// crit chance (capped at 95% total), base damage, and crit multiplier.
export const rollDamage = (
  streak: number,
  rng: () => number = Math.random,
  weapon: WeaponMods | null = null
): DamageRoll => {
  const critChance = Math.min(
    TOTAL_CRIT_CHANCE_CAP,
    critChanceForStreak(streak) + (weapon?.bonusCritChance ?? 0)
  );
  const crit = rng() < critChance;
  const base = BASE_DMG + (weapon?.bonusDamage ?? 0);
  const mult = CRIT_MULT + (weapon?.critMultBonus ?? 0);
  return { damage: Math.round(crit ? base * mult : base), crit };
};
