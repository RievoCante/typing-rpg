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
});
