import { describe, it, expect } from 'vitest';
import { CANVAS_DPR, CANVAS_GL } from './canvas';

describe('canvas defaults', () => {
  it('caps dpr at 1.5 to bound per-frame pixel work', () => {
    expect(CANVAS_DPR).toEqual([1, 1.5]);
  });
  it('keeps a transparent, antialiased context', () => {
    expect(CANVAS_GL.alpha).toBe(true);
    expect(CANVAS_GL.antialias).toBe(true);
  });
});
