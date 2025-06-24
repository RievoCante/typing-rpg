import { useMemo, useCallback } from 'react';
import { DailyCompletionHandler } from '../handlers/DailyCompletionHandler';
import { EndlessCompletionHandler } from '../handlers/EndlessCompletionHandler';
import type { CompletionStats, CompletionResult, CompletionContext } from '../types/completion';

interface UseCompletionHandlerProps {
  currentMode: 'daily' | 'endless';
  addXp: (amount: number) => void;
  completeCurrentQuote: (wpm: number, attempts: number) => void;
  getAverageWPM: () => number;
  onShowModal: () => void;
}

export const useCompletionHandler = ({
  currentMode,
  addXp,
  completeCurrentQuote,
  getAverageWPM,
  onShowModal
}: UseCompletionHandlerProps) => {
  
  // Create handlers with memoization to prevent unnecessary recreations
  const dailyHandler = useMemo(
    () => new DailyCompletionHandler(completeCurrentQuote, getAverageWPM, onShowModal),
    [completeCurrentQuote, getAverageWPM, onShowModal]
  );
  
  const endlessHandler = useMemo(
    () => new EndlessCompletionHandler(addXp),
    [addXp]
  );

  /**
   * Main completion handler that delegates to the appropriate mode handler
   * @param stats - Performance statistics from the completed session
   * @param context - Completion context (only needed for daily mode)
   * @returns CompletionResult indicating what action to take next
   */
  const handleCompletion = useCallback((
    stats: CompletionStats,
    context?: CompletionContext
  ): CompletionResult => {
    if (currentMode === 'daily') {
      if (!context) {
        throw new Error('CompletionContext is required for daily mode');
      }
      return dailyHandler.handleCompletion(stats, context);
    } else {
      return endlessHandler.handleCompletion(stats);
    }
  }, [currentMode, dailyHandler, endlessHandler]);

  return {
    handleCompletion
  };
}; 