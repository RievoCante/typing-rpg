import { useEffect, useRef, useState } from 'react';
import { useGameContext } from '../hooks/useGameContext';
import { useCharacter } from '../hooks/useCharacter';
import { DEFAULT_AVATAR_CONFIG } from '../utils/avatarConfig';
import PlayerAvatar3D from './PlayerAvatar3D';

const FLASH_MS = 240;

// The local player's warrior, shown beside the typing area in Endless/Daily.
// Self-contained: HP comes from game context, the attack lunge fires on the
// `word-hit` event dispatched when a word is completed, and the hurt recoil
// fires whenever player health drops.
export default function BattleAvatar() {
  const { playerHealth, maxPlayerHealth, isPlayerDead } = useGameContext();
  const { config } = useCharacter();

  const [isAttacking, setIsAttacking] = useState(false);
  const [isHurt, setIsHurt] = useState(false);
  const prevHealthRef = useRef(playerHealth);

  // Attack lunge on word completion (TypingInterface dispatches `word-hit`).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const onHit = () => {
      setIsAttacking(true);
      clearTimeout(timer);
      timer = setTimeout(() => setIsAttacking(false), FLASH_MS);
    };
    window.addEventListener('word-hit', onHit);
    return () => {
      window.removeEventListener('word-hit', onHit);
      clearTimeout(timer);
    };
  }, []);

  // Hurt recoil whenever health decreases.
  useEffect(() => {
    if (playerHealth < prevHealthRef.current) {
      setIsHurt(true);
      const timer = setTimeout(() => setIsHurt(false), FLASH_MS);
      prevHealthRef.current = playerHealth;
      return () => clearTimeout(timer);
    }
    prevHealthRef.current = playerHealth;
  }, [playerHealth]);

  const hpPercent =
    maxPlayerHealth > 0 ? (playerHealth / maxPlayerHealth) * 100 : 0;

  return (
    <div className="flex flex-col items-center">
      <div className="h-44 w-28">
        <PlayerAvatar3D
          config={config ?? DEFAULT_AVATAR_CONFIG}
          isAlive={!isPlayerDead}
          hpPercent={hpPercent}
          isAttacking={isAttacking}
          isHurt={isHurt}
        />
      </div>
      <span className="text-xs font-semibold opacity-70">You</span>
    </div>
  );
}
