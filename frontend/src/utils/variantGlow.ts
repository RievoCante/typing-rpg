import { Color } from 'three';
import type { MonsterVariant } from '../context/GameContext';

// Shared emissive-glow config for monster variants, used by SlimeModel and
// GolemModel so elite/rare monsters read the same across families. Common has
// no glow (null). The Color instances are only ever read/copied by the models
// (never mutated), so sharing single instances is safe.
export interface VariantGlow {
  color: Color;
  baseIntensity: number;
  pulse: boolean;
}

export const VARIANT_GLOW: Record<MonsterVariant, VariantGlow | null> = {
  common: null,
  elite: { color: new Color('#fbbf24'), baseIntensity: 0.6, pulse: false }, // amber
  rare: { color: new Color('#a78bfa'), baseIntensity: 0.85, pulse: true }, // violet
};

// Emissive intensity for a glow at a given elapsed time (seconds). Rare pulses;
// elite is steady.
export const glowIntensity = (glow: VariantGlow, time: number): number =>
  glow.pulse
    ? glow.baseIntensity * (0.55 + 0.45 * Math.abs(Math.sin(time * 3)))
    : glow.baseIntensity;
