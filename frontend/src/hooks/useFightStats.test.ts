import { describe, it, expect } from 'vitest';
import { finalizeFightStats } from './useFightStats';
import type { WordAnalysisResult } from '../utils/wordAnalysis';

const block = (over: Partial<WordAnalysisResult>): WordAnalysisResult => ({
  correctWords: 0,
  incorrectWords: 0,
  totalCharsIncludingSpaces: 0,
  correctChars: 0,
  incorrectChars: 0,
  extraChars: 0,
  missedChars: 0,
  ...over,
});

describe('finalizeFightStats', () => {
  it('sums accumulated blocks with the in-progress block', () => {
    const stats = finalizeFightStats(
      {
        chars: 100,
        correct: 20,
        incorrect: 2,
        correctChars: 0,
        incorrectChars: 0,
        extraChars: 0,
        missedChars: 0,
      },
      block({
        totalCharsIncludingSpaces: 50,
        correctWords: 10,
        incorrectWords: 1,
      }),
      1 // minute
    );
    expect(stats.totalCharsIncludingSpaces).toBe(150);
    expect(stats.correctWords).toBe(30);
    expect(stats.incorrectWords).toBe(3);
    expect(stats.finalWpm).toBe(30); // 150 / 5 / 1
    expect(stats.elapsedMinutes).toBe(1);
  });

  it('returns 0 wpm when no time elapsed', () => {
    const stats = finalizeFightStats(
      {
        chars: 0,
        correct: 0,
        incorrect: 0,
        correctChars: 0,
        incorrectChars: 0,
        extraChars: 0,
        missedChars: 0,
      },
      block({
        totalCharsIncludingSpaces: 25,
        correctWords: 5,
        incorrectWords: 0,
      }),
      0
    );
    expect(stats.finalWpm).toBe(0);
  });

  it('handles a fast kill that fits in a single block (no accumulation)', () => {
    const stats = finalizeFightStats(
      {
        chars: 0,
        correct: 0,
        incorrect: 0,
        correctChars: 0,
        incorrectChars: 0,
        extraChars: 0,
        missedChars: 0,
      },
      block({
        totalCharsIncludingSpaces: 60,
        correctWords: 12,
        incorrectWords: 0,
      }),
      0.5
    );
    expect(stats.totalCharsIncludingSpaces).toBe(60);
    expect(stats.correctWords).toBe(12);
    expect(stats.finalWpm).toBe(24); // 60 / 5 / 0.5
  });
});

describe('finalizeFightStats char breakdown', () => {
  it('sums char breakdown across accumulated blocks + current', () => {
    const accum = {
      chars: 10,
      correct: 2,
      incorrect: 1,
      correctChars: 8,
      incorrectChars: 2,
      extraChars: 1,
      missedChars: 0,
    };
    const current = block({
      correctChars: 4,
      incorrectChars: 1,
      extraChars: 0,
      missedChars: 3,
    });
    const r = finalizeFightStats(accum, current, 1);
    expect(r.correctChars).toBe(12);
    expect(r.incorrectChars).toBe(3);
    expect(r.extraChars).toBe(1);
    expect(r.missedChars).toBe(3);
  });
});
