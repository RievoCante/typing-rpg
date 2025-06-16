import { useState, useEffect, useCallback } from 'react';

interface QuoteStats {
  difficulty: 'easy' | 'medium' | 'hard';
  wpm: number;
  attempts: number;
}

interface DailyState {
  currentQuote: 'easy' | 'medium' | 'hard';
  completedQuotes: number; // 0-3
  isCompleted: boolean;
  lastCompletionDate: string; // YYYY-MM-DD format
  quoteStats: QuoteStats[]; // Stats for each completed quote
}

const getUTCDateString = (): string => {
  const now = new Date();
  return now.toISOString().split('T')[0]; // Returns YYYY-MM-DD
};

const getDefaultDailyState = (): DailyState => ({
  currentQuote: 'easy',
  completedQuotes: 0,
  isCompleted: false,
  lastCompletionDate: '',
  quoteStats: [],
});

export const useDailyProgress = () => {
  const [dailyState, setDailyState] = useState<DailyState>(getDefaultDailyState);

  // Load state from localStorage on mount
  // TODO: will use database later
  useEffect(() => {
    const today = getUTCDateString();
    const savedState = localStorage.getItem(`daily_progress_${today}`);
    
    if (savedState) {
      try {
        const parsedState = JSON.parse(savedState) as DailyState;
        
        // Clean up any duplicate entries in quoteStats (safety measure)
        const cleanedQuoteStats: QuoteStats[] = [];
        const seenDifficulties = new Set<string>();
        
        for (const stat of parsedState.quoteStats) {
          if (!seenDifficulties.has(stat.difficulty)) {
            cleanedQuoteStats.push(stat);
            seenDifficulties.add(stat.difficulty);
          }
        }
        
        const cleanedState = {
          ...parsedState,
          quoteStats: cleanedQuoteStats,
          completedQuotes: cleanedQuoteStats.length
        };
        
        setDailyState(cleanedState);
      } catch (error) {
        console.error('Failed to parse daily progress from localStorage:', error);
        setDailyState(getDefaultDailyState());
      }
    } else {
      // Check if we need to reset from previous day
      const allKeys = Object.keys(localStorage).filter(key => 
        key.startsWith('daily_progress_')
      );
      
      // Clean up old daily progress entries (optional)
      allKeys.forEach(key => {
        const date = key.replace('daily_progress_', '');
        if (date !== today) {
          localStorage.removeItem(key);
        }
      });
      
      setDailyState(getDefaultDailyState());
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    const today = getUTCDateString();
    localStorage.setItem(`daily_progress_${today}`, JSON.stringify(dailyState));
  }, [dailyState]);

  // Complete current quote and move to next
  const completeCurrentQuote = useCallback((wpm: number, attempts: number) => {
    setDailyState(prev => {
      // Check if this difficulty has already been completed to prevent duplicates
      const alreadyCompleted = prev.quoteStats.some(stat => stat.difficulty === prev.currentQuote);
      if (alreadyCompleted) {
        console.warn(`Quote difficulty ${prev.currentQuote} already completed, skipping duplicate`);
        return prev; // Don't add duplicate
      }
      
      const newQuoteStats = [...prev.quoteStats, { 
        difficulty: prev.currentQuote, 
        wpm, 
        attempts 
      }];
      const newCompletedQuotes = prev.completedQuotes + 1;
      
      // Determine next difficulty level
      let newCurrentQuote: 'easy' | 'medium' | 'hard' = 'easy';
      if (prev.currentQuote === 'easy') {
        newCurrentQuote = 'medium';
      } else if (prev.currentQuote === 'medium') {
        newCurrentQuote = 'hard';
      } else {
        newCurrentQuote = 'hard'; // Stay at hard if completed
      }
      
      const isCompleted = newCompletedQuotes >= 3;
      
      return {
        ...prev,
        currentQuote: isCompleted ? 'hard' : newCurrentQuote,
        completedQuotes: newCompletedQuotes,
        isCompleted,
        lastCompletionDate: isCompleted ? getUTCDateString() : prev.lastCompletionDate,
        quoteStats: newQuoteStats,
      };
    });
  }, []);

  // NOTE: Reset daily progress (for testing or manual reset)
  const resetDailyProgress = useCallback(() => {
    setDailyState(getDefaultDailyState());
    const today = getUTCDateString();
    localStorage.removeItem(`daily_progress_${today}`);
    console.log('Daily progress reset');
  }, []);

  // Force clear all daily progress data (for debugging)
  const clearAllDailyData = useCallback(() => {
    const allKeys = Object.keys(localStorage).filter(key => 
      key.startsWith('daily_progress_')
    );
    allKeys.forEach(key => localStorage.removeItem(key));
    setDailyState(getDefaultDailyState());
    console.log('All daily progress data cleared');
  }, []);

  // Get time until next reset (midnight UTC)
  const getTimeUntilReset = useCallback((): { hours: number; minutes: number; seconds: number } => {
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setUTCHours(24, 0, 0, 0); // Next midnight UTC
    
    const timeDiff = nextMidnight.getTime() - now.getTime();
    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
    
    return { hours, minutes, seconds };
  }, []);

  // Calculate average WPM from completed quotes
  const getAverageWPM = useCallback((): number => {
    if (dailyState.quoteStats.length === 0) return 0;
    
    const totalWPM = dailyState.quoteStats.reduce((sum, stat) => sum + stat.wpm, 0);
    return Math.round(totalWPM / dailyState.quoteStats.length);
  }, [dailyState.quoteStats]);

  // Get current difficulty based on current quote
  const getCurrentDifficulty = useCallback((): 'easy' | 'medium' | 'hard' => {
    return dailyState.currentQuote;
  }, [dailyState.currentQuote]);

  return {
    // State
    currentQuote: dailyState.currentQuote,
    completedQuotes: dailyState.completedQuotes,
    isCompleted: dailyState.isCompleted,
    quoteStats: dailyState.quoteStats,
    
    // Actions
    completeCurrentQuote,
    resetDailyProgress,
    clearAllDailyData,
    
    // Computed values
    getTimeUntilReset,
    getAverageWPM,
    getCurrentDifficulty,
  };
}; 