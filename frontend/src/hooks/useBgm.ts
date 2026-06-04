// Manages background music playback, volume, mute, and persistence
import { useCallback, useEffect, useRef, useState } from 'react';

// The slider runs 0–1, but the track is hot, so we map the slider onto a
// quieter output ceiling: slider at max produces only this much element volume.
// Every position is correspondingly quieter — safer to start low and let
// players turn it up than to blast them.
const BGM_MAX_OUTPUT = 0.45;

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
    el.volume = muted ? 0 : volume * BGM_MAX_OUTPUT;
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
    el.volume = muted ? 0 : volume * BGM_MAX_OUTPUT;
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

  // Auto-start music on the user's first interaction anywhere on the page.
  // Browsers block audio autoplay until a gesture, so we listen for the first
  // pointer/touch/key event, start playback, then remove the listeners.
  useEffect(() => {
    const events: (keyof WindowEventMap)[] = [
      'pointerdown',
      'touchstart',
      'keydown',
    ];
    const handler = () => {
      void ensurePlay();
      events.forEach(ev => window.removeEventListener(ev, handler));
    };
    events.forEach(ev =>
      window.addEventListener(ev, handler, { passive: true })
    );
    return () => events.forEach(ev => window.removeEventListener(ev, handler));
  }, [ensurePlay]);

  return { volume, setVolume, muted, toggleMute, ensurePlay };
}
