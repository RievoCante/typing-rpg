import { calculateXP } from '../utils/calculateXP';
import type { CompletionStats, CompletionResult } from '../types/completion';

export class EndlessCompletionHandler {
  constructor(private addXp: (amount: number) => void) {}

  /**
   * Handles completion of an endless mode session
   * @param stats - Performance statistics from the completed session
   * @returns CompletionResult indicating what action to take next
   */
  handleCompletion(stats: CompletionStats): CompletionResult {
    // Log completion stats
    this.logCompletionStats(stats);

    // Calculate and award XP
    const rewardXp = calculateXP('endless', stats.incorrectWords);
    this.addXp(rewardXp);

    console.log(`Endless session completed! +${rewardXp} XP earned.`);
    console.log('----------------------');

    return {
      action: 'loadNewText',
      message: `Session completed! +${rewardXp} XP earned.`
    };
  }

  private logCompletionStats(stats: CompletionStats): void {
    console.log('--- Endless Mode Completion ---');
    console.log(`Correct words: ${stats.correctWords}, Incorrect: ${stats.incorrectWords}`);
    console.log(`Total chars including spaces: ${stats.totalCharsIncludingSpaces}`);
    console.log(`Elapsed minutes: ${stats.elapsedMinutes.toFixed(2)}`);
    console.log(`WPM: ${stats.finalWpm}`);
  }
} 