export function calculateXP(
  currentMode: 'daily' | 'endless',
  incorrectWordCount: number
): number {
  if (currentMode === 'endless') {
    let rewardXp = 100;
    if (incorrectWordCount > 8) {
      rewardXp = 0;
    } else if (incorrectWordCount >= 7) {
      rewardXp *= 0.2;
    } else if (incorrectWordCount >= 5) {
      rewardXp *= 0.4;
    } else if (incorrectWordCount >= 3) {
      rewardXp *= 0.6;
    } else if (incorrectWordCount >= 1) {
      rewardXp *= 0.8;
    }
    return Math.floor(rewardXp);
  } else if (currentMode === 'daily') {
    // NOTE: Daily mode logic
    return 0;
  }
  return 0; // Default return if mode is somehow not matched
}
