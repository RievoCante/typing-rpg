import { memo, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Group, Color, MeshPhongMaterial } from 'three';
import { CANVAS_DPR, CANVAS_GL } from '../utils/canvas';

const BODY_COLOR = new Color('#7f1d1d'); // dark blood red
const HIT_COLOR = new Color('#fca5a5');
const DEAD_COLOR = new Color('#3f3f46');
const HIT_DURATION = 200; // ms — matches RaidGame bossShake timing

interface ModelProps {
  isHit: boolean;
  isDefeated: boolean;
}

function BossModel({ isHit, isDefeated }: ModelProps) {
  const groupRef = useRef<Group>(null);
  const bodyMatRef = useRef<MeshPhongMaterial | null>(null);
  const hitTimeRef = useRef(0);

  useEffect(() => {
    if (isHit) hitTimeRef.current = Date.now();
  }, [isHit]);

  useFrame(state => {
    const g = groupRef.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const now = Date.now();
    const hEl = now - hitTimeRef.current; // ms since last hit

    let posY = 0;
    let rotZ = 0;
    let scale = 1;

    if (isDefeated) {
      posY = -0.6;
      rotZ = 0.5; // topple
      scale = 0.9;
    } else {
      posY = Math.sin(t * 1.5) * 0.12; // heavy idle hover
      if (hitTimeRef.current > 0 && hEl < HIT_DURATION) {
        const k = 1 - hEl / HIT_DURATION;
        rotZ = Math.sin(now * 0.08) * 0.12 * k; // shudder
        scale = 1 - 0.06 * k; // flinch
      }
    }

    g.position.set(0, posY, 0);
    g.rotation.set(0, 0, rotZ);
    g.scale.setScalar(scale);

    const mat = bodyMatRef.current;
    if (mat) {
      const hitting =
        !isDefeated && hitTimeRef.current > 0 && hEl < HIT_DURATION;
      if (isDefeated) {
        mat.color.copy(DEAD_COLOR);
        mat.emissive.set('#000000');
        mat.emissiveIntensity = 0;
      } else if (hitting) {
        const k = 1 - hEl / HIT_DURATION;
        mat.color.copy(BODY_COLOR).lerp(HIT_COLOR, k);
        mat.emissive.copy(HIT_COLOR);
        mat.emissiveIntensity = 0.5 * k;
      } else {
        mat.color.copy(BODY_COLOR);
        mat.emissive.set('#330000');
        mat.emissiveIntensity = 0.25;
      }
    }
  });

  const eyeColor = isDefeated ? '#52525b' : '#fde047';

  return (
    <group ref={groupRef}>
      {/* Body */}
      <mesh>
        <sphereGeometry args={[1.1, 24, 24]} />
        <meshPhongMaterial
          ref={bodyMatRef}
          color="#7f1d1d"
          shininess={30}
          specular="#552222"
        />
        {/* Eyes */}
        <mesh position={[-0.4, 0.2, 0.95]}>
          <sphereGeometry args={[0.16, 12, 12]} />
          <meshPhongMaterial
            color={eyeColor}
            emissive={eyeColor}
            emissiveIntensity={isDefeated ? 0 : 0.9}
          />
        </mesh>
        <mesh position={[0.4, 0.2, 0.95]}>
          <sphereGeometry args={[0.16, 12, 12]} />
          <meshPhongMaterial
            color={eyeColor}
            emissive={eyeColor}
            emissiveIntensity={isDefeated ? 0 : 0.9}
          />
        </mesh>
        {/* Fangs */}
        <mesh position={[-0.18, -0.45, 0.9]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.08, 0.25, 8]} />
          <meshPhongMaterial color="#f8fafc" />
        </mesh>
        <mesh position={[0.18, -0.45, 0.9]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.08, 0.25, 8]} />
          <meshPhongMaterial color="#f8fafc" />
        </mesh>
      </mesh>
      {/* Horns */}
      <mesh position={[-0.6, 1.0, 0]} rotation={[0, 0, 0.4]}>
        <coneGeometry args={[0.22, 0.7, 12]} />
        <meshPhongMaterial color="#1c1917" />
      </mesh>
      <mesh position={[0.6, 1.0, 0]} rotation={[0, 0, -0.4]}>
        <coneGeometry args={[0.22, 0.7, 12]} />
        <meshPhongMaterial color="#1c1917" />
      </mesh>
    </group>
  );
}

export interface RaidBoss3DProps {
  hpPercent: number;
  isHit?: boolean;
  isDefeated?: boolean;
}

// Self-contained boss: fills its parent box (give the parent a width/height).
function RaidBoss3D({ isHit = false, isDefeated = false }: RaidBoss3DProps) {
  return (
    <Canvas
      camera={{ position: [0, 0.3, 4.2], fov: 50 }}
      dpr={CANVAS_DPR}
      gl={CANVAS_GL}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.5} />
      <pointLight position={[3, 4, 5]} intensity={1} />
      <pointLight position={[-3, -2, -3]} intensity={0.3} color="#ff6666" />
      <BossModel isHit={isHit} isDefeated={isDefeated} />
    </Canvas>
  );
}

export default memo(RaidBoss3D);
