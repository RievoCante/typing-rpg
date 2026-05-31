import { useEffect, useRef } from 'react';
import type { MonsterTypeEnum } from '../context/GameContext';

const ATTACK_INTERVALS: Record<MonsterTypeEnum, number> = {
  normal: 6,
  'mini-boss': 5,
  boss: 4,
};

const PERIODIC_DAMAGE: Record<MonsterTypeEnum, number> = {
  normal: 3,
  'mini-boss': 5,
  boss: 7,
};

interface Args {
  currentMode: 'daily' | 'endless' | 'raid';
  currentMonsterType: MonsterTypeEnum;
  isPlayerDead: boolean;
  isCurrentMonsterDefeated: boolean;
  totalWords: number;
  hasStartedTyping: boolean;
  isPaused: boolean;
  damagePlayer: (amount: number) => void;
}

// Periodic monster attacks fire only in endless mode, while typing is active
// and the monster is alive. Raid mode runs its own attack loop server-side.
export function useMonsterAttackLoop({
  currentMode,
  currentMonsterType,
  isPlayerDead,
  isCurrentMonsterDefeated,
  totalWords,
  hasStartedTyping,
  isPaused,
  damagePlayer,
}: Args) {
  const attackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const inactive =
      currentMode !== 'endless' ||
      isPlayerDead ||
      isCurrentMonsterDefeated ||
      totalWords === 0 ||
      !hasStartedTyping ||
      isPaused;

    if (inactive) {
      if (attackTimerRef.current) {
        clearInterval(attackTimerRef.current);
        attackTimerRef.current = null;
      }
      return;
    }

    const attackInterval = ATTACK_INTERVALS[currentMonsterType] * 1000;
    attackTimerRef.current = setInterval(() => {
      damagePlayer(PERIODIC_DAMAGE[currentMonsterType]);
      try {
        window.dispatchEvent(new Event('monster-attack'));
      } catch {
        // window not available
      }
    }, attackInterval);

    return () => {
      if (attackTimerRef.current) {
        clearInterval(attackTimerRef.current);
        attackTimerRef.current = null;
      }
    };
  }, [
    currentMode,
    currentMonsterType,
    isPlayerDead,
    isCurrentMonsterDefeated,
    totalWords,
    hasStartedTyping,
    isPaused,
    damagePlayer,
  ]);
}
