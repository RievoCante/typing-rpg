import { useMemo, useCallback } from 'react';
import { DailyCompletionHandler } from '../handlers/DailyCompletionHandler';
import { EndlessCompletionHandler } from '../handlers/EndlessCompletionHandler';
import type {
  CompletionStats,
  CompletionResult,
  CompletionContext,
} from '../types/completion';
import type { EndlessDifficulty } from './useEndlessSettings';
import type { MonsterVariant } from '../context/GameContext';
import { useApi } from './useApi';

interface UseCompletionHandlerProps {
  currentMode: 'daily' | 'endless';
  endlessDifficulty: EndlessDifficulty;
  completeCurrentQuote: (wpm: number, attempts: number) => void;
  getAverageWPM: () => number;
  onShowModal: () => void;
}

export const useCompletionHandler = ({
  currentMode,
  endlessDifficulty,
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
      context?: CompletionContext,
      // Endless only: rarity of the just-killed monster. Passed as a call
      // argument (not bound in the handler) so completionHandler identity stays
      // stable across monster spawns — see the memo note below.
      variant?: MonsterVariant
    ): CompletionResult | Promise<CompletionResult> => {
      if (currentMode === 'daily') {
        if (!context)
          throw new Error('CompletionContext is required for daily mode');
        return dailyHandler.handleCompletion(stats, context);
      } else {
        return endlessHandler.handleCompletion(
          stats,
          endlessDifficulty,
          variant
        );
      }
    },
    [currentMode, endlessDifficulty, dailyHandler, endlessHandler]
  );

  // Stable object identity: consumers list `completionHandler` in effect deps
  // (e.g. the endless death-finalizer). Returning a fresh literal each render
  // would re-fire those effects every render — which previously cancelled the
  // post-kill reveal timer and soft-locked Endless. Memoize on the callback.
  return useMemo(() => ({ handleCompletion }), [handleCompletion]);
};
