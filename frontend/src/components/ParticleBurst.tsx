import { useEffect, useRef, useCallback } from 'react';
import type { BurstParticle, ParticleBurstConfig } from '../types/particles';

interface ParticleBurstProps {
  isActive: boolean;
  originX: number;
  originY: number;
  color: string;
  onComplete?: () => void;
}

export default function ParticleBurst({
  isActive,
  originX,
  originY,
  color,
  onComplete,
}: ParticleBurstProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<BurstParticle[]>([]);
  const animationRef = useRef<number>();
  const hasTriggeredRef = useRef(false);

  const createParticle = useCallback(
    (
      id: number,
      x: number,
      y: number,
      particleColor: string
    ): BurstParticle => {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 8 + 4; // 4-12 pixels per frame
      const size = Math.floor(Math.random() * 4) + 3; // 3-6px squares for retro feel

      return {
        id,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3, // Initial upward boost
        size,
        color: particleColor,
        life: 1,
        maxLife: 1,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.3,
        gravity: 0.4,
      };
    },
    []
  );

  const triggerBurst = useCallback(
    (config: ParticleBurstConfig) => {
      const { x, y, color: burstColor, count = 45 } = config;
      const newParticles: BurstParticle[] = [];

      for (let i = 0; i < count; i++) {
        newParticles.push(createParticle(i, x, y, burstColor));
      }

      particlesRef.current = newParticles;
    },
    [createParticle]
  );

  const updateParticles = useCallback(() => {
    const particles = particlesRef.current;

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      // Physics
      p.vy += p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;

      // Air resistance
      p.vx *= 0.98;
      p.vy *= 0.98;

      // Fade out
      p.life -= 0.015; // ~1.5 seconds at 60fps

      // Remove dead particles
      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }
  }, []);

  const drawParticles = useCallback((ctx: CanvasRenderingContext2D) => {
    const particles = particlesRef.current;

    for (const p of particles) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);

      // Draw pixel square
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;

      // Draw the square (pixel style - no anti-aliasing)
      const halfSize = p.size / 2;
      ctx.fillRect(-halfSize, -halfSize, p.size, p.size);

      // Optional: Add a lighter border for depth
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(-halfSize, -halfSize, p.size, p.size);

      ctx.restore();
    }
  }, []);

  useEffect(() => {
    if (isActive && !hasTriggeredRef.current) {
      hasTriggeredRef.current = true;
      triggerBurst({
        x: originX,
        y: originY,
        color,
        count: 45,
      });
    }
  }, [isActive, originX, originY, color, triggerBurst]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to window size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Disable anti-aliasing for pixel art look
    ctx.imageSmoothingEnabled = false;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (particlesRef.current.length > 0) {
        updateParticles();
        drawParticles(ctx);
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // All particles finished
        if (hasTriggeredRef.current) {
          hasTriggeredRef.current = false;
          onComplete?.();
        }
      }
    };

    if (particlesRef.current.length > 0 || isActive) {
      animate();
    }

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, updateParticles, drawParticles, onComplete]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-40"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
