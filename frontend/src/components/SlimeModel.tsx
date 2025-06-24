import { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh } from 'three';
import type { SlimeTypeEnum } from '../types/SlimeTypes';
import { SLIME_CONFIGS, SLIME_ANIMATIONS } from '../types/SlimeTypes';

interface SlimeModelProps {
  slimeType: SlimeTypeEnum;
  isHit: boolean;
  isDefeated: boolean;
}

export default function SlimeModel({ slimeType, isHit, isDefeated }: SlimeModelProps) {
  const meshRef = useRef<Mesh>(null);
  const leftEyeRef = useRef<Mesh>(null);
  const rightEyeRef = useRef<Mesh>(null);
  const [hitFlashTime, setHitFlashTime] = useState(0);
  
  const config = SLIME_CONFIGS[slimeType];

  // Handle hit flash timing
  useEffect(() => {
    if (isHit) {
      setHitFlashTime(Date.now());
    }
  }, [isHit]);

  // Animation loop
  useFrame((state) => {
    if (!meshRef.current) return;

    const mesh = meshRef.current;
    const time = state.clock.elapsedTime;

    // Idle bounce animation - continuous slow bounce
    if (!isDefeated) {
      mesh.position.y = Math.sin(time * SLIME_ANIMATIONS.BOUNCE_SPEED) * SLIME_ANIMATIONS.BOUNCE_HEIGHT;
      
      // Slight squish effect during bounce for more organic feel
      const squishFactor = 1 + Math.sin(time * SLIME_ANIMATIONS.BOUNCE_SPEED * 2) * 0.05;
      mesh.scale.y = config.scale * squishFactor;
      mesh.scale.x = config.scale * (2 - squishFactor) * 0.5 + config.scale * 0.5;
      mesh.scale.z = config.scale * (2 - squishFactor) * 0.5 + config.scale * 0.5;

      // Make eyes follow the main body animation
      if (leftEyeRef.current && rightEyeRef.current) {
        leftEyeRef.current.position.y = mesh.position.y;
        rightEyeRef.current.position.y = mesh.position.y;
        leftEyeRef.current.scale.copy(mesh.scale);
        rightEyeRef.current.scale.copy(mesh.scale);
      }
    }

    // Red flash effect when hit
    if (isHit && hitFlashTime > 0) {
      const flashElapsed = Date.now() - hitFlashTime;
      if (flashElapsed < SLIME_ANIMATIONS.FLASH_DURATION) {
        // Flash intensity decreases over time
        const flashIntensity = 1 - (flashElapsed / SLIME_ANIMATIONS.FLASH_DURATION);
        // This will be handled by material color mixing
        mesh.userData.flashIntensity = flashIntensity;
      } else {
        mesh.userData.flashIntensity = 0;
        setHitFlashTime(0);
      }
    }

    // Disappear animation when defeated
    if (isDefeated) {
      // Simple fade out
      const material = mesh.material as { opacity: number };
      if (material.opacity > 0) {
        material.opacity -= 0.05; // Fade out speed
      }
      
      // Also fade out eyes
      if (leftEyeRef.current && rightEyeRef.current) {
        const leftMaterial = leftEyeRef.current.material as { opacity: number };
        const rightMaterial = rightEyeRef.current.material as { opacity: number };
        if (leftMaterial.opacity > 0) leftMaterial.opacity -= 0.05;
        if (rightMaterial.opacity > 0) rightMaterial.opacity -= 0.05;
      }
    }
  });

  return (
    <group>
      {/* Main slime body - simple sphere */}
      <mesh ref={meshRef} position={[0, 0, 0]}>
        <sphereGeometry args={[1, 32, 32]} />
      <meshPhongMaterial
        color={config.color}
        shininess={80}
        transparent={true}
        opacity={0.9}
        // Slimy, bouncy appearance
        specular="#ffffff"
        reflectivity={0.3}
      />
    </mesh>

      {/* Left eye */}
      <mesh ref={leftEyeRef} position={[-0.3, 0.2, 0.7]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshPhongMaterial
          color="#000000"
          transparent={true}
          opacity={1.0}
        />
      </mesh>

      {/* Right eye */}
      <mesh ref={rightEyeRef} position={[0.3, 0.2, 0.7]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshPhongMaterial
          color="#000000"
          transparent={true}
          opacity={1.0}
        />
      </mesh>
    </group>
  );
} 