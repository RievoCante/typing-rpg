// Maps the combo streak's crit chance to the named tiers ComboMeter shows
// (Combo / Heating / Hot / BLAZING) and to SFX parameters, so a hotter streak
// literally sounds hotter. Pure + unit-tested; sfxEngine consumes the params.

export type ComboTier = 'combo' | 'heating' | 'hot' | 'blazing';

// Thresholds mirror components/ComboMeter.tsx::tier so audio + visuals agree.
export function streakTierFromCritChance(critChance: number): ComboTier {
  if (critChance >= 0.75) return 'blazing';
  if (critChance >= 0.4) return 'hot';
  if (critChance > 0) return 'heating';
  return 'combo';
}

export interface SfxParams {
  pitchMult: number; // multiplies base note frequencies
  extraLayer: boolean; // adds a brighter octave layer at the top tier
}

const CRIT_PITCH: Record<ComboTier, number> = {
  combo: 1.0,
  heating: 1.12,
  hot: 1.26,
  blazing: 1.5,
};

export function critSfxParams(tier: ComboTier): SfxParams {
  return { pitchMult: CRIT_PITCH[tier], extraLayer: tier === 'blazing' };
}

const HIT_PITCH: Record<ComboTier, number> = {
  combo: 1.0,
  heating: 1.06,
  hot: 1.14,
  blazing: 1.24,
};

export function hitSfxParams(tier: ComboTier): SfxParams {
  return { pitchMult: HIT_PITCH[tier], extraLayer: tier === 'blazing' };
}
