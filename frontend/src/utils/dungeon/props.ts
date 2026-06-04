// Dungeon props: pixel-map sprites placed on the room's floor/walls, split into a
// static layer (baked once) and a dynamic layer (torches flicker, rats scurry).

import {
  floorPoint,
  floorScale,
  quadPoint,
  type DungeonRoom,
  type Point,
} from './geometry';
import type { DungeonPalette } from './colors';

// --- Pixel sprites ----------------------------------------------------------
// Each map is rows of single-char cells; a space is transparent. The char→colour
// mapping is resolved per-sprite against the palette at draw time.

const CHEST = [
  '   wwww   ',
  '  wWWWWw  ',
  ' wWWWWWWw ',
  ' dWWWWWWd ',
  ' dDDDDDDd ',
  ' dDDggDDd ',
  ' dDDggDDd ',
  ' dddddddd ',
];

const SKULL = [
  '  ssss  ',
  ' ssssss ',
  ' sOssOs ',
  ' ssssss ',
  '  ssss  ',
  '  s  s  ',
];

const BONES = ['b      b', 'bbb  bbb', '  bbbb  ', 'bbb  bbb', 'b      b'];

// Facing right; tail trails left.
const RAT = ['t       ', 'trr  ee ', ' rrrrrn ', ' rrrrrr ', '  r  r  '];

function spritePalette(ch: string, pal: DungeonPalette): string | undefined {
  switch (ch) {
    case 'w':
      return pal.woodLid;
    case 'W':
      return pal.wood;
    case 'd':
      return pal.woodDark;
    case 'D':
      return pal.woodBody;
    case 'g':
      return pal.gold;
    case 's':
      return pal.bone;
    case 'b':
      return pal.bone;
    case 'O':
      return pal.socket;
    case 'r':
      return pal.ratBody;
    case 't':
      return pal.ratDark;
    case 'e':
      return pal.ratDark;
    case 'n':
      return pal.ratNose;
    default:
      return undefined;
  }
}

// Draw a sprite anchored at its bottom-centre on (cx, cy), one cell = `px` pixels.
function drawSprite(
  ctx: CanvasRenderingContext2D,
  map: string[],
  pal: DungeonPalette,
  cx: number,
  cy: number,
  px: number,
  flip = false
): void {
  const w = map[0].length;
  const h = map.length;
  const ox = cx - (w * px) / 2;
  const oy = cy - h * px;
  for (let r = 0; r < h; r++) {
    const row = map[r];
    for (let c = 0; c < w; c++) {
      const ch = row[flip ? w - 1 - c : c];
      const col = spritePalette(ch, pal);
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(
        Math.floor(ox + c * px),
        Math.floor(oy + r * px),
        Math.ceil(px),
        Math.ceil(px)
      );
    }
  }
}

// --- Cobwebs (screen corners) ----------------------------------------------

