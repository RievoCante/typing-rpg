// A persistent, anonymous client identifier used to key analytics beacons.
// Random UUID stored in localStorage — no PII, no cookie. See utils/trackEvent.ts.
export const ANON_ID_KEY = 'trpg_anon_id';

export function getAnonId(): string {
  try {
    const existing = localStorage.getItem(ANON_ID_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(ANON_ID_KEY, id);
    return id;
  } catch {
    // localStorage unavailable (privacy mode / SSR) — ephemeral, non-persistent id.
    return 'anon-ephemeral';
  }
}
