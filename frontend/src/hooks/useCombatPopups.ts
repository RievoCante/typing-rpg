import { useEffect, useRef, useState } from 'react';
import { playCrit, playComboBreak } from '../utils/sfxEngine';

export interface CombatPopupItem {
  id: number;
  topPct: number;
  leftPct: number;
  show: boolean;
  text: string;
  kind: 'crit' | 'break';
}

const FADE_MS = 500;

// Listens for `combat-hit` ({ damage, crit }) and `combo-break` window events
// and emits floating popups + SFX. Only crits pop a number — non-crit hits stay
// quiet to avoid spamming every word.
export function useCombatPopups() {
  const [popups, setPopups] = useState<CombatPopupItem[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    const spawn = (text: string, kind: 'crit' | 'break', holdMs: number) => {
      const left = 50 + (Math.random() * 12 - 6);
      const top = 32 + (Math.random() * 10 - 5);
      const id = ++idRef.current;
      setPopups(prev => [
        ...prev,
        { id, topPct: top, leftPct: left, show: false, text, kind },
      ]);
      setTimeout(
        () =>
          setPopups(prev =>
            prev.map(p => (p.id === id ? { ...p, show: true } : p))
          ),
        10
      );
      setTimeout(
        () =>
          setPopups(prev =>
            prev.map(p => (p.id === id ? { ...p, show: false } : p))
          ),
        10 + holdMs
      );
      setTimeout(
        () => setPopups(prev => prev.filter(p => p.id !== id)),
        10 + holdMs + FADE_MS
      );
    };

    const onHit = (e: Event) => {
      const detail = (e as CustomEvent<{ damage: number; crit: boolean }>)
        .detail;
      if (!detail?.crit) return; // only crits pop
      playCrit();
      spawn(`CRIT ${detail.damage}!`, 'crit', 700);
    };
    const onBreak = () => {
      playComboBreak();
      spawn('Combo broken', 'break', 600);
    };

    window.addEventListener('combat-hit', onHit as EventListener);
    window.addEventListener('combo-break', onBreak as EventListener);
    return () => {
      window.removeEventListener('combat-hit', onHit as EventListener);
      window.removeEventListener('combo-break', onBreak as EventListener);
    };
  }, []);

  return popups;
}
