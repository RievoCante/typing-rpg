import type {
  CompletionStats,
  CompletionResult,
  SessionPayload,
} from '../types/completion';
import type { EndlessDifficulty } from '../hooks/useEndlessSettings';
import { calculateEndlessXp } from '../utils/calculateXP';

const RETRY_DELAYS_MS = [500, 1500, 3000];

export class EndlessCompletionHandler {
  constructor(
    private createSession: (body: SessionPayload) => Promise<Response>
  ) {}

  async handleCompletion(
    stats: CompletionStats,
    difficulty: EndlessDifficulty = 'beginner'
  ): Promise<CompletionResult> {
    const totalWords = stats.correctWords + stats.incorrectWords;
    const payload: SessionPayload = {
      mode: 'endless',
      wpm: Math.round(stats.finalWpm),
      totalWords,
      correctWords: stats.correctWords,
      incorrectWords: stats.incorrectWords,
      difficulty,
    };

    // Fire save in background with retries — don't block UI.
    // The authoritative XP is awarded server-side; we preview the same amount
    // client-side (mirrors backend formula) so the "+N XP" reward can show
    // immediately without waiting on the network. reloadPlayerStats then syncs
    // the real total.
    void this.saveWithRetry(payload);

    const xpDelta = calculateEndlessXp(
      payload.incorrectWords,
      payload.wpm,
      difficulty
    );

    return {
      action: 'loadNewText',
      message: 'Session completed!',
      xpDelta,
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
