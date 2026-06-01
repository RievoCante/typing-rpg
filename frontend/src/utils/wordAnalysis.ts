import type { CharStatus } from '../components/TypingText';

export interface WordAnalysisResult {
  correctWords: number;
  incorrectWords: number;
  totalCharsIncludingSpaces: number;
}

/**
 * Analyzes words in the text based on character status.
 * Extracted from TypingInterface.tsx handleCompletion logic.
 *
 * @param text - The original text to analyze
 * @param charStatus - Array of character statuses corresponding to each character
 * @param overflow - Optional map of word-boundary index -> extra typed letters.
 *   A word that carries overflow is scored as incorrect (Monkeytype-style), so
 *   it never adds WPM/correct-char credit.
 * @returns Object containing word analysis results
 */
export const analyzeWords = (
  text: string,
  charStatus: CharStatus[],
  overflow: Record<number, string[]> = {}
): WordAnalysisResult => {
  let correctWords = 0;
  let incorrectWords = 0;
  let totalCharsIncludingSpaces = 0;

  // Use regex to find words with their positions in the original text
  const wordMatches = [...text.matchAll(/\S+/g)];

  for (const match of wordMatches) {
    const word = match[0];
    const wordStartIndex = match.index!;
    const wordEndIndex = wordStartIndex + word.length;

    // A word with extra (overflow) characters at its trailing boundary is
    // always incorrect, regardless of its base characters.
    let isWordCorrect = (overflow[wordEndIndex]?.length ?? 0) === 0;

    // Check if all characters in this word are correct or locked
    for (let i = wordStartIndex; isWordCorrect && i < wordEndIndex; i++) {
      const status = charStatus[i];
      if (status !== 'correct' && status !== 'locked') {
        isWordCorrect = false;
        break;
      }
    }

    if (isWordCorrect) {
      correctWords++;
      // Add word length + 1 space (except for last word)
      totalCharsIncludingSpaces += word.length;

      // Add space after word if there's a space character following it
      if (wordEndIndex < text.length && text[wordEndIndex] === ' ') {
        totalCharsIncludingSpaces += 1;
      }
    } else {
      incorrectWords++;
    }
  }

  return {
    correctWords,
    incorrectWords,
    totalCharsIncludingSpaces,
  };
};

export const getIncorrectWordCount = (
  text: string,
  charStatus: CharStatus[]
): number => {
  return analyzeWords(text, charStatus).incorrectWords;
};
