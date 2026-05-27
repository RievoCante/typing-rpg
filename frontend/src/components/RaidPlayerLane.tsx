import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useTypingMechanics } from '../hooks/useTypingMechanics';
import TypingText from './TypingText';
import type { RaidPlayer, RaidHitEvent } from '../hooks/useRaidState';

interface Props {
  player?: RaidPlayer;
  isLocal: boolean;
  text: string;
  isAlive: boolean;
  onWordComplete?: (wordIndex: number) => void;
  onMistake?: () => void;
  lastHit?: RaidHitEvent | null;
}

type LanePopup = {
  id: number;
  kind: 'mistake' | 'boss';
  damage: number;
};

export default function RaidPlayerLane({
  player,
  isLocal,
  text,
  isAlive,
  onWordComplete,
  onMistake,
  lastHit,
}: Props) {
  const wordIndexRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [popups, setPopups] = useState<LanePopup[]>([]);

  const typingMechanics = useTypingMechanics({
    text,
    onWordCompleted: () => {
      wordIndexRef.current++;
      onWordComplete?.(wordIndexRef.current);
    },
    onCharacterMistake: () => {
      if (isLocal && isAlive) onMistake?.();
    },
  });

  const { resetTypingState } = typingMechanics;

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!isLocal || !isAlive) return;

    const { key } = e;
    if (key === 'Tab') return;

    if (key === ' ') {
      e.preventDefault();
      typingMechanics.handleSpaceBar();
    } else if (key === 'Backspace') {
      e.preventDefault();
      if (e.ctrlKey || e.altKey) typingMechanics.handleWordDeletion();
      else typingMechanics.handleBackspace();
    } else if (key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      typingMechanics.handleCharacterInput(key);
    }
  };

  useEffect(() => {
    if (isLocal && containerRef.current) {
      containerRef.current.focus();
    }
  }, [isLocal, text]);

  useEffect(() => {
    resetTypingState();
    wordIndexRef.current = 0;
  }, [text, resetTypingState]);

  // Pull the most recent hit relevant to this lane into a transient popup.
  useEffect(() => {
    if (!lastHit || !player) return;
    const target = lastHit.targets.find(t => t.playerId === player.userId);
    if (!target) return;
    const popup: LanePopup = {
      id: lastHit.id,
      kind: lastHit.kind,
      damage: target.damage,
    };
    setPopups(prev => [...prev, popup]);
    const timer = setTimeout(() => {
      setPopups(prev => prev.filter(p => p.id !== popup.id));
    }, 900);
    return () => clearTimeout(timer);
  }, [lastHit, player]);

  if (!player) {
    return (
      <div className="p-4 bg-gray-800 rounded-lg opacity-50 flex items-center justify-center min-h-[200px]">
        <p className="text-gray-400">Waiting for player...</p>
      </div>
    );
  }

  const hpPercent = player.maxHp > 0 ? (player.hp / player.maxHp) * 100 : 0;

  return (
    <div
      className={`relative p-4 bg-gray-800 rounded-lg ${isLocal ? 'ring-2 ring-blue-500' : ''} ${!isAlive ? 'opacity-60' : ''}`}
    >
      {/* Player Header */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <span className="font-bold flex items-center gap-2">
            {player.username}
            {!isAlive && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-red-800 text-red-200">
                DEAD
              </span>
            )}
          </span>
          <span className="text-sm text-gray-400">
            {player.damageDealt} dmg · {player.hp}/{player.maxHp} HP
          </span>
        </div>
        <div className="w-full h-3 bg-gray-700 rounded overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${isAlive ? 'bg-green-500' : 'bg-gray-500'}`}
            style={{ width: `${hpPercent}%` }}
          />
        </div>
      </div>

      {/* Typing Area */}
      <div className="relative">
        {isLocal ? (
          <div
            ref={containerRef}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            className="p-4 bg-gray-900 rounded min-h-[100px] focus:outline-none flex items-center justify-center"
          >
            <TypingText
              text={text}
              charStatus={typingMechanics.charStatus}
              typedChars={typingMechanics.typedChars}
              cursorPosition={typingMechanics.cursorPosition}
              hasStartedTyping={true}
            />
          </div>
        ) : text ? (
          <div className="p-4 bg-gray-900 rounded min-h-[100px] opacity-70 flex items-center justify-center">
            <TypingText
              text={text}
              charStatus={[]}
              typedChars={[]}
              cursorPosition={0}
              hasStartedTyping={false}
            />
          </div>
        ) : (
          <div className="p-4 bg-gray-900 rounded min-h-[100px] opacity-70 flex items-center justify-center">
            <p className="text-gray-500">Waiting...</p>
          </div>
        )}

        {/* Damage popups */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {popups.map((p, idx) => (
            <div
              key={p.id}
              className={`absolute text-2xl font-extrabold animate-raid-hit ${p.kind === 'boss' ? 'text-red-400' : 'text-orange-300'}`}
              style={{
                transform: `translateY(${-idx * 6}px)`,
                textShadow: '0 0 6px rgba(0,0,0,0.7)',
              }}
            >
              {p.kind === 'boss' ? 'ATTACK' : 'HIT'} -{p.damage}
            </div>
          ))}
        </div>

        {/* Spectator Overlay */}
        {!isAlive && (
          <div className="absolute inset-0 bg-black/60 rounded flex items-center justify-center">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-400 mb-1">
                SPECTATOR MODE
              </p>
              <p className="text-sm text-gray-300">Watch your team!</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
