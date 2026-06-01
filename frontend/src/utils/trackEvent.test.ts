import { describe, it, expect, beforeEach, vi } from 'vitest';
import { trackEvent, __resetTrackEventGuard } from './trackEvent';

function makeLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

describe('trackEvent', () => {
  beforeEach(() => {
    __resetTrackEventGuard();
    vi.unstubAllGlobals();
    vi.stubGlobal('localStorage', makeLocalStorage());
    vi.stubEnv('VITE_API_URL', 'https://api.test');
  });

  it('POSTs to /api/events with event + mode + anonId', () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    trackEvent('reached_game', 'daily');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.test/api/events');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body.event).toBe('reached_game');
    expect(body.mode).toBe('daily');
    expect(body.anonId).toBeTruthy();
  });

  it('dedupes the same event+mode within a page-load', () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    trackEvent('reached_game', 'daily');
    trackEvent('reached_game', 'daily');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not dedupe different modes', () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    trackEvent('reached_game', 'daily');
    trackEvent('reached_game', 'endless');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('swallows fetch rejection without throwing', () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network'));
    vi.stubGlobal('fetch', fetchMock);

    expect(() => trackEvent('started_typing', 'raid')).not.toThrow();
  });
});
