// Simple full-screen loading UI shown during bootstrap.
import { useEffect, useRef, useState } from 'react';

export default function LoadingScreen() {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    const durationMs = 2000; // match minimum splash time
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const pct = Math.min(100, (elapsed / durationMs) * 100);
      setProgress(pct);
      if (pct < 100) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#303446] text-gray-200">
      <div className="w-80 max-w-[80%]">
        <div className="text-sm mb-3 tracking-wide text-gray-300">Preparing your adventure…</div>
        <div className="w-full h-2 rounded-full bg-gray-700 overflow-hidden">
          <div
            className="h-full rounded-full bg-yellow-400 transition-[width] duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}


