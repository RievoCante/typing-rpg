import type { MonsterTypeEnum } from '../context/GameContext';

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
