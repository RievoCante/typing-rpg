import { memo, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Group, Color, MeshPhongMaterial } from 'three';
import type { PlayerAvatarConfig } from '../utils/avatarConfig';

const HURT_COLOR = new Color('#ff4d4d');
const GRAY = new Color('#6b7280');
const HURT_DURATION = 220; // ms
const ATTACK_DURATION = 220; // ms — matches RaidAvatar swing timing
const CRITICAL_HP = 25;

interface ModelProps {
  config: PlayerAvatarConfig;
  isAlive: boolean;
  hpPercent: number;
  isAttacking: boolean;
  isHurt: boolean;
}

function PlayerAvatarModel({
  config,
  isAlive,
  hpPercent,
  isAttacking,
  isHurt,
}: ModelProps) {
  const groupRef = useRef<Group>(null);
  const bodyMatRef = useRef<MeshPhongMaterial | null>(null);
  const attackTimeRef = useRef(0);
  const hurtTimeRef = useRef(0);

  const baseColor = useMemo(
    () => new Color(config.bodyColor),
    [config.bodyColor]
  );

  // Capture rising edges of the transient trigger props (same approach as
  // SlimeModel's hit flash): record a timestamp, decay it inside useFrame.
  useEffect(() => {
    if (isAttacking) attackTimeRef.current = Date.now();
  }, [isAttacking]);
  useEffect(() => {
    if (isHurt) hurtTimeRef.current = Date.now();
  }, [isHurt]);

  const critical = isAlive && hpPercent < CRITICAL_HP;

  useFrame(state => {
    const g = groupRef.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const now = Date.now();

    let posY = 0;
    let posZ = 0;
    let rotZ = 0;
    let rotX = 0;
    let scale = 1;

    if (isAlive) {
      posY = Math.sin(t * 2) * 0.06; // idle bob

      const aEl = now - attackTimeRef.current; // attack lunge + pop
      if (attackTimeRef.current > 0 && aEl < ATTACK_DURATION) {
        const k = 1 - aEl / ATTACK_DURATION;
        posZ += 0.5 * k;
        scale += 0.18 * k;
      }

      if (critical) rotZ = Math.sin(t * 9) * 0.12; // low-HP wobble
    } else {
      rotX = 0.9; // death droop forward
      posY = -0.25;
      scale = 0.85;
    }

    const hEl = now - hurtTimeRef.current;
    const hurting = hurtTimeRef.current > 0 && hEl < HURT_DURATION;
    if (hurting && isAlive) posZ -= 0.25 * (1 - hEl / HURT_DURATION); // recoil

    g.position.set(0, posY, posZ);
    g.rotation.set(rotX, 0, rotZ);
    g.scale.setScalar(scale);

    const mat = bodyMatRef.current;
    if (mat) {
      if (hurting) {
        const k = 1 - hEl / HURT_DURATION;
        mat.color.copy(baseColor).lerp(HURT_COLOR, k);
        mat.emissive.copy(HURT_COLOR);
        mat.emissiveIntensity = 0.2 + 0.6 * k;
      } else if (!isAlive) {
        mat.color.copy(baseColor).lerp(GRAY, 0.7);
        mat.emissive.set('#000000');
        mat.emissiveIntensity = 0;
      } else if (critical) {
        mat.color.copy(baseColor).lerp(GRAY, 0.5); // desaturate when critical
        mat.emissive.set('#000000');
        mat.emissiveIntensity = 0;
      } else {
        mat.color.copy(baseColor);
        mat.emissive.set('#000000');
        mat.emissiveIntensity = 0;
      }
    }
  });

  // Eye geometry tweaks per style.
  const eyeScaleY = config.eyeStyle === 'sleepy' ? 0.4 : 1;
  const eyeR = config.eyeStyle === 'wide' ? 0.16 : 0.12;
  const eyeX = config.eyeStyle === 'wide' ? 0.34 : 0.28;

  return (
    <group ref={groupRef}>
      <mesh>
        {config.bodyShape === 'square' ? (
          <boxGeometry args={[1.3, 1.3, 1.3]} />
        ) : (
          <sphereGeometry args={[0.9, 32, 32]} />
        )}
        <meshPhongMaterial
          ref={bodyMatRef}
          color={config.bodyColor}
          shininess={80}
          transparent
          opacity={0.95}
          specular="#ffffff"
        />
        {/* Eyes are children of the body so they inherit its transform. */}
        <mesh position={[-eyeX, 0.18, 0.82]} scale={[1, eyeScaleY, 1]}>
          <sphereGeometry args={[eyeR, 16, 16]} />
          <meshPhongMaterial color="#111111" />
        </mesh>
        <mesh position={[eyeX, 0.18, 0.82]} scale={[1, eyeScaleY, 1]}>
          <sphereGeometry args={[eyeR, 16, 16]} />
          <meshPhongMaterial color="#111111" />
        </mesh>
      </mesh>

      {config.accessory === 'antenna' && (
        <group position={[0, 0.95, 0]}>
          <mesh position={[0, 0.15, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.4, 8]} />
            <meshPhongMaterial color={config.accessoryColor} />
          </mesh>
          <mesh position={[0, 0.4, 0]}>
            <sphereGeometry args={[0.1, 16, 16]} />
            <meshPhongMaterial color={config.accessoryColor} />
          </mesh>
        </group>
      )}
      {config.accessory === 'horn' && (
        <mesh position={[0, 1.05, 0]}>
          <coneGeometry args={[0.18, 0.5, 16]} />
          <meshPhongMaterial color={config.accessoryColor} />
        </mesh>
      )}
      {config.accessory === 'crown' && (
        <mesh position={[0, 1.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.28, 0.07, 8, 24]} />
          <meshPhongMaterial color={config.accessoryColor} />
        </mesh>
      )}
    </group>
  );
}

export interface PlayerAvatar3DProps {
  config: PlayerAvatarConfig;
  isAlive: boolean;
  hpPercent: number;
  isAttacking?: boolean;
  isHurt?: boolean;
}

// Self-contained avatar: fills its parent box (give the parent a width/height).
function PlayerAvatar3D({
  config,
  isAlive,
  hpPercent,
  isAttacking = false,
  isHurt = false,
}: PlayerAvatar3DProps) {
  return (
    <Canvas
      camera={{ position: [0, 0.2, 3.2], fov: 50 }}
      gl={{ alpha: true, antialias: true }}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.6} />
      <pointLight position={[3, 4, 5]} intensity={0.9} />
      <pointLight position={[-3, -2, -3]} intensity={0.25} color="#ffffff" />
      <PlayerAvatarModel
        config={config}
        isAlive={isAlive}
        hpPercent={hpPercent}
        isAttacking={isAttacking}
        isHurt={isHurt}
      />
    </Canvas>
  );
}

export default memo(PlayerAvatar3D);
