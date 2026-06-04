import { RotateCcw, Skull } from 'lucide-react';
import { useThemeContext } from '../hooks/useThemeContext';
import { useGameContext } from '../hooks/useGameContext';
import { grade } from '../utils/grade';
import { buildGraphSeries } from '../utils/battleReportData';
import { consistency } from '../utils/consistency';
import { RARITY_COLOR } from '../utils/weapons';

interface BattleReportProps {
  onRestart: () => void;
}

const GRAPH_W = 520;
const GRAPH_H = 160;

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

// Display-only run accuracy: error density over sampled seconds. Not an
// invariant — used solely to pick a letter grade for the recap.
function runAccuracy(err: number[], raw: number[]): number {
  const totalErr = err.reduce((a, b) => a + b, 0);
  const sampledSeconds = raw.filter(v => v > 0).length;
  if (sampledSeconds === 0) return 100;
  return Math.max(0, Math.round(100 - (100 * totalErr) / sampledSeconds));
}

export default function BattleReport({ onRestart }: BattleReportProps) {
  const { theme } = useThemeContext();
  const { runMetrics } = useGameContext();
  const dark = theme === 'dark';

  const {
    chart,
    critCount,
    totalXp,
    monstersDefeated,
    bestWpm,
    elapsedSeconds,
    loot,
  } = runMetrics;

  const series = buildGraphSeries(chart, GRAPH_W, GRAPH_H);
  const accuracy = runAccuracy(chart.err, chart.raw);
  const letter = grade(accuracy);
  const avgConsistency = consistency(chart.raw);

  const stats: { label: string; value: string }[] = [
    { label: 'Monsters', value: String(monstersDefeated) },
    { label: 'Total XP', value: `+${totalXp}` },
    { label: 'Best WPM', value: String(bestWpm) },
    { label: 'Crits', value: String(critCount) },
    { label: 'Consistency', value: `${avgConsistency}%` },
    { label: 'Duration', value: formatDuration(elapsedSeconds) },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        className={`w-full max-w-2xl rounded-2xl border-2 p-6 shadow-2xl ${
          dark
            ? 'bg-gray-900/95 border-gray-700 text-white'
            : 'bg-white border-gray-200 text-gray-900'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Skull size={24} className="text-red-400" />
            <h2 className="text-2xl font-bold tracking-wide">Battle Report</h2>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-4xl font-black text-yellow-400 leading-none">
              {letter}
            </span>
            <span className="text-[10px] uppercase tracking-widest text-gray-400">
              {accuracy}% acc
            </span>
          </div>
        </div>

        {/* Continuous per-second run graph: WPM (solid), raw (faint), error ticks */}
        <div
          className={`rounded-lg p-3 mb-5 ${dark ? 'bg-black/30' : 'bg-gray-100'}`}
        >
          <svg
            viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`}
            width="100%"
            height={GRAPH_H}
            preserveAspectRatio="none"
            role="img"
            aria-label="Run WPM over time"
          >
            {series.rawPoints && (
              <polyline
                points={series.rawPoints}
                fill="none"
                stroke="currentColor"
                strokeOpacity={0.25}
                strokeWidth={1.5}
              />
            )}
            {series.wpmPoints && (
              <polyline
                points={series.wpmPoints}
                fill="none"
                className="text-yellow-400"
                stroke="currentColor"
                strokeWidth={2}
              />
            )}
            {series.errMarkers.map((m, i) => (
              <line
                key={i}
                x1={m.x}
                y1={GRAPH_H}
                x2={m.x}
                y2={GRAPH_H - 8}
                stroke="#f87171"
                strokeWidth={2}
              />
            ))}
          </svg>
          {chart.wpm.length === 0 && (
            <p className="text-center text-xs text-gray-400">
              No samples this run
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4 mb-5">
          {stats.map(s => (
            <div key={s.label} className="flex flex-col items-center">
              <span className="text-2xl font-bold">{s.value}</span>
              <span className="text-[10px] uppercase tracking-widest text-gray-400">
                {s.label}
              </span>
            </div>
          ))}
        </div>

        <div className="mb-6">
          <h3 className="text-xs uppercase tracking-widest text-gray-400 mb-2">
            Loot
          </h3>
          {loot.length === 0 ? (
            <p className="text-sm text-gray-400">
              No weapons dropped this run.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {loot.map(w => (
                <li
                  key={w.id}
                  className={`text-sm font-semibold ${RARITY_COLOR[w.rarity]}`}
                >
                  {w.name}
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          onClick={onRestart}
          className="w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors bg-red-600 hover:bg-red-500 text-white"
        >
          <RotateCcw size={18} />
          New Run
        </button>
      </div>
    </div>
  );
}
