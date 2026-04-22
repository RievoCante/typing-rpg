// This utility provides functions for generating text for the typing game.

import dailyQuotesData from '../static/english/english_quotes_1.json';
import english1kData from '../static/english/english_1k.json';
import english5kData from '../static/english/english_5k.json';
import english10kData from '../static/english/english_10k.json';

interface DailyQuotesData {
  easy: string[];
  medium: string[];
  hard: string[];
}

interface WordListData {
  words: string[];
}

const typedDailyQuotesData = dailyQuotesData as DailyQuotesData;
const typedEnglish1kData = english1kData as WordListData;
const typedEnglish5kData = english5kData as WordListData;
const typedEnglish10kData = english10kData as WordListData;

// Returns the current UTC date as "YYYY-MM-DD".
// All users in the same UTC day see the same daily quotes.
const getUtcDateString = (): string => {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Simple deterministic hash of a string to a 32-bit integer seed.
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

// Mulberry32 PRNG — cheap, deterministic, good distribution.
function mulberry32(seed: number): () => number {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Returns the daily quote for the given difficulty.
// Seeded by UTC date + difficulty so easy/medium/hard all differ,
// and every user on the same UTC day sees the same quote.
export const getDailyQuote = (
  difficulty: 'easy' | 'medium' | 'hard'
): string => {
  const quotes = typedDailyQuotesData[difficulty];
  if (!quotes || quotes.length === 0) return 'Failed to load daily quote.';

  const seed = hashString(`${getUtcDateString()}-${difficulty}`);
  const rand = mulberry32(seed);
  const quoteIndex = Math.floor(rand() * quotes.length);
  return quotes[quoteIndex] || 'Failed to load quote.';
};

export const generateText = (
  mode: 'daily' | 'endless',
  difficulty?: 'easy' | 'medium' | 'hard',
  endlessWordCount?: number,
  endlessDifficulty?: 'beginner' | 'intermediate' | 'advanced'
): string => {
  if (mode === 'daily') {
    return getDailyQuote(difficulty ?? 'easy');
  }

  // Endless mode: configurable word count and difficulty
  const wordCount = endlessWordCount ?? 25;
  const difficultyLevel = endlessDifficulty ?? 'beginner';

  // Select word list based on difficulty
  let wordList: string[];
  switch (difficultyLevel) {
    case 'beginner':
      wordList = typedEnglish1kData.words;
      break;
    case 'intermediate':
      wordList = typedEnglish5kData.words;
      break;
    case 'advanced':
      wordList = typedEnglish10kData.words;
      break;
    default:
      wordList = typedEnglish1kData.words;
  }

  if (!wordList || wordList.length === 0)
    return 'Word list is empty or not found.';

  const selectedWords: string[] = [];
  for (let i = 0; i < wordCount; i++) {
    selectedWords.push(wordList[Math.floor(Math.random() * wordList.length)]);
  }
  return selectedWords.join(' ');
};
