import { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import {
  Mesh,
  Color,
  Group,
  MeshStandardMaterial,
  Vector3,
  Euler,
} from 'three';
import type { GolemTypeEnum } from '../types/GolemTypes';
import { GOLEM_CONFIGS, GOLEM_ANIMATIONS } from '../types/GolemTypes';
import type { MonsterVariant } from '../context/GameContext';
import { VARIANT_GLOW, glowIntensity } from '../utils/variantGlow';

const HIT_FLASH_COLOR = new Color('#ff6b6b');

interface GolemModelProps {
  golemType: GolemTypeEnum;
  variant?: MonsterVariant;
  isHit: boolean;
  isDefeated: boolean;
  customColor?: string;
  customScale?: number;
}

// Preload the GLB model
useGLTF.preload('/models/GolemMiniboss.glb');

export default function GolemModel({
  golemType,
  variant = 'common',
  isHit,
  isDefeated,
  customColor,
  customScale,
}: GolemModelProps) {
  const groupRef = useRef<Group>(null);
  const [hitFlashTime, setHitFlashTime] = useState(0);
  // Tracks whether a variant aura is currently applied, so we clear it exactly
  // once when switching to a common monster instead of traversing every frame.
  const glowAppliedRef = useRef(false);

  // Load the GLB model
  const { scene } = useGLTF('/models/GolemMiniboss.glb');

  // Clone the scene for this instance (so we can modify it independently)
  const modelScene = useMemo(() => {
    const cloned = scene.clone();

    // Apply custom color to all mesh materials
    if (customColor) {
      const targetColor = new Color(customColor);
      cloned.traverse(child => {
        if ((child as Mesh).isMesh) {
          const mesh = child as Mesh;
          if (mesh.material) {
            // Clone material so we don't affect other instances
            const originalMat = mesh.material as MeshStandardMaterial;
            const newMat = originalMat.clone();

            // Tint the base color while preserving texture details
            newMat.color.copy(targetColor);
            // If there's a map, blend less aggressively to preserve texture
            if (newMat.map) {
              newMat.color.lerp(new Color('#ffffff'), 0.3);
            }

            mesh.material = newMat;
          }
        }
      });
    }

    // Remember each mesh's original transform so we can restore it after the
    // crumble (defeat) animation mutates rotation/position. A freshly spawned
    // monster can briefly mount while still flagged defeated, so without this
    // the model stays toppled on the ground for the rest of its life.
    cloned.traverse(child => {
      if ((child as Mesh).isMesh) {
        child.userData.origPosition = child.position.clone();
        child.userData.origRotation = child.rotation.clone();
      }
    });

    return cloned;
  }, [scene, customColor]);

  const config = GOLEM_CONFIGS[golemType];
  const activeScale = customScale || config.scale;

  const finalColor = useMemo(() => {
    const base = new Color(customColor || config.color);
    return base;
  }, [customColor, config.color]);

  useEffect(() => {
    if (isHit) {
      setHitFlashTime(Date.now());
    }
  }, [isHit]);

  // Reset transforms + opacity when the monster is alive (not defeated).
  // The crumble animation mutates each mesh's rotation/position cumulatively
  // and never undoes it; restore the originals here so a respawned golem
  // stands upright instead of staying toppled from the previous defeat.
  useEffect(() => {
    const group = groupRef.current;
    if (isDefeated || !group) return;

    group.position.set(0, 0, 0);
    group.rotation.set(0, 0, 0);
    group.scale.setScalar(activeScale);

    group.traverse(child => {
      if ((child as Mesh).isMesh) {
        const mesh = child as Mesh;
        const origPos = mesh.userData.origPosition as Vector3 | undefined;
        const origRot = mesh.userData.origRotation as Euler | undefined;
        if (origPos) mesh.position.copy(origPos);
        if (origRot) mesh.rotation.copy(origRot);
        const mat = mesh.material as MeshStandardMaterial;
        if (mat && mat.transparent) {
          mat.opacity = 1.0;
        }
      }
    });
  }, [isDefeated, activeScale]);

  // Flash on global 'word-hit' event
  useEffect(() => {
    const handler = () => setHitFlashTime(Date.now());
    window.addEventListener('word-hit', handler as EventListener);
    return () =>
      window.removeEventListener('word-hit', handler as EventListener);
  }, []);

  useFrame(state => {
    if (!groupRef.current) return;

    const group = groupRef.current;
    const time = state.clock.elapsedTime;

    if (!isDefeated) {
      // Idle floating animation
      group.position.y =
        Math.sin(time * GOLEM_ANIMATIONS.IDLE_SPEED) *
        GOLEM_ANIMATIONS.IDLE_HEIGHT;

      // Gentle rotation
      group.rotation.y = Math.sin(time * 0.3) * 0.1;
    }

    // Hit flash effect - apply to all meshes
    if (hitFlashTime > 0) {
      const flashElapsed = Date.now() - hitFlashTime;
      if (flashElapsed < GOLEM_ANIMATIONS.FLASH_DURATION) {
        const flashIntensity =
          1 - flashElapsed / GOLEM_ANIMATIONS.FLASH_DURATION;

        group.traverse(child => {
          if ((child as Mesh).isMesh) {
            const mesh = child as Mesh;
            const mat = mesh.material as MeshStandardMaterial;
            if (mat) {
              mat.color.copy(finalColor).lerp(HIT_FLASH_COLOR, flashIntensity);
              mat.emissive.copy(HIT_FLASH_COLOR);
              mat.emissiveIntensity = 0.3 * flashIntensity;
            }
          }
        });
      } else {
        // Restore colors
        group.traverse(child => {
          if ((child as Mesh).isMesh) {
            const mesh = child as Mesh;
            const mat = mesh.material as MeshStandardMaterial;
            if (mat) {
              mat.color.copy(finalColor);
              mat.emissive.setHex(0x000000);
              mat.emissiveIntensity = 0;
            }
          }
        });
        setHitFlashTime(0);
      }
    } else if (!isDefeated) {
      // Resting state: elite/rare wear a variant-colored aura (rare pulses).
      const glow = VARIANT_GLOW[variant];
      if (glow) {
        const intensity = glowIntensity(glow, time);
        group.traverse(child => {
          if ((child as Mesh).isMesh) {
            const mat = (child as Mesh).material as MeshStandardMaterial;
            if (mat) {
              mat.emissive.copy(glow.color);
              mat.emissiveIntensity = intensity;
            }
          }
        });
        glowAppliedRef.current = true;
      } else if (glowAppliedRef.current) {
        // Switched to a common monster: clear the leftover aura once so it
        // doesn't persist (e.g. when the GLB clone is reused for the same
        // color). Common golems otherwise skip the per-frame traverse.
        group.traverse(child => {
          if ((child as Mesh).isMesh) {
            const mat = (child as Mesh).material as MeshStandardMaterial;
            if (mat) {
              mat.emissive.setHex(0x000000);
              mat.emissiveIntensity = 0;
            }
          }
        });
        glowAppliedRef.current = false;
      }
    }

    // Defeat animation - scale down
    if (isDefeated) {
      group.scale.multiplyScalar(0.95);

      // Fall apart effect
      group.traverse(child => {
        if ((child as Mesh).isMesh) {
          const mesh = child as Mesh;
          mesh.position.y -= 0.02;
          mesh.position.x += (Math.random() - 0.5) * 0.01;
          mesh.position.z += (Math.random() - 0.5) * 0.01;
          mesh.rotation.x += 0.02;
          mesh.rotation.z += 0.01;

          // Fade out
          const mat = mesh.material as MeshStandardMaterial;
          if (mat && mat.transparent) {
            mat.opacity = Math.max(0, mat.opacity - 0.02);
          }
        }
      });
    } else {
      // Reset scale when not defeated
      const targetScale = activeScale;
      if (group.scale.x < targetScale) {
        group.scale.setScalar(Math.min(targetScale, group.scale.x + 0.02));
      }
    }
  });

  return (
    <group ref={groupRef} scale={activeScale}>
      <primitive object={modelScene} />
    </group>
  );
}
