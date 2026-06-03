import {
  Sword,
  Swords,
  Wand,
  Flame,
  Snowflake,
  Target,
  Gavel,
  Skull,
  type LucideIcon,
} from 'lucide-react';
import type { Weapon } from './weapons';

// Per-weapon-id Lucide glyph for the drop modal. This is a drop-in slot: swap
// for real PNG art later without touching the modal layout. Unknown ids fall
// back to a generic sword.
const ICON_BY_ID: Record<string, LucideIcon> = {
  'wooden-club': Gavel,
  'cracked-wand': Wand,
  'iron-sword': Sword,
  'hunters-bow': Target,
  'flaming-blade': Flame,
  'frost-spear': Snowflake,
  dragonfang: Swords,
  soulreaper: Skull,
};

export function weaponDropIcon(id: string): LucideIcon {
  return ICON_BY_ID[id] ?? Sword;
}

// Human-readable effect lines for a weapon — one per non-zero stat. Drives the
// drop modal's effect list (mirrors the loadout panel's stat summary, but one
// line per effect).
export function weaponEffectLines(weapon: Weapon): string[] {
  const lines: string[] = [];
  if (weapon.bonusDamage > 0) lines.push(`+${weapon.bonusDamage} Damage`);
  if (weapon.bonusCritChance > 0)
    lines.push(`+${Math.round(weapon.bonusCritChance * 100)}% Crit Chance`);
  if (weapon.critMultBonus > 0)
    lines.push(`+${weapon.critMultBonus}× Crit Damage`);
  return lines;
}
