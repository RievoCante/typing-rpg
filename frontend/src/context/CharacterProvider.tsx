import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useApi } from '../hooks/useApi';
import {
  parseStoredAvatarConfig,
  type PlayerAvatarConfig,
} from '../utils/avatarConfig';
import { CharacterContext, CHARACTER_STORAGE_KEY } from './characterContext';

export function CharacterProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { getMe, updateCharacter } = useApi();
  const [config, setConfig] = useState<PlayerAvatarConfig | null>(null);
  const [ready, setReady] = useState(false);
  // Track the auth state we last loaded for, so a mid-session transition
  // (e.g. a guest signs in via the header) re-loads the correct config source.
  const loadedForSignedIn = useRef<boolean | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (loadedForSignedIn.current === (isSignedIn ?? false)) return;
    loadedForSignedIn.current = isSignedIn ?? false;
    let cancelled = false;
    (async () => {
      try {
        if (isSignedIn) {
          const res = await getMe();
          if (res.ok) {
            const data = await res.json();
            const raw = data?.user?.character ?? null;
            if (!cancelled) setConfig(parseStoredAvatarConfig(raw));
          }
        } else {
          const raw = localStorage.getItem(CHARACTER_STORAGE_KEY);
          if (!cancelled) setConfig(parseStoredAvatarConfig(raw));
        }
      } catch {
        if (!cancelled) setConfig(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getMe]);

  const save = useCallback(
    async (next: PlayerAvatarConfig) => {
      // Optimistic update, rolled back if persistence fails so in-memory state
      // never diverges from what was actually saved.
      const prev = config;
      setConfig(next);
      try {
        if (isSignedIn) {
          await updateCharacter(next);
        } else {
          localStorage.setItem(CHARACTER_STORAGE_KEY, JSON.stringify(next));
        }
      } catch (e) {
        setConfig(prev);
        throw e;
      }
    },
    [config, isSignedIn, updateCharacter]
  );

  return (
    <CharacterContext.Provider value={{ config, save, ready }}>
      {children}
    </CharacterContext.Provider>
  );
}
