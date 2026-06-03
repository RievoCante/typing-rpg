import { useEffect, useRef, useCallback } from 'react';
import { useThemeContext } from '../hooks/useThemeContext';
import type { FloatingPixel } from '../types/particles';
import { buildRoom, type DungeonRoom } from '../utils/dungeon/geometry';
import {
  getDungeonPalette,
  type DungeonPalette,
} from '../utils/dungeon/colors';
import { drawRoom } from '../utils/dungeon/bricks';
import { drawStaticProps, drawDynamicProps } from '../utils/dungeon/props';

const FLOATING_PIXEL_COUNT = 22;

export default function PixelArtBackground() {
  const { theme } = useThemeContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pixelsRef = useRef<FloatingPixel[]>([]);
  const animationRef = useRef<number | undefined>(undefined);
  // Static room + props are baked here once per resize/theme change.
  const sceneRef = useRef<HTMLCanvasElement | null>(null);
  const roomRef = useRef<DungeonRoom | null>(null);
  const pal: DungeonPalette = getDungeonPalette(theme);

  const initFloatingPixels = useCallback(() => {
    const pixels: FloatingPixel[] = [];
    for (let i = 0; i < FLOATING_PIXEL_COUNT; i++) {
      pixels.push({
        id: i,
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        size: Math.floor(Math.random() * 3) + 2,
        color:
          pal.floatingPixels[
            Math.floor(Math.random() * pal.floatingPixels.length)
          ],
        speedX: (Math.random() - 0.5) * 0.3,
        speedY: (Math.random() - 0.5) * 0.3 - 0.1,
        opacity: Math.random() * 0.5 + 0.3,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }
    pixelsRef.current = pixels;
  }, [pal.floatingPixels]);

  // Bake the static room, props and vignette into an offscreen canvas so the
  // per-frame loop only redraws the animated layers.
  const buildScene = useCallback(
    (width: number, height: number) => {
      const room = buildRoom(width, height);
      roomRef.current = room;

      const scene = document.createElement('canvas');
      scene.width = width;
      scene.height = height;
      const sctx = scene.getContext('2d');
      if (!sctx) return;
      sctx.imageSmoothingEnabled = false;

      drawRoom(sctx, room, pal);
      drawStaticProps(sctx, room, pal);

      // Vignette for depth/mood.
      const vg = sctx.createRadialGradient(
        width / 2,
        height * 0.44,
        Math.min(width, height) * 0.2,
        width / 2,
        height * 0.5,
        Math.max(width, height) * 0.75
      );
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.55)');
      sctx.fillStyle = vg;
      sctx.fillRect(0, 0, width, height);

      sceneRef.current = scene;
    },
    [pal]
  );

  const drawFloatingPixels = useCallback(
    (ctx: CanvasRenderingContext2D, time: number, dtScale: number) => {
      for (const p of pixelsRef.current) {
        // dtScale normalizes drift to a 60fps baseline so pixels move at the
        // same speed regardless of the (capped) frame rate.
        p.x += p.speedX * dtScale;
        p.y += p.speedY * dtScale;
        const pulse = Math.sin(time * 0.002 + p.pulsePhase) * 0.2 + 0.8;
        if (p.x < -10) p.x = ctx.canvas.width + 10;
        if (p.x > ctx.canvas.width + 10) p.x = -10;
        if (p.y < -10) p.y = ctx.canvas.height + 10;
        if (p.y > ctx.canvas.height + 10) p.y = -10;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity * pulse;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        ctx.globalAlpha = 1;
      }
    },
    []
  );

  useEffect(() => {
    initFloatingPixels();
  }, [initFloatingPixels]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      buildScene(canvas.width, canvas.height);
    };
    resize();
    window.addEventListener('resize', resize);

    // This ambient background is a full-screen 2D redraw every frame. Capping
    // it to 30fps roughly halves its cost on 60Hz and quarters it on 120Hz
    // ProMotion displays — imperceptible for slow drifting pixels and flicker.
    const FRAME_MS = 1000 / 30;
    const startTime = Date.now();
    let lastDraw = -Infinity;
    const animate = (now: number) => {
      animationRef.current = requestAnimationFrame(animate);
      const elapsed = now - lastDraw;
      if (elapsed < FRAME_MS) return;
      const dtScale =
        lastDraw === -Infinity ? 1 : Math.min(elapsed / 16.667, 4);
      lastDraw = now;
      const time = Date.now() - startTime;
      const scene = sceneRef.current;
      const room = roomRef.current;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (scene) ctx.drawImage(scene, 0, 0);
      if (room) drawDynamicProps(ctx, room, time, pal);
      drawFloatingPixels(ctx, time, dtScale);
    };
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', resize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [buildScene, drawFloatingPixels, pal]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
