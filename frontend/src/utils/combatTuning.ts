import type { MonsterTypeEnum } from '../context/GameContext';

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
