import { useCallback, useReducer } from 'react';
import {
  critChanceForStreak,
  rollDamage,
  type DamageRoll,
} from '../utils/combatTuning';
import type { Weapon } from '../utils/weapons';

// --- Pure reducer (exported for tests, following useRaidState.ts convention) ---

export interface ComboState {
  streak: number;
}

export type ComboAction =
  | { type: 'CORRECT_WORD' }
  | { type: 'WRONG_WORD' }
  | { type: 'RESET' }
  | { type: 'BONUS'; amount: number };

export function comboReducer(
  state: ComboState,
  action: ComboAction
): ComboState {
  switch (action.type) {
    case 'CORRECT_WORD':
      return { streak: state.streak + 1 };
    case 'WRONG_WORD':
      // A mistake halves the streak (round down) rather than wiping it, so
      // crit chance drops by half instead of collapsing to base. critChance is
      // linear in streak, so halving the streak halves the crit chance.
      return { streak: Math.floor(state.streak / 2) };
    case 'RESET':
      return { streak: 0 };
    case 'BONUS':
      // Instant streak surge (e.g. killing an elite/rare). Clamped at 0 so a
      // negative amount can't drive the streak below zero.
      return { streak: Math.max(0, state.streak + action.amount) };
    default:
      return state;
  }
}

// --- Hook ---

// Endless combo streak: consecutive correct words raise crit chance. A wrong
// word halves it (round down). The streak deliberately PERSISTS across monster kills —
// it represents the player's typing flow, not a monster's state — so nothing
// here resets on defeat; only registerWrongWord() and reset() (run restart) do.
export function useComboSystem() {
  const [state, dispatch] = useReducer(comboReducer, { streak: 0 });

  // Call on a fully-correct word. Rolls damage against the CURRENT streak, then
  // increments. rng is injectable for tests. Returns the roll so the caller can
  // apply damage + drive popups/SFX.
  const registerCorrectWord = useCallback(
    (
      weapon: Weapon | null = null,
      rng: () => number = Math.random
    ): DamageRoll => {
      // Roll BEFORE dispatching so the roll uses the current streak value.
      // useReducer dispatch is synchronous for the state snapshot we read here.
      // An equipped weapon raises crit chance / damage (see rollDamage).
      const roll = rollDamage(state.streak, rng, weapon);
      dispatch({ type: 'CORRECT_WORD' });
      return roll;
    },
    [state.streak]
  );

  const registerWrongWord = useCallback(
    () => dispatch({ type: 'WRONG_WORD' }),
    []
  );
  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  // Instant streak surge, e.g. an elite/rare monster kill reward.
  const addStreak = useCallback(
    (amount: number) => dispatch({ type: 'BONUS', amount }),
    []
  );

  return {
    streak: state.streak,
    critChance: critChanceForStreak(state.streak),
    registerCorrectWord,
    registerWrongWord,
    reset,
    addStreak,
  };
}
