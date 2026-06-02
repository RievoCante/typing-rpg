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

// Per-variant badge styling. Common renders nothing (keeps the normal monster
// flow uncluttered); elite/rare get a glowing label so a special spawn reads
// instantly. Rare pulses for extra "jackpot" feel.
const VARIANT_STYLE: Record<
  Exclude<MonsterVariant, 'common'>,
  { prefix: string; className: string }
> = {
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

// Floating label above the health bar naming the current monster. Only shown
// for elite/rare variants (Endless) — common monsters show no badge.
export default function MonsterNameplate({
  family,
  variant,
}: MonsterNameplateProps) {
  if (variant === 'common') return null;

  const style = VARIANT_STYLE[variant];

  return (
    <div className="flex justify-center mb-1">
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-3 py-0.5 text-xs font-bold uppercase tracking-wide ${style.className}`}
      >
        {style.prefix} {FAMILY_LABEL[family]}
      </span>
    </div>
  );
}
