import { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh, Color, MeshPhongMaterial } from 'three';
import type { SlimeTypeEnum } from '../types/SlimeTypes';
import { SLIME_CONFIGS, SLIME_ANIMATIONS } from '../types/SlimeTypes';

interface SlimeModelProps {
  slimeType: SlimeTypeEnum;
  isHit: boolean;
  isDefeated: boolean;
  customColor?: string;
  customScale?: number;
}

export default function SlimeModel({
  slimeType,
  isHit,
  isDefeated,
  customColor,
  customScale,
}: SlimeModelProps) {
  const meshRef = useRef<Mesh>(null);
  const bodyMatRef = useRef<MeshPhongMaterial | null>(null);
  const leftEyeRef = useRef<Mesh>(null);
  const rightEyeRef = useRef<Mesh>(null);
  const [hitFlashTime, setHitFlashTime] = useState(0);

  const config = SLIME_CONFIGS[slimeType];
  const activeColor = customColor || config.color;
  const activeScale = customScale || config.scale;

  const { finalColor, emissiveColor } = useMemo(() => {
    const base = new Color(activeColor as unknown as string);
    const targetMix = new Color('#AEE6FF');

    const body = base.clone().lerp(targetMix, customColor ? 0.3 : 0.7);

    const emissive = customColor
      ? body.clone().lerp(new Color('#ffffff'), 0.2)
      : new Color('#7ecbff');

    return { finalColor: body, emissiveColor: emissive };
  }, [activeColor, customColor, slimeType]);

  useEffect(() => {
    if (isHit) {
      setHitFlashTime(Date.now());
    }
  }, [isHit]);

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
        mat.color.copy(finalColor).lerp(new Color('#ff4d4d'), flashIntensity);
        mat.emissive.set('#ff4d4d');
        mat.emissiveIntensity = 0.25 + 0.75 * flashIntensity;
      } else {
        // Restore base color
        const mat = bodyMatRef.current as MeshPhongMaterial;
        mat.color.copy(finalColor);
        mat.emissive.copy(emissiveColor);
        mat.emissiveIntensity = 0.25;
        setHitFlashTime(0);
      }
    }

    if (isDefeated) {
      const material = mesh.material as { opacity: number };
      if (material.opacity > 0) {
        material.opacity -= 0.05;
      }
      if (leftEyeRef.current && rightEyeRef.current) {
        const leftMaterial = leftEyeRef.current.material as { opacity: number };
        const rightMaterial = rightEyeRef.current.material as {
          opacity: number;
        };
        if (leftMaterial.opacity > 0) leftMaterial.opacity -= 0.05;
        if (rightMaterial.opacity > 0) rightMaterial.opacity -= 0.05;
      }
    } else {
      // Ensure opacity is reset when not defeated
      const material = mesh.material as { opacity: number };
      if (material.opacity < 0.95) {
        material.opacity = 0.95;
      }
      if (leftEyeRef.current && rightEyeRef.current) {
        const leftMaterial = leftEyeRef.current.material as { opacity: number };
        const rightMaterial = rightEyeRef.current.material as {
          opacity: number;
        };
        if (leftMaterial.opacity < 1.0) leftMaterial.opacity = 1.0;
        if (rightMaterial.opacity < 1.0) rightMaterial.opacity = 1.0;
      }
    }
  });

  return (
    <group>
      <mesh ref={meshRef} position={[0, 0, 0]}>
        <sphereGeometry args={[1, 32, 32]} />
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

        {/* Eyes are children of the body so they move/scale automatically */}
        <mesh ref={leftEyeRef} position={[-0.3, 0.2, 0.7]}>
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshPhongMaterial color="#000000" transparent={true} opacity={1.0} />
        </mesh>

        <mesh ref={rightEyeRef} position={[0.3, 0.2, 0.7]}>
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshPhongMaterial color="#000000" transparent={true} opacity={1.0} />
        </mesh>
      </mesh>
    </group>
  );
}
