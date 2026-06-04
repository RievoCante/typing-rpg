import { useRef } from 'react';
import { Group } from 'three';
import type { CrystalTypeEnum } from '../types/CrystalTypes';
import { CRYSTAL_CONFIGS, CRYSTAL_ANIMATIONS } from '../types/CrystalTypes';
import type { MonsterVariant } from '../context/GameContext';
import type { EyeStyle } from '../utils/eyeStyles';
import { useProceduralMonster } from '../hooks/useProceduralMonster';
import MonsterEyes from './MonsterEyes';

interface CrystalModelProps {
  crystalType: CrystalTypeEnum;
  variant?: MonsterVariant;
  isHit: boolean;
  isDefeated: boolean;
  customColor?: string;
  customScale?: number;
  eyeStyle?: EyeStyle;
}

// Gem cluster: elongated octahedra (bipyramid "shards") fanning up and outward
// from a shared base — a tall central crystal flanked by shorter angled ones,
// the way real quartz/amethyst clusters grow. `sy` stretches each shard along
// its own axis into a pointed crystal; `rot.z` tilts the side shards outward.
const SHARDS: {
  pos: [number, number, number];
  rot: [number, number, number];
  size: number;
  sy: number;
}[] = [
  { pos: [0, 0.12, 0], rot: [0, 0, 0], size: 0.4, sy: 2.2 }, // tall center
  { pos: [-0.46, -0.24, 0.12], rot: [0, 0, 0.5], size: 0.27, sy: 1.8 },
  { pos: [0.48, -0.2, -0.06], rot: [0, 0, -0.55], size: 0.3, sy: 1.9 },
  { pos: [-0.24, -0.34, -0.34], rot: [0.18, 0, 0.28], size: 0.2, sy: 1.6 },
  { pos: [0.24, -0.4, 0.34], rot: [-0.14, 0, -0.22], size: 0.22, sy: 1.5 },
  { pos: [0.04, -0.5, -0.12], rot: [0, 0, 0.08], size: 0.16, sy: 1.4 },
];

// Procedural crystal: a faceted gem cluster (flat-shaded, glassy — low
// roughness, slight metalness, translucent) with a bright inner core that glows
// through the facets and a small face for character. It sways gently rather than
// spinning so the eyes stay forward. All idle/hit/glow/defeat motion is handled
// by the shared procedural hook.
export default function CrystalModel({
  crystalType,
  variant = 'common',
  isHit,
  isDefeated,
  customColor,
  customScale,
  eyeStyle = 'neutral',
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
  });

  return (
    <group ref={groupRef} scale={activeScale}>
      {SHARDS.map((s, i) => (
        <mesh
          key={i}
          position={s.pos}
          rotation={s.rot}
          scale={[s.size, s.size * s.sy, s.size]}
        >
          <octahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color={color}
            transparent
            opacity={0.82}
            roughness={0.07}
            metalness={0.18}
            emissive={color}
            emissiveIntensity={0.3}
            flatShading
          />
        </mesh>
      ))}

      {/* Bright inner core glowing through the translucent facets. */}
      <mesh position={[0, 0.12, 0]} scale={[0.16, 0.42, 0.16]}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          color="#ffffff"
          transparent
          opacity={0.85}
          emissive={color}
          emissiveIntensity={0.9}
        />
      </mesh>

      {/* Small face on the central crystal — expression varies per spawn. */}
      <MonsterEyes
        style={eyeStyle}
        spacing={0.16}
        y={0.05}
        z={0.46}
        size={0.085}
        color="#1a1a2e"
      />
    </group>
  );
}
