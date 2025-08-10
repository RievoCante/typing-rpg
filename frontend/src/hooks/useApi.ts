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

  return { getMe, createMe };
}
