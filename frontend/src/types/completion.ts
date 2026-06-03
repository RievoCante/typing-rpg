import type { EndlessDifficulty } from '../hooks/useEndlessSettings';

/** Per-second history arrays for the future result graph. */
export interface ChartData {
  wpm: number[];
  raw: number[];
  err: number[];
}

/** Keystroke-derived metrics produced by useSessionMetrics.finalize(). */
export interface SessionMetrics {
  rawWpm: number;
  accuracy: number; // 0-100, keystroke-level
  consistency: number; // 0-100
  afkSeconds: number;
  chartData: ChartData;
}

export interface CompletionStats {
  correctWords: number;
  incorrectWords: number;
  totalCharsIncludingSpaces: number;
  finalWpm: number;
  elapsedMinutes: number;
  // Char breakdown (always present; from analyzeWords).
  correctChars: number;
  incorrectChars: number;
  extraChars: number;
  missedChars: number;
  // Keystroke-derived metrics (merged in at finalize sites; optional so pure
  // word-analysis paths and unit tests can omit them).
  metrics?: SessionMetrics;
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
  /** Endless word-list difficulty; scales XP server-side. Omitted for daily. */
  difficulty?: EndlessDifficulty;
  // New metrics — all optional so older paths still compile.
  rawWpm?: number;
  accuracy?: number;
  consistency?: number;
  correctChars?: number;
  incorrectChars?: number;
  extraChars?: number;
  missedChars?: number;
  durationSeconds?: number;
  afkSeconds?: number;
  chartData?: ChartData;
}

export interface SessionResponse {
  success: boolean;
  session: { xpDelta: number };
}
