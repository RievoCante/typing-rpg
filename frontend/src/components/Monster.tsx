// inlucde name, monster model, HP number (from top to bottom)

import { Canvas } from '@react-three/fiber';
import SlimeModel from './SlimeModel';
import type { SlimeTypeEnum } from '../types/SlimeTypes';

interface MonsterProps {
  monsterType: SlimeTypeEnum;
  isHit?: boolean;
  isDefeated?: boolean;
}

export default function Monster({
  monsterType,
  isHit = false,
  isDefeated = false,
}: MonsterProps) {
  return (
    <div className="w-full max-w-md mx-auto py-8">
      {/* 3D Monster Model with 3:2 aspect ratio */}
      <div className="w-full aspect-[3/2] bg-transparent">
        <Canvas
          camera={{ position: [0, 0, 4], fov: 50 }}
          gl={{ alpha: true, antialias: true }}
        >
          {/* Lighting setup for monster appearance */}
          <ambientLight intensity={0.4} />
          <pointLight position={[5, 5, 5]} intensity={0.8} />
          <pointLight position={[-3, -3, -3]} intensity={0.3} color="#ffffff" />

          {/* Main monster model */}
          <SlimeModel
            slimeType={monsterType}
            isHit={isHit}
            isDefeated={isDefeated}
          />
        </Canvas>
      </div>
    </div>
  );
}
