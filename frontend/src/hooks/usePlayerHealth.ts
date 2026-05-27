import { useCallback, useState } from 'react';

const MAX_PLAYER_HEALTH = 100;
const MISTAKE_DAMAGE_MIN = 2;
const MISTAKE_DAMAGE_MAX = 5;

export function usePlayerHealth() {
  const [playerHealth, setPlayerHealth] = useState<number>(MAX_PLAYER_HEALTH);
  const [isPlayerDead, setIsPlayerDead] = useState<boolean>(false);

  const damagePlayer = useCallback((amount: number) => {
    setPlayerHealth(prev => {
      const next = Math.max(0, prev - amount);
      if (next <= 0) setIsPlayerDead(true);
      return next;
    });
  }, []);

  const healPlayer = useCallback((amount: number) => {
    setPlayerHealth(prev => Math.min(MAX_PLAYER_HEALTH, prev + amount));
  }, []);

  const resetPlayerHealth = useCallback(() => {
    setPlayerHealth(MAX_PLAYER_HEALTH);
    setIsPlayerDead(false);
  }, []);

  const damagePlayerFromMistake = useCallback(() => {
    const damage =
      Math.floor(
        Math.random() * (MISTAKE_DAMAGE_MAX - MISTAKE_DAMAGE_MIN + 1)
      ) + MISTAKE_DAMAGE_MIN;
    damagePlayer(damage);
  }, [damagePlayer]);

  return {
    playerHealth,
    maxPlayerHealth: MAX_PLAYER_HEALTH,
    isPlayerDead,
    damagePlayer,
    healPlayer,
    resetPlayerHealth,
    damagePlayerFromMistake,
  };
}
