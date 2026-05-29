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
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || loadedRef.current) return;
    loadedRef.current = true;
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
      setConfig(next);
      if (isSignedIn) {
        await updateCharacter(next);
      } else {
        localStorage.setItem(CHARACTER_STORAGE_KEY, JSON.stringify(next));
      }
    },
    [isSignedIn, updateCharacter]
  );

  return (
    <CharacterContext.Provider value={{ config, save, ready }}>
      {children}
    </CharacterContext.Provider>
  );
}
