import type { CompletionStats, CompletionResult } from '../types/completion';

export class EndlessCompletionHandler {
  constructor(private createSession: (body: {
    mode: 'daily' | 'endless';
    wpm: number;
    totalWords: number;
    correctWords: number;
    incorrectWords: number;
  }) => Promise<Response>) {}

  /**
   * Handles completion of an endless mode session
   */
  async handleCompletion(stats: CompletionStats): Promise<CompletionResult> {
    this.logCompletionStats(stats);

    const totalWords = stats.correctWords + stats.incorrectWords;
    const payload = {
      mode: 'endless' as const,
      wpm: Math.round(stats.finalWpm),
      totalWords,
      correctWords: stats.correctWords,
      incorrectWords: stats.incorrectWords,
    };

    try {
      await this.createSession(payload);
      console.log('Endless session saved to backend.');
    } catch (e) {
      console.error('Failed to save endless session', e);
    }

    return {
      action: 'loadNewText',
      message: 'Session completed! Saved to history.',
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