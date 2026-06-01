// Post-kill results panel. Replaces the brief celebrate flash: it holds the
// speed rating + session stats on screen until the player presses Space (or
// clicks), instead of auto-advancing to the next monster.
export interface KillResult {
  title: string; // speed rating, e.g. "FAST"
  wpm: number;
  accuracy: number; // 0-100, word-level
  xp?: number; // present in endless (per-kill XP); omitted in daily quotes
  subline?: string; // optional context line, e.g. "Quote 2 of 3 complete"
}

interface KillResultOverlayProps {
  visible: boolean;
  result: KillResult | null;
  onContinue: () => void;
}

export default function KillResultOverlay({
  visible,
  result,
  onContinue,
}: KillResultOverlayProps) {
  if (!visible || !result) return null;
  return (
    <div
      className="absolute inset-0 bg-black/40 flex items-center justify-center z-20 cursor-pointer rounded-lg pointer-events-auto"
      onClick={onContinue}
    >
      <div className="px-8 py-6 rounded-xl backdrop-blur-sm bg-black/30 flex flex-col items-center gap-4 drop-shadow text-center">
        <div className="text-yellow-400 font-bold text-3xl sm:text-4xl tracking-wide">
          {result.title}
        </div>

        <div className="flex items-end justify-center gap-6 text-gray-100">
          <Stat value={`${result.wpm}`} label="WPM" />
          <Stat value={`${result.accuracy}%`} label="Accuracy" />
          {typeof result.xp === 'number' && (
            <Stat value={`+${result.xp}`} label="XP" accent />
          )}
        </div>

        {result.subline && (
          <div className="text-sm text-gray-300">{result.subline}</div>
        )}

        <div className="mt-1 text-xs sm:text-sm font-semibold text-gray-200 animate-pulse">
          Press SPACE to continue
        </div>
      </div>
    </div>
  );
}

function Stat({
  value,
  label,
  accent = false,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <span
        className={`font-bold text-2xl sm:text-3xl ${accent ? 'text-green-400' : 'text-white'}`}
      >
        {value}
      </span>
      <span className="text-[10px] sm:text-xs uppercase tracking-widest text-gray-400">
        {label}
      </span>
    </div>
  );
}
