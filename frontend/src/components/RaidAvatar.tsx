import { memo, useEffect, useState } from 'react';
import type {
  RaidPlayer,
  RaidHitEvent,
  RaidWordHit,
} from '../hooks/useRaidState';
import type { PlayerAvatarConfig } from '../utils/avatarConfig';
import { hpColorClass, isCriticalHp } from '../utils/raidHp';
import PlayerAvatar3D from './PlayerAvatar3D';

interface Props {
  player: RaidPlayer;
  config: PlayerAvatarConfig;
  lastHit: RaidHitEvent | null;
  lastWordHit: RaidWordHit | null;
  isLocal?: boolean;
}

type Popup = { id: number; damage: number; kind: 'mistake' | 'boss' };

function RaidAvatar({
  player,
  config,
  lastHit,
  lastWordHit,
  isLocal = false,
}: Props) {
  const [popups, setPopups] = useState<Popup[]>([]);
  const [swing, setSwing] = useState(false);
  const [hurt, setHurt] = useState(false);

  useEffect(() => {
    if (!lastHit) return;
    const target = lastHit.targets.find(t => t.playerId === player.userId);
    if (!target) return;
    const popup: Popup = {
      id: lastHit.id,
      damage: target.damage,
      kind: lastHit.kind,
    };
    setPopups(prev => [...prev, popup]);
    setHurt(true);
    const popupTimer = setTimeout(() => {
      setPopups(prev => prev.filter(p => p.id !== popup.id));
    }, 900);
    const hurtTimer = setTimeout(() => setHurt(false), 300);
    return () => {
      clearTimeout(popupTimer);
      clearTimeout(hurtTimer);
    };
  }, [lastHit, player.userId]);

  useEffect(() => {
    if (!lastWordHit || lastWordHit.playerId !== player.userId) return;
    setSwing(true);
    const timer = setTimeout(() => setSwing(false), 220);
    return () => clearTimeout(timer);
  }, [lastWordHit, player.userId]);

  const hpPercent = player.maxHp > 0 ? (player.hp / player.maxHp) * 100 : 0;
  const isAlive = player.isAlive;

  return (
    <div
      className={`relative flex flex-col items-center w-32 ${
        isLocal ? 'rounded-lg ring-2 ring-blue-400 bg-blue-500/5 px-1 py-1' : ''
      } ${!isAlive ? 'opacity-50' : ''}`}
    >
      <div className="relative h-24 w-24">
        <PlayerAvatar3D
          config={config}
          isAlive={isAlive}
          hpPercent={hpPercent}
          isAttacking={swing}
          isHurt={hurt}
        />
        {swing && (
          <div
            className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 text-2xl animate-raid-hit"
            aria-hidden
          >
            ⚔️
          </div>
        )}
      </div>
      <p className="mt-1 text-xs font-semibold text-gray-200 truncate max-w-full">
        {player.username}
        {isLocal && <span className="text-blue-400 text-[10px]"> (you)</span>}
      </p>
      <div className="w-full mt-1 h-1.5 bg-gray-700 rounded overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${hpColorClass(hpPercent, isAlive)} ${isCriticalHp(hpPercent, isAlive) ? 'animate-pulse' : ''}`}
          style={{ width: `${hpPercent}%` }}
        />
      </div>
      <p className="mt-1 text-[10px] text-gray-400">
        {player.hp}/{player.maxHp} · {player.damageDealt} dmg
      </p>
      {!isAlive && (
        <span className="mt-1 text-[10px] px-1.5 py-0.5 rounded bg-red-800 text-red-200">
          DEAD
        </span>
      )}

      {/* Hit popups */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center">
        {popups.map((p, idx) => (
          <div
            key={p.id}
            className={`absolute text-xl font-extrabold animate-raid-hit ${p.kind === 'boss' ? 'text-red-400' : 'text-orange-300'}`}
            style={{
              transform: `translateY(${-idx * 8}px)`,
              textShadow: '0 0 6px rgba(0,0,0,0.7)',
            }}
          >
            -{p.damage}
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(RaidAvatar);
