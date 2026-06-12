// Handles initial bootstrap: ensure user exists, fetch daily status, and enforce splash duration.
// Note: this intentionally does NOT set the game mode — the app always lands in the
// default 'endless' mode (see GameProvider). Mode only changes by user action.
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useApi } from './useApi';

export function useBootstrap(markCompletedToday: () => void) {
  const { isSignedIn } = useAuth();
  const { getMe, createMe, getDailyStatus } = useApi();
  const alreadyBootstrapped =
    typeof window !== 'undefined' &&
    sessionStorage.getItem('bootstrap_done') === '1';
  const [bootstrapping, setBootstrapping] = useState(!alreadyBootstrapped);
  const hasRun = useRef(false);

  useEffect(() => {
    const start = Date.now();
    let cancelled = false;
    const finish = () => {
      const elapsed = Date.now() - start;
      const minMs = 2000; // at least 2s splash
      const delay = Math.max(0, minMs - elapsed);
      const id = setTimeout(() => {
        if (!cancelled) {
          setBootstrapping(false);
          try {
            sessionStorage.setItem('bootstrap_done', '1');
          } catch {
            // ignore storage errors
          }
        }
      }, delay);
      return () => clearTimeout(id);
    };

    // API calls only once per mount (even in StrictMode double-fire).
    // Splash screen is still shown on first visit.
    if (!hasRun.current) {
      hasRun.current = true;
      (async () => {
        try {
          if (isSignedIn) {
            const r1 = await getMe();
            if (r1.status === 404) {
              await createMe();
            } else if (r1.ok) {
              // Re-sync username from Clerk on every boot (handles username changes)
              await createMe();
            }

            const r2 = await getDailyStatus();
            if (r2.ok) {
              const { completedToday } = await r2.json();
              if (completedToday) {
                markCompletedToday();
              }
            }
          }
        } catch {
          // ignore
        } finally {
          finish();
        }
      })();
    } else {
      // StrictMode second run: just finish the splash timer.
      finish();
    }

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getMe, createMe, getDailyStatus, markCompletedToday]);

  return { bootstrapping };
}
