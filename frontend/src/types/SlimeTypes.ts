// Slime type definitions and constants

export type SlimeTypeEnum = 'normal' | 'mini-boss' | 'boss';

export interface SlimeType {
  type: SlimeTypeEnum;
  color: string;
  scale: number;
}

export interface SlimeState {
  health: number;          // 0-100 percentage
  isHit: boolean;         // For flash animation
  isDefeated: boolean;    // For disappear animation
}

// Slime configurations
export const SLIME_CONFIGS: Record<SlimeTypeEnum, SlimeType> = {
  'normal': {
    type: 'normal',
    color: '#87CEEB', // Light blue
    scale: 0.8
  },
  'mini-boss': {
    type: 'mini-boss',
    color: '#ef4444', // Red
    scale: 1.0
  },
  'boss': {
    type: 'boss',
    color: '#8b5cf6', // Purple
    scale: 1.3
  }
};

// Animation constants
export const SLIME_ANIMATIONS = {
  BOUNCE_SPEED: 1.5,        // Speed of idle bounce
  BOUNCE_HEIGHT: 0.15,      // Height of bounce
  FLASH_DURATION: 120,      // Duration of red flash in ms (snappier)
  DISAPPEAR_DURATION: 500,  // Duration of disappear animation in ms
}; 