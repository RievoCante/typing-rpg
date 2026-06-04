import { describe, it, expect } from 'vitest';
import { buildGraphSeries } from './battleReportData';
import type { ChartData } from '../types/completion';

const data: ChartData = {
  wpm: [0, 50, 100],
  raw: [0, 50, 100],
  err: [0, 1, 0],
};

describe('buildGraphSeries', () => {
  it('returns empty series for empty data', () => {
    const s = buildGraphSeries({ wpm: [], raw: [], err: [] }, 100, 40);
    expect(s.wpmPoints).toBe('');
    expect(s.rawPoints).toBe('');
    expect(s.errMarkers).toEqual([]);
    expect(s.maxY).toBe(1);
  });

  it('spans x from 0 to width across sample indices', () => {
    const s = buildGraphSeries(data, 100, 40);
    const xs = s.wpmPoints.split(' ').map(p => Number(p.split(',')[0]));
    expect(xs[0]).toBe(0);
    expect(xs[xs.length - 1]).toBe(100);
  });

  it('flips y so the max sample sits at the top (y=0)', () => {
    const s = buildGraphSeries(data, 100, 40);
    expect(s.maxY).toBe(100);
    const ys = s.wpmPoints.split(' ').map(p => Number(p.split(',')[1]));
    // sample value 0 -> bottom (y=height); value 100 -> top (y=0)
    expect(ys[0]).toBe(40);
    expect(ys[2]).toBe(0);
  });

  it('emits an error marker per non-zero err sample', () => {
    const s = buildGraphSeries(data, 100, 40);
    expect(s.errMarkers).toHaveLength(1);
    expect(s.errMarkers[0].x).toBeCloseTo(50);
  });

  it('handles a single sample without NaN', () => {
    const s = buildGraphSeries({ wpm: [60], raw: [60], err: [0] }, 100, 40);
    expect(s.wpmPoints).toBe('0,0');
    expect(Number.isNaN(s.maxY)).toBe(false);
  });
});
