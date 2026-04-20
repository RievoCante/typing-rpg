// Manages background music playback, volume, mute, and persistence
import { useCallback, useEffect, useRef, useState } from 'react';

export function useBgm(src = '/audio/typing-giggles.mp3') {
  const [volume, setVolume] = useState<number>(() => {
    const DEFAULT_VOLUME = 0.2;
    try {
      const saved = localStorage.getItem('bgm:volume');
      const v = saved ? parseFloat(saved) : DEFAULT_VOLUME;
      return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : DEFAULT_VOLUME;
    } catch {
      return DEFAULT_VOLUME;
    }
  });
  const [muted, setMuted] = useState<boolean>(() => {
    try {
      return localStorage.getItem('bgm:muted') === '1';
    } catch {
      return false;
    }
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Create audio element once
  useEffect(() => {
    if (typeof Audio === 'undefined') return;

    // Guard: Prevent duplicate audio elements during React StrictMode remounts
    if (audioRef.current) return;

    const el = new Audio(src);
    el.loop = true;
    el.preload = 'auto';
    el.autoplay = true; // will be allowed only after a gesture
    el.volume = muted ? 0 : volume;
    audioRef.current = el;
    return () => {
      el.pause();
      el.src = '';
      audioRef.current = null;
    };
    // muted/volume deliberately not included: we update volume in the next effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // Apply and persist changes
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = muted ? 0 : volume;
    try {
      localStorage.setItem('bgm:volume', String(volume));
      localStorage.setItem('bgm:muted', muted ? '1' : '0');
    } catch {
      // ignore storage errors
    }
  }, [volume, muted]);

  const ensurePlay = useCallback(async () => {
    const el = audioRef.current;
    if (!el || !el.paused) return; // Don't play if already playing
    try {
      await el.play();
    } catch {
      /* ignore */
    }
  }, []);

  const toggleMute = useCallback(() => setMuted(m => !m), []);

  // Audio only starts via VolumeControl interaction - no global auto-unlock
  // This ensures keyboard has zero effect on audio

  return { volume, setVolume, muted, toggleMute, ensurePlay };
}
