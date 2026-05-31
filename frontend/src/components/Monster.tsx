// inlucde name, monster model, HP number (from top to bottom)

import { useRef, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import SlimeModel from './SlimeModel';
import GolemModel from './GolemModel';
import ParticleBurst from './ParticleBurst';
import type { SlimeTypeEnum, SlimeShapeEnum } from '../types/SlimeTypes';
import type { GolemTypeEnum } from '../types/GolemTypes';

export type MonsterFamily = 'slime' | 'golem';

interface MonsterProps {
  monsterFamily: MonsterFamily;
  monsterType: SlimeTypeEnum | GolemTypeEnum;
  isHit?: boolean;
  isDefeated?: boolean;
  color?: string;
  scale?: number;
  shape?: SlimeShapeEnum; // For slimes only
}

export default function Monster({
  monsterFamily,
  monsterType,
  isHit = false,
  isDefeated = false,
  color,
  scale,
  shape,
}: MonsterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [burstOrigin, setBurstOrigin] = useState({ x: 0, y: 0 });
  const [showBurst, setShowBurst] = useState(false);
  const hasBurstedRef = useRef(false);

  // Trigger particle burst when slime is defeated
  useEffect(() => {
    if (isDefeated && !hasBurstedRef.current) {
      hasBurstedRef.current = true;

      // Calculate the slime's position on screen
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        setBurstOrigin({ x: centerX, y: centerY });
        setShowBurst(true);
      }
    }

    // Reset burst flag when slime is no longer defeated (new slime appears)
    if (!isDefeated) {
      hasBurstedRef.current = false;
      setShowBurst(false);
    }
  }, [isDefeated]);

  const handleBurstComplete = () => {
    setShowBurst(false);
  };

  return (
    <>
      <div
        ref={containerRef}
        className="w-full max-w-md mx-auto py-4 transition-all duration-500 ease-in-out"
      >
        {/* 3D Monster Model with 3:2 aspect ratio */}
        <div className="w-full aspect-[3/2] bg-transparent transition-opacity duration-300">
          <Canvas
            camera={{ position: [0, 0, 4], fov: 50 }}
            gl={{ alpha: true, antialias: true }}
          >
            {/* Lighting setup for monster appearance */}
            <ambientLight intensity={0.4} />
            <pointLight position={[5, 5, 5]} intensity={0.8} />
            <pointLight
              position={[-3, -3, -3]}
              intensity={0.3}
              color="#ffffff"
            />

            {/* Main monster model */}
            {monsterFamily === 'slime' ? (
              <SlimeModel
                slimeType={monsterType as SlimeTypeEnum}
                isHit={isHit}
                isDefeated={isDefeated}
                customColor={color}
                customScale={scale}
                shape={shape}
              />
            ) : (
              <GolemModel
                golemType={monsterType as GolemTypeEnum}
                isHit={isHit}
                isDefeated={isDefeated}
                customColor={color}
                customScale={scale}
              />
            )}
          </Canvas>
        </div>
      </div>

      {/* Particle burst overlay */}
      <ParticleBurst
        isActive={showBurst}
        originX={burstOrigin.x}
        originY={burstOrigin.y}
        color={color || '#87CEEB'}
        onComplete={handleBurstComplete}
      />
    </>
  );
}
