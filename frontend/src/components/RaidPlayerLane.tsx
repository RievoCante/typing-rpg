import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { useTypingMechanics } from '../hooks/useTypingMechanics';
import TypingText from './TypingText';
import type { RaidPlayer } from '../hooks/useRaidState';

interface Props {
  player?: RaidPlayer;
  isLocal: boolean;
  text: string;
  isAlive: boolean;
  onWordComplete?: (wordIndex: number) => void;
  onPlayerDead?: () => void;
}

export default function RaidPlayerLane({
  player,
  isLocal,
  text,
  isAlive,
  onWordComplete,
  onPlayerDead,
}: Props) {
  const [wordIndex, setWordIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const typingMechanics = useTypingMechanics({
    text,
    onWordCompleted: () => {
      setWordIndex(prev => {
        const next = prev + 1;
        onWordComplete?.(next);
        return next;
      });
    },
  });

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
    typingMechanics.resetTypingState();
    setWordIndex(0);
  }, [text]);

  if (!player) {
    return (
      <div className="p-4 bg-gray-800 rounded-lg opacity-50 flex items-center justify-center min-h-[200px]">
        <p className="text-gray-400">Waiting for player...</p>
      </div>
    );
  }

  const hpPercent = player.maxHp > 0 ? (player.hp / player.maxHp) * 100 : 0;

  return (
    <div className={`relative p-4 bg-gray-800 rounded-lg ${isLocal ? 'ring-2 ring-blue-500' : ''}`}>
      {/* Player Header */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <span className="font-bold">{player.username}</span>
          <span className="text-sm text-gray-400">{player.damageDealt} dmg</span>
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
            className="p-4 bg-gray-900 rounded min-h-[100px] focus:outline-none"
          >
            <TypingText
              text={text}
              charStatus={typingMechanics.charStatus}
              typedChars={typingMechanics.typedChars}
              cursorPosition={typingMechanics.cursorPosition}
              hasStartedTyping={true}
            />
          </div>
        ) : (
          <div className="p-4 bg-gray-900 rounded min-h-[100px] opacity-70">
            <TypingText
              text={text}
              charStatus={[]}
              typedChars={[]}
              cursorPosition={0}
              hasStartedTyping={false}
            />
          </div>
        )}

        {/* Spectator Overlay */}
        {!isAlive && (
          <div className="absolute inset-0 bg-black/60 rounded flex items-center justify-center">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-400 mb-1">SPECTATOR MODE</p>
              <p className="text-sm text-gray-300">Watch your team!</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
