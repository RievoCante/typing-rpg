// Golem type definitions and constants

export type GolemTypeEnum = 'normal' | 'mini-boss' | 'boss';

export interface GolemType {
  type: GolemTypeEnum;
  color: string;
  scale: number;
  rockCount: number; // Number of rock pieces in the golem
}

export interface GolemState {
  health: number; // 0-100 percentage
  isHit: boolean; // For flash animation
  isDefeated: boolean; // For crumble animation
}

// Golem configurations
export const GOLEM_CONFIGS: Record<GolemTypeEnum, GolemType> = {
  normal: {
    type: 'normal',
    color: '#8B7355', // Brown stone
    scale: 0.9,
    rockCount: 4,
  },
  'mini-boss': {
    type: 'mini-boss',
    color: '#696969', // Dark gray
    scale: 1.1,
    rockCount: 6,
  },
  boss: {
    type: 'boss',
    color: '#2F4F4F', // Dark slate
    scale: 1.4,
    rockCount: 8,
  },
};

// Animation constants - heavier, less bouncy than slimes
export const GOLEM_ANIMATIONS = {
  IDLE_SPEED: 0.8, // Slower idle movement
  IDLE_HEIGHT: 0.05, // Smaller bounce
  FLASH_DURATION: 150, // Slightly longer hit flash
  CRUMBLE_DURATION: 800, // Duration of crumble animation
};

// Rock/earth tone colors for randomization
export const GOLEM_COLORS = [
  '#8B4513', // Saddle brown
  '#A0522D', // Sienna
  '#8B7355', // Burlywood
  '#696969', // Dim gray
  '#808080', // Gray
  '#A9A9A9', // Dark gray
  '#2F4F4F', // Dark slate gray
  '#708090', // Slate gray
];

// Size variations
export const GOLEM_SIZES = [
  0.8, // Small
  1.0, // Medium (Normal)
  1.2, // Large
];
