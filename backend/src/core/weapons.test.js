import { describe, it, expect } from 'vitest';
import { WEAPON_IDS, isWeaponId, parseUnlocked, mergeUnlocked, unlockSchema, selectSchema, } from './weapons';
describe('isWeaponId', () => {
    it('accepts every pool id', () => {
        for (const id of WEAPON_IDS)
            expect(isWeaponId(id)).toBe(true);
    });
    it('rejects unknown / non-string values', () => {
        expect(isWeaponId('not-a-weapon')).toBe(false);
        expect(isWeaponId('')).toBe(false);
        expect(isWeaponId(null)).toBe(false);
        expect(isWeaponId(42)).toBe(false);
        expect(isWeaponId(undefined)).toBe(false);
    });
});
describe('parseUnlocked', () => {
    it('returns [] for null/empty/garbage', () => {
        expect(parseUnlocked(null)).toEqual([]);
        expect(parseUnlocked(undefined)).toEqual([]);
        expect(parseUnlocked('')).toEqual([]);
        expect(parseUnlocked('not json')).toEqual([]);
        expect(parseUnlocked('{"a":1}')).toEqual([]); // not an array
    });
    it('parses a valid id array and drops invalid ids', () => {
        expect(parseUnlocked('["iron-sword","bogus","dragonfang"]')).toEqual([
            'iron-sword',
            'dragonfang',
        ]);
    });
});
describe('mergeUnlocked', () => {
    it('unions current + incoming, deduped, filtered, in canonical order', () => {
        const merged = mergeUnlocked(['dragonfang'], ['iron-sword', 'dragonfang', 'bogus', 'wooden-club']);
        // canonical WEAPON_IDS order: wooden-club, ..., iron-sword, ..., dragonfang
        expect(merged).toEqual(['wooden-club', 'iron-sword', 'dragonfang']);
    });
    it('ignores non-string / invalid incoming entries', () => {
        expect(mergeUnlocked([], ['iron-sword', 123, null, ''])).toEqual(['iron-sword']);
    });
    it('is idempotent when nothing new is added', () => {
        expect(mergeUnlocked(['iron-sword'], ['iron-sword'])).toEqual([
            'iron-sword',
        ]);
    });
});
describe('unlockSchema', () => {
    it('accepts a non-empty id array within the pool size', () => {
        expect(unlockSchema.safeParse({ weaponIds: ['iron-sword'] }).success).toBe(true);
    });
    it('rejects an empty array and an over-long array', () => {
        expect(unlockSchema.safeParse({ weaponIds: [] }).success).toBe(false);
        expect(unlockSchema.safeParse({
            weaponIds: new Array(WEAPON_IDS.length + 1).fill('iron-sword'),
        }).success).toBe(false);
    });
    it('rejects a missing field', () => {
        expect(unlockSchema.safeParse({}).success).toBe(false);
    });
});
describe('selectSchema', () => {
    it('accepts a string id or null', () => {
        expect(selectSchema.safeParse({ weaponId: 'iron-sword' }).success).toBe(true);
        expect(selectSchema.safeParse({ weaponId: null }).success).toBe(true);
    });
    it('rejects a numeric weaponId', () => {
        expect(selectSchema.safeParse({ weaponId: 5 }).success).toBe(false);
    });
});
