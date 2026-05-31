import { useEffect, useRef, useCallback } from 'react';
import { useThemeContext } from '../hooks/useThemeContext';
import type { FloatingPixel } from '../types/particles';
import { SLIME_KINGDOM_COLORS } from '../types/particles';

const FLOATING_PIXEL_COUNT = 25;
const BRICK_SIZE = 40;
const BRICK_GAP = 4;

export default function PixelArtBackground() {
  const { theme } = useThemeContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pixelsRef = useRef<FloatingPixel[]>([]);
  const animationRef = useRef<number>();
  const colors = SLIME_KINGDOM_COLORS[theme];

  const initFloatingPixels = useCallback(() => {
    const pixels: FloatingPixel[] = [];
    const pixelColors = colors.floatingPixels;

    for (let i = 0; i < FLOATING_PIXEL_COUNT; i++) {
      pixels.push({
        id: i,
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        size: Math.floor(Math.random() * 3) + 2, // 2-4px
        color: pixelColors[Math.floor(Math.random() * pixelColors.length)],
        speedX: (Math.random() - 0.5) * 0.3,
        speedY: (Math.random() - 0.5) * 0.3 - 0.1, // Slight upward drift
        opacity: Math.random() * 0.5 + 0.3,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }

    pixelsRef.current = pixels;
  }, [colors.floatingPixels]);

  const drawBrickPattern = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      ctx.fillStyle = colors.base;
      ctx.fillRect(0, 0, width, height);

      const brickWidth = BRICK_SIZE;
      const brickHeight = BRICK_SIZE * 0.6;
      const gap = BRICK_GAP;

      // Draw brick pattern
      for (let y = 0; y < height + brickHeight; y += brickHeight + gap) {
        const rowOffset =
          Math.floor(y / (brickHeight + gap)) % 2 === 0 ? 0 : brickWidth / 2;

        for (
          let x = -brickWidth;
          x < width + brickWidth;
          x += brickWidth + gap
        ) {
          const brickX = x + rowOffset;

          // Main brick color
          ctx.fillStyle = colors.brick;
          ctx.fillRect(brickX, y, brickWidth, brickHeight);

          // Brick highlight (top edge)
          ctx.fillStyle = colors.brickHighlight;
          ctx.fillRect(brickX, y, brickWidth, 2);

          // Brick shadow (right edge)
          ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
          ctx.fillRect(brickX + brickWidth - 2, y, 2, brickHeight);
          ctx.fillRect(brickX, y + brickHeight - 2, brickWidth, 2);
        }
      }

      // Draw slime banners (decorative pixel art)
      drawSlimeBanners(ctx, width);
    },
    [colors]
  );

  const drawSlimeBanners = useCallback(
    (ctx: CanvasRenderingContext2D, width: number) => {
      const bannerWidth = 60;
      const bannerHeight = 100;
      const bannerSpacing = 200;

      for (let x = bannerSpacing; x < width; x += bannerSpacing * 2) {
        const y = 20;

        // Banner pole
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(x - 2, y, 4, bannerHeight + 20);

        // Banner background
        ctx.fillStyle = colors.banner;
        ctx.fillRect(x - bannerWidth / 2, y + 10, bannerWidth, bannerHeight);

        // Banner dark shadow
        ctx.fillStyle = colors.bannerDark;
        ctx.fillRect(x - bannerWidth / 2, y + 10, bannerWidth, 8);
        ctx.fillRect(
          x - bannerWidth / 2 + bannerWidth - 8,
          y + 10,
          8,
          bannerHeight
        );

        // Pixel slime symbol on banner (simple 8x8 pattern)
        drawPixelSlime(ctx, x - 12, y + 35, 24);

        // Banner bottom notch
        ctx.fillStyle = colors.base;
        ctx.beginPath();
        ctx.moveTo(x - bannerWidth / 2, y + 10 + bannerHeight);
        ctx.lineTo(x - bannerWidth / 2 + 10, y + 10 + bannerHeight + 15);
        ctx.lineTo(x, y + 10 + bannerHeight);
        ctx.lineTo(x + bannerWidth / 2 - 10, y + 10 + bannerHeight + 15);
        ctx.lineTo(x + bannerWidth / 2, y + 10 + bannerHeight);
        ctx.closePath();
        ctx.fill();
      }
    },
    [colors]
  );

  const drawPixelSlime = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      centerX: number,
      centerY: number,
      size: number
    ) => {
      const pixelSize = size / 8;
      const slimePixels = [
        '  XXXX  ',
        ' XXXXXX ',
        'XXXXXXXX',
        'XXXXXXXX',
        'XXXXXXXX',
        'XX XX XX',
        'X  XX  X',
        '  XXXX  ',
      ];

      ctx.fillStyle = '#98FB98'; // Light green slime

      for (let row = 0; row < slimePixels.length; row++) {
        const rowStr = slimePixels[row];
        for (let col = 0; col < rowStr.length; col++) {
          if (rowStr[col] === 'X') {
            ctx.fillRect(
              centerX + (col - 4) * pixelSize,
              centerY + row * pixelSize,
              pixelSize,
              pixelSize
            );
          }
        }
      }

      // Eyes
      ctx.fillStyle = '#000000';
      ctx.fillRect(centerX - 4, centerY + 16, 4, 4);
      ctx.fillRect(centerX + 4, centerY + 16, 4, 4);
    },
    []
  );

  const drawFloatingPixels = useCallback(
    (ctx: CanvasRenderingContext2D, time: number) => {
      const pixels = pixelsRef.current;

      for (const p of pixels) {
        // Update position
        p.x += p.speedX;
        p.y += p.speedY;

        // Pulse opacity
        const pulse = Math.sin(time * 0.002 + p.pulsePhase) * 0.2 + 0.8;
        const currentOpacity = p.opacity * pulse;

        // Wrap around screen
        if (p.x < -10) p.x = ctx.canvas.width + 10;
        if (p.x > ctx.canvas.width + 10) p.x = -10;
        if (p.y < -10) p.y = ctx.canvas.height + 10;
        if (p.y > ctx.canvas.height + 10) p.y = -10;

        // Draw pixel
        ctx.fillStyle = p.color;
        ctx.globalAlpha = currentOpacity;
        ctx.fillRect(p.x, p.y, p.size, p.size);

        // Reset alpha
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

    // Disable anti-aliasing for pixel art look
    ctx.imageSmoothingEnabled = false;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const startTime = Date.now();

    const animate = () => {
      const time = Date.now() - startTime;
      const width = canvas.width;
      const height = canvas.height;

      // Clear and redraw everything
      ctx.clearRect(0, 0, width, height);

      // Draw brick background
      drawBrickPattern(ctx, width, height);

      // Draw floating pixels
      drawFloatingPixels(ctx, time);

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [drawBrickPattern, drawFloatingPixels]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
