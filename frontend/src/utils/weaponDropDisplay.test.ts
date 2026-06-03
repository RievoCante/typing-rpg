import { describe, it, expect } from 'vitest';
import { weaponDropIcon, weaponEffectLines } from './weaponDropDisplay';
import { WEAPON_IDS, ALL_WEAPONS, type Weapon } from './weapons';

const byId = (id: string): Weapon =>
  ALL_WEAPONS.find(w => w.id === id) as Weapon;

describe('weaponEffectLines', () => {
  it('lists only non-zero stats, one line each', () => {
    expect(weaponEffectLines(byId('dragonfang'))).toEqual([
      '+5 Damage',
      '+10% Crit Chance',
      '+1× Crit Damage',
    ]);
  });

  it('omits zero stats', () => {
    expect(weaponEffectLines(byId('wooden-club'))).toEqual(['+1 Damage']);
    expect(weaponEffectLines(byId('cracked-wand'))).toEqual([
      '+4% Crit Chance',
    ]);
  });

  it('returns an empty array when a weapon has no bonuses', () => {
    const none: Weapon = {
      id: 'x',
      name: 'X',
      rarity: 'common',
      bonusDamage: 0,
      bonusCritChance: 0,
      critMultBonus: 0,
    };
    expect(weaponEffectLines(none)).toEqual([]);
  });
});

describe('weaponDropIcon', () => {
  it('returns a component for every weapon id', () => {
    for (const id of WEAPON_IDS) {
      expect(typeof weaponDropIcon(id)).toBe('object'); // lucide forwardRef component
    }
  });

  it('falls back to a default for unknown ids', () => {
    expect(weaponDropIcon('not-a-weapon')).toBeDefined();
  });
});
