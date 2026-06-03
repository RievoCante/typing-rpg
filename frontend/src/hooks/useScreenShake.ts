import { useEffect, useRef, useState } from 'react';
import {
  shakeForDamage,
  shakeOffset,
  KILL_SHAKE,
  prefersReducedMotion,
  type ShakeSpec,
} from '../utils/screenShake';

// Drives a transient CSS transform on the gameplay container. Listens for
// `combat-hit` (crit only) and `monster-killed` window events, then runs a
// requestAnimationFrame decay loop using the pure shakeOffset math. Honors
// prefers-reduced-motion: when set, returns 'none' and never starts a loop.
export function useScreenShake(): string {
  const [transform, setTransform] = useState('none');
  const rafRef = useRef<number | null>(null);
  const reducedRef = useRef(false);

  useEffect(() => {
    reducedRef.current = prefersReducedMotion();

    const run = (spec: ShakeSpec) => {
      if (reducedRef.current) return;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      const start = performance.now();
      const step = (now: number) => {
        const elapsed = now - start;
        if (elapsed >= spec.durationMs) {
          rafRef.current = null;
          setTransform('none');
          return;
        }
        const o = shakeOffset(spec, elapsed);
        setTransform(
          `translate(${o.x.toFixed(2)}px, ${o.y.toFixed(2)}px) rotate(${o.rotate.toFixed(3)}deg)`
        );
        rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    };

    const onHit = (e: Event) => {
      const detail = (e as CustomEvent<{ damage: number; crit: boolean }>)
        .detail;
      if (!detail?.crit) return; // only crits shake
      run(shakeForDamage(detail.damage));
    };
    const onKill = () => run(KILL_SHAKE);

    window.addEventListener('combat-hit', onHit as EventListener);
    window.addEventListener('monster-killed', onKill as EventListener);
    return () => {
      window.removeEventListener('combat-hit', onHit as EventListener);
      window.removeEventListener('monster-killed', onKill as EventListener);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return transform;
}
