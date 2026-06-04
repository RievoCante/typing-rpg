// XP formulas — mirrored from backend/src/core/xp.ts.
// Authoritative copy is on the server; these are client-side previews only.
// MUST stay in sync with the backend formulas (see CLAUDE.md critical rule).

import type { EndlessDifficulty } from '../hooks/useEndlessSettings';
import type { MonsterVariant } from '../context/GameContext';

export const RAID_BASE_XP = 300;
export const RAID_DAMAGE_MULTIPLIER = 5;

export function calculateRaidXp(damageDealt: number): number {
  return RAID_BASE_XP + Math.floor(damageDealt * RAID_DAMAGE_MULTIPLIER);
}

// Endless config — mirrors MODE_CONFIG.endless in backend xp.ts.
const ENDLESS_BASE_XP = 100;
const ENDLESS_TARGET_WPM = 60;
const ENDLESS_WPM_CAP = 1.25;
const ENDLESS_WPM_FLOOR = 0.5;

// Per-difficulty XP multiplier for endless mode. Harder word lists earn more
// because rarer/longer words also slow WPM (which lowers the WPM multiplier).
// MUST stay in sync with DIFFICULTY_XP_MULTIPLIER in backend/src/core/xp.ts
// (see CLAUDE.md XP-sync rule).
export const DIFFICULTY_XP_MULTIPLIER: Record<EndlessDifficulty, number> = {
  beginner: 1.0,
  common: 1.5,
  intermediate: 2.0,
  advanced: 3.0,
};

// Per-rarity XP multiplier for endless kills. Rarer monsters have more HP so
// they take longer to kill; the reward scales to match. Elite is the prestige
// tier and pays the most. MUST stay in sync with VARIANT_XP_MULTIPLIER in
// backend/src/core/xp.ts (see CLAUDE.md XP-sync rule).
export const VARIANT_XP_MULTIPLIER: Record<MonsterVariant, number> = {
  common: 1.0,
  elite: 3.0,
  rare: 1.75,
};

// Per-session endless XP a player earns on a monster kill. Mirrors
// calculateXpDelta('endless', incorrectWords, wpm, difficulty, variant) on the
// backend, including the step penalties for mistakes, the difficulty multiplier,
// and the monster-rarity multiplier. `wpm` should be the rounded WPM sent to the
// server so the previewed amount matches the awarded amount.
export function calculateEndlessXp(
  incorrectWords: number,
  wpm: number,
  difficulty: EndlessDifficulty = 'beginner',
  variant: MonsterVariant = 'common'
): number {
  let base = ENDLESS_BASE_XP;
  if (incorrectWords > 8) base = 0;
  else if (incorrectWords >= 7) base *= 0.2;
  else if (incorrectWords >= 5) base *= 0.4;
  else if (incorrectWords >= 3) base *= 0.6;
  else if (incorrectWords >= 1) base *= 0.8;

  const difficultyMult = DIFFICULTY_XP_MULTIPLIER[difficulty] ?? 1;
  const variantMult = VARIANT_XP_MULTIPLIER[variant] ?? 1;

  const wpmMult = Math.max(
    ENDLESS_WPM_FLOOR,
    Math.min(ENDLESS_WPM_CAP, wpm / ENDLESS_TARGET_WPM)
  );
  return Math.floor(base * difficultyMult * wpmMult * variantMult);
}
