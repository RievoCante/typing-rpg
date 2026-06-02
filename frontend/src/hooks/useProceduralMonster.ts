import { useRef, useEffect, useState } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Mesh, Color, MeshStandardMaterial } from 'three';
import type { MonsterVariant } from '../context/GameContext';
import { VARIANT_GLOW, glowIntensity } from '../utils/variantGlow';

const HIT_FLASH_COLOR = new Color('#ff6b6b');

interface ProceduralMonsterOptions {
  variant: MonsterVariant;
  isHit: boolean;
  isDefeated: boolean;
  scale: number;
  idleSpeed: number;
  idleHeight: number;
  flashDuration: number;
  // Crystal spins continuously; others sway gently.
  spin?: boolean;
}

// Shared idle / hit-flash / variant-glow / defeat animation for procedural
// multi-mesh monster families (mushroom, crystal). Generalizes GolemModel's
// group-traverse approach so a single, tested code path drives every procedural
// family: each mesh's original color is captured once, so hit-flash and aura
// restore correctly even when meshes have different base colors (e.g. a
// mushroom's red cap, beige stem, white spots). Mirrors the slime/golem
// contract: elite/rare wear the shared VARIANT_GLOW aura (rare pulses), common
// has none.
export function useProceduralMonster(
  groupRef: RefObject<Group | null>,
  {
    variant,
    isHit,
    isDefeated,
    scale,
    idleSpeed,
    idleHeight,
    flashDuration,
    spin = false,
  }: ProceduralMonsterOptions
) {
  const [hitFlashTime, setHitFlashTime] = useState(0);
  // Tracks whether a variant aura is currently applied, so we clear it exactly
  // once when switching to a common monster instead of traversing every frame.
  const glowAppliedRef = useRef(false);

  // Capture each material's base color once so flash/restore is color-accurate.
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    group.traverse(child => {
      if ((child as Mesh).isMesh) {
        const mat = (child as Mesh).material as MeshStandardMaterial;
        if (mat && !mat.userData.origColor) {
          mat.userData.origColor = mat.color.clone();
        }
      }
    });
  }, [groupRef]);

  useEffect(() => {
    if (isHit) setHitFlashTime(Date.now());
  }, [isHit]);

  // Restore transforms/opacity when the monster is alive (the defeat animation
  // mutates these cumulatively, and a respawn can briefly mount while still
  // flagged defeated).
  useEffect(() => {
    const group = groupRef.current;
    if (isDefeated || !group) return;
    group.position.set(0, 0, 0);
    group.rotation.set(0, 0, 0);
    group.scale.setScalar(scale);
    group.traverse(child => {
      if ((child as Mesh).isMesh) {
        const mat = (child as Mesh).material as MeshStandardMaterial;
        if (mat && mat.transparent) mat.opacity = 1.0;
      }
    });
  }, [isDefeated, scale, groupRef]);

  // Flash on the global 'word-hit' event so we don't rely solely on props.
  useEffect(() => {
    const handler = () => setHitFlashTime(Date.now());
    window.addEventListener('word-hit', handler as EventListener);
    return () =>
      window.removeEventListener('word-hit', handler as EventListener);
  }, []);

  useFrame(state => {
    const group = groupRef.current;
    if (!group) return;
    const time = state.clock.elapsedTime;

    if (!isDefeated) {
      group.position.y = Math.sin(time * idleSpeed) * idleHeight;
      group.rotation.y = spin ? time * 0.4 : Math.sin(time * 0.3) * 0.1;
      // Grow back to target scale after a defeat shrink (e.g. clone reuse).
      if (group.scale.x < scale) {
        group.scale.setScalar(Math.min(scale, group.scale.x + 0.02));
      }
    }

    if (hitFlashTime > 0) {
      const flashElapsed = Date.now() - hitFlashTime;
      if (flashElapsed < flashDuration) {
        const flashIntensity = 1 - flashElapsed / flashDuration;
        group.traverse(child => {
          if ((child as Mesh).isMesh) {
            const mat = (child as Mesh).material as MeshStandardMaterial;
            if (mat) {
              const orig = (mat.userData.origColor as Color) ?? mat.color;
              mat.color.copy(orig).lerp(HIT_FLASH_COLOR, flashIntensity);
              mat.emissive.copy(HIT_FLASH_COLOR);
              mat.emissiveIntensity = 0.3 * flashIntensity;
            }
          }
        });
      } else {
        group.traverse(child => {
          if ((child as Mesh).isMesh) {
            const mat = (child as Mesh).material as MeshStandardMaterial;
            if (mat) {
              const orig = (mat.userData.origColor as Color) ?? mat.color;
              mat.color.copy(orig);
              mat.emissive.setHex(0x000000);
              mat.emissiveIntensity = 0;
            }
          }
        });
        setHitFlashTime(0);
        // Force the aura to re-apply next frame if this is an elite/rare.
        glowAppliedRef.current = false;
      }
    } else if (!isDefeated) {
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

    if (isDefeated) {
      group.scale.multiplyScalar(0.95);
      group.traverse(child => {
        if ((child as Mesh).isMesh) {
          const mesh = child as Mesh;
          mesh.position.y -= 0.02;
          mesh.rotation.x += 0.03;
          mesh.rotation.z += 0.015;
          const mat = mesh.material as MeshStandardMaterial;
          if (mat && mat.transparent) {
            mat.opacity = Math.max(0, mat.opacity - 0.03);
          }
        }
      });
    }
  });
}
