import { describe, it, expect } from 'vitest';
import {
  generateGuestId,
  generateGuestUsername,
  isGuestId,
} from './guestIdentity';

describe('guestIdentity', () => {
  it('generateGuestId returns a guest- prefixed id', () => {
    const id = generateGuestId();
    expect(id).toMatch(/^guest-[a-f0-9]{8}$/);
  });

  it('generateGuestId produces unique values', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateGuestId()));
    expect(ids.size).toBe(100);
  });

  it('generateGuestUsername returns Guest- prefixed name with 3-digit suffix', () => {
    const name = generateGuestUsername();
    expect(name).toMatch(/^Guest-\d{3}$/);
    const n = parseInt(name.slice(6), 10);
    expect(n).toBeGreaterThanOrEqual(100);
    expect(n).toBeLessThanOrEqual(999);
  });

  it('isGuestId identifies guest ids and not Clerk user ids', () => {
    expect(isGuestId(generateGuestId())).toBe(true);
    expect(isGuestId('guest-anything')).toBe(true);
    expect(isGuestId('user_2abc')).toBe(false);
    expect(isGuestId('')).toBe(false);
  });
});
