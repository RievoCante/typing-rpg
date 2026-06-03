// Persistent weapon vault (Phase 3b). Pure helpers + request schemas for the
// /me/vault endpoints. The vault is which of the fixed weapon pool a user has
// unlocked, plus one selected loadout id.
//
// IMPORTANT (sync rule): WEAPON_IDS MUST match the weapon ids in
// frontend/src/utils/weapons.ts (WEAPON_POOL). Guarded by weapons.sync.test.ts.
import { z } from 'zod';
export const WEAPON_IDS = [
    'wooden-club',
    'cracked-wand',
    'iron-sword',
    'hunters-bow',
    'flaming-blade',
    'frost-spear',
    'dragonfang',
    'soulreaper',
];
const ID_SET = new Set(WEAPON_IDS);
export const isWeaponId = (value) => typeof value === 'string' && ID_SET.has(value);
// Parse the stored JSON column into a clean list of valid ids. Tolerant of
// null / malformed / non-array / unknown ids (returns [] or filters them out).
export function parseUnlocked(raw) {
    if (!raw)
        return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed))
            return [];
        return parsed.filter(isWeaponId);
    }
    catch {
        return [];
    }
}
// Union the current set with incoming ids, keeping only valid ids, deduped, in
// canonical WEAPON_IDS order so the stored column is stable.
export function mergeUnlocked(current, incoming) {
    const set = new Set(current.filter(isWeaponId));
    for (const id of incoming)
        if (isWeaponId(id))
            set.add(id);
    return WEAPON_IDS.filter(id => set.has(id));
}
// POST /me/vault/unlock body. Ids are validated against WEAPON_IDS in the
// handler (via mergeUnlocked) so the schema only bounds shape/size here.
export const unlockSchema = z.object({
    weaponIds: z.array(z.string()).min(1).max(WEAPON_IDS.length),
});
// POST /me/vault/select body. null clears the loadout (back to Fists).
export const selectSchema = z.object({
    weaponId: z.string().nullable(),
});
