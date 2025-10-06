import { useMemo, useCallback } from 'react';
import { DailyCompletionHandler } from '../handlers/DailyCompletionHandler';
import { EndlessCompletionHandler } from '../handlers/EndlessCompletionHandler';
import type {
  CompletionStats,
  CompletionResult,
  CompletionContext,
} from '../types/completion';
import { useApi } from './useApi';

interface UseCompletionHandlerProps {
  currentMode: 'daily' | 'endless';
  completeCurrentQuote: (wpm: number, attempts: number) => void;
  getAverageWPM: () => number;
  onShowModal: () => void;
}

export const useCompletionHandler = ({
  currentMode,
  completeCurrentQuote,
  getAverageWPM,
  onShowModal,
}: UseCompletionHandlerProps) => {
  const { createSession } = useApi();

  const dailyHandler = useMemo(
    () =>
      new DailyCompletionHandler(
        completeCurrentQuote,
        getAverageWPM,
        onShowModal,
        createSession
      ),
    [completeCurrentQuote, getAverageWPM, onShowModal, createSession]
  );

  const endlessHandler = useMemo(
    () => new EndlessCompletionHandler(createSession),
    [createSession]
  );

  const handleCompletion = useCallback(
    (
      stats: CompletionStats,
      context?: CompletionContext
    ): CompletionResult | Promise<CompletionResult> => {
      if (currentMode === 'daily') {
        if (!context)
          throw new Error('CompletionContext is required for daily mode');
        return dailyHandler.handleCompletion(stats, context);
      } else {
        return endlessHandler.handleCompletion(stats);
      }
    },
    [currentMode, dailyHandler, endlessHandler]
  );

  return { handleCompletion };
};
