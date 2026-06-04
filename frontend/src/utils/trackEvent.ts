// Fire-and-forget analytics beacon. Posts to the public POST /api/events route.
// Never throws and never blocks gameplay — a dropped beacon is acceptable.
import { getAnonId } from './anonId';

export type AnalyticsEvent = 'reached_game' | 'started_typing';
export type AnalyticsMode = 'daily' | 'endless' | 'raid';

// Per-page-load dedup: stops Endless's many quote-loads from inflating reached_game.
const sent = new Set<string>();

/** Test-only: reset the per-page-load dedup guard. */
export function __resetTrackEventGuard(): void {
  sent.clear();
}

export function trackEvent(event: AnalyticsEvent, mode: AnalyticsMode): void {
  const key = `${event}:${mode}`;
  if (sent.has(key)) return;
  sent.add(key);

  try {
    const baseUrl = import.meta.env.VITE_API_URL as string | undefined;
    if (!baseUrl) return;
    void fetch(`${baseUrl}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, anonId: getAnonId(), mode }),
      keepalive: true,
    }).catch(() => {
      // best-effort: never surface beacon failures
    });
  } catch {
    // never throw from analytics
  }
}
