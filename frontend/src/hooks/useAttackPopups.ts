import { useEffect, useRef, useState } from 'react';

export interface AttackItem {
  id: number;
  topPct: number;
  leftPct: number;
  show: boolean;
}

// Listens for the `monster-attack` window event (dispatched by the periodic
// attack loop) and emits transient ATTACK! popups near the player area.
export function useAttackPopups() {
  const [attacks, setAttacks] = useState<AttackItem[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    const onAttack = () => {
      const left = 15 + (Math.random() * 10 - 5);
      const top = 35 + (Math.random() * 20 - 10);
      const id = ++idRef.current;
      setAttacks(prev => [
        ...prev,
        { id, topPct: top, leftPct: left, show: false },
      ]);
      setTimeout(() => {
        setAttacks(prev =>
          prev.map(a => (a.id === id ? { ...a, show: true } : a))
        );
      }, 10);
      setTimeout(() => {
        setAttacks(prev =>
          prev.map(a => (a.id === id ? { ...a, show: false } : a))
        );
      }, 600);
      setTimeout(() => {
        setAttacks(prev => prev.filter(a => a.id !== id));
      }, 900);
    };

    window.addEventListener('monster-attack', onAttack as EventListener);
    return () => {
      window.removeEventListener('monster-attack', onAttack as EventListener);
    };
  }, []);

  return attacks;
}
