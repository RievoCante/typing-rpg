import { useEffect, useRef, useState } from 'react';
import { playPotionDrop, playPotionHeal } from '../utils/sfxEngine';

export interface PotionPopupItem {
  id: number;
  topPct: number;
  leftPct: number;
  show: boolean;
  text: string;
  // Drives the text colour: a drop is purple/pink, a heal is green.
  kind: 'drop' | 'heal';
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
      kind: 'drop' | 'heal',
      leftPct: number,
      topBase: number,
      holdMs: number
    ) => {
      const left = leftPct + (Math.random() * 8 - 4);
      const top = topBase + (Math.random() * 12 - 6);
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
      // Near the potion column on the right so the gain reads next to the slots.
      // Holds ~2.5s before fading so the player clearly notices the drop.
      spawn('+1 Potion', 'drop', 85, 40, 2500);
    };

    const onHeal = (e: Event) => {
      const detail = (e as CustomEvent<PotionHealDetail>).detail;
      const amount = detail?.amount ?? 0;
      if (amount <= 0) return;
      playPotionHeal();
      // Near the player health bar on the left.
      spawn(`+${amount} HP`, 'heal', 16, 38, 900);
    };

    window.addEventListener('potion-drop', onDrop as EventListener);
    window.addEventListener('potion-heal', onHeal as EventListener);
    return () => {
      window.removeEventListener('potion-drop', onDrop as EventListener);
      window.removeEventListener('potion-heal', onHeal as EventListener);
    };
  }, []);

  return popups;
}
