import { describe, it, expect } from 'vitest';
import { analyzeWords } from './wordAnalysis';
import type { CharStatus } from '../components/TypingText';

const TEXT = 'to be free';
// "to"(0,1) " "(2) "be"(3,4) " "(5) "free"(6-9)

const allCorrect = (): CharStatus[] =>
  TEXT.split('').map(c => (c === ' ' ? 'locked' : 'correct'));

describe('analyzeWords', () => {
  it('counts every fully-correct word and its spaces', () => {
    const result = analyzeWords(TEXT, allCorrect());
    expect(result.correctWords).toBe(3);
    expect(result.incorrectWords).toBe(0);
    // "to" + space + "be" + space + "free" = 2+1+2+1+4 = 10
    expect(result.totalCharsIncludingSpaces).toBe(10);
  });

  it('treats a word carrying overflow as incorrect and excludes its credit', () => {
    // All chars typed correctly, but "to" has 2 overflow letters at boundary 2.
    const overflow = { 2: ['x', 'y'] };
    const result = analyzeWords(TEXT, allCorrect(), overflow);
    expect(result.correctWords).toBe(2); // "be" and "free"
    expect(result.incorrectWords).toBe(1); // "to"
    // "to"(2) + its space(1) are NOT credited: 10 - 3 = 7
    expect(result.totalCharsIncludingSpaces).toBe(7);
  });

  it('ignores empty overflow buckets', () => {
    const overflow = { 2: [] };
    const result = analyzeWords(TEXT, allCorrect(), overflow);
    expect(result.correctWords).toBe(3);
    expect(result.totalCharsIncludingSpaces).toBe(10);
  });

  it('is unchanged when no overflow map is provided', () => {
    const result = analyzeWords(TEXT, allCorrect());
    expect(result.correctWords).toBe(3);
  });

  describe('typedLength bound (mid-fight kill)', () => {
    // Player typed "to be " then the monster died; "free" is untyped (pending).
    const partial = (): CharStatus[] => [
      'correct', // t
      'correct', // o
      'locked', //  (space)
      'correct', // b
      'correct', // e
      'locked', //  (space)
      'pending', // f
      'pending', // r
      'pending', // e
      'pending', // e
    ];

    it('excludes the untyped tail past the cursor instead of scoring it incorrect', () => {
      // cursor at 6 = start of "free". Without the bound, "free" (all pending)
      // would count as 1 incorrect word and zero out endless XP.
      const result = analyzeWords(TEXT, partial(), {}, 6);
      expect(result.correctWords).toBe(2); // "to", "be"
      expect(result.incorrectWords).toBe(0); // "free" untyped -> not penalized
    });

    it('excludes an in-progress word straddling the cursor', () => {
      // Player started "fr" of "free" then died: cursor at 8, word ends at 10.
      const inProgress = partial();
      inProgress[6] = 'correct';
      inProgress[7] = 'correct';
      const result = analyzeWords(TEXT, inProgress, {}, 8);
      expect(result.correctWords).toBe(2); // "to", "be"
      expect(result.incorrectWords).toBe(0); // "free" not finished -> not penalized
    });

    it('counts everything when typedLength is omitted (full-block path)', () => {
      const result = analyzeWords(TEXT, partial());
      expect(result.correctWords).toBe(2);
      expect(result.incorrectWords).toBe(1); // "free" pending -> incorrect
    });
  });
});
