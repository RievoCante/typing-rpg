import { Sword, Hand, Lock } from 'lucide-react';
import { useThemeContext } from '../hooks/useThemeContext';
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

// Pre-run loadout picker (Endless, Phase 3b). Shows the fixed weapon pool:
// unlocked weapons are selectable as the run's starting weapon, locked ones are
// greyed with a lock. "Fists" clears the loadout. Logged-out users see a sign-in
// hint and a read-only (all-locked) pool. Mounted in EndlessOptions so it shows
// before the first keystroke starts the run.
export default function WeaponLoadoutPanel() {
  const { theme } = useThemeContext();
  const { weaponVault } = useGameContext();
  const { unlocked, loadout, setLoadout, isSignedIn } = weaponVault;
  const unlockedSet = new Set(unlocked);
  const dark = theme === 'dark';

  const chipBase =
    'flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors';

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-1.5">
      <div className="flex items-center gap-2">
        <span
          className={`text-xs font-bold uppercase tracking-wide ${
            dark ? 'text-amber-300' : 'text-amber-600'
          }`}
        >
          Loadout
        </span>
        {!isSignedIn && (
          <span
            className={`text-[0.65rem] ${dark ? 'text-gray-400' : 'text-gray-500'}`}
          >
            Sign in to collect & equip weapons
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {/* Fists (no loadout) */}
        <button
          type="button"
          onClick={() => setLoadout(null)}
          title="Fists — start with no weapon"
          className={`${chipBase} ${
            loadout === null
              ? dark
                ? 'border-amber-400 bg-amber-900/40 text-amber-200'
                : 'border-amber-400 bg-amber-100 text-amber-700'
              : dark
                ? 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500'
                : 'border-gray-300 bg-gray-100 text-gray-600 hover:border-gray-400'
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
                className={`${chipBase} cursor-not-allowed ${
                  dark
                    ? 'border-gray-800 bg-gray-900 text-gray-600'
                    : 'border-gray-200 bg-gray-50 text-gray-400'
                }`}
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
              onClick={() => setLoadout(w.id)}
              title={`${w.name} — ${statLine(w)}`}
              className={`${chipBase} ${
                isSelected
                  ? dark
                    ? 'border-amber-400 bg-amber-900/40'
                    : 'border-amber-400 bg-amber-100'
                  : dark
                    ? 'border-gray-700 bg-gray-800 hover:border-gray-500'
                    : 'border-gray-300 bg-gray-100 hover:border-gray-400'
              } ${RARITY_COLOR[w.rarity]}`}
            >
              <Sword size={14} aria-hidden />
              {w.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
