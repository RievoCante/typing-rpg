import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useApi } from './useApi';

// Persistent weapon vault (Phase 3b). Loads the signed-in user's unlocked
// weapons + selected loadout from the backend, records newly-found weapons as
// they drop during a run (auto-unlock, fire-and-forget with retry), and lets the
// pre-run panel choose a loadout. Logged-out users get an empty, read-only vault
// (Endless then falls back to Fists). Must be a single shared instance — it is
// instantiated in GameProvider and exposed via context.

const MAX_UNLOCK_RETRIES = 3;

// Fire-and-forget POST with a few retries so a found weapon isn't lost to a
// transient network blip. Best-effort: gives up silently after the last try.
async function unlockWithRetry(
  post: (ids: string[]) => Promise<Response>,
  ids: string[]
): Promise<void> {
  for (let attempt = 0; attempt < MAX_UNLOCK_RETRIES; attempt++) {
    try {
      const res = await post(ids);
      if (res.ok) return;
    } catch {
      // network error — fall through to retry
    }
  }
}

export interface WeaponVault {
  unlocked: string[];
  loadout: string | null;
  setLoadout: (id: string | null) => void;
  isSignedIn: boolean;
  isLoading: boolean;
}

export function useWeaponVault(): WeaponVault {
  const { isSignedIn } = useAuth();
  const { getWeaponVault, unlockWeapons, selectLoadout } = useApi();

  const [unlocked, setUnlocked] = useState<string[]>([]);
  const [loadout, setLoadoutState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Ref mirror of the unlocked set so the (stable) weapon-drop listener can
  // dedupe without re-subscribing on every unlock.
  const unlockedSetRef = useRef<Set<string>>(new Set());

  // Load the vault on sign-in; clear it on sign-out.
  useEffect(() => {
    if (!isSignedIn) {
      setUnlocked([]);
      setLoadoutState(null);
      unlockedSetRef.current = new Set();
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    getWeaponVault()
      .then(res => (res.ok ? res.json() : null))
      .then((data: { unlocked?: unknown; loadout?: unknown } | null) => {
        if (cancelled || !data) return;
        const list = Array.isArray(data.unlocked)
          ? (data.unlocked.filter(x => typeof x === 'string') as string[])
          : [];
        setUnlocked(list);
        unlockedSetRef.current = new Set(list);
        setLoadoutState(typeof data.loadout === 'string' ? data.loadout : null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getWeaponVault]);

  // Record weapons found mid-run: each unique drop unlocks once (optimistic
  // local update + backend POST). Only genuinely-new ids POST, so a full
  // collection makes zero requests.
  useEffect(() => {
    if (!isSignedIn) return;
    const handler = (e: Event) => {
      const id = (e as CustomEvent<{ id?: string }>).detail?.id;
      if (!id || unlockedSetRef.current.has(id)) return;
      unlockedSetRef.current.add(id);
      setUnlocked(prev => (prev.includes(id) ? prev : [...prev, id]));
      void unlockWithRetry(unlockWeapons, [id]);
    };
    window.addEventListener('weapon-drop', handler as EventListener);
    return () =>
      window.removeEventListener('weapon-drop', handler as EventListener);
  }, [isSignedIn, unlockWeapons]);

  const setLoadout = useCallback(
    (id: string | null) => {
      // Only an unlocked weapon (or null = Fists) is a valid loadout.
      if (id !== null && !unlockedSetRef.current.has(id)) return;
      setLoadoutState(id);
      selectLoadout(id).catch(() => {}); // fire-and-forget
    },
    [selectLoadout]
  );

  return { unlocked, loadout, setLoadout, isSignedIn: !!isSignedIn, isLoading };
}
