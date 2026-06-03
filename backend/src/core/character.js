// Cosmetic player avatar config persisted on users.character and echoed in raid
// presence. Purely cosmetic — safe to accept from the WS message body.
// IMPORTANT: keep these allowed values in sync with the arrays in
// frontend/src/utils/avatarConfig.ts.
import { z } from 'zod';
// Shared 5-color palette for armor + helmet (matches ARMOR_COLORS in the
// frontend). Skin tones are a separate 5-value palette.
const METAL_COLORS = ['#9aa4b2', '#d4af37', '#b23a48', '#3b5bdb', '#2f9e69'];
const SKIN_TONES = ['#f1c9a5', '#e0a878', '#c68642', '#8d5524', '#5c3317'];
export const characterConfigSchema = z
    .object({
    armorType: z.enum(['plate', 'tunic', 'heavy']),
    armorColor: z.enum(METAL_COLORS),
    helmetType: z.enum(['barbute', 'horned', 'crowned']),
    helmetColor: z.enum(METAL_COLORS),
    skinTone: z.enum(SKIN_TONES),
})
    .strict();
// Returns the validated config, or null if input is missing/invalid.
export function parseCharacterConfig(input) {
    const r = characterConfigSchema.safeParse(input);
    return r.success ? r.data : null;
}
