import { useEffect, useState } from 'react';
import type {
  RaidPlayer,
  RaidHitEvent,
  RaidWordHit,
} from '../hooks/useRaidState';

interface Props {
  player: RaidPlayer;
  emoji: string;
  lastHit: RaidHitEvent | null;
  lastWordHit: RaidWordHit | null;
}

type Popup = { id: number; damage: number; kind: 'mistake' | 'boss' };

export default function RaidAvatar({
  player,
  emoji,
  lastHit,
  lastWordHit,
}: Props) {
  const [popups, setPopups] = useState<Popup[]>([]);
  const [swing, setSwing] = useState(false);

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
    const timer = setTimeout(() => {
      setPopups(prev => prev.filter(p => p.id !== popup.id));
    }, 900);
    return () => clearTimeout(timer);
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
      className={`relative flex flex-col items-center w-32 ${!isAlive ? 'opacity-50' : ''}`}
    >
      <div
        className={`text-5xl select-none transition-transform duration-100 ${isAlive ? '' : 'grayscale'} ${swing ? '-translate-y-1 scale-110' : ''}`}
        aria-hidden
      >
        {emoji}
      </div>
      {swing && (
        <div
          className="pointer-events-none absolute top-1 text-2xl animate-raid-hit"
          aria-hidden
        >
          ⚔️
        </div>
      )}
      <p className="mt-1 text-xs font-semibold text-gray-200 truncate max-w-full">
        {player.username}
      </p>
      <div className="w-full mt-1 h-1.5 bg-gray-700 rounded overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${isAlive ? 'bg-green-500' : 'bg-gray-500'}`}
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
