import { describe, it, expect } from 'vitest';
import { getDailyQuote, generateText } from './textGenerator';

describe('getDailyQuote', () => {
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

  it('returns different quotes for different difficulties on the same day', () => {
    // Seed includes difficulty so easy/medium/hard produce different results
    const quotes = [
      getDailyQuote('easy'),
      getDailyQuote('medium'),
      getDailyQuote('hard'),
    ];
    const unique = new Set(quotes);
    expect(unique.size).toBeGreaterThan(1);
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
