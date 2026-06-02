import { useRef, useCallback } from 'react';
import type { CompletionStats } from '../types/completion';
import type { WordAnalysisResult } from '../utils/wordAnalysis';

interface FightAccum {
  chars: number;
  correct: number;
  incorrect: number;
}

const EMPTY: FightAccum = { chars: 0, correct: 0, incorrect: 0 };

// Pure: combine the fight's accumulated completed-block totals with the
// in-progress block and elapsed time into CompletionStats. WPM uses the same
// chars/5/min rule as usePerformanceTracking so it matches the live number.
export function finalizeFightStats(
  accum: FightAccum,
  current: WordAnalysisResult,
  elapsedMinutes: number
): CompletionStats {
  const totalCharsIncludingSpaces =
    accum.chars + current.totalCharsIncludingSpaces;
  const correctWords = accum.correct + current.correctWords;
  const incorrectWords = accum.incorrect + current.incorrectWords;
  const finalWpm =
    elapsedMinutes > 0
      ? Math.round(totalCharsIncludingSpaces / 5 / elapsedMinutes)
      : 0;
  return {
    correctWords,
    incorrectWords,
    totalCharsIncludingSpaces,
    finalWpm,
    elapsedMinutes,
  };
}

// Fight-scoped (monster spawn -> death) typing accumulator. Survives the silent
// 50-word block refills that happen mid-fight; reset on continue / new run.
export function useFightStats() {
  const accumRef = useRef<FightAccum>({ ...EMPTY });
  const startRef = useRef<number | null>(null);

  const startFightIfNeeded = useCallback(() => {
    if (startRef.current === null) startRef.current = Date.now();
  }, []);

  const foldBlock = useCallback((block: WordAnalysisResult) => {
    accumRef.current = {
      chars: accumRef.current.chars + block.totalCharsIncludingSpaces,
      correct: accumRef.current.correct + block.correctWords,
      incorrect: accumRef.current.incorrect + block.incorrectWords,
    };
  }, []);

  const finalize = useCallback(
    (current: WordAnalysisResult): CompletionStats => {
      const elapsedMinutes =
        startRef.current !== null
          ? (Date.now() - startRef.current) / 60000
          : 0;
      return finalizeFightStats(accumRef.current, current, elapsedMinutes);
    },
    []
  );

  const resetFight = useCallback(() => {
    accumRef.current = { ...EMPTY };
    startRef.current = null;
  }, []);

  return { startFightIfNeeded, foldBlock, finalize, resetFight };
}
