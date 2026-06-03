// Consistency scoring, matching monkeytype's `kogasa`.
// consistency = 100 * (1 - tanh(cov + cov^3/3 + cov^5/5)), cov = stdDev/mean.
// Uses POPULATION std dev (divide by n). NaN/empty → 0.

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function populationStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const m = mean(values);
  const variance =
    values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function kogasa(cov: number): number {
  return 100 * (1 - Math.tanh(cov + cov ** 3 / 3 + cov ** 5 / 5));
}

// Consistency over a samples array (e.g. raw WPM per second). <2 samples → 0.
export function consistency(samples: number[]): number {
  if (samples.length < 2) return 0;
  const m = mean(samples);
  if (m === 0) return 0;
  const cov = populationStdDev(samples) / m;
  const value = kogasa(cov);
  return Number.isFinite(value) ? Math.round(value) : 0;
}
