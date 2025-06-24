export interface CompletionStats {
  correctWords: number;
  incorrectWords: number;
  totalCharsIncludingSpaces: number;
  finalWpm: number;
  elapsedMinutes: number;
}

export interface CompletionResult {
  action: 'retry' | 'nextQuote' | 'showModal' | 'loadNewText';
  message?: string;
  newAttempts?: number;
}

export interface CompletionContext {
  currentAttempts: number;
  completedQuotes: number;
  hasShownDailyCompletion: boolean;
  currentDifficulty: 'easy' | 'medium' | 'hard';
} 