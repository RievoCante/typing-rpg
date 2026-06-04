import { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh, Color, MeshPhongMaterial } from 'three';
import type { SlimeTypeEnum, SlimeShapeEnum } from '../types/SlimeTypes';
import { SLIME_CONFIGS, SLIME_ANIMATIONS } from '../types/SlimeTypes';
import type { MonsterVariant } from '../context/GameContext';
import { VARIANT_GLOW, glowIntensity } from '../utils/variantGlow';
import type { EyeStyle } from '../utils/eyeStyles';
import MonsterEyes from './MonsterEyes';

const HIT_FLASH_COLOR = new Color('#ff4d4d');

interface SlimeModelProps {
  slimeType: SlimeTypeEnum;
  variant?: MonsterVariant;
  isHit: boolean;
  isDefeated: boolean;
  customColor?: string;
  customScale?: number;
  shape?: SlimeShapeEnum; // Override shape if provided
  eyeStyle?: EyeStyle;
}

export default function SlimeModel({
  slimeType,
  variant = 'common',
  isHit,
  isDefeated,
  customColor,
  customScale,
  shape: shapeProp,
  eyeStyle = 'neutral',
}: SlimeModelProps) {
  const meshRef = useRef<Mesh>(null);
  const bodyMatRef = useRef<MeshPhongMaterial | null>(null);
  const [hitFlashTime, setHitFlashTime] = useState(0);

  const config = SLIME_CONFIGS[slimeType];
  const activeColor = customColor !== undefined ? customColor : config.color;
  const activeScale = customScale || config.scale;
  const activeShape = shapeProp || config.shape;

  const { finalColor, emissiveColor } = useMemo(() => {
    const base = new Color(activeColor as unknown as string);
    const targetMix = new Color('#AEE6FF');

    const body = base.clone().lerp(targetMix, customColor ? 0.3 : 0.7);

    const emissive = customColor
      ? body.clone().lerp(new Color('#ffffff'), 0.2)
      : new Color('#7ecbff');

    return { finalColor: body, emissiveColor: emissive };
  }, [activeColor, customColor]);

  useEffect(() => {
    if (isHit) {
      setHitFlashTime(Date.now());
    }
  }, [isHit]);

  // Reset opacity when monster spawns (not defeated). The body fades on defeat
  // and so do its eye meshes (children); restore both so a respawn isn't ghosted.
  useEffect(() => {
    const mesh = meshRef.current;
    if (isDefeated || !mesh) return;
    (mesh.material as { opacity: number }).opacity = 0.95;
    mesh.traverse(child => {
      if ((child as Mesh).isMesh && child !== mesh) {
        ((child as Mesh).material as { opacity: number }).opacity = 1.0;
      }
    });
  }, [isDefeated]);

  // Also flash on global 'word-hit' event so we don't rely on parent props
  useEffect(() => {
    const handler = () => setHitFlashTime(Date.now());
    window.addEventListener('word-hit', handler as EventListener);
    return () =>
      window.removeEventListener('word-hit', handler as EventListener);
  }, []);

  useFrame(state => {
    if (!meshRef.current) return;

    const mesh = meshRef.current;
    const time = state.clock.elapsedTime;

    if (!isDefeated) {
      mesh.position.y =
        Math.sin(time * SLIME_ANIMATIONS.BOUNCE_SPEED) *
        SLIME_ANIMATIONS.BOUNCE_HEIGHT;
      const squishFactor =
        1 + Math.sin(time * SLIME_ANIMATIONS.BOUNCE_SPEED * 2) * 0.05;
      mesh.scale.y = activeScale * squishFactor;
      mesh.scale.x = activeScale * (2 - squishFactor) * 0.5 + activeScale * 0.5;
      mesh.scale.z = activeScale * (2 - squishFactor) * 0.5 + activeScale * 0.5;
    }

    if (hitFlashTime > 0 && bodyMatRef.current) {
      const flashElapsed = Date.now() - hitFlashTime;
      if (flashElapsed < SLIME_ANIMATIONS.FLASH_DURATION) {
        const flashIntensity =
          1 - flashElapsed / SLIME_ANIMATIONS.FLASH_DURATION;
        // Blend body color toward red; keep this cheap and allocation-free
        const mat = bodyMatRef.current as MeshPhongMaterial;
        mat.color.copy(finalColor).lerp(HIT_FLASH_COLOR, flashIntensity);
        mat.emissive.copy(HIT_FLASH_COLOR);
        mat.emissiveIntensity = 0.25 + 0.75 * flashIntensity;
      } else {
        // Restore base color
        const mat = bodyMatRef.current as MeshPhongMaterial;
        mat.color.copy(finalColor);
        mat.emissive.copy(emissiveColor);
        mat.emissiveIntensity = 0.25;
        setHitFlashTime(0);
      }
    } else if (bodyMatRef.current && !isDefeated) {
      // Resting state (alive, not flashing): elite/rare wear a variant-colored
      // aura (rare pulses). Common restores the subtle base emissive so a
      // common slime spawned right after an elite/rare doesn't inherit its glow.
      const glow = VARIANT_GLOW[variant];
      const mat = bodyMatRef.current as MeshPhongMaterial;
      if (glow) {
        mat.emissive.copy(glow.color);
        mat.emissiveIntensity = glowIntensity(glow, time);
      } else {
        mat.emissive.copy(emissiveColor);
        mat.emissiveIntensity = 0.25;
      }
    }

    if (isDefeated) {
      const material = mesh.material as { opacity: number };
      if (material.opacity > 0) material.opacity -= 0.05;
      // Fade every eye mesh (children of the body) in lockstep with the body.
      mesh.traverse(child => {
        if ((child as Mesh).isMesh && child !== mesh) {
          const m = (child as Mesh).material as { opacity: number };
          if (m.opacity > 0) m.opacity -= 0.05;
        }
      });
    } else {
      // Ensure opacity is reset when not defeated
      const material = mesh.material as { opacity: number };
      if (material.opacity < 0.95) material.opacity = 0.95;
      mesh.traverse(child => {
        if ((child as Mesh).isMesh && child !== mesh) {
          const m = (child as Mesh).material as { opacity: number };
          if (m.opacity < 1.0) m.opacity = 1.0;
        }
      });
    }
  });

  return (
    <group>
      <mesh ref={meshRef} position={[0, 0, 0]}>
        {activeShape === 'square' ? (
          <dodecahedronGeometry args={[1, 0]} />
        ) : (
          <sphereGeometry args={[1, 24, 24]} />
        )}
        <meshPhongMaterial
          ref={bodyMatRef}
          color={finalColor}
          shininess={120}
          transparent={true}
          opacity={0.95}
          specular="#ffffff"
          reflectivity={0.5}
          emissive={emissiveColor}
          emissiveIntensity={0.25}
        />

        {/* Eyes are children of the body so they move/scale automatically.
            Expression varies per spawn for visual variety. */}
        <MonsterEyes
          style={eyeStyle}
          spacing={0.3}
          y={0.2}
          z={0.92}
          size={0.16}
        />
      </mesh>
    </group>
  );
}
