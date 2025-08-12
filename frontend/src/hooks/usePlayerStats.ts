// This hook manages the player's statistics from the server.
import { useEffect, useState, useCallback } from 'react';
import { useApi } from './useApi';

export const usePlayerStats = () => {
  const { getMe } = useApi();
  const [level, setLevel] = useState(1);
  const [currentXp, setCurrentXp] = useState(0);
  const [xpToNextLevel, setXpToNextLevel] = useState(20);

  const load = useCallback(async () => {
    try {
      const res = await getMe();
      if (!res.ok) return; // 404 before create is fine
      const data = await res.json();
      const user = data.user ?? data.data?.user ?? data;
      if (user && typeof user.level === 'number' && typeof user.xp === 'number') {
        setLevel(user.level);
        setCurrentXp(user.xp);
        // naive recompute: next level requirement mirrors backend curve
        const computeNext = (lvl: number) => {
          if (lvl <= 1) return 20;
          let req = 20;
          for (let i = 2; i <= lvl; i++) req = Math.ceil(req * 1.2);
          return req;
        };
        setXpToNextLevel(computeNext(user.level));
      }
    } catch {
      // ignore
    }
  }, [getMe]);

  useEffect(() => {
    load();
  }, [load]);

  return { level, currentXp, xpToNextLevel, reload: load };
};
