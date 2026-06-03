import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';

interface FrameLimiterProps {
  /** Target frames per second. Default 30 — plenty for idle/hit animations. */
  fps?: number;
}

// Caps a `frameloop="demand"` Canvas to `fps` by driving invalidate() from a
// throttled rAF loop. Continuous useFrame animations (idle bob, hover, hit
// lerp) keep running, just sampled at the capped rate instead of the display's
// native refresh — which is up to 120Hz on ProMotion Macs, where two or three
// WebGL canvases at full refresh are the main CPU/GPU heat source.
//
// elapsedTime advances by real wall-clock time on each render, so animation
// SPEED is unchanged; only the sampling rate drops. The browser throttles rAF
// when the tab is hidden, so off-screen rendering pauses for free.
export default function FrameLimiter({ fps = 30 }: FrameLimiterProps) {
  const invalidate = useThree(state => state.invalidate);

  useEffect(() => {
    const minDelta = 1000 / fps;
    let last = -Infinity;
    let raf = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (t - last >= minDelta) {
        last = t;
        invalidate();
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [fps, invalidate]);

  return null;
}
