import { useCallback, useRef, useState } from 'react';

export interface HitItem {
  id: number;
  topPct: number;
  leftPct: number;
  show: boolean;
  damage?: number;
  crit?: boolean;
}

// Drives the transient HIT popups that spawn near the monster when a word is
// successfully completed. Returns the list of active popups plus a trigger
// the caller invokes from its word-completion handler. Pass the damage dealt to
// float the number; omit it (daily/raid) to fall back to a generic "HIT".
export function useHitPopups() {
  const [hits, setHits] = useState<HitItem[]>([]);
  const idRef = useRef(0);

  const triggerHit = useCallback((damage?: number, crit?: boolean) => {
    const left = 50 + (Math.random() * 24 - 12);
    const top = 36 + (Math.random() * 16 - 8);
    const id = ++idRef.current;
    setHits(prev => [
      ...prev,
      { id, topPct: top, leftPct: left, show: false, damage, crit },
    ]);
    setTimeout(() => {
      setHits(prev => prev.map(h => (h.id === id ? { ...h, show: true } : h)));
    }, 10);
    setTimeout(() => {
      setHits(prev => prev.map(h => (h.id === id ? { ...h, show: false } : h)));
    }, 600);
    setTimeout(() => {
      setHits(prev => prev.filter(h => h.id !== id));
    }, 900);
  }, []);

  return { hits, triggerHit };
}
