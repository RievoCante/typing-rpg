import type {
  CompletionStats,
  CompletionResult,
  SessionPayload,
  SessionResponse,
} from '../types/completion';

const RETRY_DELAYS_MS = [500, 1500, 3000];

export class EndlessCompletionHandler {
  constructor(
    private createSession: (body: SessionPayload) => Promise<Response>
  ) {}

  async handleCompletion(stats: CompletionStats): Promise<CompletionResult> {
    const totalWords = stats.correctWords + stats.incorrectWords;
    const payload: SessionPayload = {
      mode: 'endless',
      wpm: Math.round(stats.finalWpm),
      totalWords,
      correctWords: stats.correctWords,
      incorrectWords: stats.incorrectWords,
    };

    // Fire save in background with retries — don't block UI.
    // xpDelta not shown for endless; stats update via reloadPlayerStats.
    void this.saveWithRetry(payload);

    return {
      action: 'loadNewText',
      message: 'Session completed!',
      xpDelta: 0,
    };
  }

  /** Attempts the save up to 4 times (1 initial + 3 retries with delays). */
  private async saveWithRetry(payload: SessionPayload): Promise<void> {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      if (attempt > 0) {
        await new Promise(res => setTimeout(res, RETRY_DELAYS_MS[attempt - 1]));
      }
      try {
        const response = await this.createSession(payload);
        if (!response.ok) continue;
        return;
      } catch {
        // network error — retry
      }
    }
    console.error('Failed to save endless session after retries');
  }
}
