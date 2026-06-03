import type { CharStatus } from '../components/TypingText';

export interface WordAnalysisResult {
  correctWords: number;
  incorrectWords: number;
  totalCharsIncludingSpaces: number;
  correctChars: number;
  incorrectChars: number;
  extraChars: number;
  missedChars: number;
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
 * @param typedLength - Optional cursor position. When set, only words the player
 *   has fully reached (wordEndIndex <= typedLength) are scored; the untyped tail
 *   past the cursor is ignored. Used when a fight ends mid-block on a monster
 *   kill so the remaining `pending` words aren't counted as incorrect (which
 *   would otherwise zero out endless XP and tank accuracy).
 * @returns Object containing word analysis results
 */
export const analyzeWords = (
  text: string,
  charStatus: CharStatus[],
  overflow: Record<number, string[]> = {},
  typedLength?: number
): WordAnalysisResult => {
  let correctWords = 0;
  let incorrectWords = 0;
  let totalCharsIncludingSpaces = 0;
  let correctChars = 0;
  let incorrectChars = 0;
  let extraChars = 0;
  let missedChars = 0;

  // Use regex to find words with their positions in the original text
  const wordMatches = [...text.matchAll(/\S+/g)];

  for (const match of wordMatches) {
    const word = match[0];
    const wordStartIndex = match.index!;
    const wordEndIndex = wordStartIndex + word.length;

    // Matches are ordered, so once a word extends past the cursor every later
    // word is also untyped — stop scoring entirely.
    if (typedLength !== undefined && wordEndIndex > typedLength) break;

    // Per-character tally for this reached word (letter-only; spaces excluded).
    let wordCorrect = 0;
    let wordIncorrect = 0;
    let wordMissed = 0;
    for (let i = wordStartIndex; i < wordEndIndex; i++) {
      const status = charStatus[i];
      if (status === 'correct' || status === 'locked') wordCorrect++;
      else if (status === 'incorrect') wordIncorrect++;
      else wordMissed++; // 'pending' | 'skipped'
    }
    const wordExtra = overflow[wordEndIndex]?.length ?? 0;

    correctChars += wordCorrect;
    incorrectChars += wordIncorrect;
    missedChars += wordMissed;
    extraChars += wordExtra;

    // A word is correct only if every char is correct/locked and it carries no
    // overflow — identical to the previous definition.
    const isWordCorrect =
      wordExtra === 0 && wordIncorrect === 0 && wordMissed === 0;

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
    correctChars,
    incorrectChars,
    extraChars,
    missedChars,
  };
};

export const getIncorrectWordCount = (
  text: string,
  charStatus: CharStatus[]
): number => {
  return analyzeWords(text, charStatus).incorrectWords;
};
