import {
  checkDailyFailure,
  getDailyFailureMessage,
} from '../utils/dailyFailureDetection';
import type {
  CompletionStats,
  CompletionResult,
  CompletionContext,
} from '../types/completion';

interface SessionPayload {
  mode: 'daily' | 'endless';
  wpm: number;
  totalWords: number;
  correctWords: number;
  incorrectWords: number;
}

interface SessionResponse {
  success: boolean;
  session: { xpDelta: number };
}

export class DailyCompletionHandler {
  constructor(
    private completeCurrentQuote: (wpm: number, attempts: number) => void,
    private getAverageWPM: () => number,
    private onShowModal: () => void,
    private createSession: (body: SessionPayload) => Promise<Response>
  ) {}

  async handleCompletion(
    stats: CompletionStats,
    context: CompletionContext
  ): Promise<CompletionResult> {
    const failed = checkDailyFailure(stats.incorrectWords);
    if (failed) {
      return this.handleFailure(stats, context);
    }
    return this.handleSuccess(stats, context);
  }

  private handleFailure(
    stats: CompletionStats,
    context: CompletionContext
  ): CompletionResult {
    const failureMessage = getDailyFailureMessage(
      stats.incorrectWords,
      context.currentDifficulty
    );
    return {
      action: 'retry',
      message: `Attempt ${context.currentAttempts + 1} - ${failureMessage}`,
      newAttempts: context.currentAttempts + 1,
    };
  }

  private async handleSuccess(
    stats: CompletionStats,
    context: CompletionContext
  ): Promise<CompletionResult> {
    const willCompleteDaily =
      context.completedQuotes >= 2 && !context.hasShownDailyCompletion;

    if (!willCompleteDaily) {
      // Not the final quote — safe to record stats immediately
      this.completeCurrentQuote(stats.finalWpm, context.currentAttempts);
      return {
        action: 'nextQuote',
        message: `${context.currentDifficulty} quote completed! Moving to next difficulty.`,
        newAttempts: 1,
      };
    }

    // Final (3rd) quote — compute true 3-quote average without calling
    // completeCurrentQuote yet (that would mark isCompletedToday = true in
    // localStorage before the server confirms).
    const prevAvg = this.getAverageWPM(); // average of the 2 completed quotes
    const avgWpm = Math.round(
      (prevAvg * context.completedQuotes + stats.finalWpm) /
        (context.completedQuotes + 1)
    );
    const totalWords = stats.correctWords + stats.incorrectWords;
    const payload: SessionPayload = {
      mode: 'daily',
      wpm: avgWpm,
      totalWords,
      correctWords: stats.correctWords,
      incorrectWords: stats.incorrectWords,
    };

    // Build a closure that does the save AND the post-save side-effects.
    // Stored as retrySave so TypingInterface can call it again on failure.
    const performSaveAndComplete = async (): Promise<CompletionResult> => {
      try {
        const response = await this.createSession(payload);
        if (!response.ok) throw new Error(`Server returned ${response.status}`);
        const data = (await response.json()) as SessionResponse;
        const xpEarned = data.session?.xpDelta ?? 0;
        // Server confirmed — now safe to write localStorage
        this.completeCurrentQuote(stats.finalWpm, context.currentAttempts);
        this.onShowModal();
        return { action: 'showModal', xpDelta: xpEarned };
      } catch (e) {
        const message =
          e instanceof Error ? e.message : 'Network error — please retry.';
        return {
          action: 'saveError',
          message,
          retrySave: performSaveAndComplete,
        };
      }
    };

    return performSaveAndComplete();
  }
}
