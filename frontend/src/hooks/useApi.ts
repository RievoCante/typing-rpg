// simple API client using Clerk token
import { useAuth } from '@clerk/clerk-react';
import { useCallback, useMemo } from 'react';

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
    [baseUrl, getToken],
  );

  const getMe = useCallback(() => authFetch('/me'), [authFetch]);
  const createMe = useCallback(() => authFetch('/me', { method: 'POST' }), [authFetch]);

  const createSession = useCallback(
    (body: {
      mode: 'daily' | 'endless';
      wpm: number;
      totalWords: number;
      correctWords: number;
      incorrectWords: number;
    }) =>
      authFetch('/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    [authFetch],
  );

  const getRecentSessions = useCallback(
    (limit = 20) => authFetch(`/sessions?limit=${encodeURIComponent(limit)}`),
    [authFetch],
  );

  const getDailyStatus = useCallback(() => authFetch('/daily/status'), [authFetch]);

  return { getMe, createMe, createSession, getRecentSessions, getDailyStatus };
}
