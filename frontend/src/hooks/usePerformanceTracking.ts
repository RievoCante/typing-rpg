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
  // Extra letters typed past a word's end, keyed by boundary space index.
  // Words carrying overflow are scored as incorrect (no WPM credit).
  overflow?: Record<number, string[]>;
}

export const usePerformanceTracking = ({
  text,
  charStatus,
  hasStartedTyping,
  cursorPosition,
  overflow = {},
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
      analyzeWords(text, charStatus, overflow);
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
  }, [text, charStatus, overflow, hasStartedTyping, startTime]);

  // Calculate current WPM in real-time
  const calculateCurrentWpm = useCallback((): number => {
    if (!hasStartedTyping || !startTime) return 0;

    const elapsedMinutes = (Date.now() - startTime) / 60000;
    if (elapsedMinutes === 0) return 0;

    // Use the SAME word-counting rule as the final calculation (analyzeWords)
    // so the live number doesn't read low while typing. A word counts as soon
    // as all its chars are 'correct' or 'locked' — not only 'locked' — which
    // means a fully-typed-but-not-yet-spaced word (incl. the last word, which
    // never gets a trailing space) is credited immediately instead of jumping
    // up only on completion.
    const { totalCharsIncludingSpaces } = analyzeWords(
      text,
      charStatus,
      overflow
    );

    return Math.round(totalCharsIncludingSpaces / 5 / elapsedMinutes);
  }, [text, charStatus, overflow, hasStartedTyping, startTime]);

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
