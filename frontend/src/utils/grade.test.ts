import { describe, it, expect } from 'vitest';
import { grade } from './grade';

describe('grade', () => {
  it('returns S at >= 98', () => {
    expect(grade(100)).toBe('S');
    expect(grade(98)).toBe('S');
  });

  it('returns A at >= 95 and < 98', () => {
    expect(grade(97)).toBe('A');
    expect(grade(95)).toBe('A');
  });

  it('returns B at >= 90 and < 95', () => {
    expect(grade(94)).toBe('B');
    expect(grade(90)).toBe('B');
  });

  it('returns C at >= 80 and < 90', () => {
    expect(grade(89)).toBe('C');
    expect(grade(80)).toBe('C');
  });

  it('returns D below 80', () => {
    expect(grade(79)).toBe('D');
    expect(grade(0)).toBe('D');
  });

  it('clamps out-of-range input', () => {
    expect(grade(150)).toBe('S');
    expect(grade(-5)).toBe('D');
  });
});
