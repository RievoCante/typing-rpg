import { useEffect } from 'react';
import { playArpeggio } from '../utils/sfxEngine';
import { hpBonus, levelDmgBonus } from '../utils/combatTuning';

interface LevelUpToastProps {
  level: number;
  milestone: boolean;
  onDismiss: () => void;
}

// Subtle level-up celebration moment (Endless, signed-in only). Plain level-up
// = "Level Up!" + number; milestone (every 5 levels) = bigger note + the reward
// granted. Auto-dismisses; reuses the chiptune arpeggio family for SFX.
export default function LevelUpToast({
  level,
  milestone,
  onDismiss,
}: LevelUpToastProps) {
  useEffect(() => {
    // Ascending arpeggio — brighter/longer for a milestone.
    if (milestone) {
      playArpeggio([523, 659, 784, 1047, 1319], 0.09, 0.32);
    } else {
      playArpeggio([659, 988], 0.07, 0.26);
    }
    const t = setTimeout(onDismiss, milestone ? 2600 : 1800);
    return () => clearTimeout(t);
  }, [milestone, onDismiss]);

  const hp = hpBonus(level);
  const dmg = levelDmgBonus(level);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-24 z-50 flex justify-center"
      role="status"
      aria-live="polite"
    >
      <div className="animate-bounce rounded-lg border-2 border-yellow-400 bg-slate-900/90 px-6 py-3 text-center shadow-lg">
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
