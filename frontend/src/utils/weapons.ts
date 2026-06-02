import type { MonsterVariant } from '../context/GameContext';

// Per-run weapon loot (Endless). Weapons drop from kills, auto-equip if better,
// and modify combat damage/crit via rollDamage. No weapon = "Fists" (null).
// Frontend-only + per-run: cleared on death/restart, never persisted, so this
// never touches the server-authoritative XP pipeline.

export type WeaponRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface Weapon {
  id: string;
  name: string;
  rarity: WeaponRarity;
  bonusDamage: number; // flat add to base hit damage
  bonusCritChance: number; // added to streak crit chance (0–1)
  critMultBonus: number; // added to CRIT_MULT on a crit
}

const RARITY_RANK: Record<WeaponRarity, number> = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
};

// Tailwind text-color class per rarity, shared by the weapon slot + drop popup.
export const RARITY_COLOR: Record<WeaponRarity, string> = {
  common: 'text-gray-300',
  rare: 'text-sky-400',
  epic: 'text-violet-400',
  legendary: 'text-amber-400',
};

// Fixed pool, 2 weapons per rarity. Kept small + readable; Phase 3b can expand.
export const WEAPON_POOL: Record<WeaponRarity, Weapon[]> = {
  common: [
    {
      id: 'wooden-club',
      name: 'Wooden Club',
      rarity: 'common',
      bonusDamage: 1,
      bonusCritChance: 0,
      critMultBonus: 0,
    },
    {
      id: 'cracked-wand',
      name: 'Cracked Wand',
      rarity: 'common',
      bonusDamage: 0,
      bonusCritChance: 0.04,
      critMultBonus: 0,
    },
  ],
  rare: [
    {
      id: 'iron-sword',
      name: 'Iron Sword',
      rarity: 'rare',
      bonusDamage: 2,
      bonusCritChance: 0.03,
      critMultBonus: 0,
    },
    {
      id: 'hunters-bow',
      name: "Hunter's Bow",
      rarity: 'rare',
      bonusDamage: 1,
      bonusCritChance: 0.08,
      critMultBonus: 0,
    },
  ],
  epic: [
    {
      id: 'flaming-blade',
      name: 'Flaming Blade',
      rarity: 'epic',
      bonusDamage: 3,
      bonusCritChance: 0.06,
      critMultBonus: 0.5,
    },
    {
      id: 'frost-spear',
      name: 'Frost Spear',
      rarity: 'epic',
      bonusDamage: 4,
      bonusCritChance: 0.04,
      critMultBonus: 0,
    },
  ],
  legendary: [
    {
      id: 'dragonfang',
      name: 'Dragonfang',
      rarity: 'legendary',
      bonusDamage: 5,
      bonusCritChance: 0.1,
      critMultBonus: 1,
    },
    {
      id: 'soulreaper',
      name: 'Soulreaper',
      rarity: 'legendary',
      bonusDamage: 4,
      bonusCritChance: 0.15,
      critMultBonus: 1.5,
    },
  ],
};

// Flat list of every weapon in the pool, ordered by rarity rank. Used by the
// persistent vault UI (Phase 3b) and loadout lookup.
export const ALL_WEAPONS: Weapon[] = (
  ['common', 'rare', 'epic', 'legendary'] as WeaponRarity[]
).flatMap(rarity => WEAPON_POOL[rarity]);

// Stable id list. SYNC RULE: must match backend core/weapons.ts WEAPON_IDS
// (guarded by backend weapons.sync.test.ts).
export const WEAPON_IDS: string[] = ALL_WEAPONS.map(w => w.id);

// Resolve a weapon by id (e.g. a persisted loadout id). null = Fists / unknown.
export const getWeaponById = (id: string | null | undefined): Weapon | null =>
  id ? (ALL_WEAPONS.find(w => w.id === id) ?? null) : null;

// Comparable power score for auto-equip-if-better. Rarity dominates, then a
// weighted stat sum. Fists (null) = 0.
export const weaponPower = (w: Weapon | null): number => {
  if (!w) return 0;
  return (
    RARITY_RANK[w.rarity] * 100 +
    w.bonusDamage * 10 +
    w.bonusCritChance * 100 +
    w.critMultBonus * 15
  );
};

// Drop chance (any weapon) per monster variant — rares are a guaranteed jackpot.
const DROP_CHANCE: Record<MonsterVariant, number> = {
  common: 0.08,
  elite: 0.35,
  rare: 1,
};

// Rarity tables per variant as ordered [rarity, cumulativeThreshold] pairs; the
// first whose threshold a [0,1) roll falls under is chosen. Better monsters
// skew toward better rarities. Each table's last threshold is 1.
const RARITY_TABLE: Record<MonsterVariant, Array<[WeaponRarity, number]>> = {
  common: [
    ['common', 0.7],
    ['rare', 0.95],
    ['epic', 1.0],
  ], // no legendary from common monsters
  elite: [
    ['common', 0.3],
    ['rare', 0.75],
    ['epic', 0.97],
    ['legendary', 1.0],
  ],
  rare: [
    ['rare', 0.35],
    ['epic', 0.85],
    ['legendary', 1.0],
  ], // no common from rare monsters
};

// Roll a weapon drop for a kill of the given monster variant. Returns a Weapon
// or null (no drop). rng injectable for tests; uses up to 3 draws (drop?,
// rarity, which-in-pool).
export function rollWeaponDrop(
  variant: MonsterVariant,
  rng: () => number = Math.random
): Weapon | null {
  if (rng() >= DROP_CHANCE[variant]) return null;

  const r = rng();
  const table = RARITY_TABLE[variant];
  let rarity: WeaponRarity = table[table.length - 1][0];
  for (const [rar, threshold] of table) {
    if (r < threshold) {
      rarity = rar;
      break;
    }
  }

  const pool = WEAPON_POOL[rarity];
  const idx = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
  return pool[idx];
}
