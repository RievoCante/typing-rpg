import { Group, Mesh, MeshStandardMaterial, Vector3, Euler } from 'three';

// Shared transform bookkeeping for procedural multi-mesh monsters (mushroom,
// crystal). The defeat animation mutates each child mesh's position/rotation
// (and the group scale) cumulatively and never undoes it. Because the same
// model instance is reused when consecutive monsters share a family, the next
// monster would otherwise inherit the previous one's toppled, shrunk, faded
// state — sinking its meshes out of the camera frame so the monster looks like
// it vanished while its health bar still shows. Mirrors GolemModel's fix.

// Snapshot each mesh's original transform (and base color) once. Idempotent, so
// it is safe to call every frame / on every effect run.
export function captureOriginalTransforms(group: Group): void {
  group.traverse(child => {
    if (!(child as Mesh).isMesh) return;
    const mesh = child as Mesh;
    if (!mesh.userData.origPosition) {
      mesh.userData.origPosition = mesh.position.clone();
      mesh.userData.origRotation = mesh.rotation.clone();
    }
    const mat = mesh.material as MeshStandardMaterial;
    if (mat && !mat.userData.origColor) {
      mat.userData.origColor = mat.color.clone();
    }
  });
}

// Reset the group and all child meshes back to their captured spawn transforms
// (and full opacity) so a respawned monster stands upright and visible.
export function restoreAliveTransforms(group: Group, scale: number): void {
  group.position.set(0, 0, 0);
  group.rotation.set(0, 0, 0);
  group.scale.setScalar(scale);
  group.traverse(child => {
    if (!(child as Mesh).isMesh) return;
    const mesh = child as Mesh;
    const origPos = mesh.userData.origPosition as Vector3 | undefined;
    const origRot = mesh.userData.origRotation as Euler | undefined;
    if (origPos) mesh.position.copy(origPos);
    if (origRot) mesh.rotation.copy(origRot);
    const mat = mesh.material as MeshStandardMaterial;
    if (mat && mat.transparent) mat.opacity = 1.0;
  });
}
