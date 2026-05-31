import { describe, it, expect } from 'vitest';
import { hpStatus, hpColorClass, isCriticalHp } from './raidHp';

describe('hpStatus', () => {
  it('is healthy above 50', () => {
    expect(hpStatus(100)).toBe('healthy');
    expect(hpStatus(50.1)).toBe('healthy');
  });
  it('is caution from 25 to 50 inclusive', () => {
    expect(hpStatus(50)).toBe('caution');
    expect(hpStatus(25)).toBe('caution');
    expect(hpStatus(40)).toBe('caution');
  });
  it('is critical below 25', () => {
    expect(hpStatus(24.9)).toBe('critical');
    expect(hpStatus(0)).toBe('critical');
  });
});

describe('hpColorClass', () => {
  it('returns full literal Tailwind classes per band', () => {
    expect(hpColorClass(80)).toBe('bg-green-500');
    expect(hpColorClass(40)).toBe('bg-amber-500');
    expect(hpColorClass(10)).toBe('bg-red-500');
    expect(hpColorClass(50)).toBe('bg-amber-500');
    expect(hpColorClass(25)).toBe('bg-amber-500');
  });
  it('returns grey when not alive, regardless of percent', () => {
    expect(hpColorClass(80, false)).toBe('bg-gray-500');
    expect(hpColorClass(0, false)).toBe('bg-gray-500');
  });
});

describe('isCriticalHp', () => {
  it('is true only when below 25 and alive', () => {
    expect(isCriticalHp(10, true)).toBe(true);
    expect(isCriticalHp(10, false)).toBe(false);
    expect(isCriticalHp(30, true)).toBe(false);
    expect(isCriticalHp(25, true)).toBe(false);
    expect(isCriticalHp(24.9, true)).toBe(true);
  });
});
