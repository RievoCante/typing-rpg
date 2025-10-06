import { useState, useCallback, useEffect } from 'react';
import { analyzeWords } from '../utils/wordAnalysis';
import type { CharStatus } from '../components/TypingText';

interface PerformanceStats {
  correctWords: number;
  incorrectWords: number;
  totalCharsIncludingSpaces: number;
  finalWpm: number;
  elapsedMinutes: number;
}

interface UsePerformanceTrackingProps {
  text: string;
  charStatus: CharStatus[];
  hasStartedTyping: boolean;
  cursorPosition: number;
}

export const usePerformanceTracking = ({
  text,
  charStatus,
  hasStartedTyping,
  cursorPosition,
}: UsePerformanceTrackingProps) => {
  const [startTime, setStartTime] = useState<number | null>(null);
  const [wpm, setWpm] = useState<number>(0);

  // Start timing session
  const startSession = useCallback(() => {
    setWpm(0);
    setStartTime(Date.now());
  }, []);

  // Reset for new session - only reset timing, keep WPM displayed
  const resetSession = useCallback(() => {
    setStartTime(null);
  }, []);

  // Calculate final stats when session is completed
  const calculateFinalStats = useCallback((): PerformanceStats | null => {
    if (!hasStartedTyping || !startTime || text.length === 0) {
      return null;
    }

    const elapsedMinutes = (Date.now() - startTime) / 60000;
    const { correctWords, incorrectWords, totalCharsIncludingSpaces } =
      analyzeWords(text, charStatus);
    const calculatedWpm =
      elapsedMinutes > 0 ? totalCharsIncludingSpaces / 5 / elapsedMinutes : 0;
    const finalWpm = Math.round(calculatedWpm);

    // Update WPM state for display
    setWpm(finalWpm);

    return {
      correctWords,
      incorrectWords,
      totalCharsIncludingSpaces,
      finalWpm,
      elapsedMinutes,
    };
  }, [text, charStatus, hasStartedTyping, startTime]);

  // Calculate current WPM in real-time
  const calculateCurrentWpm = useCallback((): number => {
    if (!hasStartedTyping || !startTime) return 0;

    const elapsedMinutes = (Date.now() - startTime) / 60000;
    if (elapsedMinutes === 0) return 0;

    // Count completed words (locked words)
    const wordMatches = [...text.matchAll(/\S+/g)];
    let totalCharsIncludingSpaces = 0;

    for (const match of wordMatches) {
      const word = match[0];
      const wordStartIndex = match.index!;
      const wordEndIndex = wordStartIndex + word.length;

      let isWordCompleted = true;

      // Check if all characters in this word are locked
      for (let i = wordStartIndex; i < wordEndIndex; i++) {
        if (charStatus[i] !== 'locked') {
          isWordCompleted = false;
          break;
        }
      }

      if (isWordCompleted) {
        // Add word length + 1 space (except for last word)
        totalCharsIncludingSpaces += word.length;

        // Add space after word if there's a space character following it
        if (wordEndIndex < text.length && text[wordEndIndex] === ' ') {
          totalCharsIncludingSpaces += 1;
        }
      }
    }

    return Math.round(totalCharsIncludingSpaces / 5 / elapsedMinutes);
  }, [text, charStatus, hasStartedTyping, startTime]);

  // Update WPM in real-time (only during active typing, not after completion)
  useEffect(() => {
    if (hasStartedTyping && cursorPosition < text.length) {
      const currentWpm = calculateCurrentWpm();
      setWpm(currentWpm);
    }
  }, [
    charStatus,
    hasStartedTyping,
    calculateCurrentWpm,
    cursorPosition,
    text.length,
  ]);

  return {
    // State
    startTime,
    wpm,

    // Actions
    startSession,
    resetSession,
    calculateFinalStats,
    calculateCurrentWpm,
  };
};
