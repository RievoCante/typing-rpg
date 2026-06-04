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

// Fast, styled hover tooltip for a loadout chip. Replaces the native `title`
// attribute (which has a ~0.5s browser delay and unstyled OS appearance) with
// an instant CSS fade. Sits above the chip; parent chip must be `group relative`.
function ChipTip({ children }: { children: React.ReactNode }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-max max-w-[14rem] -translate-x-1/2 translate-y-1 rounded-md bg-gray-800/95 px-2.5 py-1.5 text-center text-xs font-medium text-gray-100 opacity-0 shadow-xl ring-1 ring-gray-700 transition duration-100 group-hover:translate-y-0 group-hover:opacity-100"
    >
      {children}
    </span>
  );
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
    'group relative flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors';

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
            className={`${chipBase} ${
              loadout === null
                ? 'border-amber-400 bg-amber-900/40 text-amber-200'
                : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500'
            }`}
          >
            <ChipTip>Fists — start with no weapon</ChipTip>
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
                  className={`${chipBase} cursor-not-allowed border-gray-800 bg-gray-900 text-gray-600`}
                >
                  <ChipTip>{w.name} — locked (find it in a run)</ChipTip>
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
                className={`${chipBase} ${
                  isSelected
                    ? 'border-amber-400 bg-amber-900/40'
                    : 'border-gray-700 bg-gray-800 hover:border-gray-500'
                } ${RARITY_COLOR[w.rarity]}`}
              >
                <ChipTip>
                  <span className="font-semibold">{w.name}</span>
                  <span className="mt-0.5 block text-gray-300">
                    {statLine(w)}
                  </span>
                </ChipTip>
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
