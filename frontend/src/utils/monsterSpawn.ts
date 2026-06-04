import type { MonsterTypeEnum, MonsterVariant } from '../context/GameContext';
import type { MonsterFamily } from '../components/Monster';

// Endless monster-type gating.
//
// Difficulty ramps with how many monsters the player has already defeated in
// the current run, so a fresh run always starts safe and pressure escalates as
// the player survives. This replaces the previous uniform-random pick, which
// could spawn a high-DPS boss on the very first monster and make a long-word
// run unwinnable through no fault of the player.
export function pickMonsterType(
  monstersDefeated: number,
  rng: () => number = Math.random
): MonsterTypeEnum {
  if (monstersDefeated <= 2) return 'normal';
  if (monstersDefeated <= 6) {
    // Mostly normal, occasional mini-boss.
    return rng() < 0.25 ? 'mini-boss' : 'normal';
  }
  // 7+: mini-boss / boss mix.
  return rng() < 0.5 ? 'boss' : 'mini-boss';
}

// Endless monster-variant gating (independent of tier). Like the tier pick,
// variants ramp with run progress: the first few monsters are always common so
// a fresh run is calm, then elites start appearing, then rares unlock as the
// jackpot. Tuned low so elite/rare feel special. A single uniform roll is
// partitioned into non-overlapping bands: [0, rare) = rare (once unlocked),
// then a fixed-width elite band above it, then common. The elite band keeps a
// constant width whether or not rares are unlocked, so elite stays ~12% across
// the whole run.
const ELITE_CHANCE = 0.12;
const RARE_CHANCE = 0.05;

export function pickMonsterVariant(
  monstersDefeated: number,
  rng: () => number = Math.random
): MonsterVariant {
  if (monstersDefeated <= 2) return 'common';
  const roll = rng();
  const rareUnlocked = monstersDefeated >= 8;
  if (rareUnlocked && roll < RARE_CHANCE) return 'rare';
  const eliteFloor = rareUnlocked ? RARE_CHANCE : 0;
  if (roll >= eliteFloor && roll < eliteFloor + ELITE_CHANCE) return 'elite';
  return 'common';
}

// Endless monster-family selection (cosmetic only — family does not affect HP,
// tier, or combat). All four families are available from the first fight, but
// slime/golem stay the bread-and-butter while the procedural newcomers
// (mushroom/crystal) are rarer treats. A single uniform roll is partitioned
// into non-overlapping cumulative bands. Weights must sum to 1.
export const FAMILY_WEIGHTS: { family: MonsterFamily; weight: number }[] = [
  { family: 'slime', weight: 0.35 },
  { family: 'golem', weight: 0.35 },
  { family: 'mushroom', weight: 0.18 },
  { family: 'crystal', weight: 0.12 },
];

export function pickMonsterFamily(
  rng: () => number = Math.random
): MonsterFamily {
  const roll = rng();
  let cumulative = 0;
  for (const { family, weight } of FAMILY_WEIGHTS) {
    cumulative += weight;
    if (roll < cumulative) return family;
  }
  // rng() === 1 (or float drift) falls through to the last band.
  return FAMILY_WEIGHTS[FAMILY_WEIGHTS.length - 1].family;
}
