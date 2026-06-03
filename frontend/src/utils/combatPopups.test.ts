import { describe, it, expect } from 'vitest';
import { selectCritPopup, killPopup } from './combatPopups';

describe('selectCritPopup', () => {
  it('includes the damage number in the text', () => {
    expect(selectCritPopup(7).text).toBe('CRIT 7!');
  });

  it('scales size up with damage (bigger crit = bigger text)', () => {
    const small = selectCritPopup(1);
    const big = selectCritPopup(50);
    expect(big.sizePx).toBeGreaterThan(small.sizePx);
  });

  it('clamps size to a max so a huge crit stays on screen', () => {
    expect(selectCritPopup(9999).sizePx).toBe(48);
  });

  it('floors size for tiny crits', () => {
    expect(selectCritPopup(0).sizePx).toBe(24);
  });

  it('always tags kind=crit', () => {
    expect(selectCritPopup(3).kind).toBe('crit');
  });
});

describe('killPopup', () => {
  it('shows DEFEATED', () => {
    expect(killPopup('common').text).toBe('DEFEATED');
  });

  it('colors by variant', () => {
    expect(killPopup('common').color).toBe('#f87171'); // red-400
    expect(killPopup('elite').color).toBe('#fbbf24'); // amber-400
    expect(killPopup('rare').color).toBe('#a78bfa'); // violet-400
  });

  it('always tags kind=kill', () => {
    expect(killPopup('rare').kind).toBe('kill');
  });
});
