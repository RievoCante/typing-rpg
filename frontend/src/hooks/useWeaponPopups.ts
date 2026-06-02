import { useEffect, useRef, useState } from 'react';
import { playPotionDrop } from '../utils/sfxEngine';
import type { WeaponRarity } from '../utils/weapons';

export interface WeaponPopupItem {
  id: number;
  topPct: number;
  leftPct: number;
  show: boolean;
  text: string;
  rarity: WeaponRarity;
}

interface WeaponDropDetail {
  name: string;
  rarity: WeaponRarity;
  equipped: boolean;
}

// Fade transition length; must match the `duration-500` on the popup element.
const FADE_MS = 500;

// Listens for the `weapon-drop` window event (dispatched by useWeaponSystem) and
// emits a floating popup near the weapon slot, reusing the item-pickup SFX.
// Lifecycle mirrors usePotionPopups: spawn hidden → fade in → hold → fade → drop.
export function useWeaponPopups() {
  const [popups, setPopups] = useState<WeaponPopupItem[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    const spawn = (text: string, rarity: WeaponRarity) => {
      const left = 85 + (Math.random() * 8 - 4);
      const top = 55 + (Math.random() * 12 - 6);
      const id = ++idRef.current;
      setPopups(prev => [
        ...prev,
        { id, topPct: top, leftPct: left, show: false, text, rarity },
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
      }, 10 + 2200);
      setTimeout(
        () => {
          setPopups(prev => prev.filter(p => p.id !== id));
        },
        10 + 2200 + FADE_MS
      );
    };

    const onDrop = (e: Event) => {
      const detail = (e as CustomEvent<WeaponDropDetail>).detail;
      if (!detail) return;
      playPotionDrop();
      const text = detail.equipped
        ? `⚔️ ${detail.name}!`
        : `Found ${detail.name}`;
      spawn(text, detail.rarity);
    };

    window.addEventListener('weapon-drop', onDrop as EventListener);
    return () =>
      window.removeEventListener('weapon-drop', onDrop as EventListener);
  }, []);

  return popups;
}
