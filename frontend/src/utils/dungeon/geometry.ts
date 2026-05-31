// One-point-perspective dungeon room geometry.
// A "Quad" is four corners in (u, v) order [p00, p10, p11, p01] where u runs
// across the surface and v runs into depth (v=0 near/outer edge, v=1 far/back).

export interface Point {
  x: number;
  y: number;
}

export type Quad = [Point, Point, Point, Point];

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpPt(a: Point, b: Point, t: number): Point {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

// Bilinear interpolation of a point inside a quad at parameters (u, v).
export function quadPoint(q: Quad, u: number, v: number): Point {
  const near = lerpPt(q[0], q[1], u); // v = 0 edge
  const far = lerpPt(q[3], q[2], u); // v = 1 edge
  return lerpPt(near, far, v);
}

export interface DungeonRoom {
  w: number;
  h: number;
  vp: Point;
  ceiling: Quad;
  floor: Quad;
  leftWall: Quad;
  rightWall: Quad;
  backWall: Quad;
  // Shared corners, handy for drawing the room's defining edges.
  bTL: Point;
  bTR: Point;
  bBR: Point;
  bBL: Point;
  TL: Point;
  TR: Point;
  BR: Point;
  BL: Point;
}

// How far (0..1) the back wall sits toward the vanishing point. Larger = deeper
// room with a smaller back wall.
const DEPTH = 0.52;

export function buildRoom(w: number, h: number): DungeonRoom {
  // Vanishing point slightly above center so the floor has room for props.
  const vp: Point = { x: w / 2, y: h * 0.44 };

  const TL: Point = { x: 0, y: 0 };
  const TR: Point = { x: w, y: 0 };
  const BR: Point = { x: w, y: h };
  const BL: Point = { x: 0, y: h };

  const bTL = lerpPt(TL, vp, DEPTH);
  const bTR = lerpPt(TR, vp, DEPTH);
  const bBR = lerpPt(BR, vp, DEPTH);
  const bBL = lerpPt(BL, vp, DEPTH);

  return {
    w,
    h,
    vp,
    // ceiling: u left→right, v front→back
    ceiling: [TL, TR, bTR, bTL],
    // floor: u left→right, v front→back
    floor: [BL, BR, bBR, bBL],
    // left wall: u top→bottom, v front→back
    leftWall: [TL, BL, bBL, bTL],
    // right wall: u top→bottom, v front→back
    rightWall: [TR, BR, bBR, bTR],
    // back wall: u left→right, v top→bottom (flat, no depth)
    backWall: [bTL, bTR, bBR, bBL],
    bTL,
    bTR,
    bBR,
    bBL,
    TL,
    TR,
    BR,
    BL,
  };
}

// Pixel size for a prop standing on the floor at depth v (closer = larger).
export function floorScale(room: DungeonRoom, v: number): number {
  return (room.h / 150) * (1 - 0.62 * v);
}

// Where a prop standing on the floor at (u, v) touches the ground, in screen px.
export function floorPoint(room: DungeonRoom, u: number, v: number): Point {
  return quadPoint(room.floor, u, v);
}
