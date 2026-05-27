import type { HitItem } from '../hooks/useHitPopups';
import type { AttackItem } from '../hooks/useAttackPopups';
import type { XpPopupState } from '../hooks/useXpPopup';

export function HitPopups({ hits }: { hits: HitItem[] }) {
  return (
    <>
      {hits.map(hit => (
        <div key={hit.id} className="fixed inset-0 pointer-events-none z-40">
          <div
            className={`absolute transition-all ${hit.show ? 'opacity-100 -translate-y-1 scale-110' : 'opacity-0 translate-y-0 scale-95'} duration-500 ease-out`}
            style={{
              top: `${hit.topPct}%`,
              left: `${hit.leftPct}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <span className="text-red-500 font-extrabold text-xl select-none drop-shadow">
              HIT
            </span>
          </div>
        </div>
      ))}
    </>
  );
}

export function AttackPopups({ attacks }: { attacks: AttackItem[] }) {
  return (
    <>
      {attacks.map(attack => (
        <div key={attack.id} className="fixed inset-0 pointer-events-none z-40">
          <div
            className={`absolute transition-all ${attack.show ? 'opacity-100 -translate-y-1 scale-110' : 'opacity-0 translate-y-0 scale-95'} duration-500 ease-out`}
            style={{
              top: `${attack.topPct}%`,
              left: `${attack.leftPct}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <span className="text-purple-500 font-extrabold text-xl select-none drop-shadow">
              ATTACK!
            </span>
          </div>
        </div>
      ))}
    </>
  );
}

export function XpPopup({
  state,
  earnedXp,
}: {
  state: XpPopupState;
  earnedXp: number;
}) {
  if (!state.visible || earnedXp <= 0) return null;
  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      <div
        className={`absolute transition-all ${state.show ? 'opacity-100 -translate-y-2' : 'opacity-0 translate-y-1'} duration-300 ease-out`}
        style={{
          top: `${state.topPct}%`,
          left: `${state.leftPct}%`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <span className="text-yellow-400 font-bold text-xl select-none drop-shadow">
          +{earnedXp} XP
        </span>
      </div>
    </div>
  );
}

export function SaveErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-lg bg-red-700 text-white shadow-xl">
      <span className="text-sm">{message}</span>
      <button
        type="button"
        onClick={onRetry}
        className="px-3 py-1 rounded bg-white text-red-700 text-sm font-semibold hover:bg-red-100 transition-colors"
      >
        Retry
      </button>
    </div>
  );
}
