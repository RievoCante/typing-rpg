import type { HitItem } from '../hooks/useHitPopups';
import type { AttackItem } from '../hooks/useAttackPopups';
import type { PotionPopupItem } from '../hooks/usePotionPopups';
import type { CombatPopupItem } from '../hooks/useCombatPopups';
import type { WeaponPopupItem } from '../hooks/useWeaponPopups';
import { RARITY_COLOR } from '../utils/weapons';

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

export function PotionPopups({ popups }: { popups: PotionPopupItem[] }) {
  return (
    <>
      {popups.map(popup => (
        <div key={popup.id} className="fixed inset-0 pointer-events-none z-40">
          <div
            className={`absolute transition-all ${popup.show ? 'opacity-100 -translate-y-2 scale-110' : 'opacity-0 translate-y-0 scale-95'} duration-500 ease-out`}
            style={{
              top: `${popup.topPct}%`,
              left: `${popup.leftPct}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <span
              className={`font-extrabold text-xl select-none drop-shadow ${
                popup.kind === 'heal'
                  ? 'text-green-400'
                  : popup.kind === 'warn'
                    ? 'text-amber-400'
                    : 'text-pink-400'
              }`}
            >
              {popup.text}
            </span>
          </div>
        </div>
      ))}
    </>
  );
}

export function WeaponPopups({ popups }: { popups: WeaponPopupItem[] }) {
  return (
    <>
      {popups.map(popup => (
        <div key={popup.id} className="fixed inset-0 pointer-events-none z-40">
          <div
            className={`absolute transition-all ${popup.show ? 'opacity-100 -translate-y-2 scale-110' : 'opacity-0 translate-y-0 scale-95'} duration-500 ease-out`}
            style={{
              top: `${popup.topPct}%`,
              left: `${popup.leftPct}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <span
              className={`font-extrabold text-lg select-none drop-shadow ${RARITY_COLOR[popup.rarity]}`}
            >
              {popup.text}
            </span>
          </div>
        </div>
      ))}
    </>
  );
}

export function CombatPopups({ popups }: { popups: CombatPopupItem[] }) {
  return (
    <>
      {popups.map(popup => (
        <div key={popup.id} className="fixed inset-0 pointer-events-none z-40">
          <div
            className={`absolute transition-all ${popup.show ? 'opacity-100 -translate-y-3 scale-125' : 'opacity-0 translate-y-0 scale-95'} duration-500 ease-out`}
            style={{
              top: `${popup.topPct}%`,
              left: `${popup.leftPct}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <span
              className={`font-extrabold select-none drop-shadow ${
                popup.kind === 'crit'
                  ? 'text-pink-400 text-2xl'
                  : 'text-gray-400 text-base'
              }`}
            >
              {popup.text}
            </span>
          </div>
        </div>
      ))}
    </>
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
