/**
 * Daily mode failure detection utilities.
 * Simple logic to determine if a daily quote attempt failed.
 */

// Configuration constant for failure threshold
export const DAILY_FAILURE_THRESHOLD = 5;

/**
 * Checks if a daily quote attempt failed based on incorrect word count.
 * 
 * @param incorrectWords - Number of incorrect words in the attempt
 * @returns true if the attempt failed (should retry), false if successful
 */
export const checkDailyFailure = (incorrectWords: number): boolean => {
  return incorrectWords >= DAILY_FAILURE_THRESHOLD;
};

/**
 * Gets a failure message for the user when they fail a daily quote.
 * 
 * @param incorrectWords - Number of incorrect words that caused the failure
 * @param difficulty - Current difficulty level (for context)
 * @returns User-friendly failure message
 */
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

/**
 * Gets a success message when user successfully completes a daily quote.
 * 
 * @param incorrectWords - Number of incorrect words (should be < 5)
 * @param difficulty - Current difficulty level
 * @returns User-friendly success message
 */
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