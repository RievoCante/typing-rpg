import type { MonsterVariant } from '../context/GameContext';
import type { MonsterFamily } from './Monster';

interface MonsterNameplateProps {
  family: MonsterFamily;
  variant: MonsterVariant;
}

const FAMILY_LABEL: Record<MonsterFamily, string> = {
  slime: 'Slime',
  golem: 'Golem',
  mushroom: 'Mushroom',
  crystal: 'Crystal',
};

// Per-variant badge styling. Common gets a muted label; elite/rare get a
// glowing label so a special spawn reads instantly. Rare pulses for extra
// "jackpot" feel.
const VARIANT_STYLE: Record<
  MonsterVariant,
  { prefix: string; className: string }
> = {
  common: {
    prefix: '',
    className: 'text-slate-300 border-slate-500/50 bg-slate-600/20',
  },
  elite: {
    prefix: '⚡ Elite',
    className:
      'text-amber-300 border-amber-400/60 bg-amber-500/10 shadow-[0_0_12px_rgba(251,191,36,0.45)]',
  },
  rare: {
    prefix: '✦ Rare',
    className:
      'text-violet-200 border-violet-400/70 bg-violet-500/15 shadow-[0_0_16px_rgba(167,139,250,0.6)] animate-pulse',
  },
};

// Floating label above the health bar naming the current monster. Shown for
// every variant — common is muted, elite/rare glow.
export default function MonsterNameplate({
  family,
  variant,
}: MonsterNameplateProps) {
  const style = VARIANT_STYLE[variant];

  return (
    <div className="flex justify-center mb-1">
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-3 py-0.5 text-xs font-bold uppercase tracking-wide ${style.className}`}
      >
        {style.prefix ? `${style.prefix} ` : ''}
        {FAMILY_LABEL[family]}
      </span>
    </div>
  );
}
