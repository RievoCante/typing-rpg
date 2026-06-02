// Mushroom type definitions and constants (procedural family — Phase 2b).

export type MushroomTypeEnum = 'normal' | 'mini-boss' | 'boss';

export interface MushroomType {
  type: MushroomTypeEnum;
  color: string; // cap color
  scale: number;
}

// Per-tier configs (cosmetic only; HP/combat unaffected).
export const MUSHROOM_CONFIGS: Record<MushroomTypeEnum, MushroomType> = {
  normal: {
    type: 'normal',
    color: '#e06666', // toadstool red
    scale: 0.9,
  },
  'mini-boss': {
    type: 'mini-boss',
    color: '#cc4125', // deeper red
    scale: 1.1,
  },
  boss: {
    type: 'boss',
    color: '#9b1d1d', // dark crimson
    scale: 1.35,
  },
};

// Idle bob + hit flash, tuned organic/cute.
export const MUSHROOM_ANIMATIONS = {
  IDLE_SPEED: 1.2,
  IDLE_HEIGHT: 0.12,
  FLASH_DURATION: 130,
};

// Cap-color randomization pool.
export const MUSHROOM_COLORS = [
  '#e06666', // red
  '#f6b26b', // orange
  '#ffd966', // yellow
  '#93c47d', // green
  '#76a5af', // teal
  '#c27ba0', // pink
  '#8e7cc3', // purple
];

export const MUSHROOM_SIZES = [
  0.8, // small
  1.0, // medium
  1.2, // large
];
