import { useEffect } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { getWpmTitle } from '../utils/wpmTitle';
import type {
  CompletionContext,
  CompletionResult,
  CompletionStats,
} from '../types/completion';
import type { CharStatus } from '../components/TypingText';
import type { KillResult } from '../components/KillResultOverlay';

// Word-level accuracy as a 0-100 integer. 100 when no words were typed (avoids
// divide-by-zero and reads sensibly on an empty/instant completion).
function computeAccuracy(correctWords: number, incorrectWords: number): number {
  const total = correctWords + incorrectWords;
  return total > 0 ? Math.round((correctWords / total) * 100) : 100;
}

interface Args {
  // completion-detection signals
  isCompleted: boolean;
  isSessionAlreadyCompleted: boolean;
  markAsProcessed: () => void;
  markSessionCompleted: () => void;
  // session inputs
  startTime: number | null;
  text: string;
  hasStartedTyping: boolean;
  charStatusRef: RefObject<CharStatus[]>;
  calculateFinalStats: () => CompletionStats | null;
  // mode-specific context
  currentMode: 'daily' | 'endless' | 'raid';
  currentDifficulty: 'easy' | 'medium' | 'hard';
  currentAttempts: number;
  completedQuotes: number;
  hasShownDailyCompletion: boolean;
  // outputs / side effects
  completionHandler: {
    handleCompletion: (
      stats: CompletionStats,
      context?: CompletionContext
    ) => CompletionResult | Promise<CompletionResult>;
  };
  damagePlayerFromMistake: () => void;
  incrementMonstersDefeated: () => void;
  reloadPlayerStats: () => Promise<void> | void;
  restartSession: () => void;
  setRemainingWords: (n: number) => void;
  setIsProcessingCompletion: Dispatch<SetStateAction<boolean>>;
  isProcessingCompletion: boolean;
  setEarnedXp: Dispatch<SetStateAction<number>>;
  setCurrentAttempts: Dispatch<SetStateAction<number>>;
  // Post-kill results panel: held on screen until the player presses Space.
  setKillResult: Dispatch<SetStateAction<KillResult | null>>;
  setAwaitingContinue: Dispatch<SetStateAction<boolean>>;
  setSaveError: Dispatch<SetStateAction<string | null>>;
  setPendingRetrySave: Dispatch<
    SetStateAction<(() => Promise<CompletionResult>) | null>
  >;
}

