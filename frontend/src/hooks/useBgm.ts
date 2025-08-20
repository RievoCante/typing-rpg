// Manages background music playback, volume, mute, and persistence
import { useCallback, useEffect, useRef, useState } from 'react';

export function useBgm(src = '/audio/typing-giggles.mp3') {
  const [volume, setVolume] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('bgm:volume');
      const v = saved ? parseFloat(saved) : 0.4;
      return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.4;
    } catch {
      return 0.4;
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
    if (!el) return;
    try {
      await el.play();
    } catch {
      /* ignore */
    }
  }, []);

  const toggleMute = useCallback(() => setMuted(m => !m), []);

  // One-time unlock: start playback on first user gesture anywhere
  useEffect(() => {
    let unlocked = false;
    const unlock = () => {
      if (unlocked) return;
      unlocked = true;
      ensurePlay();
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
      document.removeEventListener('touchstart', unlock);
    };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
    document.addEventListener('touchstart', unlock, {
      passive: true,
    } as AddEventListenerOptions);
    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
      document.removeEventListener('touchstart', unlock);
    };
  }, [ensurePlay]);

  return { volume, setVolume, muted, toggleMute, ensurePlay };
}
