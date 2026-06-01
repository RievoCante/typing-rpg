// XP formulas — mirrored from backend/src/core/xp.ts.
// Authoritative copy is on the server; these are client-side previews only.
// MUST stay in sync with the backend formulas (see CLAUDE.md critical rule).

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

// Per-session endless XP a player earns on a monster kill. Mirrors
// calculateXpDelta('endless', incorrectWords, wpm) on the backend, including
// the step penalties for mistakes. `wpm` should be the rounded WPM sent to
// the server so the previewed amount matches the awarded amount.
export function calculateEndlessXp(
  incorrectWords: number,
  wpm: number
): number {
  let base = ENDLESS_BASE_XP;
  if (incorrectWords > 8) base = 0;
  else if (incorrectWords >= 7) base *= 0.2;
  else if (incorrectWords >= 5) base *= 0.4;
  else if (incorrectWords >= 3) base *= 0.6;
  else if (incorrectWords >= 1) base *= 0.8;

  const wpmMult = Math.max(
    ENDLESS_WPM_FLOOR,
    Math.min(ENDLESS_WPM_CAP, wpm / ENDLESS_TARGET_WPM)
  );
  return Math.floor(base * wpmMult);
}
