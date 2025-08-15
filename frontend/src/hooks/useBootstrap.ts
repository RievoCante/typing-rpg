// Handles initial bootstrap: ensure user exists, fetch daily status, set mode, and enforce splash duration
import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useApi } from './useApi';
import { useGameContext } from './useGameContext';

export function useBootstrap(markCompletedToday: () => void) {
  const { isSignedIn } = useAuth();
  const { getMe, createMe, getDailyStatus } = useApi();
  const { setCurrentMode } = useGameContext();
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    const start = Date.now();
    let cancelled = false;
    const finish = () => {
      const elapsed = Date.now() - start;
      const minMs = 2000; // at least 2s splash
      const delay = Math.max(0, minMs - elapsed);
      const id = setTimeout(() => { if (!cancelled) setBootstrapping(false); }, delay);
      return () => clearTimeout(id);
    };

    (async () => {
      try {
        if (isSignedIn) {
          const r1 = await getMe();
          if (r1.status === 404) await createMe();

          const r2 = await getDailyStatus();
          if (r2.ok) {
            const { completedToday } = await r2.json();
            if (completedToday) {
              markCompletedToday();
              setCurrentMode('endless');
            } else {
              setCurrentMode('daily');
            }
          }
        } else {
          setCurrentMode('daily');
        }
      } catch {
        // ignore
      } finally {
        finish();
      }
    })();

    return () => { cancelled = true; };
  }, [isSignedIn, getMe, createMe, getDailyStatus, setCurrentMode, markCompletedToday]);

  return { bootstrapping };
}


