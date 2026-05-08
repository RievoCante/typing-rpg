interface RaidBossDisplayProps {
  bossHp: number;
  bossMaxHp: number;
  status: string;
}

export default function RaidBossDisplay({
  bossHp,
  bossMaxHp,
  status,
}: RaidBossDisplayProps) {
  const hpPercent = (bossHp / bossMaxHp) * 100;

  return (
    <div className="flex flex-col items-center gap-4 mb-8">
      <div className="w-full max-w-xl">
        <div className="flex justify-between text-sm mb-1">
          <span className="font-bold text-red-500">RAID BOSS</span>
          <span>
            {bossHp} / {bossMaxHp}
          </span>
        </div>
        <div className="h-6 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-300"
            style={{ width: `${hpPercent}%` }}
          />
        </div>
      </div>

      <div className="relative">
        <div className="text-8xl">👹</div>
        {status === 'active' && (
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-2xl animate-bounce">
            ⚔️
          </div>
        )}
      </div>
    </div>
  );
}
