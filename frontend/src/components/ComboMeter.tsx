import { useGameContext } from '../hooks/useGameContext';
import { useThemeContext } from '../hooks/useThemeContext';

// Tier purely for label/colour feel; crit math lives in combatTuning.
function tier(streak: number, critChance: number) {
  if (streak <= 0) return { label: '', color: '', fill: 0 };
  if (critChance >= 0.75)
    return { label: '🔥 BLAZING', color: 'text-pink-400', fill: 100 };
  if (critChance >= 0.4)
    return {
      label: '🔥 Hot',
      color: 'text-orange-400',
      fill: (critChance / 0.75) * 100,
    };
  return {
    label: 'Heating',
    color: 'text-yellow-300',
    fill: (critChance / 0.75) * 100,
  };
}

export default function ComboMeter() {
  const { comboStreak, comboCritChance } = useGameContext();
  const { theme } = useThemeContext();
  if (comboStreak <= 0) return null;
  const t = tier(comboStreak, comboCritChance);

  return (
    <div className="mx-auto mb-2 flex w-full max-w-xs flex-col items-center gap-1 select-none">
      <div className="flex items-center gap-2 text-sm font-extrabold">
        <span className={t.color}>{t.label}</span>
        <span className={theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}>
          ×{comboStreak}
        </span>
        <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>
          {Math.round(comboCritChance * 100)}% crit
        </span>
      </div>
      <div
        className={`h-2 w-full overflow-hidden rounded-full ${
          theme === 'dark' ? 'bg-gray-800' : 'bg-gray-200'
        }`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-pink-500 transition-all duration-200"
          style={{ width: `${t.fill}%` }}
        />
      </div>
    </div>
  );
}
