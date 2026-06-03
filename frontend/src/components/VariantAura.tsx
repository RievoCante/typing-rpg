import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  CanvasTexture,
  PointLight,
  Sprite,
  Texture,
  type SpriteMaterial,
} from 'three';
import type { MonsterVariant } from '../context/GameContext';
import { VARIANT_GLOW, auraPulse } from '../utils/variantGlow';

// Soft radial-gradient sprite used as the additive halo. White so the sprite
// material's `color` (the variant colour) tints it; alpha fades to 0 at the rim
// for a soft falloff. Built once, lazily, and shared across instances — only
// when an elite/rare actually renders the sprite (never under SSR/tests).
let haloTexture: Texture | null = null;
function getHaloTexture(): Texture {
  if (haloTexture) return haloTexture;
  // No DOM (SSR/tests) — hand back a blank texture so render doesn't crash.
  if (typeof document === 'undefined') {
    haloTexture = new Texture();
    return haloTexture;
  }
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const r = size / 2;
    const g = ctx.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  haloTexture = new CanvasTexture(canvas);
  return haloTexture;
}

interface VariantAuraProps {
  variant: MonsterVariant;
}

// Family-agnostic glow for elite/rare monsters: a colored point light in front
// of the model (so it casts the variant colour onto the silhouette) plus an
// additive halo sprite behind it. This reads as luminous WITHOUT repainting the
// model — the bodies keep only a faint self-illum (see variantGlow.ts). Rare
// pulses; elite is steady. Common renders nothing.
export default function VariantAura({ variant }: VariantAuraProps) {
  const glow = VARIANT_GLOW[variant];
  const lightRef = useRef<PointLight>(null);
  const spriteRef = useRef<Sprite>(null);

  useFrame(state => {
    if (!glow) return;
    const p = auraPulse(glow, state.clock.elapsedTime);
    if (lightRef.current) lightRef.current.intensity = glow.lightIntensity * p;
    if (spriteRef.current) {
      const mat = spriteRef.current.material as SpriteMaterial;
      mat.opacity = glow.haloOpacity * p;
    }
  });

  if (!glow) return null;

  return (
    <group>
      {/* Halo behind the model — additive so it brightens the dark backdrop */}
      <sprite
        ref={spriteRef}
        position={[0, 0, -0.8]}
        scale={[glow.haloScale, glow.haloScale, 1]}
      >
        <spriteMaterial
          map={getHaloTexture()}
          color={glow.color}
          opacity={glow.haloOpacity}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </sprite>
      {/* Colored cast light in front — gives the body a glowing rim/wash */}
      <pointLight
        ref={lightRef}
        position={[0, 0.5, 2.5]}
        color={glow.color}
        intensity={glow.lightIntensity}
        distance={14}
        decay={2}
      />
    </group>
  );
}
