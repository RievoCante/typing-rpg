import { useCallback, useState } from 'react';
import { hpBonus } from '../utils/combatTuning';

const BASE_PLAYER_HEALTH = 100;
const MISTAKE_DAMAGE_MIN = 2;
const MISTAKE_DAMAGE_MAX = 5;

// `level` adds the faint level-derived max-HP bonus (+1 per 5 levels, uncapped).
// Defaults to 1 (no bonus) for guests / pre-load. Max HP = 100 + hpBonus(level).
export function usePlayerHealth(level: number = 1) {
  const maxPlayerHealth = BASE_PLAYER_HEALTH + hpBonus(level);
  const [playerHealth, setPlayerHealth] = useState<number>(maxPlayerHealth);
  const [isPlayerDead, setIsPlayerDead] = useState<boolean>(false);

  const damagePlayer = useCallback((amount: number) => {
    setPlayerHealth(prev => {
      const next = Math.max(0, prev - amount);
      if (next <= 0) setIsPlayerDead(true);
      return next;
    });
  }, []);

  const healPlayer = useCallback(
    (amount: number) => {
      setPlayerHealth(prev => Math.min(maxPlayerHealth, prev + amount));
    },
    [maxPlayerHealth]
  );

  const resetPlayerHealth = useCallback(() => {
    setPlayerHealth(maxPlayerHealth);
    setIsPlayerDead(false);
  }, [maxPlayerHealth]);

  const damagePlayerFromMistake = useCallback(() => {
    const damage =
      Math.floor(
        Math.random() * (MISTAKE_DAMAGE_MAX - MISTAKE_DAMAGE_MIN + 1)
      ) + MISTAKE_DAMAGE_MIN;
    damagePlayer(damage);
  }, [damagePlayer]);

  return {
    playerHealth,
    maxPlayerHealth,
    isPlayerDead,
    damagePlayer,
    healPlayer,
    resetPlayerHealth,
    damagePlayerFromMistake,
  };
}
