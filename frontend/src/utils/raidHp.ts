// HP → visual feedback mapping for raid player health bars.
// Color classes are returned as COMPLETE literal strings so Tailwind's
// content scanner (it reads .ts files) keeps them in the build.

export const HP_THRESHOLDS = {
  HEALTHY: 50, // strictly above -> green
  CAUTION: 25, // [25, 50] -> amber; below -> red
} as const;

export type HpStatus = 'healthy' | 'caution' | 'critical';

export type HpColorClass =
  | 'bg-green-500'
  | 'bg-amber-500'
  | 'bg-red-500'
  | 'bg-gray-500';

export function hpStatus(percent: number): HpStatus {
  if (percent > HP_THRESHOLDS.HEALTHY) return 'healthy';
  if (percent >= HP_THRESHOLDS.CAUTION) return 'caution';
  return 'critical';
}

// Tailwind bg-* class for an HP bar fill. Dead players are always grey.
export function hpColorClass(percent: number, isAlive = true): HpColorClass {
  if (!isAlive) return 'bg-gray-500';
  switch (hpStatus(percent)) {
    case 'healthy':
      return 'bg-green-500';
    case 'caution':
      return 'bg-amber-500';
    case 'critical':
      return 'bg-red-500';
  }
}

// Whether to apply a pulsing/critical emphasis: below 25% and still alive.
export function isCriticalHp(percent: number, isAlive = true): boolean {
  return isAlive && hpStatus(percent) === 'critical';
}
