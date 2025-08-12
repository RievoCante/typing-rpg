// XP utilities used by session handling

export type Mode = 'daily' | 'endless';

// Per-mode config
const MODE_CONFIG: Record<Mode, {
  base: number;                // base XP before multipliers
  targetWpm: number;           // target WPM for 1.0x multiplier
  wpmCap: number;              // maximum WPM multiplier
  wpmFloor: number;            // minimum WPM multiplier
  useStepPenalties: boolean;   // whether to apply mistake-based step penalties
}> = {
  // Endless: keep step penalties; modest WPM boost
  endless: { base: 100, targetWpm: 60, wpmCap: 1.25, wpmFloor: 0.5, useStepPenalties: true },
  // Daily: base XP with WPM multiplier; no step penalties (expects wpm to be AVERAGE across 3 difficulties)
  daily:   { base: 500,  targetWpm: 60, wpmCap: 1.5,  wpmFloor: 0.5, useStepPenalties: false },
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function calculateXpDelta(mode: Mode, incorrectWords: number, wpm: number): number {
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

  // WPM multiplier (smooth, bounded)
  const wpmMult = clamp(wpm / cfg.targetWpm, cfg.wpmFloor, cfg.wpmCap);

  return Math.floor(base * wpmMult);
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