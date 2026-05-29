import { describe, it, expect } from 'vitest';
import { parseCharacterConfig } from './character';

const valid = {
  bodyShape: 'square',
  bodyColor: '#a78bfa',
  eyeStyle: 'sleepy',
  accessory: 'horn',
  accessoryColor: '#c4b5fd',
};

describe('parseCharacterConfig', () => {
  it('returns the config for valid input', () => {
    expect(parseCharacterConfig(valid)).toEqual(valid);
  });
  it('returns null for missing/invalid/extra-typed input', () => {
    expect(parseCharacterConfig(null)).toBeNull();
    expect(parseCharacterConfig(undefined)).toBeNull();
    expect(parseCharacterConfig({ ...valid, bodyShape: 'blob' })).toBeNull();
    expect(parseCharacterConfig({ ...valid, accessoryColor: '#123456' })).toBeNull();
    const { eyeStyle: _o, ...partial } = valid;
    expect(parseCharacterConfig(partial)).toBeNull();
  });
});
