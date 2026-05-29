import { describe, it, expect } from 'vitest';
import {
  avatarConfigFromSeed,
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
