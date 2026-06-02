import { useThemeContext } from '../hooks/useThemeContext';
import { useGameContext } from '../hooks/useGameContext';
import { Sword, Hand } from 'lucide-react';
import { RARITY_COLOR } from '../utils/weapons';

// Compact stat summary line for the equipped weapon, e.g. "+2 DMG · +8% Crit".
function statLine(w: {
  bonusDamage: number;
  bonusCritChance: number;
  critMultBonus: number;
}): string {
  const parts: string[] = [];
  if (w.bonusDamage) parts.push(`+${w.bonusDamage} DMG`);
  if (w.bonusCritChance)
    parts.push(`+${Math.round(w.bonusCritChance * 100)}% Crit`);
  if (w.critMultBonus) parts.push(`+${w.critMultBonus}× Crit DMG`);
  return parts.join(' · ') || 'No bonuses';
}

// Endless weapon slot, shown in the right-hand column beside the potion slot.
// Displays the currently-equipped loot weapon (per-run); empty = Fists. Weapons
// drop from kills and auto-equip when stronger (see useWeaponSystem).
export default function WeaponSlot() {
  const { theme } = useThemeContext();
  const { equippedWeapon } = useGameContext();

  const tipRows = [
    'Drops from kills — better monsters, better loot',
    'A stronger weapon auto-equips',
    'Boosts damage & crit; resets on death',
  ];

  return (
    <div
      className={`group relative flex flex-col items-center gap-2 select-none rounded-2xl px-3 py-4 ${
        theme === 'dark'
          ? 'bg-gray-900 ring-1 ring-gray-800'
          : 'bg-gray-50 ring-1 ring-gray-200'
      }`}
    >
      {/* Hover tooltip explaining the loot loop. */}
      <div
        role="tooltip"
        className={`pointer-events-none absolute right-full top-1/2 z-50 mr-3 w-56 -translate-y-1/2 rounded-lg px-3 py-2.5 text-left opacity-0 shadow-xl ring-1 transition-opacity duration-150 group-hover:opacity-100 ${
          theme === 'dark'
            ? 'bg-gray-800 text-gray-200 ring-gray-700'
            : 'bg-white text-gray-700 ring-gray-200'
        }`}
      >
        <span
          className={`mb-1 block text-xs font-bold uppercase tracking-wide ${
            theme === 'dark' ? 'text-amber-300' : 'text-amber-600'
          }`}
        >
          Weapon
        </span>
        <ul className="space-y-0.5 text-xs leading-snug">
          {tipRows.map(row => (
            <li key={row}>{row}</li>
          ))}
        </ul>
      </div>

      <span
        className={`text-xs font-bold uppercase tracking-wide ${
          theme === 'dark' ? 'text-amber-300' : 'text-amber-600'
        }`}
      >
        Weapon
      </span>

      <div
        className={`flex h-9 w-9 items-center justify-center rounded-md border-2 ${
          equippedWeapon
            ? theme === 'dark'
              ? 'border-amber-400 bg-amber-900/40'
              : 'border-amber-400 bg-amber-100'
            : theme === 'dark'
              ? 'border-gray-700 bg-gray-800'
              : 'border-gray-300 bg-gray-100'
        }`}
      >
        {equippedWeapon ? (
          <Sword
            size={20}
            className={RARITY_COLOR[equippedWeapon.rarity]}
            aria-hidden
          />
        ) : (
          <Hand
            size={20}
            className={theme === 'dark' ? 'text-gray-600' : 'text-gray-300'}
            aria-hidden
          />
        )}
      </div>

      {equippedWeapon ? (
        <div className="flex flex-col items-center text-center">
          <span
            className={`text-xs font-bold ${RARITY_COLOR[equippedWeapon.rarity]}`}
          >
            {equippedWeapon.name}
          </span>
          <span
            className={`text-[0.6rem] leading-tight ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            }`}
          >
            {statLine(equippedWeapon)}
          </span>
        </div>
      ) : (
        <span
          className={`text-xs font-bold ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          }`}
        >
          Fists
        </span>
      )}
    </div>
  );
}
