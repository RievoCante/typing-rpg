// Endless potion economy (pure helpers + tuning constants).
//
// Potions drop on a *word* clock rather than on monster defeat, so heal
// frequency scales with how long a fight actually runs (i.e. with the chosen
// word count) and stays in step with the time-based damage the monster deals.
// The player banks a small number and spends them manually.

export const POTION_DROP_CHANCE = 0.15; // chance per drop check
export const POTION_MIN_HEAL = 25;
export const POTION_MAX_HEAL = 50;
export const MAX_POTIONS = 3;
export const WORDS_PER_DROP_CHECK = 5; // a drop is rolled every N correct words

// True only on every WORDS_PER_DROP_CHECK-th correct word, and only when the
// drop roll succeeds. `correctWordCount` is the 1-based running count of
// correct words in the current run.
export function shouldDropPotion(
  correctWordCount: number,
  rng: () => number = Math.random
): boolean {
  if (correctWordCount <= 0) return false;
  if (correctWordCount % WORDS_PER_DROP_CHECK !== 0) return false;
  return rng() < POTION_DROP_CHANCE;
}

// Random heal amount in [POTION_MIN_HEAL, POTION_MAX_HEAL].
export function rollHealAmount(rng: () => number = Math.random): number {
  return (
    Math.floor(rng() * (POTION_MAX_HEAL - POTION_MIN_HEAL + 1)) +
    POTION_MIN_HEAL
  );
}
