// This utility provides functions for generating text for the typing game.

import dailyQuotesData from '../static/english/english_quotes.json';
import english1kData from '../static/english/english_1k.json';

// Type definitions for the imported JSON data.
interface QuoteData {
  quotes: string[];
}

interface WordListData {
  words: string[];
}

// Type assertion to ensure TypeScript understands the JSON structure.
const typedDailyQuotesData = dailyQuotesData as QuoteData;
const typedEnglish1kData = english1kData as WordListData;

export const generateText = (mode: 'daily' | 'endless'): string => {
  if (mode === 'daily') {
    const randomIndex = Math.floor(
      Math.random() * typedDailyQuotesData.quotes.length
    );
    return typedDailyQuotesData.quotes[randomIndex] || 'Failed to load quote.';
  }

  // Endless mode
  const selectedWords: string[] = [];
  const wordList = typedEnglish1kData.words;
  if (wordList && wordList.length > 0) {
    // Generate a flat list of 25 words for endless mode.
    for (let i = 0; i < 25; i++) {
      const randomIndex = Math.floor(Math.random() * wordList.length);
      selectedWords.push(wordList[randomIndex]);
    }

    // Join words with a single space.
    return selectedWords.join(' ') || 'Failed to load words.';
  }

  return 'Word list is empty or not found.';
};
