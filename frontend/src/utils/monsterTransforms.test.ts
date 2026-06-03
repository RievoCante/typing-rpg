import { describe, it, expect } from 'vitest';
import { Group, Mesh, BoxGeometry, MeshStandardMaterial } from 'three';
import {
  captureOriginalTransforms,
  restoreAliveTransforms,
} from './monsterTransforms';

// Builds a procedural-style monster: a group with a child mesh that sits at a
// non-origin offset (like a mushroom cap above its stem) and a transparent
// material so the defeat fade applies.
function makeMonster() {
  const group = new Group();
  const cap = new Mesh(
    new BoxGeometry(),
    new MeshStandardMaterial({ transparent: true })
  );
  cap.position.set(0, 0.6, 0);
  cap.rotation.set(0.1, 0, 0);
  group.add(cap);
  return { group, cap };
}

// Mimics one frame of useProceduralMonster's defeat animation.
function runDefeatFrame(group: Group) {
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

describe('monster transform restore', () => {
  it('restores child mesh position/rotation after a defeat animation', () => {
    const { group, cap } = makeMonster();
    captureOriginalTransforms(group);

    // Player lingers on the kill overlay: many defeat frames run, sinking the
    // child mesh well below the camera frame.
    for (let i = 0; i < 30; i++) runDefeatFrame(group);
    expect(cap.position.y).toBeLessThan(0);
    expect(cap.rotation.x).toBeGreaterThan(0.5);

    // Respawn (same family → same instance reused): restore for the new life.
    restoreAliveTransforms(group, 1);

    expect(cap.position.y).toBeCloseTo(0.6);
    expect(cap.rotation.x).toBeCloseTo(0.1);
    expect(cap.rotation.z).toBeCloseTo(0);
    expect(group.scale.x).toBeCloseTo(1);
    expect((cap.material as MeshStandardMaterial).opacity).toBeCloseTo(1);
  });

  it('restores the group transform and opacity', () => {
    const { group, cap } = makeMonster();
    captureOriginalTransforms(group);
    for (let i = 0; i < 10; i++) runDefeatFrame(group);

    restoreAliveTransforms(group, 2.5);

    expect(group.position.x).toBe(0);
    expect(group.scale.x).toBeCloseTo(2.5);
    expect((cap.material as MeshStandardMaterial).opacity).toBeCloseTo(1);
  });
});
