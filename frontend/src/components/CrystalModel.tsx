import { useRef } from 'react';
import { Group } from 'three';
import type { CrystalTypeEnum } from '../types/CrystalTypes';
import { CRYSTAL_CONFIGS, CRYSTAL_ANIMATIONS } from '../types/CrystalTypes';
import type { MonsterVariant } from '../context/GameContext';
import { useProceduralMonster } from '../hooks/useProceduralMonster';

interface CrystalModelProps {
  crystalType: CrystalTypeEnum;
  variant?: MonsterVariant;
  isHit: boolean;
  isDefeated: boolean;
  customColor?: string;
  customScale?: number;
}

// Shard cluster: a central core octahedron surrounded by smaller angled shards.
const SHARDS: {
  pos: [number, number, number];
  rot: [number, number, number];
  size: number;
}[] = [
  { pos: [0, 0.15, 0], rot: [0, 0, 0], size: 0.7 }, // core
  { pos: [0.55, -0.1, 0.15], rot: [0, 0, -0.5], size: 0.42 },
  { pos: [-0.55, -0.05, -0.15], rot: [0, 0, 0.5], size: 0.42 },
  { pos: [0.12, 0.72, -0.25], rot: [0.3, 0, 0.2], size: 0.38 },
  { pos: [-0.3, -0.5, 0.3], rot: [0.25, 0, -0.3], size: 0.34 },
  { pos: [0.35, -0.45, -0.35], rot: [-0.2, 0, 0.25], size: 0.3 },
];

// Procedural crystal: faceted octahedra (flat-shaded, low roughness, slight
// metalness) that catch light as the cluster slowly spins. Its facets read
// strongly under the elite/rare emissive aura. All idle/hit/glow/defeat motion
// is handled by the shared procedural hook (spin enabled).
export default function CrystalModel({
  crystalType,
  variant = 'common',
  isHit,
  isDefeated,
  customColor,
  customScale,
}: CrystalModelProps) {
  const groupRef = useRef<Group>(null);
  const config = CRYSTAL_CONFIGS[crystalType];
  const activeScale = customScale || config.scale;
  const color = customColor || config.color;

  useProceduralMonster(groupRef, {
    variant,
    isHit,
    isDefeated,
    scale: activeScale,
    idleSpeed: CRYSTAL_ANIMATIONS.IDLE_SPEED,
    idleHeight: CRYSTAL_ANIMATIONS.IDLE_HEIGHT,
    flashDuration: CRYSTAL_ANIMATIONS.FLASH_DURATION,
    spin: true,
  });

  return (
    <group ref={groupRef} scale={activeScale}>
      {SHARDS.map((s, i) => (
        <mesh key={i} position={s.pos} rotation={s.rot}>
          <octahedronGeometry args={[s.size, 0]} />
          <meshStandardMaterial
            color={color}
            transparent
            opacity={0.9}
            roughness={0.1}
            metalness={0.35}
            emissive={color}
            emissiveIntensity={0.18}
            flatShading
          />
        </mesh>
      ))}
    </group>
  );
}
