import { Color } from 'three';
import type { MonsterVariant } from '../context/GameContext';

// Shared glow config for monster variants, used by SlimeModel, GolemModel and
// the procedural models so elite/rare monsters read the same across families.
// Common has no glow (null). The Color instances are only ever read/copied
// (never mutated), so sharing single instances is safe.
//
// The glow is split in two so elite/rare LOOK luminous instead of getting
// repainted a flat colour: `baseIntensity` is a *subtle* body self-illum that
// keeps the model's texture/detail visible, while the real "glow" comes from a
// VariantAura (a colored cast light + additive halo behind the silhouette) —
// see VariantAura.tsx. `lightIntensity`/`halo*` drive that aura.
export interface VariantGlow {
  color: Color;
  baseIntensity: number; // body emissive — kept low so detail survives
  lightIntensity: number; // colored cast light in front of the model
  haloOpacity: number; // additive halo strength behind the model
  haloScale: number; // halo sprite size
  pulse: boolean;
}

export const VARIANT_GLOW: Record<MonsterVariant, VariantGlow | null> = {
  common: null,
  // amber
  elite: {
    color: new Color('#fbbf24'),
    baseIntensity: 0.22,
    lightIntensity: 1.6,
    haloOpacity: 0.55,
    haloScale: 3.4,
    pulse: false,
  },
  // violet
  rare: {
    color: new Color('#a78bfa'),
    baseIntensity: 0.3,
    lightIntensity: 2.2,
    haloOpacity: 0.72,
    haloScale: 3.8,
    pulse: true,
  },
};

// Emissive intensity for the subtle body self-illum at a given elapsed time
// (seconds). Rare pulses; elite is steady.
export const glowIntensity = (glow: VariantGlow, time: number): number =>
  glow.pulse
    ? glow.baseIntensity * (0.55 + 0.45 * Math.abs(Math.sin(time * 3)))
    : glow.baseIntensity;

// 0..1 pulse multiplier for the aura (cast light + halo). Steady (1) unless the
// variant pulses; matches the phase of glowIntensity so body + aura breathe
// together.
export const auraPulse = (glow: VariantGlow, time: number): number =>
  glow.pulse ? 0.6 + 0.4 * Math.abs(Math.sin(time * 3)) : 1;
