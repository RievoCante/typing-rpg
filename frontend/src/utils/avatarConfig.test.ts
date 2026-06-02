import { describe, it, expect } from 'vitest';
import {
  avatarConfigFromSeed,
  isValidAvatarConfig,
  resolveAvatarConfig,
  parseStoredAvatarConfig,
  ARMOR_TYPES,
  HELMET_TYPES,
  ARMOR_COLORS,
  HELMET_COLORS,
  SKIN_TONES,
  DEFAULT_AVATAR_CONFIG,
} from './avatarConfig';

describe('avatarConfigFromSeed', () => {
  it('is deterministic for a given seed', () => {
    expect(avatarConfigFromSeed('user_2abc')).toEqual(
      avatarConfigFromSeed('user_2abc')
    );
  });

  it('always produces values from the allowed sets', () => {
    for (const seed of ['', 'a', 'guest-xy12', 'user_2abc', 'ZZZ', '0']) {
      const c = avatarConfigFromSeed(seed);
      expect(ARMOR_TYPES).toContain(c.armorType);
      expect(HELMET_TYPES).toContain(c.helmetType);
      expect(ARMOR_COLORS).toContain(c.armorColor);
      expect(HELMET_COLORS).toContain(c.helmetColor);
      expect(SKIN_TONES).toContain(c.skinTone);
    }
  });

  it('produces variation across different seeds', () => {
    const seeds = Array.from({ length: 40 }, (_, i) => `user_${i}`);
    const armor = new Set(seeds.map(s => avatarConfigFromSeed(s).armorType));
    const colors = new Set(seeds.map(s => avatarConfigFromSeed(s).armorColor));
    const helmets = new Set(seeds.map(s => avatarConfigFromSeed(s).helmetType));
    const skins = new Set(seeds.map(s => avatarConfigFromSeed(s).skinTone));
    expect(armor.size).toBeGreaterThan(1);
    expect(colors.size).toBeGreaterThan(1);
    expect(helmets.size).toBeGreaterThan(1);
    expect(skins.size).toBeGreaterThan(1);
  });
});

const valid = {
  armorType: 'plate',
  armorColor: ARMOR_COLORS[0],
  helmetType: 'crowned',
  helmetColor: HELMET_COLORS[1],
  skinTone: SKIN_TONES[2],
};

describe('isValidAvatarConfig', () => {
  it('accepts a fully valid config', () => {
    expect(isValidAvatarConfig(valid)).toBe(true);
  });
  it('accepts the default config', () => {
    expect(isValidAvatarConfig(DEFAULT_AVATAR_CONFIG)).toBe(true);
  });
  it('rejects null/undefined/non-objects', () => {
    expect(isValidAvatarConfig(null)).toBe(false);
    expect(isValidAvatarConfig(undefined)).toBe(false);
    expect(isValidAvatarConfig('x')).toBe(false);
  });
  it('rejects unknown knob values', () => {
    expect(isValidAvatarConfig({ ...valid, armorType: 'mage' })).toBe(false);
    expect(isValidAvatarConfig({ ...valid, armorColor: '#000000' })).toBe(
      false
    );
  });
  it('rejects configs missing a key', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { helmetType: _omit, ...partial } = valid;
    expect(isValidAvatarConfig(partial)).toBe(false);
  });
  it('rejects the legacy blob config shape', () => {
    expect(
      isValidAvatarConfig({
        bodyShape: 'square',
        bodyColor: '#a78bfa',
        eyeStyle: 'sleepy',
        accessory: 'horn',
        accessoryColor: '#c4b5fd',
      })
    ).toBe(false);
  });
});

describe('resolveAvatarConfig', () => {
  it('returns the saved config when valid', () => {
    expect(resolveAvatarConfig('user_x', valid)).toEqual(valid);
  });
  it('falls back to the seed when saved is null/invalid', () => {
    expect(resolveAvatarConfig('user_2abc', null)).toEqual(
      avatarConfigFromSeed('user_2abc')
    );
    expect(resolveAvatarConfig('user_2abc', { bad: true } as never)).toEqual(
      avatarConfigFromSeed('user_2abc')
    );
  });
  it('falls back to the seed when saved is omitted (undefined)', () => {
    expect(resolveAvatarConfig('user_2abc')).toEqual(
      avatarConfigFromSeed('user_2abc')
    );
  });
  it('rejects array input (treated as invalid)', () => {
    expect(resolveAvatarConfig('user_2abc', [] as never)).toEqual(
      avatarConfigFromSeed('user_2abc')
    );
  });
});

describe('parseStoredAvatarConfig', () => {
  it('parses a valid JSON string', () => {
    expect(parseStoredAvatarConfig(JSON.stringify(valid))).toEqual(valid);
  });
  it('returns null for null, empty, malformed, or invalid JSON', () => {
    expect(parseStoredAvatarConfig(null)).toBeNull();
    expect(parseStoredAvatarConfig('')).toBeNull();
    expect(parseStoredAvatarConfig('{not json')).toBeNull();
    expect(
      parseStoredAvatarConfig(JSON.stringify({ armorType: 'plate' }))
    ).toBeNull();
  });
});
