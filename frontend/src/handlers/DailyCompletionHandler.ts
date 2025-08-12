import { checkDailyFailure, getDailyFailureMessage, getDailySuccessMessage } from '../utils/dailyFailureDetection';
import type { CompletionStats, CompletionResult, CompletionContext } from '../types/completion';

export class DailyCompletionHandler {
  constructor(
    private completeCurrentQuote: (wpm: number, attempts: number) => void,
    private getAverageWPM: () => number,
    private onShowModal: () => void,
    private createSession: (body: {
      mode: 'daily' | 'endless';
      wpm: number;
      totalWords: number;
      correctWords: number;
      incorrectWords: number;
    }) => Promise<Response>
  ) {}

  handleCompletion(stats: CompletionStats, context: CompletionContext): CompletionResult {
    this.logCompletionStats(stats);

    const failed = checkDailyFailure(stats.incorrectWords);
    if (failed) {
      return this.handleFailure(stats, context);
    }

    return this.handleSuccess(stats, context);
  }

  private handleFailure(stats: CompletionStats, context: CompletionContext): CompletionResult {
    const failureMessage = getDailyFailureMessage(stats.incorrectWords, context.currentDifficulty);
    console.log(failureMessage);

    return {
      action: 'retry',
      message: `Attempt ${context.currentAttempts + 1} - ${failureMessage}`,
      newAttempts: context.currentAttempts + 1,
    };
  }

  private handleSuccess(stats: CompletionStats, context: CompletionContext): CompletionResult {
    const successMessage = getDailySuccessMessage(stats.incorrectWords, context.currentDifficulty);
    console.log(successMessage);

    this.completeCurrentQuote(stats.finalWpm, context.currentAttempts);

    const willCompleteDaily = context.completedQuotes >= 2 && !context.hasShownDailyCompletion;

    if (willCompleteDaily) {
      console.log('--- DAILY CHALLENGE COMPLETED! ---');
      const avgWpm = Math.round(this.getAverageWPM());
      console.log(`Average WPM: ${avgWpm}`);
      console.log('-----------------------------------');

      // Build and send a single daily session using average WPM and totals from the last run
      const totalWords = stats.correctWords + stats.incorrectWords;
      const payload = {
        mode: 'daily' as const,
        wpm: avgWpm,
        totalWords,
        correctWords: stats.correctWords,
        incorrectWords: stats.incorrectWords,
      };
      this.createSession(payload).catch((e) => console.error('Failed to save daily session', e));

      this.onShowModal();
      return { action: 'showModal', message: 'Daily challenge completed! Congratulations!' };
    }

    return {
      action: 'nextQuote',
      message: `${context.currentDifficulty} quote completed! Moving to next difficulty.`,
      newAttempts: 1,
    };
  }

  private logCompletionStats(stats: CompletionStats): void {
    console.log('--- Completion Stats ---');
    console.log(`Correct words: ${stats.correctWords}, Incorrect: ${stats.incorrectWords}`);
    console.log(`Total chars including spaces: ${stats.totalCharsIncludingSpaces}`);
    console.log(`Elapsed minutes: ${stats.elapsedMinutes.toFixed(2)}`);
    console.log(`WPM: ${stats.finalWpm}`);
  }
} 