// Orchestrates everything that happens once the user finishes the prompt:
// final-word mistake penalty, stats computation, persistence, XP grant,
// next-monster spawn, and the post-completion UX (kill-result panel, daily
// modal, retry, etc.). Extracted from TypingInterface to keep that file at
// a reviewable size; the dep graph is intentionally explicit.
export function useTypingCompletion({
  isCompleted,
  isProcessingCompletion,
  isSessionAlreadyCompleted,
  markAsProcessed,
  markSessionCompleted,
  startTime,
  text,
  hasStartedTyping,
  charStatusRef,
  calculateFinalStats,
  currentMode,
  currentDifficulty,
  currentAttempts,
  completedQuotes,
  hasShownDailyCompletion,
  completionHandler,
  damagePlayerFromMistake,
  incrementMonstersDefeated,
  reloadPlayerStats,
  restartSession,
  setRemainingWords,
  setIsProcessingCompletion,
  setEarnedXp,
  setCurrentAttempts,
  setKillResult,
  setAwaitingContinue,
  setSaveError,
  setPendingRetrySave,
}: Args) {
  useEffect(() => {
    if (!isCompleted || isProcessingCompletion) return;

    // Endless: block/text completion is a SILENT buffer refill, not a kill.
    // Kills are HP-based and finalized in TypingInterface's death handler
    // (save + XP + overlay happen there). The block-refill effect in
    // TypingInterface owns markAsProcessed + restartSession for endless.
    if (currentMode === 'endless') return;

    setIsProcessingCompletion(true);
    markAsProcessed();
    // Final word never produced a space, so the health bar wouldn't fully
    // drain — drive it to zero so the defeat state can trigger.
    setRemainingWords(0);

    if (!hasStartedTyping || !startTime || text.length === 0) {
      setIsProcessingCompletion(false);
      restartSession();
      return;
    }

    if (isSessionAlreadyCompleted) {
      setIsProcessingCompletion(false);
      return;
    }
    markSessionCompleted();

    // Penalty for typos on the final word (no trailing space ever fired the
    // normal mistake path for it).
    const finalCharStatus = charStatusRef.current;
    if (finalCharStatus.length > 0) {
      let lastWordStart = text.length - 1;
      while (lastWordStart >= 0 && text[lastWordStart] !== ' ') lastWordStart--;
      lastWordStart++;
      const hasLastWordMistake = finalCharStatus
        .slice(lastWordStart)
        .some(status => status === 'incorrect');
      if (hasLastWordMistake) damagePlayerFromMistake();
    }

    const stats = calculateFinalStats();
    if (!stats) {
      setIsProcessingCompletion(false);
      restartSession();
      return;
    }

    const context: CompletionContext | undefined =
      currentMode === 'daily'
        ? {
            currentAttempts,
            completedQuotes,
            hasShownDailyCompletion,
            currentDifficulty,
          }
        : undefined;

    (async () => {
      const result: CompletionResult = await completionHandler.handleCompletion(
        stats,
        context
      );

      if (result.action === 'saveError') {
        setSaveError(result.message ?? 'Failed to save. Please retry.');
        setPendingRetrySave(() => result.retrySave ?? null);
        setIsProcessingCompletion(false);
        return;
      }

      if (typeof result.xpDelta === 'number') setEarnedXp(result.xpDelta);
      // Daily/raid defeat the monster by finishing the text. (Endless returns
      // early above — its kills are HP-based and counted in GameProvider.)
      incrementMonstersDefeated();
      reloadPlayerStats();

      switch (result.action) {
        case 'retry':
          if (result.newAttempts !== undefined)
            setCurrentAttempts(result.newAttempts);
          setTimeout(() => {
            setIsProcessingCompletion(false);
            restartSession();
          }, 400);
          break;
        case 'nextQuote':
          if (result.newAttempts !== undefined)
            setCurrentAttempts(result.newAttempts);
          // The next quote regenerates on its own (completeCurrentQuote bumps
          // currentDifficulty). Hold the results panel until the player
          // presses Space; the Daily handler awards XP only on the final quote,
          // so no XP figure is shown here.
          setIsProcessingCompletion(false);
          setKillResult({
            title: getWpmTitle(stats.finalWpm),
            wpm: stats.finalWpm,
            accuracy: computeAccuracy(stats.correctWords, stats.incorrectWords),
            subline: result.message,
          });
          setAwaitingContinue(true);
          break;
        case 'showModal':
          setIsProcessingCompletion(false);
          break;
        case 'loadNewText':
        default:
          // Raid (and any other auto-advancing mode): keep the brief pause.
          setTimeout(() => {
            setIsProcessingCompletion(false);
            restartSession();
          }, 400);
          break;
      }
    })();
  }, [
    isCompleted,
    isProcessingCompletion,
    isSessionAlreadyCompleted,
    startTime,
    text,
    text.length,
    currentMode,
    currentDifficulty,
    currentAttempts,
    completedQuotes,
    hasShownDailyCompletion,
    hasStartedTyping,
    markAsProcessed,
    markSessionCompleted,
    calculateFinalStats,
    restartSession,
    completionHandler,
    reloadPlayerStats,
    incrementMonstersDefeated,
    setRemainingWords,
    damagePlayerFromMistake,
    setIsProcessingCompletion,
    setEarnedXp,
    setCurrentAttempts,
    setKillResult,
    setAwaitingContinue,
    setSaveError,
    setPendingRetrySave,
    charStatusRef,
  ]);
}
