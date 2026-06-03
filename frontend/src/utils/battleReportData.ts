import type { ChartData } from '../types/completion';

export interface GraphSeries {
  /** SVG polyline points "x,y x,y …" for WPM. */
  wpmPoints: string;
  /** SVG polyline points "x,y x,y …" for raw WPM. */
  rawPoints: string;
  /** Positions of error markers (one per non-zero err sample). */
  errMarkers: { x: number; y: number }[];
  /** Y-axis upper bound used for scaling (>= 1). */
  maxY: number;
}

// Pure geometry for the Battle Report run graph. Scales per-second WPM/raw/err
// samples into an inline SVG box. x = index spread across `width`; y is flipped
// so higher values sit nearer the top (y=0). No DOM, fully unit-testable.
export function buildGraphSeries(
  chart: ChartData,
  width: number,
  height: number
): GraphSeries {
  const n = chart.wpm.length;
  if (n === 0) {
    return { wpmPoints: '', rawPoints: '', errMarkers: [], maxY: 1 };
  }

  const maxSample = Math.max(1, ...chart.wpm, ...chart.raw);
  const xAt = (i: number) => (n === 1 ? 0 : (i / (n - 1)) * width);
  const yAt = (v: number) => height - (v / maxSample) * height;

  const toPoints = (values: number[]) =>
    values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(' ');

  const errMarkers = chart.err
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e > 0)
    .map(({ i }) => ({ x: xAt(i), y: height }));

  return {
    wpmPoints: toPoints(chart.wpm),
    rawPoints: toPoints(chart.raw),
    errMarkers,
    maxY: maxSample,
  };
}
