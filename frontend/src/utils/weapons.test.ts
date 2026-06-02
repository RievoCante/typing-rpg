import { describe, it, expect } from 'vitest';
import {
  WEAPON_POOL,
  weaponPower,
  rollWeaponDrop,
  type Weapon,
} from './weapons';

// Deterministic rng that yields a fixed sequence, then repeats the last value.
const seq = (...vals: number[]) => {
  let i = 0;
  return () => vals[Math.min(i++, vals.length - 1)];
};

const find = (id: string): Weapon =>
  Object.values(WEAPON_POOL)
    .flat()
    .find(w => w.id === id)!;

describe('weaponPower', () => {
  it('treats no weapon (Fists) as 0', () => {
    expect(weaponPower(null)).toBe(0);
  });

  it('orders strictly by rarity rank first', () => {
    const common = weaponPower(find('wooden-club'));
    const rare = weaponPower(find('iron-sword'));
    const epic = weaponPower(find('flaming-blade'));
    const legendary = weaponPower(find('dragonfang'));
    expect(common).toBeLessThan(rare);
    expect(rare).toBeLessThan(epic);
    expect(epic).toBeLessThan(legendary);
  });

  it('any weapon outranks Fists', () => {
    expect(weaponPower(find('cracked-wand'))).toBeGreaterThan(
      weaponPower(null)
    );
  });
});

describe('rollWeaponDrop', () => {
  it('common monsters usually drop nothing (8% chance)', () => {
    // First draw is the drop roll; >= 0.08 → no drop.
    expect(rollWeaponDrop('common', seq(0.5))).toBeNull();
    expect(rollWeaponDrop('common', seq(0.08))).toBeNull(); // boundary: not < 0.08
  });

  it('rare monsters always drop (guaranteed jackpot)', () => {
    // Drop roll can be anything in [0,1) and still drops (chance = 1).
    const w = rollWeaponDrop('rare', seq(0.99, 0.0, 0.0));
    expect(w).not.toBeNull();
  });

  it('weights rarity by monster variant (elite bands)', () => {
    // draws: [drop=0 (<0.35 → drops), rarity, pool=0]
    expect(rollWeaponDrop('elite', seq(0, 0.1, 0))?.rarity).toBe('common'); // <0.30
    expect(rollWeaponDrop('elite', seq(0, 0.5, 0))?.rarity).toBe('rare'); // <0.75
    expect(rollWeaponDrop('elite', seq(0, 0.8, 0))?.rarity).toBe('epic'); // <0.97
    expect(rollWeaponDrop('elite', seq(0, 0.99, 0))?.rarity).toBe('legendary');
  });

  it('rare monsters never drop common weapons', () => {
    for (const r of [0, 0.34, 0.5, 0.99]) {
      expect(rollWeaponDrop('rare', seq(0.0, r, 0))?.rarity).not.toBe('common');
    }
  });

  it('picks within the rarity pool by the third draw', () => {
    expect(rollWeaponDrop('elite', seq(0, 0.5, 0))?.id).toBe('iron-sword');
    expect(rollWeaponDrop('elite', seq(0, 0.5, 0.99))?.id).toBe('hunters-bow');
  });
});
