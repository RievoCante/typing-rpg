// Manages sound-effect volume, mute, and persistence. Playback itself is
// synthesized in sfxEngine; this hook keeps the engine's settings in sync and
// exposes playExplosion for components to trigger on game events.
import { useCallback, useEffect, useState } from 'react';
import {
  SFX_MUTED_KEY,
  SFX_VOLUME_KEY,
  setSfxSettings,
  playExplosion,
} from '../utils/sfxEngine';

export function useSfx() {
  const [volume, setVolume] = useState<number>(() => {
    const DEFAULT_VOLUME = 0.5;
    try {
      const saved = localStorage.getItem(SFX_VOLUME_KEY);
      const v = saved ? parseFloat(saved) : DEFAULT_VOLUME;
      return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : DEFAULT_VOLUME;
    } catch {
      return DEFAULT_VOLUME;
    }
  });
  const [muted, setMuted] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SFX_MUTED_KEY) === '1';
    } catch {
      return false;
    }
  });

  // Push settings to the engine and persist on change
  useEffect(() => {
    setSfxSettings({ volume, muted });
    try {
      localStorage.setItem(SFX_VOLUME_KEY, String(volume));
      localStorage.setItem(SFX_MUTED_KEY, muted ? '1' : '0');
    } catch {
      // ignore storage errors
    }
  }, [volume, muted]);

  const toggleMute = useCallback(() => setMuted(m => !m), []);

  return { volume, setVolume, muted, toggleMute, playExplosion };
}
