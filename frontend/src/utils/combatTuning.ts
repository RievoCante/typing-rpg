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

// Visual size by rarity. Size now *encodes* rarity (common = small, rare =
// big) instead of being a random per-spawn roll, so the player can read a
// monster's tier at a glance. Multiplies the family's base scale (see App).
export const VARIANT_SIZE: Record<MonsterVariant, number> = {
  common: 0.8,
  elite: 1.15,
  rare: 1.55,
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

// --- Level-derived progression payoff (Endless, signed-in only) ---
// milestonesReached = floor(level / 5). Bonuses are DERIVED from level (no
// backend state) so they're idempotent across multi-level jumps.

const milestonesReached = (level: number): number =>
  Math.max(0, Math.floor(level / 5));

// Max HP bonus: +1 per milestone, uncapped. Trivial vs base 100.
export const hpBonus = (level: number): number => milestonesReached(level);

// Base damage bonus: +0.25 per milestone, CAPPED at +1.0 (~level 20) so it
// never outweighs streak/weapon power.
export const levelDmgBonus = (level: number): number =>
  Math.min(1.0, 0.25 * milestonesReached(level));

export interface LevelUpEvent {
  leveledUp: boolean;
  milestoneReached: boolean;
  newLevel: number;
}

// Pure level-up detection: leveledUp when next > prev; milestoneReached when
// the jump crosses (or lands on) a new multiple of 5, i.e. floor(next/5) grew.
export const detectLevelUp = (prev: number, next: number): LevelUpEvent => {
  const leveledUp = next > prev;
  const milestoneReached =
    leveledUp && milestonesReached(next) > milestonesReached(prev);
  return { leveledUp, milestoneReached, newLevel: next };
};

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
// crit chance (capped at 95% total), base damage, and crit multiplier. `level`
// adds the faint level-derived base-damage bonus (capped +1.0; default 1 = +0).
export const rollDamage = (
  streak: number,
  rng: () => number = Math.random,
  weapon: WeaponMods | null = null,
  level: number = 1
): DamageRoll => {
  const critChance = Math.min(
    TOTAL_CRIT_CHANCE_CAP,
    critChanceForStreak(streak) + (weapon?.bonusCritChance ?? 0)
  );
  const crit = rng() < critChance;
  const base = BASE_DMG + (weapon?.bonusDamage ?? 0) + levelDmgBonus(level);
  const mult = CRIT_MULT + (weapon?.critMultBonus ?? 0);
  return { damage: Math.round(crit ? base * mult : base), crit };
};
