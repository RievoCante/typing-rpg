import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getAnonId, ANON_ID_KEY } from './anonId';

// vitest runs under the 'node' environment here, so localStorage is not global.
// Provide a minimal in-memory stub.
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

describe('getAnonId', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeLocalStorage());
  });

  it('creates and persists an id on first call', () => {
    const id = getAnonId();
    expect(id).toBeTruthy();
    expect(localStorage.getItem(ANON_ID_KEY)).toBe(id);
  });

  it('returns the same id on subsequent calls', () => {
    const a = getAnonId();
    const b = getAnonId();
    expect(a).toBe(b);
  });
});
