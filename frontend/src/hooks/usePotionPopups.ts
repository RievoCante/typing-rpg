import { useEffect, useRef, useState } from 'react';
import { playPotionDrop, playPotionHeal } from '../utils/sfxEngine';

export interface PotionPopupItem {
  id: number;
  topPct: number;
  leftPct: number;
  show: boolean;
  text: string;
  // Drives the text colour: a drop is purple/pink, a heal is green, a warn
  // (e.g. drinking at full HP) is amber.
  kind: 'drop' | 'heal' | 'warn';
}

interface PotionHealDetail {
  amount: number;
}

// Fade transition length; must match the `duration-500` on the popup element.
const FADE_MS = 500;

// Listens for the `potion-drop` and `potion-heal` window events (dispatched by
// usePotionSystem) and emits floating popups, while also playing the matching
// sound effect. Lifecycle: spawn hidden → fade in → hold visible (`holdMs`) →
// fade out → remove.
export function usePotionPopups() {
  const [popups, setPopups] = useState<PotionPopupItem[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    const spawn = (
      text: string,
      kind: 'drop' | 'heal' | 'warn',
      leftPct: number,
      topBase: number,
      holdMs: number,
      jitterX = 8,
      jitterY = 12
    ) => {
      const left = leftPct + (Math.random() * jitterX - jitterX / 2);
      const top = topBase + (Math.random() * jitterY - jitterY / 2);
      const id = ++idRef.current;
      setPopups(prev => [
        ...prev,
        { id, topPct: top, leftPct: left, show: false, text, kind },
      ]);
      setTimeout(() => {
        setPopups(prev =>
          prev.map(p => (p.id === id ? { ...p, show: true } : p))
        );
      }, 10);
      setTimeout(() => {
        setPopups(prev =>
          prev.map(p => (p.id === id ? { ...p, show: false } : p))
        );
      }, 10 + holdMs);
      setTimeout(
        () => {
          setPopups(prev => prev.filter(p => p.id !== id));
        },
        10 + holdMs + FADE_MS
      );
    };

    const onDrop = () => {
      playPotionDrop();
      // Anchor the popup to the *actual* potion panel rather than a fixed
      // viewport %: the panel sits at the right edge of a centered max-w-5xl
      // container, so a hardcoded percentage drifts far from it on wide
      // screens. We read the panel's on-screen rect and convert its centre to
      // viewport-relative percentages so the gain always lands right over the
      // slots. Small jitter keeps repeated drops from stacking. Holds ~2.5s.
      const anchor = document.querySelector('[data-potion-anchor]');
      if (anchor) {
        const r = anchor.getBoundingClientRect();
        const leftPct = ((r.left + r.width / 2) / window.innerWidth) * 100;
        // ~22% down the panel puts the text over the "POTIONS" label / top
        // slot, floating just above the flasks rather than covering them.
        const topPct = ((r.top + r.height * 0.22) / window.innerHeight) * 100;
        spawn('+1 Potion', 'drop', leftPct, topPct, 2500, 4, 6);
      } else {
        spawn('+1 Potion', 'drop', 85, 40, 2500);
      }
    };

    // Spawn a popup randomly positioned around the player's vertical health
    // bar so the gain lands right where the user is looking. We measure the
    // bar's on-screen rect ([data-hp-anchor]) and place the text just to its
    // right, with vertical jitter spanning the bar's height. Falls back to a
    // fixed viewport % if the bar isn't mounted (e.g. raid layout).
    const spawnNearHpBar = (
      text: string,
      kind: 'heal' | 'warn',
      holdMs: number
    ) => {
      const anchor = document.querySelector('[data-hp-anchor]');
      if (anchor) {
        const r = anchor.getBoundingClientRect();
        // ~28px to the right of the bar so the text floats beside it, not over.
        const leftPct = ((r.right + 28) / window.innerWidth) * 100;
        // Centre vertically on the bar; jitterY (below) spreads it across height.
        const topPct = ((r.top + r.height / 2) / window.innerHeight) * 100;
        // Span ~90% of the bar's height for the random vertical placement.
        const jitterY = (r.height / window.innerHeight) * 100 * 0.9;
        spawn(text, kind, leftPct, topPct, holdMs, 6, jitterY);
      } else {
        spawn(text, kind, 16, 38, holdMs);
      }
    };

    const onHeal = (e: Event) => {
      const detail = (e as CustomEvent<PotionHealDetail>).detail;
      const amount = detail?.amount ?? 0;
      if (amount <= 0) return;
      playPotionHeal();
      spawnNearHpBar(`+${amount} HP`, 'heal', 900);
    };

    const onFull = () => {
      // Player tried to drink at full HP — nothing was consumed. Warn near the
      // health bar (same anchor as a heal) so it's clear why nothing happened.
      spawnNearHpBar('HP already full', 'warn', 1200);
    };

    window.addEventListener('potion-drop', onDrop as EventListener);
    window.addEventListener('potion-heal', onHeal as EventListener);
    window.addEventListener('potion-full', onFull as EventListener);
    return () => {
      window.removeEventListener('potion-drop', onDrop as EventListener);
      window.removeEventListener('potion-heal', onHeal as EventListener);
      window.removeEventListener('potion-full', onFull as EventListener);
    };
  }, []);

  return popups;
}
