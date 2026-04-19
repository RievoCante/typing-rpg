export interface CompletionStats {
  correctWords: number;
  incorrectWords: number;
  totalCharsIncludingSpaces: number;
  finalWpm: number;
  elapsedMinutes: number;
}

export interface CompletionResult {
  action: 'retry' | 'nextQuote' | 'showModal' | 'loadNewText' | 'saveError';
  message?: string;
  newAttempts?: number;
  xpDelta?: number;
  /** Only set when action === 'saveError'. Calling this retries the server save. */
  retrySave?: () => Promise<CompletionResult>;
}

export interface CompletionContext {
  currentAttempts: number;
  completedQuotes: number;
  hasShownDailyCompletion: boolean;
  currentDifficulty: 'easy' | 'medium' | 'hard';
}

export type Mode = 'daily' | 'endless';

export interface SessionPayload {
  mode: Mode;
  wpm: number;
  totalWords: number;
  correctWords: number;
  incorrectWords: number;
}

export interface SessionResponse {
  success: boolean;
  session: { xpDelta: number };
}
