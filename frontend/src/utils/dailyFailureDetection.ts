// Configuration constant for failure threshold
export const DAILY_FAILURE_THRESHOLD = 5;

// Checks if a daily quote attempt failed based on incorrect word count.
export const checkDailyFailure = (incorrectWords: number): boolean => {
  return incorrectWords >= DAILY_FAILURE_THRESHOLD;
};

// Gets a failure message for the user when they fail a daily quote.
export const getDailyFailureMessage = (
  incorrectWords: number, 
  difficulty: 'easy' | 'medium' | 'hard'
): string => {
  const difficultyNames = {
    easy: 'Monster',
    medium: 'Mini Boss',
    hard: 'Boss'
  };
  
  return `${difficultyNames[difficulty]} defeated you! ${incorrectWords} incorrect words (max: ${DAILY_FAILURE_THRESHOLD - 1}). Try again!`;
};

// Gets a success message when user successfully completes a daily quote.
export const getDailySuccessMessage = (
  incorrectWords: number,
  difficulty: 'easy' | 'medium' | 'hard'
): string => {
  const difficultyNames = {
    easy: 'Monster',
    medium: 'Mini Boss', 
    hard: 'Boss'
  };
  
  if (incorrectWords === 0) {
    return `Perfect! ${difficultyNames[difficulty]} defeated with no errors!`;
  }
  
  return `${difficultyNames[difficulty]} defeated! ${incorrectWords} incorrect words.`;
}; 