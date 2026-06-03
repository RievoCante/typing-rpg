import { describe, it, expect } from 'vitest';
import { parseCharacterConfig } from './character';
const valid = {
    armorType: 'heavy',
    armorColor: '#3b5bdb',
    helmetType: 'horned',
    helmetColor: '#d4af37',
    skinTone: '#8d5524',
};
describe('parseCharacterConfig', () => {
    it('returns the config for valid input', () => {
        expect(parseCharacterConfig(valid)).toEqual(valid);
    });
    it('returns null for missing/invalid input', () => {
        expect(parseCharacterConfig(null)).toBeNull();
        expect(parseCharacterConfig(undefined)).toBeNull();
        expect(parseCharacterConfig({ ...valid, armorType: 'mage' })).toBeNull();
        expect(parseCharacterConfig({ ...valid, helmetColor: '#123456' })).toBeNull();
        expect(parseCharacterConfig({ ...valid, skinTone: '#000000' })).toBeNull();
        const { helmetType: _o, ...partial } = valid;
        expect(parseCharacterConfig(partial)).toBeNull();
    });
    it('rejects extra/unknown fields (.strict)', () => {
        expect(parseCharacterConfig({ ...valid, cape: 'red' })).toBeNull();
    });
    it('rejects the legacy blob config shape', () => {
        expect(parseCharacterConfig({
            bodyShape: 'square',
            bodyColor: '#a78bfa',
            eyeStyle: 'sleepy',
            accessory: 'horn',
            accessoryColor: '#c4b5fd',
        })).toBeNull();
    });
});
