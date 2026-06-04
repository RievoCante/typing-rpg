import { useEffect, useState } from 'react';
import { playArpeggio } from '../utils/sfxEngine';
import { hpBonus, levelDmgBonus } from '../utils/combatTuning';

interface LevelUpToastProps {
  level: number;
  milestone: boolean;
  onDismiss: () => void;
}

const FADE_MS = 1200; // slow fade-out once the hold window ends

// Subtle level-up celebration moment (Endless, signed-in only). Rendered just
// below the Player Level card (absolute, anchored to that fixed card). Plain
// level-up = "Level Up!" + number; milestone (every 5 levels) = bigger note +
// the reward granted. Fades in fast, holds, then slowly fades away before
// dismissing. Reuses the chiptune arpeggio family for SFX.
export default function LevelUpToast({
  level,
  milestone,
  onDismiss,
}: LevelUpToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Ascending arpeggio — brighter/longer for a milestone.
    if (milestone) {
      playArpeggio([523, 659, 784, 1047, 1319], 0.09, 0.32);
    } else {
      playArpeggio([659, 988], 0.07, 0.26);
    }

    const holdMs = milestone ? 2600 : 1800;
    const showTimer = setTimeout(() => setVisible(true), 20); // fade in
    const hideTimer = setTimeout(() => setVisible(false), holdMs); // start slow fade out
    const dismissTimer = setTimeout(onDismiss, holdMs + FADE_MS); // unmount after fade
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      clearTimeout(dismissTimer);
    };
  }, [milestone, onDismiss]);

  const hp = hpBonus(level);
  const dmg = levelDmgBonus(level);

  return (
    <div
      className="pointer-events-none absolute top-full right-0 left-0 mt-16 flex justify-center"
      role="status"
      aria-live="polite"
    >
      <div
        className={`rounded-lg border-2 border-yellow-400 bg-slate-900/90 px-6 py-3 text-center shadow-lg transition-all ease-out ${
          visible
            ? 'opacity-100 translate-y-0 duration-300'
            : 'opacity-0 -translate-y-2 duration-[1200ms]'
        }`}
      >
        <div className="text-lg font-bold tracking-wide text-yellow-300">
          {milestone ? 'Milestone!' : 'Level Up!'}
        </div>
        <div className="text-2xl font-extrabold text-white">Lv {level}</div>
        {milestone && (
          <div className="mt-1 text-xs text-emerald-300">
            +{hp} Max HP · +{dmg.toFixed(2)} Base DMG
          </div>
        )}
      </div>
    </div>
  );
}
