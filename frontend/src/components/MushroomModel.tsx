import { useRef } from 'react';
import { Group } from 'three';
import type { MushroomTypeEnum } from '../types/MushroomTypes';
import { MUSHROOM_CONFIGS, MUSHROOM_ANIMATIONS } from '../types/MushroomTypes';
import type { MonsterVariant } from '../context/GameContext';
import { useProceduralMonster } from '../hooks/useProceduralMonster';

interface MushroomModelProps {
  mushroomType: MushroomTypeEnum;
  variant?: MonsterVariant;
  isHit: boolean;
  isDefeated: boolean;
  customColor?: string;
  customScale?: number;
}

// Spot positions on the cap (relative to the group). Hand-placed for a cute
// toadstool look.
const CAP_SPOTS: [number, number, number][] = [
  [0.0, 0.78, 0.25],
  [-0.4, 0.55, 0.3],
  [0.42, 0.5, 0.28],
  [0.2, 0.62, -0.4],
  [-0.25, 0.45, -0.45],
];

// Procedural mushroom: hemisphere cap + tapered stem + white spots + eyes.
// Cute/organic silhouette to contrast the round slime and rocky golem. All
// idle/hit/glow/defeat motion is handled by the shared procedural hook.
export default function MushroomModel({
  mushroomType,
  variant = 'common',
  isHit,
  isDefeated,
  customColor,
  customScale,
}: MushroomModelProps) {
  const groupRef = useRef<Group>(null);
  const config = MUSHROOM_CONFIGS[mushroomType];
  const activeScale = customScale || config.scale;
  const capColor = customColor || config.color;

  useProceduralMonster(groupRef, {
    variant,
    isHit,
    isDefeated,
    scale: activeScale,
    idleSpeed: MUSHROOM_ANIMATIONS.IDLE_SPEED,
    idleHeight: MUSHROOM_ANIMATIONS.IDLE_HEIGHT,
    flashDuration: MUSHROOM_ANIMATIONS.FLASH_DURATION,
  });

  return (
    <group ref={groupRef} scale={activeScale}>
      {/* Stem */}
      <mesh position={[0, -0.5, 0]}>
        <cylinderGeometry args={[0.32, 0.45, 1.0, 16]} />
        <meshStandardMaterial
          color="#f5e6c8"
          transparent
          opacity={1}
          roughness={0.85}
        />
      </mesh>

      {/* Cap (top hemisphere) */}
      <mesh position={[0, 0.1, 0]}>
        <sphereGeometry args={[0.95, 28, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial
          color={capColor}
          transparent
          opacity={1}
          roughness={0.5}
        />
      </mesh>

      {/* Cap spots */}
      {CAP_SPOTS.map((pos, i) => (
        <mesh key={i} position={pos}>
          <sphereGeometry args={[0.13, 12, 12]} />
          <meshStandardMaterial
            color="#fdfdfd"
            transparent
            opacity={1}
            roughness={0.6}
          />
        </mesh>
      ))}

      {/* Eyes on the stem */}
      <mesh position={[-0.16, -0.42, 0.42]}>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshStandardMaterial color="#1a1a1a" transparent opacity={1} />
      </mesh>
      <mesh position={[0.16, -0.42, 0.42]}>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshStandardMaterial color="#1a1a1a" transparent opacity={1} />
      </mesh>
    </group>
  );
}
