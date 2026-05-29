// Deterministic, editor-free player avatar configuration. Seeded from the
// user id so each player has a stable identity. These knobs are exactly what
// a future customization editor (+ users.character persistence) will expose.

export type BodyShape = 'round' | 'square';
export type EyeStyle = 'dot' | 'wide' | 'sleepy';
export type Accessory = 'none' | 'antenna' | 'horn' | 'crown';

export interface PlayerAvatarConfig {
  bodyShape: BodyShape;
  bodyColor: string; // hex #rrggbb
  eyeStyle: EyeStyle;
  accessory: Accessory;
  accessoryColor: string; // hex #rrggbb
}

export const BODY_SHAPES: BodyShape[] = ['round', 'square'];
export const EYE_STYLES: EyeStyle[] = ['dot', 'wide', 'sleepy'];
export const ACCESSORIES: Accessory[] = ['none', 'antenna', 'horn', 'crown'];

// Friendly palette — deliberately avoids the boss reds so players read as allies.
export const BODY_COLORS: string[] = [
  '#38bdf8', // sky
  '#34d399', // emerald
  '#a78bfa', // violet
  '#fbbf24', // amber
  '#f472b6', // pink
  '#22d3ee', // cyan
  '#fb923c', // orange
  '#4ade80', // green
];

export const ACCESSORY_COLORS: string[] = [
  '#f8fafc', // near-white
  '#fde047', // gold
  '#fca5a5', // soft red
  '#c4b5fd', // lilac
];

// 32-bit string hash (same base algorithm as the old pickEmoji, so existing
// users keep a consistent identity feel; extended to drive multiple knobs).
function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

// Derive an independent index per knob by mixing the base hash with a salt,
// so two knobs don't move in lockstep.
function pick<T>(arr: T[], hash: number, salt: number): T {
  const mixed = ((hash ^ (salt * 2654435761)) >>> 0) % arr.length;
  return arr[mixed];
}

export function avatarConfigFromSeed(seed: string): PlayerAvatarConfig {
  const h = hashSeed(seed);
  return {
    bodyShape: pick(BODY_SHAPES, h, 1),
    bodyColor: pick(BODY_COLORS, h, 2),
    eyeStyle: pick(EYE_STYLES, h, 3),
    accessory: pick(ACCESSORIES, h, 4),
    accessoryColor: pick(ACCESSORY_COLORS, h, 5),
  };
}
