import { checkDailyFailure, getDailyFailureMessage, getDailySuccessMessage } from '../utils/dailyFailureDetection';
import type { CompletionStats, CompletionResult, CompletionContext } from '../types/completion';

export class DailyCompletionHandler {
  constructor(
    private completeCurrentQuote: (wpm: number, attempts: number) => void,
    private getAverageWPM: () => number,
    private onShowModal: () => void
  ) {}

  /**
   * Handles completion of a daily quote
   * @param stats - Performance statistics from the completed quote
   * @param context - Current completion context (attempts, progress, etc.)
   * @returns CompletionResult indicating what action to take next
   */
  handleCompletion(stats: CompletionStats, context: CompletionContext): CompletionResult {
    // Log completion stats
    this.logCompletionStats(stats);

    // Check for failure first
    const failed = checkDailyFailure(stats.incorrectWords);
    
    if (failed) {
      return this.handleFailure(stats, context);
    }
    
    // Handle success
    return this.handleSuccess(stats, context);
  }

  private handleFailure(stats: CompletionStats, context: CompletionContext): CompletionResult {
    const failureMessage = getDailyFailureMessage(stats.incorrectWords, context.currentDifficulty);
    console.log(failureMessage);
    
    return {
      action: 'retry',
      message: `Attempt ${context.currentAttempts + 1} - ${failureMessage}`,
      newAttempts: context.currentAttempts + 1
    };
  }

  private handleSuccess(stats: CompletionStats, context: CompletionContext): CompletionResult {
    const successMessage = getDailySuccessMessage(stats.incorrectWords, context.currentDifficulty);
    console.log(successMessage);
    
    // Complete the current quote
    this.completeCurrentQuote(stats.finalWpm, context.currentAttempts);
    
    // Check if all 3 quotes are completed (will be 3 after this completion)
    const willCompleteDaily = context.completedQuotes >= 2 && !context.hasShownDailyCompletion;
    
    if (willCompleteDaily) {
      console.log('--- DAILY CHALLENGE COMPLETED! ---');
      console.log(`Average WPM: ${this.getAverageWPM()}`);
      console.log('-----------------------------------');
      
      this.onShowModal();
      
      return {
        action: 'showModal',
        message: 'Daily challenge completed! Congratulations!'
      };
    }
    
    // Move to next quote
    return {
      action: 'nextQuote',
      message: `${context.currentDifficulty} quote completed! Moving to next difficulty.`,
      newAttempts: 1 // Reset attempts for next quote
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