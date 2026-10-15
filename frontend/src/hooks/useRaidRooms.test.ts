// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRaidRooms } from './useRaidRooms';

const room = {
  roomId: 'ABCDEF',
  hostName: 'Host',
  playerCount: 1,
  maxPlayers: 3,
  status: 'lobby',
};
const response = () =>
  ({ ok: true, json: async () => ({ rooms: [room] }) }) as Response;
let hidden = false;
const setHidden = (value: boolean) => {
  hidden = value;
  act(() => document.dispatchEvent(new Event('visibilitychange')));
};
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  hidden = false;
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response()));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Raid room polling', () => {
  it('cleans the StrictMode replay and leaves only one polling loop', async () => {
    const { result, unmount } = renderHook(
      () => useRaidRooms('https://api.test', true),
      { reactStrictMode: true }
    );
    await flush();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fetch).mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(vi.mocked(fetch).mock.calls[1][1]?.signal?.aborted).toBe(false);
    expect(result.current.rooms).toEqual([room]);
    await act(async () => vi.advanceTimersByTimeAsync(30_000));
    expect(fetch).toHaveBeenCalledTimes(3);
    unmount();
    setHidden(true);
    setHidden(false);
    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('loads immediately then waits 30 seconds between completed requests', async () => {
    const { result } = renderHook(() => useRaidRooms('https://api.test', true));
    await flush();
    expect(result.current.rooms).toEqual([room]);
    expect(result.current.loading).toBe(false);
    await act(async () => vi.advanceTimersByTimeAsync(29_999));
    expect(fetch).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('stops while hidden and refreshes immediately when visible', async () => {
    renderHook(() => useRaidRooms('https://api.test', true));
    await flush();
    setHidden(true);
    await act(async () => vi.advanceTimersByTimeAsync(120_000));
    expect(fetch).toHaveBeenCalledTimes(1);
    setHidden(false);
    await flush();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not request until an initially hidden tab becomes visible', async () => {
    hidden = true;
    renderHook(() => useRaidRooms('https://api.test', true));
    expect(fetch).not.toHaveBeenCalled();
    setHidden(false);
    await flush();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('never overlaps slow requests and ignores aborted responses', async () => {
    let resolve!: (value: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(
      () =>
        new Promise(done => {
          resolve = done;
        })
    );
    const { result } = renderHook(() => useRaidRooms('https://api.test', true));
    await act(async () => vi.advanceTimersByTimeAsync(90_000));
    expect(fetch).toHaveBeenCalledTimes(1);
    const signal = vi.mocked(fetch).mock.calls[0][1]?.signal;
    setHidden(true);
    expect(signal?.aborted).toBe(true);
    setHidden(false);
    expect(fetch).toHaveBeenCalledTimes(1);
    await act(async () => resolve(response()));
    expect(result.current.rooms).toEqual([]);
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.current.rooms).toEqual([room]);
  });

  it('aborts on phase exit, ignores late results, and cleans timers/listeners', async () => {
    let resolve!: (value: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(
      () =>
        new Promise(done => {
          resolve = done;
        })
    );
    const { result, rerender, unmount } = renderHook(
      ({ enabled }) => useRaidRooms('https://api.test', enabled),
      { initialProps: { enabled: true } }
    );
    const signal = vi.mocked(fetch).mock.calls[0][1]?.signal;
    rerender({ enabled: false });
    expect(signal?.aborted).toBe(true);
    await act(async () => resolve(response()));
    expect(result.current.rooms).toEqual([]);
    setHidden(true);
    setHidden(false);
    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(fetch).toHaveBeenCalledTimes(1);
    rerender({ enabled: true });
    await flush();
    expect(fetch).toHaveBeenCalledTimes(2);
    unmount();
    setHidden(true);
    setHidden(false);
    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
