// NOTE: @testing-library/react is not installed in this project (no jsdom either).
// The existing hook test (useRaidState.test.ts) tests pure reducer functions
// directly. We follow the same pattern: extract and test the pure combo logic
// via comboReducer rather than renderHook.

import { describe, it, expect } from 'vitest';
import { comboReducer, type ComboState } from './useComboSystem';

const initial: ComboState = { streak: 0 };

describe('comboReducer', () => {
  it('starts at streak 0', () => {
    expect(initial.streak).toBe(0);
  });

  it('increments streak on CORRECT_WORD', () => {
    const next = comboReducer(initial, { type: 'CORRECT_WORD' });
    expect(next.streak).toBe(1);
  });

  it('accumulates streak across multiple correct words', () => {
    let state = initial;
    state = comboReducer(state, { type: 'CORRECT_WORD' });
    state = comboReducer(state, { type: 'CORRECT_WORD' });
    expect(state.streak).toBe(2);
  });

  it('halves streak (floored) on WRONG_WORD', () => {
    expect(comboReducer({ streak: 40 }, { type: 'WRONG_WORD' }).streak).toBe(
      20
    );
    expect(comboReducer({ streak: 3 }, { type: 'WRONG_WORD' }).streak).toBe(1);
  });

  it('drops to 0 on WRONG_WORD from streak 1 or 0', () => {
    expect(comboReducer({ streak: 1 }, { type: 'WRONG_WORD' }).streak).toBe(0);
    expect(comboReducer({ streak: 0 }, { type: 'WRONG_WORD' }).streak).toBe(0);
  });

  it('resets streak to 0 on RESET', () => {
    const state = comboReducer({ streak: 5 }, { type: 'RESET' });
    expect(state.streak).toBe(0);
  });

  it('adds a bonus surge on BONUS (elite/rare kill reward)', () => {
    const state = comboReducer({ streak: 5 }, { type: 'BONUS', amount: 8 });
    expect(state.streak).toBe(13);
  });

  it('clamps a negative BONUS so streak never goes below 0', () => {
    const state = comboReducer({ streak: 2 }, { type: 'BONUS', amount: -10 });
    expect(state.streak).toBe(0);
  });
});

// Verify rollDamage integration: streak-0 roll with rng=0.99 → no crit, damage=1
import { rollDamage } from '../utils/combatTuning';

describe('rollDamage (streak 0, rng=0.99)', () => {
  it('returns damage=1, crit=false', () => {
    expect(rollDamage(0, () => 0.99)).toEqual({ damage: 1, crit: false });
  });
});

describe('rollDamage with level bonus (streak 0, rng=0.99)', () => {
  it('level 20 adds +1.0 → damage=2', () => {
    expect(rollDamage(0, () => 0.99, null, 20)).toEqual({
      damage: 2,
      crit: false,
    });
  });
});
