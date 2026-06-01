import { memo, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Group, Color, MeshPhongMaterial } from 'three';
import type { PlayerAvatarConfig } from '../utils/avatarConfig';
import { isCriticalHp } from '../utils/raidHp';
import { CANVAS_DPR, CANVAS_GL } from '../utils/canvas';

const HURT_COLOR = new Color('#ff4d4d');
const GRAY = new Color('#6b7280');
const HURT_DURATION = 220; // ms
const ATTACK_DURATION = 220; // ms — matches RaidAvatar swing timing

// Which base color a material derives from, so hurt/death tints recolor every
// body part (not just one). 'steel' (the sword) is left out of the critical
// desaturate so the weapon keeps its shine.
type TintGroup = 'armor' | 'armorDark' | 'skin' | 'helmet' | 'steel';

interface ModelProps {
  config: PlayerAvatarConfig;
  isAlive: boolean;
  hpPercent: number;
  isAttacking: boolean;
  isHurt: boolean;
}

function WarriorModel({
  config,
  isAlive,
  hpPercent,
  isAttacking,
  isHurt,
}: ModelProps) {
  const groupRef = useRef<Group>(null);
  const matsRef = useRef<Map<MeshPhongMaterial, TintGroup>>(new Map());
  const attackTimeRef = useRef(0);
  const hurtTimeRef = useRef(0);

  // Register a material under its tint group. Inline ref identity changes each
  // render so React calls it with null then the (reused) instance — we ignore
  // null and re-set the same key, so the map stays correct.
  const reg = (group: TintGroup) => (m: MeshPhongMaterial | null) => {
    if (m) matsRef.current.set(m, group);
  };

  // Base colors recomputed when the config changes; tint math lerps from these.
  const bases = useMemo<Record<TintGroup, Color>>(
    () => ({
      armor: new Color(config.armorColor),
      armorDark: new Color(config.armorColor).multiplyScalar(0.55),
      skin: new Color(config.skinTone),
      helmet: new Color(config.helmetColor),
      steel: new Color('#c7ccd6'),
    }),
    [config.armorColor, config.skinTone, config.helmetColor]
  );

  useEffect(() => {
    if (isAttacking) attackTimeRef.current = Date.now();
  }, [isAttacking]);
  useEffect(() => {
    if (isHurt) hurtTimeRef.current = Date.now();
  }, [isHurt]);

  const critical = isCriticalHp(hpPercent, isAlive);

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

    for (const [mat, group] of matsRef.current) {
      const base = bases[group];
      if (hurting && isAlive) {
        const k = 1 - hEl / HURT_DURATION;
        mat.color.copy(base).lerp(HURT_COLOR, k);
        mat.emissive.copy(HURT_COLOR);
        mat.emissiveIntensity = 0.2 + 0.6 * k;
      } else if (!isAlive) {
        mat.color.copy(base).lerp(GRAY, 0.7);
        mat.emissive.set('#000000');
        mat.emissiveIntensity = 0;
      } else if (critical && group !== 'steel') {
        mat.color.copy(base).lerp(GRAY, 0.5); // desaturate when critical
        mat.emissive.set('#000000');
        mat.emissiveIntensity = 0;
      } else {
        mat.color.copy(base);
        mat.emissive.set('#000000');
        mat.emissiveIntensity = 0;
      }
    }
  });

  // Silhouette varies by armor type.
  const heavy = config.armorType === 'heavy';
  const tunic = config.armorType === 'tunic';
  const torsoW = heavy ? 1.0 : tunic ? 0.74 : 0.9;
  const torsoD = heavy ? 0.58 : tunic ? 0.46 : 0.52;
  const armX = torsoW / 2 + 0.12;
  const showPauldrons = !tunic;
  const pauldronR = heavy ? 0.3 : 0.22;

  // Helmet shapes. All open-faced so the skin tone reads on the face.
  const helmet = (
    <group position={[0, 0.62, 0]}>
      {/* Cap covering the crown of the head */}
      <mesh position={[0, 0.16, -0.02]}>
        <sphereGeometry
          args={[0.34, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.62]}
        />
        <meshPhongMaterial
          ref={reg('helmet')}
          shininess={70}
          specular="#ffffff"
        />
      </mesh>
      {config.helmetType === 'barbute' && (
        // Nose guard down the face
        <mesh position={[0, 0.02, 0.27]}>
          <boxGeometry args={[0.07, 0.34, 0.06]} />
          <meshPhongMaterial ref={reg('helmet')} shininess={70} />
        </mesh>
      )}
      {config.helmetType === 'horned' && (
        <>
          <mesh position={[-0.3, 0.26, 0]} rotation={[0, 0, 0.5]}>
            <coneGeometry args={[0.08, 0.34, 12]} />
            <meshPhongMaterial ref={reg('helmet')} shininess={70} />
          </mesh>
          <mesh position={[0.3, 0.26, 0]} rotation={[0, 0, -0.5]}>
            <coneGeometry args={[0.08, 0.34, 12]} />
            <meshPhongMaterial ref={reg('helmet')} shininess={70} />
          </mesh>
        </>
      )}
      {config.helmetType === 'crowned' && (
        <mesh position={[0, 0.28, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.26, 0.05, 8, 24]} />
          <meshPhongMaterial ref={reg('helmet')} shininess={70} />
        </mesh>
      )}
    </group>
  );

  return (
    <group ref={groupRef}>
      {/* Head */}
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[0.46, 0.46, 0.44]} />
        <meshPhongMaterial ref={reg('skin')} shininess={15} />
      </mesh>
      {/* Eyes (static dark, not tinted) */}
      <mesh position={[-0.12, 0.57, 0.23]}>
        <boxGeometry args={[0.07, 0.05, 0.02]} />
        <meshPhongMaterial color="#111111" />
      </mesh>
      <mesh position={[0.12, 0.57, 0.23]}>
        <boxGeometry args={[0.07, 0.05, 0.02]} />
        <meshPhongMaterial color="#111111" />
      </mesh>

      {helmet}

      {/* Torso */}
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[torsoW, 0.92, torsoD]} />
        <meshPhongMaterial
          ref={reg('armor')}
          shininess={60}
          specular="#ffffff"
        />
      </mesh>
      {/* Pelvis */}
      <mesh position={[0, -0.5, 0]}>
        <boxGeometry args={[torsoW * 0.82, 0.26, torsoD * 0.92]} />
        <meshPhongMaterial ref={reg('armorDark')} shininess={40} />
      </mesh>

      {showPauldrons && (
        <>
          <mesh position={[-armX + 0.04, 0.4, 0]}>
            <sphereGeometry args={[pauldronR, 12, 12]} />
            <meshPhongMaterial ref={reg('armor')} shininess={60} />
          </mesh>
          <mesh position={[armX - 0.04, 0.4, 0]}>
            <sphereGeometry args={[pauldronR, 12, 12]} />
            <meshPhongMaterial ref={reg('armor')} shininess={60} />
          </mesh>
        </>
      )}

      {/* Arms (upper arm armored, hands skin) */}
      <mesh position={[-armX, 0.06, 0]}>
        <boxGeometry args={[0.2, 0.62, 0.24]} />
        <meshPhongMaterial ref={reg('armor')} shininess={60} />
      </mesh>
      <mesh position={[armX, 0.06, 0]}>
        <boxGeometry args={[0.2, 0.62, 0.24]} />
        <meshPhongMaterial ref={reg('armor')} shininess={60} />
      </mesh>
      <mesh position={[-armX, -0.34, 0.02]}>
        <boxGeometry args={[0.16, 0.18, 0.2]} />
        <meshPhongMaterial ref={reg('skin')} shininess={15} />
      </mesh>
      <mesh position={[armX, -0.34, 0.02]}>
        <boxGeometry args={[0.16, 0.18, 0.2]} />
        <meshPhongMaterial ref={reg('skin')} shininess={15} />
      </mesh>

      {/* Legs */}
      <mesh position={[-0.22, -0.92, 0]}>
        <boxGeometry args={[0.24, 0.6, 0.28]} />
        <meshPhongMaterial ref={reg('armorDark')} shininess={40} />
      </mesh>
      <mesh position={[0.22, -0.92, 0]}>
        <boxGeometry args={[0.24, 0.6, 0.28]} />
        <meshPhongMaterial ref={reg('armorDark')} shininess={40} />
      </mesh>

      {/* Sword — fixed prop in the right hand, slightly forward so the attack
          lunge reads as a thrust. */}
      <group position={[armX + 0.02, -0.1, 0.16]}>
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[0.07, 0.95, 0.04]} />
          <meshPhongMaterial
            ref={reg('steel')}
            shininess={90}
            specular="#ffffff"
          />
        </mesh>
        <mesh position={[0, 0.02, 0]}>
          <boxGeometry args={[0.3, 0.07, 0.07]} />
          <meshPhongMaterial color="#8a6a3a" shininess={30} />
        </mesh>
        <mesh position={[0, -0.16, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.28, 10]} />
          <meshPhongMaterial color="#5a3d22" shininess={20} />
        </mesh>
      </group>
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
      camera={{ position: [0, 0, 3.6], fov: 50 }}
      dpr={CANVAS_DPR}
      gl={CANVAS_GL}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.6} />
      <pointLight position={[3, 4, 5]} intensity={0.9} />
      <pointLight position={[-3, -2, -3]} intensity={0.25} color="#ffffff" />
      <WarriorModel
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
