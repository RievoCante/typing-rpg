import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useTypingMechanics } from '../hooks/useTypingMechanics';
import TypingText from './TypingText';
import RaidAvatar from './RaidAvatar';
import RaidBoss3D from './RaidBoss3D';
import type {
  RaidPlayer,
  RaidHitEvent,
  RaidWordHit,
} from '../hooks/useRaidState';
import {
  resolveAvatarConfig,
  type PlayerAvatarConfig,
} from '../utils/avatarConfig';
import { isCriticalHp } from '../utils/raidHp';
import { trackEvent } from '../utils/trackEvent';
import { useSfx } from '../hooks/useSfx';

interface Props {
  players: RaidPlayer[];
  bossHp: number;
  bossMaxHp: number;
  localText: string;
  isLocalAlive: boolean;
  localUserId: string;
  lastHit: RaidHitEvent | null;
  lastWordHit: RaidWordHit | null;
  onWordComplete: (wordIndex: number) => void;
  onMistake: () => void;
}

export default function RaidGame({
  players,
  bossHp,
  bossMaxHp,
  localText,
  isLocalAlive,
  localUserId,
  lastHit,
  lastWordHit,
  onWordComplete,
  onMistake,
}: Props) {
  const bossHpPercent = bossMaxHp > 0 ? (bossHp / bossMaxHp) * 100 : 0;
  const wordIndexRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [bossShake, setBossShake] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const { playExplosion } = useSfx();
  const bossDefeatedRef = useRef(false);

  // Play explosion once when the boss is defeated
  useEffect(() => {
    if (bossHp <= 0 && !bossDefeatedRef.current) {
      bossDefeatedRef.current = true;
      playExplosion();
    } else if (bossHp > 0) {
      bossDefeatedRef.current = false;
    }
  }, [bossHp, playExplosion]);

  const localPlayer = players.find(p => p.userId === localUserId);

  const avatarConfigs = useMemo(() => {
    const m = new Map<string, PlayerAvatarConfig>();
    for (const p of players)
      m.set(p.userId, resolveAvatarConfig(p.userId, p.characterConfig));
    return m;
  }, [players]);

  const typingMechanics = useTypingMechanics({
    text: localText,
    onWordCompleted: () => {
      wordIndexRef.current++;
      onWordComplete(wordIndexRef.current);
    },
    // Boss attacks only when the player commits a wrong word with spacebar,
    // not per-character. Lets players freely backspace and correct typos.
    onWordMistake: () => {
      if (isLocalAlive) onMistake();
    },
  });

  const { resetTypingState } = typingMechanics;

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!isLocalAlive) return;
    const { key } = e;
    if (key === 'Tab') return;
    if (!hasStarted) {
      setHasStarted(true);
      trackEvent('started_typing', 'raid');
    }
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
    if (containerRef.current) containerRef.current.focus();
  }, [localText]);

  useEffect(() => {
    resetTypingState();
    wordIndexRef.current = 0;
    setHasStarted(false);
    // Analytics: player reached a live raid battle (deduped per page-load).
    if (localText.length > 0) trackEvent('reached_game', 'raid');
  }, [localText, resetTypingState]);

  // Boss shake fires whenever any player lands a hit.
  useEffect(() => {
    if (!lastWordHit) return;
    setBossShake(true);
    const timer = setTimeout(() => setBossShake(false), 200);
    return () => clearTimeout(timer);
  }, [lastWordHit]);

  const localHpPercent =
    localPlayer && localPlayer.maxHp > 0
      ? (localPlayer.hp / localPlayer.maxHp) * 100
      : 0;
  // Guard on localPlayer so the red critical ring never flashes before the
  // first room_state populates the local player's HP.
  const localCritical =
    !!localPlayer && isCriticalHp(localHpPercent, isLocalAlive);

  return (
    <div className="min-h-screen p-4 flex flex-col items-center">
      {/* Boss */}
      <div className="w-full max-w-3xl mx-auto text-center">
        <h2 className="text-xl font-bold text-red-500 mb-2 tracking-wider">
          RAID BOSS
        </h2>
        <div className="h-5 bg-gray-700 rounded overflow-hidden mb-1">
          <div
            className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-300"
            style={{ width: `${bossHpPercent}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mb-2">{`${bossHp} / ${bossMaxHp} HP`}</p>
        <div
          className={`mx-auto h-56 w-56 sm:h-64 sm:w-64 ${bossShake ? 'animate-pixel-shake' : ''}`}
        >
          <RaidBoss3D
            hpPercent={bossHpPercent}
            isHit={bossShake}
            isDefeated={bossHp <= 0}
          />
        </div>
      </div>

      {/* Party row — all players, local highlighted */}
      <div className="flex flex-wrap items-end justify-center gap-6 mb-6 min-h-[160px]">
        {players.map(p => (
          <RaidAvatar
            key={p.userId}
            player={p}
            config={avatarConfigs.get(p.userId)!}
            lastHit={lastHit}
            lastWordHit={lastWordHit}
            isLocal={p.userId === localUserId}
          />
        ))}
      </div>

      {/* Local typing area */}
      <div className="relative w-full max-w-3xl mx-auto">
        <div
          ref={containerRef}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          className={`p-6 bg-gray-800 rounded-lg shadow-xl focus:outline-none ${!isLocalAlive ? 'opacity-50' : ''} ${localCritical ? 'ring-2 ring-red-500' : 'focus:ring-2 focus:ring-blue-500'}`}
        >
          <TypingText
            text={localText}
            charStatus={typingMechanics.charStatus}
            typedChars={typingMechanics.typedChars}
            cursorPosition={typingMechanics.cursorPosition}
            hasStartedTyping={hasStarted}
          />
        </div>

        {/* Spectator overlay when local is dead */}
        {!isLocalAlive && (
          <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center pointer-events-none">
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
