import { useThemeContext } from '../hooks/useThemeContext';
import { useGameContext } from '../hooks/useGameContext';
import { FlaskConical } from 'lucide-react';

// Endless potion inventory, shown to the right of the typing card. Potions drop
// as the player types and stack up to `maxPotions`. Clicking (or pressing
// Ctrl+H while typing) drinks one to heal.
export default function PotionSlot() {
  const { theme } = useThemeContext();
  const { potionCount, maxPotions, drinkPotion } = useGameContext();

  const isEmpty = potionCount <= 0;
  const slots = Array.from({ length: maxPotions }, (_, i) => i < potionCount);

  return (
    // Opaque backing panel: the dungeon scene behind this column has roaming
    // rat sprites that would otherwise show through the gaps around the slots
    // and read as junk on the bottom slot. A solid panel hides the scene
    // regardless of where a rat scurries (viewport-independent).
    <div
      className={`flex flex-col items-center gap-3 select-none rounded-2xl px-3 py-4 ${
        theme === 'dark'
          ? 'bg-gray-900 ring-1 ring-gray-800'
          : 'bg-gray-50 ring-1 ring-gray-200'
      }`}
    >
      <span
        className={`text-xs font-bold uppercase tracking-wide ${
          theme === 'dark' ? 'text-purple-300' : 'text-purple-600'
        }`}
      >
        Potions
      </span>

      <button
        type="button"
        onClick={drinkPotion}
        disabled={isEmpty}
        aria-label={`Use potion (Ctrl+H). ${potionCount} of ${maxPotions} stored.`}
        title="Use potion (Ctrl+H)"
        className={`flex flex-col items-center gap-2 rounded-lg p-2 transition-all ${
          isEmpty
            ? 'cursor-not-allowed opacity-60'
            : 'cursor-pointer hover:scale-105'
        }`}
      >
        {slots
          .slice()
          .reverse()
          .map((filled, idx) => (
            <span
              key={idx}
              className={`flex h-9 w-9 items-center justify-center rounded-md border-2 transition-colors ${
                filled
                  ? theme === 'dark'
                    ? 'border-pink-400 bg-purple-800'
                    : 'border-purple-400 bg-purple-200'
                  : theme === 'dark'
                    ? 'border-gray-700 bg-gray-800'
                    : 'border-gray-300 bg-gray-100'
              }`}
            >
              <FlaskConical
                size={20}
                className={
                  filled
                    ? theme === 'dark'
                      ? 'text-pink-300'
                      : 'text-purple-600'
                    : theme === 'dark'
                      ? 'text-gray-600'
                      : 'text-gray-300'
                }
              />
            </span>
          ))}
      </button>

      <span
        className={`text-xs font-bold ${
          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
        }`}
      >
        {potionCount}/{maxPotions}
      </span>

      <kbd
        className={`rounded border px-1.5 py-0.5 font-mono text-[0.65rem] font-semibold ${
          theme === 'dark'
            ? 'border-purple-500 bg-purple-800 text-purple-100'
            : 'border-purple-400 bg-purple-200 text-purple-800'
        }`}
      >
        Ctrl+H
      </kbd>
    </div>
  );
}
