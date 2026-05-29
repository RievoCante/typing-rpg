import { describe, it, expect } from 'vitest';
import {
  avatarConfigFromSeed,
  isValidAvatarConfig,
  resolveAvatarConfig,
  parseStoredAvatarConfig,
  BODY_SHAPES,
  EYE_STYLES,
  ACCESSORIES,
} from './avatarConfig';

describe('avatarConfigFromSeed', () => {
  it('returns a stable, exact config for a known seed (locks per-user identity)', () => {
    expect(avatarConfigFromSeed('user_2abc')).toEqual({
      bodyShape: 'square',
      bodyColor: '#fb923c',
      eyeStyle: 'dot',
      accessory: 'none',
      accessoryColor: '#fde047',
    });
  });

  it('always produces values from the allowed sets', () => {
    for (const seed of ['', 'a', 'guest-xy12', 'user_2abc', 'ZZZ', '0']) {
      const c = avatarConfigFromSeed(seed);
      expect(BODY_SHAPES).toContain(c.bodyShape);
      expect(EYE_STYLES).toContain(c.eyeStyle);
      expect(ACCESSORIES).toContain(c.accessory);
      expect(c.bodyColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(c.accessoryColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('produces variation across different seeds', () => {
    const seeds = Array.from({ length: 40 }, (_, i) => `user_${i}`);
    const shapes = new Set(seeds.map(s => avatarConfigFromSeed(s).bodyShape));
    const colors = new Set(seeds.map(s => avatarConfigFromSeed(s).bodyColor));
    const eyes = new Set(seeds.map(s => avatarConfigFromSeed(s).eyeStyle));
    const accessories = new Set(
      seeds.map(s => avatarConfigFromSeed(s).accessory)
    );
    expect(shapes.size).toBeGreaterThan(1);
    expect(colors.size).toBeGreaterThan(1);
    expect(eyes.size).toBeGreaterThan(1);
    expect(accessories.size).toBeGreaterThan(1);
  });
});

const valid = {
  bodyShape: 'round',
  bodyColor: '#38bdf8',
  eyeStyle: 'wide',
  accessory: 'crown',
  accessoryColor: '#fde047',
};

describe('isValidAvatarConfig', () => {
  it('accepts a fully valid config', () => {
    expect(isValidAvatarConfig(valid)).toBe(true);
  });
  it('rejects null/undefined/non-objects', () => {
    expect(isValidAvatarConfig(null)).toBe(false);
    expect(isValidAvatarConfig(undefined)).toBe(false);
    expect(isValidAvatarConfig('x')).toBe(false);
  });
  it('rejects unknown knob values', () => {
    expect(isValidAvatarConfig({ ...valid, bodyShape: 'triangle' })).toBe(
      false
    );
    expect(isValidAvatarConfig({ ...valid, bodyColor: '#000000' })).toBe(false);
  });
  it('rejects configs missing a key', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { accessory: _omit, ...partial } = valid;
    expect(isValidAvatarConfig(partial)).toBe(false);
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
      parseStoredAvatarConfig(JSON.stringify({ bodyShape: 'round' }))
    ).toBeNull();
  });
});
