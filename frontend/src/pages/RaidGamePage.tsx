import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { useRaidApi } from '../hooks/useRaidApi';
import {
  useRaidWebSocket,
  RaidState,
  RaidStats,
} from '../hooks/useRaidWebSocket';
import RaidBossDisplay from '../components/RaidBossDisplay';
import PlayerLane from '../components/PlayerLane';
import RaidResults from '../components/RaidResults';
import { Sword } from 'lucide-react';

const initialRaidState: RaidState = {
  roomCode: null,
  status: 'connecting',
  bossHp: 100,
  bossMaxHp: 100,
  players: [],
  hostId: null,
};

export default function RaidGamePage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const { joinRoom } = useRaidApi();
  const { user } = useUser();

  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const [raidState, setRaidState] = useState<RaidState>(initialRaidState);
  const [raidStats, setRaidStats] = useState<RaidStats | null>(null);

  const currentPlayerId = user?.id || 'anonymous';

  useEffect(() => {
    if (!roomCode) return;
    joinRoom(roomCode).then(result => {
      if (result) {
        setWsUrl(result.wsUrl);
      } else {
        navigate('/raid');
      }
    });
  }, [roomCode, joinRoom, navigate]);

  const handleMessage = useCallback((msg: Record<string, unknown>) => {
    switch (msg.type) {
      case 'room_state':
        setRaidState({
          roomCode: msg.roomCode as string,
          status: 'waiting',
          bossHp: 100,
          bossMaxHp: 100,
          players: msg.players as never[],
          hostId: msg.hostId as string,
        });
        break;

      case 'player_joined':
        setRaidState(prev => ({
          ...prev,
          players: [...prev.players, msg.player as never],
        }));
        break;

      case 'player_left':
        setRaidState(prev => ({
          ...prev,
          players: prev.players.filter(p => p.id !== msg.playerId),
        }));
        break;

      case 'new_host':
        setRaidState(prev => ({
          ...prev,
          hostId: msg.hostId as string,
          players: prev.players.map(p => ({
            ...p,
            isHost: p.id === msg.hostId,
          })),
        }));
        break;

      case 'raid_started':
        setRaidState(prev => ({
          ...prev,
          status: 'active' as const,
          bossHp: (msg.boss as Record<string, unknown>).hp as number,
          bossMaxHp: (msg.boss as Record<string, unknown>).maxHp as number,
          players: msg.players as never[],
        }));
        break;

      case 'boss_damaged':
        setRaidState(prev => ({
          ...prev,
          bossHp: msg.bossHp as number,
        }));
        break;

      case 'boss_attacked':
        setRaidState(prev => ({
          ...prev,
          players: prev.players.map(p => {
            const updated = (msg.players as Record<string, unknown>[]).find(
              x => x.id === p.id
            );
            return updated
              ? {
                  ...p,
                  hp: updated.hp as number,
                  isDead: updated.isDead as boolean,
                }
              : p;
          }),
        }));
        window.dispatchEvent(new CustomEvent('raid-boss-attack'));
        break;

      case 'player_hit':
        setRaidState(prev => ({
          ...prev,
          players: prev.players.map(p =>
            p.id === msg.playerId
              ? { ...p, hp: msg.hp as number, isDead: msg.isDead as boolean }
              : p
          ),
        }));
        window.dispatchEvent(
          new CustomEvent('raid-player-hit', {
            detail: { playerId: msg.playerId },
          })
        );
        break;

      case 'raid_ended':
        setRaidState(prev => ({ ...prev, status: 'ended' as const }));
        setRaidStats({
          bossHpStart: msg.bossHpStart as number,
          bossHpEnd: msg.bossHpEnd as number,
          victory: msg.victory as boolean,
          players: msg.players as never[],
        });
        break;
    }
  }, []);

  const { startRaid, sendWordDone, sendPlayerHit } = useRaidWebSocket(
    wsUrl || '',
    handleMessage
  );

  const handleWordDone = useCallback(() => sendWordDone(), [sendWordDone]);
  const handleMistake = useCallback(
    (damage: number) => sendPlayerHit(damage),
    [sendPlayerHit]
  );
  const handleClose = useCallback(() => navigate('/raid'), [navigate]);

  if (!wsUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Connecting to raid...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
        {raidState.status === 'waiting' && (
          <div className="text-center py-16">
            <h2 className="text-3xl font-bold mb-4">Waiting for Players...</h2>
            <div className="mb-8">
              <p className="text-gray-500 mb-2">
                Room Code:{' '}
                <span className="font-mono text-2xl">{roomCode}</span>
              </p>
              <p className="text-gray-400">
                {raidState.players.length} / 4 players joined
              </p>
            </div>

            <div className="mb-8">
              {raidState.players.map(player => (
                <div
                  key={player.id}
                  className="p-3 bg-gray-800 rounded mb-2 flex items-center justify-between"
                >
                  <span className="font-bold">{player.username}</span>
                  {player.isHost && (
                    <span className="text-xs text-yellow-500">HOST</span>
                  )}
                </div>
              ))}
            </div>

            {currentPlayerId === raidState.hostId ? (
              <button
                onClick={startRaid}
                disabled={raidState.players.length < 2}
                className="px-8 py-4 rounded-lg bg-green-600 hover:bg-green-500 font-bold text-xl disabled:opacity-50"
              >
                <Sword className="w-6 h-6 inline mr-2" />
                Start Raid
              </button>
            ) : (
              <p className="text-gray-500">Waiting for host to start...</p>
            )}
          </div>
        )}

        {raidState.status === 'active' && (
          <div className="space-y-6">
            <RaidBossDisplay
              bossHp={raidState.bossHp}
              bossMaxHp={raidState.bossMaxHp}
              status={raidState.status}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {raidState.players.map(player => (
                <PlayerLane
                  key={player.id}
                  player={player}
                  isCurrentPlayer={player.id === currentPlayerId}
                  onWordDone={handleWordDone}
                  onMistake={handleMistake}
                />
              ))}
            </div>
          </div>
        )}

        {raidState.status === 'ended' && raidStats && (
          <RaidResults
            victory={raidStats.victory}
            stats={raidStats}
            onClose={handleClose}
          />
        )}
      </div>
    </div>
  );
}
