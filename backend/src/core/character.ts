// Cosmetic player avatar config persisted on users.character and echoed in raid
// presence. Purely cosmetic — safe to accept from the WS message body.
// IMPORTANT: keep these allowed values in sync with the arrays in
// frontend/src/utils/avatarConfig.ts.
import { z } from 'zod';

export const characterConfigSchema = z
  .object({
    bodyShape: z.enum(['round', 'square']),
    bodyColor: z.enum([
      '#38bdf8',
      '#34d399',
      '#a78bfa',
      '#fbbf24',
      '#f472b6',
      '#22d3ee',
      '#fb923c',
      '#4ade80',
    ]),
    eyeStyle: z.enum(['dot', 'wide', 'sleepy']),
    accessory: z.enum(['none', 'antenna', 'horn', 'crown']),
    accessoryColor: z.enum(['#f8fafc', '#fde047', '#fca5a5', '#c4b5fd']),
  })
  .strict();

export type CharacterConfig = z.infer<typeof characterConfigSchema>;

// Returns the validated config, or null if input is missing/invalid.
export function parseCharacterConfig(input: unknown): CharacterConfig | null {
  const r = characterConfigSchema.safeParse(input);
  return r.success ? r.data : null;
}
