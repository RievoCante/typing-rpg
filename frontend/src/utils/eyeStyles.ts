import type { MonsterFamily } from '../components/Monster';

// Procedural face variety for monsters. The same dark "googly eye" on every
// monster read as boring/cute, so each spawn picks an expression. Mushrooms are
// always angry (they're meant to look mean); everyone else rolls a random style.
export const EYE_STYLES = [
  'neutral', // plain dark dots
  'pupil', // white eyeball + dark pupil + glint (lively)
  'cute', // bigger pupil eyes
  'wink', // one open, one closed
  'suspicious', // narrowed half-lidded glare
  'angry', // tilted dark eyes + slanted brows
] as const;

export type EyeStyle = (typeof EYE_STYLES)[number];

// Mushrooms always glare; every other family rolls a random expression so the
// roster stops looking like identical two-dot faces.
export function pickEyeStyle(
  family: MonsterFamily,
  rng: () => number = Math.random
): EyeStyle {
  if (family === 'mushroom') return 'angry';
  return EYE_STYLES[Math.floor(rng() * EYE_STYLES.length)];
}
