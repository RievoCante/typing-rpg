// Raid XP — mirrored from backend/src/core/xp.ts.
// Authoritative copy is on the server; this is for client-side preview only.
// MUST stay in sync with the backend formula (see CLAUDE.md critical rule).

export const RAID_BASE_XP = 300;
export const RAID_DAMAGE_MULTIPLIER = 5;

export function calculateRaidXp(damageDealt: number): number {
  return RAID_BASE_XP + Math.floor(damageDealt * RAID_DAMAGE_MULTIPLIER);
}
