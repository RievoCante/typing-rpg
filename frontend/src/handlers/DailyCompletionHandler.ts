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

  async handleCompletion(stats: CompletionStats, context: CompletionContext): Promise<CompletionResult> {
    this.logCompletionStats(stats);

    const failed = checkDailyFailure(stats.incorrectWords);
    if (failed) {
      return this.handleFailure(stats, context);
    }

    return await this.handleSuccess(stats, context);
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

  private async handleSuccess(stats: CompletionStats, context: CompletionContext): Promise<CompletionResult> {
    const successMessage = getDailySuccessMessage(stats.incorrectWords, context.currentDifficulty);
    console.log(successMessage);

    this.completeCurrentQuote(stats.finalWpm, context.currentAttempts);

    const willCompleteDaily = context.completedQuotes >= 2 && !context.hasShownDailyCompletion;

    if (willCompleteDaily) {
      console.log('--- DAILY CHALLENGE COMPLETED! ---');
      const avgWpm = Math.round(this.getAverageWPM());
      console.log(`Average WPM: ${avgWpm}`);
      console.log('-----------------------------------');

      const totalWords = stats.correctWords + stats.incorrectWords;
      const payload = {
        mode: 'daily' as const,
        wpm: avgWpm,
        totalWords,
        correctWords: stats.correctWords,
        incorrectWords: stats.incorrectWords,
      };

      let xpEarned = 0;
      try {
        const res = await this.createSession(payload);
        if (res.ok) {
          const data = await res.json();
          xpEarned = Number(data?.session?.xpDelta ?? 0);
        }
      } catch (e) {
        console.error('Failed to save daily session', e);
      }

      this.onShowModal();
      return { action: 'showModal', message: `Daily challenge completed! +${xpEarned} XP`, xpDelta: xpEarned };
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