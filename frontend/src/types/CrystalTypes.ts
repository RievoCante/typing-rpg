// Crystal type definitions and constants (procedural family — Phase 2b).

export type CrystalTypeEnum = 'normal' | 'mini-boss' | 'boss';

export interface CrystalType {
  type: CrystalTypeEnum;
  color: string;
  scale: number;
}

// Per-tier configs (cosmetic only; HP/combat unaffected).
export const CRYSTAL_CONFIGS: Record<CrystalTypeEnum, CrystalType> = {
  normal: {
    type: 'normal',
    color: '#7dd3fc', // sky
    scale: 0.95,
  },
  'mini-boss': {
    type: 'mini-boss',
    color: '#c084fc', // violet
    scale: 1.15,
  },
  boss: {
    type: 'boss',
    color: '#f472b6', // magenta
    scale: 1.4,
  },
};

// Slow rotate + subtle shimmer; flash slightly longer (glassy).
export const CRYSTAL_ANIMATIONS = {
  IDLE_SPEED: 0.9,
  IDLE_HEIGHT: 0.08,
  FLASH_DURATION: 140,
};

// Gem-tone randomization pool.
export const CRYSTAL_COLORS = [
  '#7dd3fc', // sky
  '#67e8f9', // cyan
  '#a5b4fc', // indigo
  '#c084fc', // violet
  '#f0abfc', // fuchsia
  '#f472b6', // pink
  '#5eead4', // teal
];

export const CRYSTAL_SIZES = [
  1.0, // small
  1.2, // medium
  1.5, // large
];
