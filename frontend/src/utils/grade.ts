// Letter grade from keystroke accuracy (0–100). Battle Report only.
// Locked thresholds: S ≥98 · A ≥95 · B ≥90 · C ≥80 · D <80.
export type Grade = 'S' | 'A' | 'B' | 'C' | 'D';

export function grade(accuracy: number): Grade {
  const a = Math.max(0, Math.min(100, accuracy));
  if (a >= 98) return 'S';
  if (a >= 95) return 'A';
  if (a >= 90) return 'B';
  if (a >= 80) return 'C';
  return 'D';
}
