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
// at streak 50). A wrong word resets the streak to 0 (see useComboSystem).
const CRIT_RAMP_PER_WORD = 0.015;
const CRIT_CHANCE_CAP = 0.75;

export const critChanceForStreak = (streak: number): number =>
  Math.min(CRIT_CHANCE_CAP, Math.max(0, streak) * CRIT_RAMP_PER_WORD);

export interface DamageRoll {
  damage: number;
  crit: boolean;
}

// Pure: rng is injectable so tests are deterministic. Defaults to Math.random.
export const rollDamage = (
  streak: number,
  rng: () => number = Math.random
): DamageRoll => {
  const crit = rng() < critChanceForStreak(streak);
  return { damage: crit ? BASE_DMG * CRIT_MULT : BASE_DMG, crit };
};
