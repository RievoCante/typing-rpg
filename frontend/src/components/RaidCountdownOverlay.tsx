import { useEffect, useState } from 'react';

// Whole seconds remaining until `endsAt`, clamped at 0. Pure so it can be
// unit-tested without a DOM (frontend vitest runs in the node environment).
export function countdownRemaining(endsAt: number, nowMs: number): number {
  return Math.max(0, Math.ceil((endsAt - nowMs) / 1000));
}

interface RaidCountdownOverlayProps {
  endsAt: number;
}

// Full-screen "get ready" overlay shown during the auto-start countdown. Ticks
// locally off `endsAt`; the server's `game_started` is what actually swaps to
// the game, so any sub-second clock skew is invisible.
export default function RaidCountdownOverlay({
  endsAt,
}: RaidCountdownOverlayProps) {
  const [remaining, setRemaining] = useState(() =>
    countdownRemaining(endsAt, Date.now())
  );

  useEffect(() => {
    setRemaining(countdownRemaining(endsAt, Date.now()));
    const id = setInterval(() => {
      setRemaining(countdownRemaining(endsAt, Date.now()));
    }, 200);
    return () => clearInterval(id);
  }, [endsAt]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm text-white">
      <p className="mb-4 text-lg uppercase tracking-widest text-gray-300">
        Room full — get ready
      </p>
      <div className="text-8xl font-extrabold tabular-nums animate-pulse">
        {remaining > 0 ? remaining : 'Starting…'}
      </div>
    </div>
  );
}
