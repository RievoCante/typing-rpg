// This utility provides functions for generating text for the typing game.

import dailyQuotesData from '../static/english/english_quotes_1.json'; //TODO: find a better system
import english1kData from '../static/english/english_1k.json';

// Type definitions for the imported JSON data.
interface DailyQuotesData {
  easy: string[];
  medium: string[];
  hard: string[];
}

interface WordListData {
  words: string[];
}

// Type assertion to ensure TypeScript understands the JSON structure.
const typedDailyQuotesData = dailyQuotesData as DailyQuotesData;
const typedEnglish1kData = english1kData as WordListData;

// Get day of week index (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
const getDayOfWeekIndex = (): number => {
  const now = new Date();
  const utcDay = now.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  return utcDay === 0 ? 6 : utcDay - 1; // Convert to Monday = 0, ..., Sunday = 6
};

// Get daily quote based on difficulty and current day
export const getDailyQuote = (difficulty: 'easy' | 'medium' | 'hard'): string => {
  const dayIndex = getDayOfWeekIndex();
  const quotes = typedDailyQuotesData[difficulty];
  
  if (!quotes || quotes.length === 0) {
    return 'Failed to load daily quote.';
  }
  
  // Use day index to get consistent quote for the day
  const quoteIndex = dayIndex % quotes.length;
  return quotes[quoteIndex] || 'Failed to load quote.';
};

export const generateText = (mode: 'daily' | 'endless', difficulty?: 'easy' | 'medium' | 'hard'): string => {
  // Daily mode
  if (mode === 'daily') {
    if (!difficulty) {
      // Default to easy if no difficulty specified (backward compatibility)
      return getDailyQuote('easy');
    }
    return getDailyQuote(difficulty);
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
