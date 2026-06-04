import { useGameContext } from '../hooks/useGameContext';
import { useThemeContext } from '../hooks/useThemeContext';
import { CRIT_CHANCE_CAP } from '../utils/combatTuning';

// Tier purely for label/colour feel; crit math lives in combatTuning. Fill is
// scaled against the streak cap (50%) so the bar reads full once the streak is
// maxed; a weapon's flat crit bonus can push critChance slightly past the cap,
// hence the clamp.
function tier(streak: number, critChance: number) {
  if (streak <= 0)
    return { label: 'Combo', color: 'text-gray-500', fill: 0, glow: '' };
  const fill = Math.min(100, (critChance / CRIT_CHANCE_CAP) * 100);
  if (critChance >= CRIT_CHANCE_CAP)
    return {
      label: '🔥 BLAZING',
      color: 'text-pink-400',
      fill: 100,
      glow: 'combo-glow-blazing',
    };
  if (critChance >= CRIT_CHANCE_CAP * 0.6)
    return {
      label: '🔥 Hot',
      color: 'text-orange-400',
      fill,
      glow: 'combo-glow-hot',
    };
  return {
    label: 'Heating',
    color: 'text-yellow-300',
    fill,
    glow: '',
  };
}

export default function ComboMeter() {
  const { comboStreak, comboCritChance } = useGameContext();
  const { theme } = useThemeContext();
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
        className={`h-2 w-full overflow-hidden rounded-full ${t.glow} ${
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
