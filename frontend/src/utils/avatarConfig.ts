// Deterministic, editor-free player avatar configuration for a humanoid
// warrior. Seeded from the user id so each player has a stable identity. These
// knobs are exactly what the customization editor (+ users.character
// persistence) exposes.

export type ArmorType = 'plate' | 'tunic' | 'heavy';
export type HelmetType = 'barbute' | 'horned' | 'crowned';

export interface PlayerAvatarConfig {
  armorType: ArmorType;
  armorColor: string; // hex #rrggbb, from ARMOR_COLORS
  helmetType: HelmetType;
  helmetColor: string; // hex #rrggbb, from ARMOR_COLORS (shared palette)
  skinTone: string; // hex #rrggbb, from SKIN_TONES
}

export const ARMOR_TYPES: ArmorType[] = ['plate', 'tunic', 'heavy'];
export const HELMET_TYPES: HelmetType[] = ['barbute', 'horned', 'crowned'];

// Shared 5-color metal/cloth palette for armor and helmet. Deliberately avoids
// pure boss-reds so players still read as allies (crimson is muted).
export const ARMOR_COLORS: string[] = [
  '#9aa4b2', // steel
  '#d4af37', // gold
  '#b23a48', // crimson
  '#3b5bdb', // royal blue
  '#2f9e69', // emerald
];

// Helmet shares the armor palette (one set of swatches in the UI).
export const HELMET_COLORS: string[] = ARMOR_COLORS;

export const SKIN_TONES: string[] = [
  '#f1c9a5', // light
  '#e0a878', // fair
  '#c68642', // tan
  '#8d5524', // brown
  '#5c3317', // deep
];

// Sensible neutral default warrior for users who have not customized.
export const DEFAULT_AVATAR_CONFIG: PlayerAvatarConfig = {
  armorType: 'plate',
  armorColor: '#9aa4b2',
  helmetType: 'barbute',
  helmetColor: '#9aa4b2',
  skinTone: '#e0a878',
};

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
    armorType: pick(ARMOR_TYPES, h, 1),
    armorColor: pick(ARMOR_COLORS, h, 2),
    helmetType: pick(HELMET_TYPES, h, 3),
    helmetColor: pick(HELMET_COLORS, h, 4),
    skinTone: pick(SKIN_TONES, h, 5),
  };
}

// Runtime guard for configs arriving from storage, the network, or teammates.
// IMPORTANT: keep the allowed values in sync with backend/src/core/character.ts.
// Colors are intentionally restricted to the fixed palettes — custom hex is not
// offered by the customizer. Configs in the old "blob" shape fail this guard and
// callers fall back to the seed/default, so legacy saves silently upgrade.
export function isValidAvatarConfig(x: unknown): x is PlayerAvatarConfig {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  const c = x as Record<string, unknown>;
  return (
    typeof c.armorType === 'string' &&
    (ARMOR_TYPES as string[]).includes(c.armorType) &&
    typeof c.armorColor === 'string' &&
    ARMOR_COLORS.includes(c.armorColor) &&
    typeof c.helmetType === 'string' &&
    (HELMET_TYPES as string[]).includes(c.helmetType) &&
    typeof c.helmetColor === 'string' &&
    HELMET_COLORS.includes(c.helmetColor) &&
    typeof c.skinTone === 'string' &&
    SKIN_TONES.includes(c.skinTone)
  );
}

// Resolve the config to render for a player: prefer a valid saved/received
// config, else fall back to the deterministic per-user seed.
export function resolveAvatarConfig(
  userId: string,
  saved?: PlayerAvatarConfig | null
): PlayerAvatarConfig {
  return saved && isValidAvatarConfig(saved)
    ? saved
    : avatarConfigFromSeed(userId);
}

// Parse + validate a JSON string from storage or an API field. Null on any
// failure so callers can treat "no custom config" uniformly.
export function parseStoredAvatarConfig(
  raw: string | null | undefined
): PlayerAvatarConfig | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return isValidAvatarConfig(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
