// This hook manages the player's statistics, including level, XP, and level-up logic.
import { useState, useMemo, useCallback } from 'react';

// Calculates the XP required to advance from the current level to the next.
const calculateXpToNextLevel = (level: number): number => {
  if (level <= 0) {
    console.warn(
      `calculateXpToNextLevel called with invalid level: ${level}. Defaulting to base XP.`
    );
    return 20;
  }
  if (level === 1) {
    return 20; // XP to go from level 1 to 2
  }

  // Start with the XP required to reach level 2 (when player is level 1)
  let requiredXpForPreviousLevelTransition = 20;

  // Iterate from level 2 up to the player's current 'level'.
  for (let i = 2; i <= level; i++) {
    requiredXpForPreviousLevelTransition = Math.ceil(
      requiredXpForPreviousLevelTransition * 1.2
    );
  }
  return requiredXpForPreviousLevelTransition;
};

export const usePlayerStats = () => {
  const [level, setLevel] = useState(1);
  const [currentXp, setCurrentXp] = useState(0);

  // useMemo ensures this calculation is only re-run when the level changes.
  const xpToNextLevel = useMemo(() => calculateXpToNextLevel(level), [level]);

  const addXp = useCallback(
    (amount: number) => {
      let newXp = currentXp + amount;
      let newLevel = level;
      let requiredXp = calculateXpToNextLevel(newLevel);

      // Loop to handle multiple level-ups from a single XP gain.
      while (newXp >= requiredXp) {
        newXp -= requiredXp;
        newLevel++;
        requiredXp = calculateXpToNextLevel(newLevel);
      }

      setLevel(newLevel);
      setCurrentXp(newXp);
    },
    [currentXp, level]
  );

  return { level, currentXp, xpToNextLevel, addXp };
};
