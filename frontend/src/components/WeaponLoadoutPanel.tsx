import { Sword, Hand, Lock } from 'lucide-react';
import { useGameContext } from '../hooks/useGameContext';
import { ALL_WEAPONS, RARITY_COLOR, type Weapon } from '../utils/weapons';

// Compact stat summary for a weapon's hover title, e.g. "+2 DMG · +8% Crit".
function statLine(w: Weapon): string {
  const parts: string[] = [];
  if (w.bonusDamage) parts.push(`+${w.bonusDamage} DMG`);
  if (w.bonusCritChance)
    parts.push(`+${Math.round(w.bonusCritChance * 100)}% Crit`);
  if (w.critMultBonus) parts.push(`+${w.critMultBonus}× Crit DMG`);
  return parts.join(' · ') || 'No bonuses';
}

interface WeaponLoadoutPanelProps {
  // Called after the player picks a loadout chip — confirms the choice and
  // starts the run. When omitted, picking just sets the loadout (legacy inline use).
  onConfirm?: () => void;
}

// Pre-run loadout picker (Endless, Phase 3b). Renders as a dark overlay card
// inside the typing area: unlocked weapons are selectable as the run's starting
// weapon, locked ones are greyed with a lock. "Fists" clears the loadout. Picking
// any chip confirms the loadout and starts the run. Logged-out users see a sign-in
// hint and a read-only (all-locked) pool.
export default function WeaponLoadoutPanel({
  onConfirm,
}: WeaponLoadoutPanelProps) {
  const { weaponVault } = useGameContext();
  const { unlocked, loadout, setLoadout, isSignedIn } = weaponVault;
  const unlockedSet = new Set(unlocked);

  const chipBase =
    'flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors';

  return (
    <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-20 rounded-lg pointer-events-auto">
      <div className="px-6 py-5 rounded-xl backdrop-blur-sm bg-black/40 flex flex-col items-center gap-3 drop-shadow text-center max-w-md">
        <span className="text-amber-300 font-bold uppercase tracking-wide text-sm">
          Choose your weapon
        </span>
        {!isSignedIn && (
          <span className="text-[0.7rem] text-gray-300">
            Sign in to collect &amp; equip weapons
          </span>
        )}
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {/* Fists (no loadout) */}
          <button
            type="button"
            onClick={() => {
              setLoadout(null);
              onConfirm?.();
            }}
            title="Fists — start with no weapon"
            className={`${chipBase} ${
              loadout === null
                ? 'border-amber-400 bg-amber-900/40 text-amber-200'
                : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500'
            }`}
          >
            <Hand size={14} aria-hidden />
            Fists
          </button>

          {ALL_WEAPONS.map(w => {
            const isUnlocked = isSignedIn && unlockedSet.has(w.id);
            const isSelected = loadout === w.id;
            if (!isUnlocked) {
              return (
                <span
                  key={w.id}
                  title={`${w.name} — locked (find it in a run)`}
                  className={`${chipBase} cursor-not-allowed border-gray-800 bg-gray-900 text-gray-600`}
                >
                  <Lock size={14} aria-hidden />
                  {w.name}
                </span>
              );
            }
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => {
                  setLoadout(w.id);
                  onConfirm?.();
                }}
                title={`${w.name} — ${statLine(w)}`}
                className={`${chipBase} ${
                  isSelected
                    ? 'border-amber-400 bg-amber-900/40'
                    : 'border-gray-700 bg-gray-800 hover:border-gray-500'
                } ${RARITY_COLOR[w.rarity]}`}
              >
                <Sword size={14} aria-hidden />
                {w.name}
              </button>
            );
          })}
        </div>
        <span className="text-xs text-gray-300">
          Pick a weapon to start fighting
        </span>
      </div>
    </div>
  );
}
