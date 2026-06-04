// @vitest-environment jsdom
// Regression guard: bootstrap must NOT override the default game mode.
// The app's default mode is 'endless' (GameProvider). Previously useBootstrap
// forced 'daily' for signed-out users and signed-in users who hadn't finished
// the daily, which made the landing mode non-deterministic. The intended
// behavior is: always land on Endless, regardless of auth or daily status.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const setCurrentMode = vi.fn();
const getMe = vi.fn(async () => ({ status: 200 }) as Response);
const createMe = vi.fn(async () => ({ status: 200 }) as Response);
const getDailyStatus = vi.fn(
  async () =>
    ({
      ok: true,
      json: async () => ({ completedToday: false }),
    }) as unknown as Response
);
let signedIn = false;

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ isSignedIn: signedIn }),
}));
vi.mock('./useApi', () => ({
  useApi: () => ({ getMe, createMe, getDailyStatus }),
}));
vi.mock('./useGameContext', () => ({
  useGameContext: () => ({ setCurrentMode }),
}));

import { useBootstrap } from './useBootstrap';

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe('useBootstrap landing mode', () => {
  it('never overrides the mode when signed out', async () => {
    signedIn = false;
    const markCompletedToday = vi.fn();
    renderHook(() => useBootstrap(markCompletedToday));
    await waitFor(() => expect(getDailyStatus).not.toHaveBeenCalled(), {
      timeout: 100,
    }).catch(() => {});
    expect(setCurrentMode).not.toHaveBeenCalled();
  });

  it('never overrides the mode when signed in and daily not completed', async () => {
    signedIn = true;
    getDailyStatus.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ completedToday: false }),
    } as unknown as Response);
    const markCompletedToday = vi.fn();
    renderHook(() => useBootstrap(markCompletedToday));
    await waitFor(() => expect(getDailyStatus).toHaveBeenCalled());
    expect(setCurrentMode).not.toHaveBeenCalled();
  });

  it('never overrides the mode when signed in and daily completed', async () => {
    signedIn = true;
    getDailyStatus.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ completedToday: true }),
    } as unknown as Response);
    const markCompletedToday = vi.fn();
    renderHook(() => useBootstrap(markCompletedToday));
    await waitFor(() => expect(markCompletedToday).toHaveBeenCalled());
    expect(setCurrentMode).not.toHaveBeenCalled();
  });
});
