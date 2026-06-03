import type { MonsterVariant } from '../context/GameContext';

// Pure popup selection for combat juice. useCombatPopups consumes these and the
// TypingPopups CombatPopups component renders the returned text/size/color.

export interface CritPopupSpec {
  kind: 'crit';
  text: string;
  sizePx: number;
}

const CRIT_MIN_PX = 24;
const CRIT_MAX_PX = 48;

// Bigger crit number = bigger/brighter text, clamped so a huge crit still fits.
export function selectCritPopup(damage: number): CritPopupSpec {
  const sizePx = Math.min(
    CRIT_MAX_PX,
    Math.max(CRIT_MIN_PX, CRIT_MIN_PX + Math.max(0, damage) * 0.5)
  );
  return { kind: 'crit', text: `CRIT ${damage}!`, sizePx };
}

export interface KillPopupSpec {
  kind: 'kill';
  text: string;
  color: string;
}

// Variant-colored kill popup (common red, elite amber, rare violet — matching
// the death-burst palette in Monster.tsx::VARIANT_BURST).
const KILL_COLOR: Record<MonsterVariant, string> = {
  common: '#f87171',
  elite: '#fbbf24',
  rare: '#a78bfa',
};

export function killPopup(variant: MonsterVariant): KillPopupSpec {
  return { kind: 'kill', text: 'DEFEATED', color: KILL_COLOR[variant] };
}
