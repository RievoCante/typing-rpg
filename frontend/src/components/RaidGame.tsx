import { useCallback } from 'react';
import RaidPlayerLane from './RaidPlayerLane';
import type { RaidPlayer } from '../hooks/useRaidState';

interface Props {
  players: RaidPlayer[];
  bossHp: number;
  bossMaxHp: number;
  localText: string;
  isLocalAlive: boolean;
  localUserId: string;
  onWordComplete: (wordIndex: number) => void;
  onPlayerDead: () => void;
}

export default function RaidGame({
  players,
  bossHp,
  bossMaxHp,
  localText,
  isLocalAlive,
  localUserId,
  onWordComplete,
  onPlayerDead,
}: Props) {
  const bossHpPercent = bossMaxHp > 0 ? (bossHp / bossMaxHp) * 100 : 0;

  const handleLocalDead = useCallback(() => {
    if (isLocalAlive) {
      onPlayerDead();
    }
  }, [isLocalAlive, onPlayerDead]);

  return (
    <div className="min-h-screen p-4">
      {/* Boss Section */}
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold text-red-500 mb-2">RAID BOSS</h2>
        <div className="w-full max-w-2xl mx-auto h-6 bg-gray-700 rounded overflow-hidden">
          <div
            className="h-full bg-red-600 transition-all duration-300"
            style={{ width: `${bossHpPercent}%` }}
          />
        </div>
        <p className="mt-1 text-sm text-gray-300">{bossHp} / {bossMaxHp} HP</p>
      </div>

      {/* Player Lanes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-6xl mx-auto">
        {Array.from({ length: 3 }).map((_, idx) => {
          const player = players[idx];
          const isLocal = player?.userId === localUserId;
          return (
            <RaidPlayerLane
              key={player?.userId ?? `empty-${idx}`}
              player={player}
              isLocal={isLocal}
              text={isLocal ? localText : ''}
              isAlive={isLocal ? isLocalAlive : player?.isAlive ?? false}
              onWordComplete={isLocal ? onWordComplete : undefined}
              onPlayerDead={isLocal ? handleLocalDead : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
