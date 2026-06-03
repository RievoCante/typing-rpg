// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessionMetrics } from './useSessionMetrics';
import type { SessionMetrics } from '../types/completion';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useSessionMetrics', () => {
  it('computes accuracy from keystroke counters', () => {
    const { result } = renderHook(() => useSessionMetrics());
    act(() => result.current.startIfNeeded());
    act(() => {
      for (let i = 0; i < 9; i++) result.current.recordKeypress(true);
      result.current.recordKeypress(false); // 9 correct / 1 wrong
    });
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    let m: SessionMetrics | undefined;
    act(() => {
      m = result.current.finalize(1); // 1 minute elapsed
    });
    expect(m!.accuracy).toBe(90);
    expect(m!.rawWpm).toBe(2); // 10 chars /5 /1min
  });

  it('samples once per second and counts AFK seconds', () => {
    const { result } = renderHook(() => useSessionMetrics());
    act(() => result.current.startIfNeeded());
    act(() => {
      result.current.recordKeypress(true);
      vi.advanceTimersByTime(1000);
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    let m: SessionMetrics | undefined;
    act(() => {
      m = result.current.finalize(2 / 60);
    });
    expect(m!.chartData.raw.length).toBe(2);
    expect(m!.afkSeconds).toBe(1);
  });

  it('reset clears counters and stops sampling', () => {
    const { result } = renderHook(() => useSessionMetrics());
    act(() => result.current.startIfNeeded());
    act(() => {
      result.current.recordKeypress(true);
      result.current.reset();
      vi.advanceTimersByTime(3000);
    });
    let m: SessionMetrics | undefined;
    act(() => {
      m = result.current.finalize(0);
    });
    expect(m!.accuracy).toBe(100); // no keypresses after reset
    expect(m!.chartData.raw.length).toBe(0);
  });
});
