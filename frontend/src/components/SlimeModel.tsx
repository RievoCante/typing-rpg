import { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh, Color, MeshPhongMaterial } from 'three';
import type { SlimeTypeEnum } from '../types/SlimeTypes';
import { SLIME_CONFIGS, SLIME_ANIMATIONS } from '../types/SlimeTypes';

interface SlimeModelProps {
  slimeType: SlimeTypeEnum;
  isHit: boolean;
  isDefeated: boolean;
}

export default function SlimeModel({
  slimeType,
  isHit,
  isDefeated,
}: SlimeModelProps) {
  const meshRef = useRef<Mesh>(null);
  const bodyMatRef = useRef<MeshPhongMaterial | null>(null);
  const leftEyeRef = useRef<Mesh>(null);
  const rightEyeRef = useRef<Mesh>(null);
  const [hitFlashTime, setHitFlashTime] = useState(0);

  const config = SLIME_CONFIGS[slimeType];

  // derive a brighter light-blue color
  const base = new Color(config.color as unknown as string);
  const lightBlue = new Color('#AEE6FF');
  const finalColor = base.lerp(lightBlue, 0.7);

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
      mesh.scale.y = config.scale * squishFactor;
      mesh.scale.x =
        config.scale * (2 - squishFactor) * 0.5 + config.scale * 0.5;
      mesh.scale.z =
        config.scale * (2 - squishFactor) * 0.5 + config.scale * 0.5;

      if (leftEyeRef.current && rightEyeRef.current) {
        leftEyeRef.current.position.y = mesh.position.y;
        rightEyeRef.current.position.y = mesh.position.y;
        leftEyeRef.current.scale.copy(mesh.scale);
        rightEyeRef.current.scale.copy(mesh.scale);
      }
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
        mat.emissive.set('#7ecbff');
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
          emissive="#7ecbff"
          emissiveIntensity={0.25}
        />
      </mesh>

      <mesh ref={leftEyeRef} position={[-0.3, 0.2, 0.7]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshPhongMaterial color="#000000" transparent={true} opacity={1.0} />
      </mesh>

      <mesh ref={rightEyeRef} position={[0.3, 0.2, 0.7]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshPhongMaterial color="#000000" transparent={true} opacity={1.0} />
      </mesh>
    </group>
  );
}
