// Brick-texturing of the room's five surfaces. Each surface is a quad textured
// with a grid of brick cells; depth rows compress toward the back (geometric
// spacing) and darken for perspective + volume.

import { quadPoint, type Quad, type DungeonRoom } from './geometry';
import { shade, type DungeonPalette } from './colors';

interface BrickOpts {
  cols: number;
  rows: number;
  ratio: number; // depth-row compression toward the back (<1 = bunch up far)
  brick: string;
  mortar: string;
  highlight?: string;
  tint: number; // base brightness for this surface
  shadeFar: number; // extra darkening at the far edge (0..1)
}

// Cumulative v-edges for `rows` depth bands, each `ratio`x the previous, so bands
// bunch toward the back edge (v = 1).
function depthEdges(rows: number, ratio: number): number[] {
  const segs: number[] = [];
  let s = 1;
  let total = 0;
  for (let i = 0; i < rows; i++) {
    segs.push(s);
    total += s;
    s *= ratio;
  }
  const edges = [0];
  let acc = 0;
  for (let i = 0; i < rows; i++) {
    acc += segs[i] / total;
    edges.push(acc);
  }
  return edges;
}

function drawQuadBricks(
  ctx: CanvasRenderingContext2D,
  q: Quad,
  o: BrickOpts
): void {
  const vE = depthEdges(o.rows, o.ratio);
  const cw = 1 / o.cols;
  ctx.lineWidth = 1;

  for (let i = 0; i < o.rows; i++) {
    const v0 = vE[i];
    const v1 = vE[i + 1];
    const vMid = (v0 + v1) / 2;
    const bright = o.tint * (1 - o.shadeFar * vMid);
    const fill = shade(o.brick, bright);
    const mortar = shade(o.mortar, Math.max(0.4, bright));
    const offset = i % 2 ? cw / 2 : 0; // running-bond stagger

    for (let u = -offset; u < 1 - 1e-6; u += cw) {
      const uA = Math.max(0, u);
      const uB = Math.min(1, u + cw);
      if (uB - uA <= 1e-3) continue;

      const p0 = quadPoint(q, uA, v0);
      const p1 = quadPoint(q, uB, v0);
      const p2 = quadPoint(q, uB, v1);
      const p3 = quadPoint(q, uA, v1);

      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = mortar;
      ctx.stroke();

      if (o.highlight) {
        ctx.strokeStyle = shade(o.highlight, bright);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
    }
  }
}

export function drawRoom(
  ctx: CanvasRenderingContext2D,
  room: DungeonRoom,
  pal: DungeonPalette
): void {
  ctx.fillStyle = pal.base;
  ctx.fillRect(0, 0, room.w, room.h);

  // Back wall: flat, farthest, darkest.
  drawQuadBricks(ctx, room.backWall, {
    cols: 11,
    rows: 8,
    ratio: 1,
    brick: pal.brick,
    mortar: pal.mortar,
    tint: 0.6,
    shadeFar: 0,
  });
  // Ceiling.
  drawQuadBricks(ctx, room.ceiling, {
    cols: 16,
    rows: 7,
    ratio: 0.8,
    brick: pal.brick,
    mortar: pal.mortar,
    tint: 0.7,
    shadeFar: 0.5,
  });
  // Side walls.
  for (const wall of [room.leftWall, room.rightWall]) {
    drawQuadBricks(ctx, wall, {
      cols: 7,
      rows: 10,
      ratio: 0.8,
      brick: pal.brick,
      mortar: pal.mortar,
      tint: 0.86,
      shadeFar: 0.55,
    });
  }
  // Floor: brightest, with edge highlights.
  drawQuadBricks(ctx, room.floor, {
    cols: 16,
    rows: 9,
    ratio: 0.8,
    brick: pal.brick,
    mortar: pal.mortar,
    highlight: pal.brickHi,
    tint: 1,
    shadeFar: 0.5,
  });

  // Defining edges from the screen corners to the back wall.
  ctx.strokeStyle = shade(pal.mortar, 1);
  ctx.lineWidth = 2;
  const edge = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  };
  edge(room.TL, room.bTL);
  edge(room.TR, room.bTR);
  edge(room.BL, room.bBL);
  edge(room.BR, room.bBR);
}
