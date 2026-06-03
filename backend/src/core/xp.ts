// XP utilities used by session handling

export type Mode = 'daily' | 'endless';

// Endless word-list difficulty. MUST stay in sync with the frontend
// EndlessDifficulty type (frontend/src/hooks/useEndlessSettings.ts).
export type EndlessDifficulty =
  | 'beginner'
  | 'common'
  | 'intermediate'
  | 'advanced';

// Per-difficulty XP multiplier for endless mode. Harder word lists earn more
// because rarer/longer words also slow WPM (which lowers the WPM multiplier).
// MUST stay in sync with DIFFICULTY_XP_MULTIPLIER in
// frontend/src/utils/calculateXP.ts (see CLAUDE.md XP-sync rule).
export const DIFFICULTY_XP_MULTIPLIER: Record<EndlessDifficulty, number> = {
  beginner: 1.0,
  common: 1.5,
  intermediate: 2.0,
  advanced: 3.0,
};

const DEFAULT_DIFFICULTY: EndlessDifficulty = 'beginner';

// Monster rarity tier (endless). MUST stay in sync with MonsterVariant in
// frontend/src/context/GameContext.ts.
export type MonsterVariant = 'common' | 'elite' | 'rare';

// Per-rarity XP multiplier for endless kills. Rarer monsters carry more HP
// (VARIANT_HP_MULT in frontend combatTuning.ts) so they take longer to kill —
// the reward scales to match the effort. Elite is the prestige/jackpot tier and
// pays the most. MUST stay in sync with VARIANT_XP_MULTIPLIER in
// frontend/src/utils/calculateXP.ts (see CLAUDE.md XP-sync rule).
export const VARIANT_XP_MULTIPLIER: Record<MonsterVariant, number> = {
  common: 1.0,
  elite: 3.0,
  rare: 1.75,
};

const DEFAULT_VARIANT: MonsterVariant = 'common';

// Per-mode config
const MODE_CONFIG: Record<Mode, {
  base: number;                     // base XP before multipliers
  targetWpm: number;                // target WPM for 1.0x multiplier
  wpmCap: number;                   // maximum WPM multiplier
  wpmFloor: number;                 // minimum WPM multiplier
  useStepPenalties: boolean;        // whether to apply mistake-based step penalties
  useDifficultyMultiplier: boolean; // whether word-list difficulty scales XP
  useVariantMultiplier: boolean;    // whether monster rarity scales XP
}> = {
  // Endless: keep step penalties; modest WPM boost; difficulty-scaled reward; rarity-scaled reward
  endless: { base: 100, targetWpm: 60, wpmCap: 1.25, wpmFloor: 0.5, useStepPenalties: true, useDifficultyMultiplier: true, useVariantMultiplier: true },
  // Daily: base XP with WPM multiplier; no step penalties (expects wpm to be AVERAGE across 3 difficulties); not difficulty-scaled; no monster rarity
  daily:   { base: 500,  targetWpm: 60, wpmCap: 1.5,  wpmFloor: 0.5, useStepPenalties: false, useDifficultyMultiplier: false, useVariantMultiplier: false },
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function calculateXpDelta(
  mode: Mode,
  incorrectWords: number,
  wpm: number,
  difficulty: EndlessDifficulty = DEFAULT_DIFFICULTY,
  variant: MonsterVariant = DEFAULT_VARIANT
): number {
  const cfg = MODE_CONFIG[mode];

  // Start with mode base
  let base = cfg.base;

  // Apply step penalties only for endless
  if (cfg.useStepPenalties) {
    if (incorrectWords > 8) base = 0;
    else if (incorrectWords >= 7) base *= 0.2;
    else if (incorrectWords >= 5) base *= 0.4;
    else if (incorrectWords >= 3) base *= 0.6;
    else if (incorrectWords >= 1) base *= 0.8;
  }

  // Word-list difficulty multiplier (endless only)
  const difficultyMult = cfg.useDifficultyMultiplier
    ? (DIFFICULTY_XP_MULTIPLIER[difficulty] ?? 1)
    : 1;

  // Monster rarity multiplier (endless only)
  const variantMult = cfg.useVariantMultiplier
    ? (VARIANT_XP_MULTIPLIER[variant] ?? 1)
    : 1;

  // WPM multiplier (smooth, bounded)
  const wpmMult = clamp(wpm / cfg.targetWpm, cfg.wpmFloor, cfg.wpmCap);

  return Math.floor(base * difficultyMult * wpmMult * variantMult);
}

// Raid XP — awarded only on victory, only to authenticated players.
// Mirrored in frontend/src/utils/calculateXP.ts.
export const RAID_BASE_XP = 300;
export const RAID_DAMAGE_MULTIPLIER = 5;

export function calculateRaidXp(damageDealt: number): number {
  return RAID_BASE_XP + Math.floor(damageDealt * RAID_DAMAGE_MULTIPLIER);
}

export function xpToNextLevel(level: number): number {
  if (level <= 1) return 20;
  let req = 20;
  for (let i = 2; i <= level; i++) req = Math.ceil(req * 1.2);
  return req;
}

export function applyXp(currentLevel: number, currentXp: number, xpDelta: number) {
  let newLevel = currentLevel;
  let newXp = currentXp + xpDelta;
  let needed = xpToNextLevel(newLevel);
  while (newXp >= needed) {
    newXp -= needed;
    newLevel += 1;
    needed = xpToNextLevel(newLevel);
  }
  return { level: newLevel, xp: newXp };
}