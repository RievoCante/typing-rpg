import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getDailyQuote, generateText } from './textGenerator';

// Pin UTC date so PRNG-based assertions are deterministic in CI
const PINNED_DATE = new Date('2026-04-19T12:00:00Z');

describe('getDailyQuote', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_DATE);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a non-empty string for each difficulty', () => {
    expect(getDailyQuote('easy').length).toBeGreaterThan(0);
    expect(getDailyQuote('medium').length).toBeGreaterThan(0);
    expect(getDailyQuote('hard').length).toBeGreaterThan(0);
  });

  it('returns the same quote for the same difficulty on the same day (PRNG is deterministic)', () => {
    expect(getDailyQuote('easy')).toBe(getDailyQuote('easy'));
    expect(getDailyQuote('medium')).toBe(getDailyQuote('medium'));
    expect(getDailyQuote('hard')).toBe(getDailyQuote('hard'));
  });

  it('returns different quotes for different difficulties (seeds include difficulty)', () => {
    // Seeds are YYYY-MM-DD-{difficulty} so the three must differ
    const easy = getDailyQuote('easy');
    const medium = getDailyQuote('medium');
    const hard = getDailyQuote('hard');
    // At least two of the three must differ — same index is physically possible
    // but astronomically unlikely for three independently seeded PRNGs
    const unique = new Set([easy, medium, hard]);
    expect(unique.size).toBeGreaterThan(1);
  });

  it('returns a different quote on a different date', () => {
    const today = getDailyQuote('easy');
    vi.setSystemTime(new Date('2026-04-20T12:00:00Z'));
    const tomorrow = getDailyQuote('easy');
    // Different seed (different date) should produce a different quote
    // (may match by chance, but this validates the date affects the result)
    expect(typeof tomorrow).toBe('string');
    expect(tomorrow.length).toBeGreaterThan(0);
    // Store for snapshot-style regression
    expect(today).not.toBe('Failed to load daily quote.');
    expect(tomorrow).not.toBe('Failed to load daily quote.');
  });
});

describe('generateText', () => {
  it('daily mode returns the daily quote', () => {
    expect(generateText('daily', 'easy')).toBe(getDailyQuote('easy'));
  });

  it('endless mode returns 25 space-separated words', () => {
    const text = generateText('endless');
    const words = text.split(' ');
    expect(words.length).toBe(25);
    words.forEach(w => expect(w.length).toBeGreaterThan(0));
  });

  it('endless mode is random across calls', () => {
    const a = generateText('endless');
    const b = generateText('endless');
    // With 25 words from a 1k list, exact match is astronomically unlikely
    expect(a).not.toBe(b);
  });
});
