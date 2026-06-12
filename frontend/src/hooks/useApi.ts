// simple API client using Clerk token
import { useAuth } from '@clerk/clerk-react';
import { useCallback, useMemo } from 'react';
import type { PlayerAvatarConfig } from '../utils/avatarConfig';
import type { SessionPayload } from '../types/completion';

export function useApi() {
  const { getToken } = useAuth();
  const baseUrl = useMemo(() => import.meta.env.VITE_API_URL as string, []);

  const authFetch = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const token = await getToken();
      const headers = new Headers(init.headers || {});
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return fetch(`${baseUrl}/api${path}`, { ...init, headers });
    },
    [baseUrl, getToken]
  );

  const getMe = useCallback(() => authFetch('/me'), [authFetch]);
  const createMe = useCallback(
    () => authFetch('/me', { method: 'POST' }),
    [authFetch]
  );

  const updateDisplayName = useCallback(
    (displayName: string | null) =>
      authFetch('/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName }),
      }),
    [authFetch]
  );

  const updateCharacter = useCallback(
    (config: PlayerAvatarConfig) =>
      authFetch('/me/character', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      }),
    [authFetch]
  );

  const createSession = useCallback(
    (body: SessionPayload) =>
      authFetch('/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    [authFetch]
  );

  const getRecentSessions = useCallback(
    (limit = 20) => authFetch(`/sessions?limit=${encodeURIComponent(limit)}`),
    [authFetch]
  );

  // Persistent weapon vault (Phase 3b).
  const getWeaponVault = useCallback(() => authFetch('/me/vault'), [authFetch]);

  const unlockWeapons = useCallback(
    (weaponIds: string[]) =>
      authFetch('/me/vault/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weaponIds }),
      }),
    [authFetch]
  );

  const selectLoadout = useCallback(
    (weaponId: string | null) =>
      authFetch('/me/vault/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weaponId }),
      }),
    [authFetch]
  );

  const getDailyStatus = useCallback(
    () => authFetch('/daily/status'),
    [authFetch]
  );

  // leaderboard (public)
  const getLeaderboardLevels = useCallback(
    (limit = 50, offset = 0) =>
      authFetch(
        `/leaderboard/levels?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`
      ),
    [authFetch]
  );
  const getLeaderboardTodayWpm = useCallback(
    (limit = 50, offset = 0) =>
      authFetch(
        `/leaderboard/today-wpm?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`
      ),
    [authFetch]
  );

  return {
    getMe,
    createMe,
    updateDisplayName,
    updateCharacter,
    createSession,
    getRecentSessions,
    getDailyStatus,
    getLeaderboardLevels,
    getLeaderboardTodayWpm,
    getWeaponVault,
    unlockWeapons,
    selectLoadout,
  };
}
