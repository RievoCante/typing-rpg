# Dungeon Room Background — Design

**Date:** 2026-05-31
**Branch:** feature/dungeon-room-bg

## Goal

Replace the flat brick wall + banners background with a **one-point perspective
dungeon chamber** (back wall + receding floor/ceiling/side walls) and populate it
with animated dungeon props. Canvas-2D only (no Three.js), preserving the pixel-art
aesthetic.

## Scope

Single component upgrade. `App.tsx` and `LeaderboardPage.tsx` already mount
`<PixelArtBackground />` behind all content; raid renders on top of the same
background. So upgrading this one component covers **main game + raid + leaderboard**.
No new mount points.

Dark-first. Theme system (`SLIME_KINGDOM_COLORS[theme]`) is preserved — light mode
still renders. Removing light mode is deliberately out of scope (separate cleanup).

## Approach: Canvas-2D perspective (Approach A)

One vanishing point slightly above center. Five surfaces drawn as quads:
ceiling, floor, left wall, right wall, back wall. Each surface is brick-textured via
a bilinear-mapped grid whose depth rows compress toward the back (geometric spacing)
for perspective foreshortening. Surfaces darken toward the back for volume.

### Modules

- `utils/dungeon/geometry.ts` — `Point`, `Quad`, `lerp`, `quadPoint` (bilinear),
  `buildRoom(w,h)` → the five quads + shared corners + vanishing point.
- `utils/dungeon/colors.ts` — `getDungeonPalette(theme)` (extends slime colors with
  prop colors: wood, gold, bone, rat, flame, web), `shade(hex, factor)`.
- `utils/dungeon/bricks.ts` — `drawQuadBricks`, `drawRoom`.
- `utils/dungeon/props.ts` — pixel-map prop sprites + `drawStaticProps` (chests,
  skull+bones, cobwebs, banners, torch brackets) and `drawDynamicProps`
  (torch flames + glow, scurrying rats).
- `components/PixelArtBackground.tsx` — rewritten to: build room on resize/theme,
  bake room + static props + vignette to an **offscreen canvas** (perf), then each
  frame blit it and draw dynamic props + existing floating dust pixels.

### Props

- **Chests** — on the floor, depth-scaled.
- **Skeletons & bones** — skull + bone cluster against floor/walls.
- **Rats** — animated, scurry across the floor along perspective, wrap + flip.
- **Torches** — mounted on side walls, flickering flame + additive glow pool.
- **Cobwebs** — upper screen corners.
- **Banners** — moved onto the back wall, smaller.

### Animation

Reuse existing `requestAnimationFrame` loop. Only torches (flicker) and rats (move)
recompute per frame; everything else is the cached offscreen blit.

## Verification

`bun run lint && bun run format:check && bunx tsc --noEmit && bun run test && bun run build`
