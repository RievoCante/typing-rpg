import type { LucideIcon } from 'lucide-react';
import { RARITY_COLOR, type Weapon, type WeaponRarity } from '../utils/weapons';
import { weaponDropIcon, weaponEffectLines } from '../utils/weaponDropDisplay';

// Rarity -> icon frame border/glow classes.
const RARITY_FRAME: Record<WeaponRarity, string> = {
  common: 'border-gray-400 shadow-gray-500/30',
  rare: 'border-sky-400 shadow-sky-500/40',
  epic: 'border-violet-400 shadow-violet-500/40',
  legendary: 'border-amber-400 shadow-amber-500/50',
};

interface WeaponDropModalProps {
  weapon: Weapon;
  onTake: () => void;
}

// Center-screen weapon-drop celebration (Endless). Renders on top of the kill
// flow (z-50) and gates the kill-result overlay until the player takes it via
// Space/Enter (handled in TypingInterface) or this Take button. The icon is a
// rarity-framed Lucide glyph — a drop-in slot for real art later.
export default function WeaponDropModal({
  weapon,
  onTake,
}: WeaponDropModalProps) {
  const Icon: LucideIcon = weaponDropIcon(weapon.id);
  const lines = weaponEffectLines(weapon);
  return (
    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 rounded-lg pointer-events-auto">
      <div className="px-8 py-6 rounded-xl backdrop-blur-sm bg-black/40 flex flex-col items-center gap-4 drop-shadow text-center max-w-sm">
        <span className="text-[0.7rem] uppercase tracking-widest text-gray-300">
          Weapon dropped
        </span>
        <div
          className={`flex h-24 w-24 items-center justify-center rounded-2xl border-2 bg-black/30 shadow-lg ${RARITY_FRAME[weapon.rarity]}`}
        >
          <Icon size={48} className={RARITY_COLOR[weapon.rarity]} aria-hidden />
        </div>
        <div className={`text-2xl font-bold ${RARITY_COLOR[weapon.rarity]}`}>
          {weapon.name}
        </div>
        <div className="flex flex-col items-center gap-0.5 text-sm text-gray-200">
          {lines.length > 0 ? (
            lines.map(line => <span key={line}>{line}</span>)
          ) : (
            <span className="text-gray-400">No bonuses</span>
          )}
        </div>
        <button
          type="button"
          onClick={onTake}
          className="mt-1 rounded-lg bg-amber-500 px-6 py-2 font-bold text-black transition-colors hover:bg-amber-400"
        >
          Take
        </button>
        <span className="text-[0.7rem] text-gray-300 animate-pulse">
          Press SPACE to take
        </span>
      </div>
    </div>
  );
}
