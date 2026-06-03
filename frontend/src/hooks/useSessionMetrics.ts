import { useRef, useCallback, useMemo, useEffect } from 'react';
import { consistency } from '../utils/consistency';
import type { SessionMetrics } from '../types/completion';

const MAX_SAMPLES = 300;

interface MetricsState {
  start: number | null;
  correct: number;
  incorrect: number;
  activeThisTick: boolean;
  prevIncorrect: number;
  afkSeconds: number;
  wpm: number[];
  raw: number[];
  err: number[];
  intervalId: ReturnType<typeof setInterval> | null;
}

const fresh = (): MetricsState => ({
  start: null,
  correct: 0,
  incorrect: 0,
  activeThisTick: false,
  prevIncorrect: 0,
  afkSeconds: 0,
  wpm: [],
  raw: [],
  err: [],
  intervalId: null,
});

// Fight (endless) / quote (daily) scoped keystroke metrics. Keystroke counts are
// monotonic and survive endless block refills; the 1 Hz sampler builds the
// per-second arrays + AFK seconds. No timestamps are collected per keystroke.
export function useSessionMetrics() {
  const ref = useRef<MetricsState>(fresh());

  const tick = useCallback(() => {
    const s = ref.current;
    if (s.start === null) return;
    const elapsedMin = (Date.now() - s.start) / 60000;
    const safeMin = elapsedMin > 0 ? elapsedMin : 1 / 60;
    const total = s.correct + s.incorrect;
    if (s.wpm.length < MAX_SAMPLES) {
      s.wpm.push(Math.round(s.correct / 5 / safeMin));
      s.raw.push(Math.round(total / 5 / safeMin));
      s.err.push(s.incorrect - s.prevIncorrect);
    }
    s.prevIncorrect = s.incorrect;
    if (!s.activeThisTick) s.afkSeconds += 1;
    s.activeThisTick = false;
  }, []);

  const startIfNeeded = useCallback(() => {
    const s = ref.current;
    if (s.start !== null) return;
    s.start = Date.now();
    s.intervalId = setInterval(tick, 1000);
  }, [tick]);

  const recordKeypress = useCallback((correct: boolean) => {
    const s = ref.current;
    if (correct) s.correct += 1;
    else s.incorrect += 1;
    s.activeThisTick = true;
  }, []);

  const finalize = useCallback((elapsedMinutes: number): SessionMetrics => {
    const s = ref.current;
    if (s.intervalId !== null) {
      clearInterval(s.intervalId);
      s.intervalId = null;
    }
    const total = s.correct + s.incorrect;
    const rawWpm =
      elapsedMinutes > 0 ? Math.round(total / 5 / elapsedMinutes) : 0;
    const accuracy = total > 0 ? Math.round((s.correct / total) * 100) : 100;
    return {
      rawWpm,
      accuracy,
      consistency: consistency(s.raw),
      afkSeconds: s.afkSeconds,
      chartData: { wpm: [...s.wpm], raw: [...s.raw], err: [...s.err] },
    };
  }, []);

  const reset = useCallback(() => {
    const s = ref.current;
    if (s.intervalId !== null) clearInterval(s.intervalId);
    ref.current = fresh();
  }, []);

  useEffect(() => {
    return () => {
      if (ref.current.intervalId !== null)
        clearInterval(ref.current.intervalId);
    };
  }, []);

  return useMemo(
    () => ({ startIfNeeded, recordKeypress, finalize, reset }),
    [startIfNeeded, recordKeypress, finalize, reset]
  );
}
