// Dungeon colour palette: extends the existing Slime Kingdom theme colours with
// prop colours, plus a brightness helper used for depth shading.

import {
  SLIME_KINGDOM_COLORS,
  type SlimeKingdomTheme,
} from '../../types/particles';

export interface DungeonPalette {
  base: string;
  brick: string;
  brickHi: string;
  mortar: string;
  banner: string;
  bannerDark: string;
  floatingPixels: string[];
  // Prop colours (mostly theme-independent).
  woodLid: string;
  wood: string;
  woodDark: string;
  woodBody: string;
  gold: string;
  bone: string;
  socket: string;
  ratBody: string;
  ratDark: string;
  ratNose: string;
  flame: string;
  flameMid: string;
  flameCore: string;
  torchWood: string;
  web: string;
}

export function getDungeonPalette(theme: SlimeKingdomTheme): DungeonPalette {
  const c = SLIME_KINGDOM_COLORS[theme];
  return {
    base: c.base,
    brick: c.brick,
    brickHi: c.brickHighlight,
    mortar: theme === 'dark' ? '#0a0a18' : '#8aa88a',
    banner: c.banner,
    bannerDark: c.bannerDark,
    floatingPixels: c.floatingPixels,
    woodLid: '#8a5a2a',
    wood: '#7a4a22',
    woodDark: '#4a2f14',
    woodBody: '#6b4220',
    gold: '#f5c542',
    bone: '#e8e6d2',
    socket: '#16121f',
    ratBody: '#6b6b73',
    ratDark: '#48484f',
    ratNose: '#caa0a0',
    flame: '#ff7b29',
    flameMid: '#ffb347',
    flameCore: '#fff3b0',
    torchWood: '#3a2614',
    web: 'rgba(220,225,235,0.16)',
  };
}

// Multiply a #rrggbb colour's brightness by `f` (clamped). Used for depth shading.
export function shade(hex: string, f: number): string {
  const h = hex.replace('#', '');
  const r = Math.min(255, Math.round(parseInt(h.slice(0, 2), 16) * f));
  const g = Math.min(255, Math.round(parseInt(h.slice(2, 4), 16) * f));
  const b = Math.min(255, Math.round(parseInt(h.slice(4, 6), 16) * f));
  return `rgb(${r}, ${g}, ${b})`;
}
