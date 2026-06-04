import type { JSX } from 'react';
import type { EyeStyle } from '../utils/eyeStyles';

interface MonsterEyesProps {
  style: EyeStyle;
  spacing: number; // x offset of each eye from center
  y: number; // vertical position (group space)
  z: number; // forward position (group space)
  size: number; // base eye radius
  color?: string; // dark/pupil color
}

const WHITE = '#fcfcfc';

// All materials are `transparent` so the shared defeat fade (which decrements
// mat.opacity on every child mesh) dissolves the eyes along with the body.
function darkMat(color: string) {
  return (
    <meshStandardMaterial
      color={color}
      transparent
      opacity={1}
      roughness={0.35}
    />
  );
}

// A cartoon eye: white ball + dark pupil pushed to the front surface + a small
// highlight glint. `r` is the eyeball radius.
function eyeWithPupil(
  r: number,
  dark: string,
  pupilRatio: number
): JSX.Element {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[r, 16, 16]} />
        <meshStandardMaterial
          color={WHITE}
          transparent
          opacity={1}
          roughness={0.3}
        />
      </mesh>
      <mesh position={[0, 0, r * 0.6]}>
        <sphereGeometry args={[r * pupilRatio, 14, 14]} />
        {darkMat(dark)}
      </mesh>
      <mesh position={[-r * 0.3, r * 0.3, r * 0.85]}>
        <sphereGeometry args={[r * 0.2, 8, 8]} />
        <meshStandardMaterial color={WHITE} transparent opacity={1} />
      </mesh>
    </group>
  );
}

function renderEye(
  style: EyeStyle,
  side: number,
  s: number,
  dark: string
): JSX.Element {
  switch (style) {
    case 'pupil':
      return eyeWithPupil(s, dark, 0.55);
    case 'cute':
      return eyeWithPupil(s * 1.15, dark, 0.62);
    case 'wink':
      // Left eye open, right eye a closed horizontal line.
      return side < 0 ? (
        eyeWithPupil(s, dark, 0.55)
      ) : (
        <mesh>
          <boxGeometry args={[s * 1.8, s * 0.32, s * 0.6]} />
          {darkMat(dark)}
        </mesh>
      );
    case 'suspicious':
      // Strongly squashed dark eye = a narrowed, unimpressed glare.
      return (
        <group scale={[1, 0.45, 1]}>
          <mesh>
            <sphereGeometry args={[s, 16, 16]} />
            {darkMat(dark)}
          </mesh>
        </group>
      );
    case 'angry':
      // Squashed + tilted dark eye (inner corner down). Brows add the rest.
      return (
        <group rotation={[0, 0, side * -0.35]} scale={[1.05, 0.7, 1]}>
          <mesh>
            <sphereGeometry args={[s, 16, 16]} />
            {darkMat(dark)}
          </mesh>
        </group>
      );
    case 'neutral':
    default:
      return (
        <mesh>
          <sphereGeometry args={[s, 16, 16]} />
          {darkMat(dark)}
        </mesh>
      );
  }
}

// Slanted brows forming an angry "\ /" frown above the eyes.
function renderBrows(
  spacing: number,
  y: number,
  z: number,
  s: number,
  dark: string
): JSX.Element {
  const browY = y + s * 1.7;
  return (
    <>
      <mesh position={[-spacing, browY, z]} rotation={[0, 0, -0.45]}>
        <boxGeometry args={[s * 2.1, s * 0.5, s * 0.55]} />
        <meshStandardMaterial
          color={dark}
          transparent
          opacity={1}
          roughness={0.4}
        />
      </mesh>
      <mesh position={[spacing, browY, z]} rotation={[0, 0, 0.45]}>
        <boxGeometry args={[s * 2.1, s * 0.5, s * 0.55]} />
        <meshStandardMaterial
          color={dark}
          transparent
          opacity={1}
          roughness={0.4}
        />
      </mesh>
    </>
  );
}

// Reusable monster face. Renders two eyes (mirrored) in the given expression,
// positioned at ±spacing. Used by slime / mushroom / crystal so every family
// shares one tested face implementation with per-spawn expression variety.
export default function MonsterEyes({
  style,
  spacing,
  y,
  z,
  size,
  color = '#16161f',
}: MonsterEyesProps) {
  return (
    <group>
      {[-1, 1].map(side => (
        <group key={side} position={[side * spacing, y, z]}>
          {renderEye(style, side, size, color)}
        </group>
      ))}
      {style === 'angry' && renderBrows(spacing, y, z, size, color)}
    </group>
  );
}
