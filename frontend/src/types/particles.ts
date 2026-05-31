// Particle system types for retro pixel art effects

export interface BurstParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number; // Square size in pixels (2-6 for retro feel)
  color: string;
  life: number; // 0-1, fades out as it decreases
  maxLife: number; // Starting life value
  rotation: number;
  rotationSpeed: number;
  gravity: number;
}

export interface FloatingPixel {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  speedX: number;
  speedY: number;
  opacity: number;
  pulsePhase: number; // For subtle pulsing effect
}

export interface ParticleBurstConfig {
  x: number;
  y: number;
  color: string;
  count?: number;
  spread?: number; // How wide the burst spreads
  gravity?: number;
  particleSize?: number;
}

export type SlimeKingdomTheme = 'dark' | 'light';

export interface PixelBackgroundColors {
  // Dark mode - Slime dungeon
  dark: {
    base: string;
    brick: string;
    brickHighlight: string;
    banner: string;
    bannerDark: string;
    floatingPixels: string[];
  };
  // Light mode - Nature day (user preference)
  light: {
    base: string;
    brick: string;
    brickHighlight: string;
    banner: string;
    bannerDark: string;
    floatingPixels: string[];
  };
}

// Color palettes matching the Slime Kingdom theme
export const SLIME_KINGDOM_COLORS: PixelBackgroundColors = {
  dark: {
    base: '#1a1a2e', // Deep dungeon blue
    brick: '#16213e', // Slightly lighter blue
    brickHighlight: '#0f3460', // Highlight for brick edges
    banner: '#e94560', // Slime banner red
    bannerDark: '#8b1538', // Darker banner shadow
    floatingPixels: ['#87CEEB', '#98FB98', '#DDA0DD', '#F0E68C', '#FFA07A'],
  },
  light: {
    base: '#e8f5e9', // Light green nature base
    brick: '#c8e6c9', // Mossy stone
    brickHighlight: '#a5d6a7', // Lighter moss
    banner: '#66bb6a', // Nature green banner
    bannerDark: '#388e3c', // Darker green shadow
    floatingPixels: ['#81c784', '#64b5f6', '#ffb74d', '#ba68c8', '#4dd0e1'],
  },
};
