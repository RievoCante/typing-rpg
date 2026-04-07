import type { CompletionStats, CompletionResult } from '../types/completion';

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

  /** Attempts the save up to 3 times with delays. Returns server xpDelta, or 0 on total failure. */
  private async saveWithRetry(payload: SessionPayload): Promise<number> {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      if (attempt > 0) {
        await new Promise(res => setTimeout(res, RETRY_DELAYS_MS[attempt - 1]));
      }
      try {
        const response = await this.createSession(payload);
        if (!response.ok) continue;
        const data = (await response.json()) as SessionResponse;
        return data.session?.xpDelta ?? 0;
      } catch {
        // network error — retry
      }
    }
    console.error('Failed to save endless session after retries');
    return 0;
  }
}
