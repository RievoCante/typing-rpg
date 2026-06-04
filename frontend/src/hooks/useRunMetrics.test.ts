import { describe, it, expect } from 'vitest';
import {
  runMetricsReducer,
  initialRunMetrics,
  type RunMetricsState,
} from './useRunMetrics';
import type { ChartData } from '../types/completion';
import type { Weapon } from '../utils/weapons';

const fight = (wpm: number[], raw: number[], err: number[]): ChartData => ({
  wpm,
  raw,
  err,
});

const weapon = (id: string): Weapon => ({
  id,
  name: id,
  rarity: 'common',
  bonusDamage: 0,
  bonusCritChance: 0,
  critMultBonus: 0,
});

describe('runMetricsReducer', () => {
  it('starts empty', () => {
    const s = initialRunMetrics;
    expect(s.chart).toEqual({ wpm: [], raw: [], err: [] });
    expect(s.critCount).toBe(0);
    expect(s.totalXp).toBe(0);
    expect(s.monstersDefeated).toBe(0);
    expect(s.bestWpm).toBe(0);
    expect(s.elapsedSeconds).toBe(0);
    expect(s.loot).toEqual([]);
  });

  it('APPEND_FIGHT concatenates samples into one continuous timeline', () => {
    let s: RunMetricsState = initialRunMetrics;
    s = runMetricsReducer(s, {
      type: 'APPEND_FIGHT',
      chart: fight([40, 50], [42, 55], [0, 1]),
    });
    s = runMetricsReducer(s, {
      type: 'APPEND_FIGHT',
      chart: fight([60], [62], [0]),
    });
    expect(s.chart.wpm).toEqual([40, 50, 60]);
    expect(s.chart.raw).toEqual([42, 55, 62]);
    expect(s.chart.err).toEqual([0, 1, 0]);
  });

  it('APPEND_FIGHT tracks best single-sample WPM across the run', () => {
    let s: RunMetricsState = initialRunMetrics;
    s = runMetricsReducer(s, {
      type: 'APPEND_FIGHT',
      chart: fight([40, 70], [40, 70], [0, 0]),
    });
    s = runMetricsReducer(s, {
      type: 'APPEND_FIGHT',
      chart: fight([55], [55], [0]),
    });
    expect(s.bestWpm).toBe(70);
  });

  it('TALLY_CRIT increments crit count', () => {
    let s: RunMetricsState = initialRunMetrics;
    s = runMetricsReducer(s, { type: 'TALLY_CRIT' });
    s = runMetricsReducer(s, { type: 'TALLY_CRIT' });
    expect(s.critCount).toBe(2);
  });

  it('ADD_XP accumulates and ignores non-positive', () => {
    let s: RunMetricsState = initialRunMetrics;
    s = runMetricsReducer(s, { type: 'ADD_XP', amount: 30 });
    s = runMetricsReducer(s, { type: 'ADD_XP', amount: 0 });
    s = runMetricsReducer(s, { type: 'ADD_XP', amount: -5 });
    s = runMetricsReducer(s, { type: 'ADD_XP', amount: 12 });
    expect(s.totalXp).toBe(42);
  });

  it('INC_MONSTER counts kills', () => {
    let s: RunMetricsState = initialRunMetrics;
    s = runMetricsReducer(s, { type: 'INC_MONSTER' });
    s = runMetricsReducer(s, { type: 'INC_MONSTER' });
    s = runMetricsReducer(s, { type: 'INC_MONSTER' });
    expect(s.monstersDefeated).toBe(3);
  });

  it('ADD_SECONDS accumulates run duration', () => {
    let s: RunMetricsState = initialRunMetrics;
    s = runMetricsReducer(s, { type: 'ADD_SECONDS', seconds: 18 });
    s = runMetricsReducer(s, { type: 'ADD_SECONDS', seconds: 7 });
    expect(s.elapsedSeconds).toBe(25);
  });

  it('LOOT appends weapons and dedupes by id', () => {
    let s: RunMetricsState = initialRunMetrics;
    s = runMetricsReducer(s, { type: 'LOOT', weapon: weapon('club') });
    s = runMetricsReducer(s, { type: 'LOOT', weapon: weapon('club') });
    s = runMetricsReducer(s, { type: 'LOOT', weapon: weapon('axe') });
    expect(s.loot.map(w => w.id)).toEqual(['club', 'axe']);
  });

  it('RESET returns to the initial state', () => {
    let s: RunMetricsState = initialRunMetrics;
    s = runMetricsReducer(s, { type: 'TALLY_CRIT' });
    s = runMetricsReducer(s, { type: 'INC_MONSTER' });
    s = runMetricsReducer(s, { type: 'ADD_XP', amount: 99 });
    s = runMetricsReducer(s, { type: 'RESET' });
    expect(s).toEqual(initialRunMetrics);
  });

  it('does not mutate the input state', () => {
    const s = initialRunMetrics;
    runMetricsReducer(s, { type: 'TALLY_CRIT' });
    expect(s.critCount).toBe(0);
  });
});
