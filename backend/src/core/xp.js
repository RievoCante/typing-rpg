// XP utilities used by session handling
// Per-difficulty XP multiplier for endless mode. Harder word lists earn more
// because rarer/longer words also slow WPM (which lowers the WPM multiplier).
// MUST stay in sync with DIFFICULTY_XP_MULTIPLIER in
// frontend/src/utils/calculateXP.ts (see CLAUDE.md XP-sync rule).
export const DIFFICULTY_XP_MULTIPLIER = {
    beginner: 1.0,
    common: 1.5,
    intermediate: 2.0,
    advanced: 3.0,
};
const DEFAULT_DIFFICULTY = 'beginner';
// Per-mode config
const MODE_CONFIG = {
    // Endless: keep step penalties; modest WPM boost; difficulty-scaled reward
    endless: { base: 100, targetWpm: 60, wpmCap: 1.25, wpmFloor: 0.5, useStepPenalties: true, useDifficultyMultiplier: true },
    // Daily: base XP with WPM multiplier; no step penalties (expects wpm to be AVERAGE across 3 difficulties); not difficulty-scaled
    daily: { base: 500, targetWpm: 60, wpmCap: 1.5, wpmFloor: 0.5, useStepPenalties: false, useDifficultyMultiplier: false },
};
function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
}
export function calculateXpDelta(mode, incorrectWords, wpm, difficulty = DEFAULT_DIFFICULTY) {
    const cfg = MODE_CONFIG[mode];
    // Start with mode base
    let base = cfg.base;
    // Apply step penalties only for endless
    if (cfg.useStepPenalties) {
        if (incorrectWords > 8)
            base = 0;
        else if (incorrectWords >= 7)
            base *= 0.2;
        else if (incorrectWords >= 5)
            base *= 0.4;
        else if (incorrectWords >= 3)
            base *= 0.6;
        else if (incorrectWords >= 1)
            base *= 0.8;
    }
    // Word-list difficulty multiplier (endless only)
    const difficultyMult = cfg.useDifficultyMultiplier
        ? (DIFFICULTY_XP_MULTIPLIER[difficulty] ?? 1)
        : 1;
    // WPM multiplier (smooth, bounded)
    const wpmMult = clamp(wpm / cfg.targetWpm, cfg.wpmFloor, cfg.wpmCap);
    return Math.floor(base * difficultyMult * wpmMult);
}
// Raid XP — awarded only on victory, only to authenticated players.
// Mirrored in frontend/src/utils/calculateXP.ts.
export const RAID_BASE_XP = 300;
export const RAID_DAMAGE_MULTIPLIER = 5;
export function calculateRaidXp(damageDealt) {
    return RAID_BASE_XP + Math.floor(damageDealt * RAID_DAMAGE_MULTIPLIER);
}
export function xpToNextLevel(level) {
    if (level <= 1)
        return 20;
    let req = 20;
    for (let i = 2; i <= level; i++)
        req = Math.ceil(req * 1.2);
    return req;
}
export function applyXp(currentLevel, currentXp, xpDelta) {
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