function drawCobweb(
  ctx: CanvasRenderingContext2D,
  corner: Point,
  dx: number,
  dy: number,
  size: number,
  pal: DungeonPalette
): void {
  ctx.strokeStyle = pal.web;
  ctx.lineWidth = 1;
  const rays = 4;
  const pts: Point[] = [];
  for (let i = 0; i <= rays; i++) {
    const t = i / rays;
    const ang = (Math.PI / 2) * t;
    const ex = corner.x + dx * size * Math.cos(ang);
    const ey = corner.y + dy * size * Math.sin(ang);
    pts.push({ x: ex, y: ey });
    ctx.beginPath();
    ctx.moveTo(corner.x, corner.y);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }
  // Concentric threads linking the rays.
  for (const f of [0.45, 0.75]) {
    ctx.beginPath();
    for (let i = 0; i <= rays; i++) {
      const x = corner.x + (pts[i].x - corner.x) * f;
      const y = corner.y + (pts[i].y - corner.y) * f;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

// --- Banners on the back wall ----------------------------------------------

function drawBackWallBanner(
  ctx: CanvasRenderingContext2D,
  room: DungeonRoom,
  u: number,
  pal: DungeonPalette
): void {
  const top = quadPoint(room.backWall, u, 0.06);
  const bottom = quadPoint(room.backWall, u, 0.52);
  const wallW = room.bTR.x - room.bTL.x;
  const bw = wallW * 0.07;
  const x = top.x - bw / 2;

  // Pole.
  ctx.fillStyle = pal.woodDark;
  ctx.fillRect(top.x - 1, top.y - bw * 0.2, 2, bottom.y - top.y + bw * 0.2);
  // Cloth.
  ctx.fillStyle = pal.banner;
  ctx.fillRect(x, top.y, bw, bottom.y - top.y);
  ctx.fillStyle = pal.bannerDark;
  ctx.fillRect(x, top.y, bw, Math.max(2, bw * 0.12));
  ctx.fillRect(
    x + bw - Math.max(2, bw * 0.12),
    top.y,
    Math.max(2, bw * 0.12),
    bottom.y - top.y
  );
  // Notched bottom.
  ctx.fillStyle = pal.base;
  ctx.beginPath();
  ctx.moveTo(x, bottom.y);
  ctx.lineTo(x + bw / 2, bottom.y - bw * 0.35);
  ctx.lineTo(x + bw, bottom.y);
  ctx.closePath();
  ctx.fill();
}

// --- Static layer (baked into the offscreen room canvas) -------------------

interface TorchSite {
  base: Point;
  scale: number;
}

// Torch mount points on the side walls, returned so the dynamic layer can draw
// matching flames over the baked brackets.
export function torchSites(room: DungeonRoom): TorchSite[] {
  const sites: TorchSite[] = [];
  for (const wall of [room.leftWall, room.rightWall]) {
    for (const v of [0.32, 0.62]) {
      sites.push({
        base: quadPoint(wall, 0.4, v), // upper-third height on the wall
        scale: (room.h / 220) * (1 - 0.5 * v),
      });
    }
  }
  return sites;
}

export function drawStaticProps(
  ctx: CanvasRenderingContext2D,
  room: DungeonRoom,
  pal: DungeonPalette
): void {
  // Banners on the back wall.
  drawBackWallBanner(ctx, room, 0.3, pal);
  drawBackWallBanner(ctx, room, 0.7, pal);

  // Cobwebs in the upper screen corners.
  drawCobweb(ctx, room.TL, 1, 1, room.h * 0.14, pal);
  drawCobweb(ctx, room.TR, -1, 1, room.h * 0.14, pal);

  // Floor props: [u, v, sprite].
  const items: Array<[number, number, string[]]> = [
    [0.2, 0.5, CHEST],
    [0.82, 0.34, CHEST],
    [0.12, 0.32, SKULL],
    [0.34, 0.62, BONES],
    [0.7, 0.58, SKULL],
    [0.9, 0.7, BONES],
  ];
  for (const [u, v, map] of items) {
    const p = floorPoint(room, u, v);
    drawSprite(ctx, map, pal, p.x, p.y, floorScale(room, v));
  }

  // Torch brackets (static); flames are drawn dynamically over these.
  for (const s of torchSites(room)) {
    ctx.fillStyle = pal.torchWood;
    ctx.fillRect(s.base.x - s.scale, s.base.y, s.scale * 2, s.scale * 5);
  }
}

// --- Dynamic layer (per-frame) ---------------------------------------------

function drawFlame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - w, y);
  ctx.quadraticCurveTo(x - w * 0.6, y - h * 0.5, x, y - h);
  ctx.quadraticCurveTo(x + w * 0.6, y - h * 0.5, x + w, y);
  ctx.quadraticCurveTo(x, y + h * 0.2, x - w, y);
  ctx.closePath();
  ctx.fill();
}

function drawTorchFlame(
  ctx: CanvasRenderingContext2D,
  site: TorchSite,
  time: number,
  pal: DungeonPalette
): void {
  const x = site.base.x;
  const y = site.base.y; // flame sits at the top of the bracket
  const seed = x * 0.7 + y * 0.3;
  const flick =
    0.82 + 0.18 * Math.sin(time * 0.02 + seed) * Math.cos(time * 0.011 + seed);
  const w = site.scale * 2.2;
  const h = site.scale * 5.5 * flick;

  // Additive glow pool.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const radius = w * 4.2;
  const g = ctx.createRadialGradient(x, y - h * 0.3, 0, x, y - h * 0.3, radius);
  g.addColorStop(0, 'rgba(255, 150, 50, 0.32)');
  g.addColorStop(1, 'rgba(255, 150, 50, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y - h * 0.3, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  drawFlame(ctx, x, y, w, h, pal.flame);
  drawFlame(ctx, x, y, w * 0.6, h * 0.7, pal.flameMid);
  drawFlame(ctx, x, y, w * 0.3, h * 0.45, pal.flameCore);
}

interface RatPath {
  v: number;
  speed: number;
  phase: number;
}

const RAT_PATHS: RatPath[] = [
  { v: 0.4, speed: 0.06, phase: 0 },
  { v: 0.66, speed: 0.045, phase: 0.5 },
];

function drawRat(
  ctx: CanvasRenderingContext2D,
  room: DungeonRoom,
  path: RatPath,
  time: number,
  pal: DungeonPalette
): void {
  // u sweeps 0→1 then wraps; direction flips with travel sense.
  const cycle = (((time * 0.001 * path.speed + path.phase) % 2) + 2) % 2;
  const forward = cycle < 1;
  const u = forward ? cycle : 2 - cycle;
  const p = floorPoint(room, u, path.v);
  const px = floorScale(room, path.v) * 0.7;
  drawSprite(ctx, RAT, pal, p.x, p.y, px, !forward);
}

export function drawDynamicProps(
  ctx: CanvasRenderingContext2D,
  room: DungeonRoom,
  time: number,
  pal: DungeonPalette
): void {
  for (const site of torchSites(room)) drawTorchFlame(ctx, site, time, pal);
  for (const path of RAT_PATHS) drawRat(ctx, room, path, time, pal);
}
