# Phase 2b — Procedural Monster Families (Mushroom + Crystal)

**Status:** design · **Date:** 2026-06-02 · **Mode:** Endless only (Daily/Raid untouched)

## Goal

Multiply Endless visual variety by adding **two new procedural 3D monster families**
beyond the existing slime (procedural) and golem (GLB). More families = more "what's
next?" novelty, and they compose for free with the existing tier (normal / mini-boss /
boss) and variant (common / elite / rare) systems. Frontend-only, no asset pipeline,
no XP-sync risk.

## Families

`MonsterFamily = 'slime' | 'golem' | 'mushroom' | 'crystal'`

- **Mushroom** — procedural, organic/cute. Hemisphere cap + cylinder stem + a few
  spot spheres on the cap. Gentle vertical idle bob (`useFrame`). Clear silhouette
  contrast vs the round slime and rocky golem.
- **Crystal** — procedural, angular/elemental. A cluster of cones / octahedra at
  varied angles around a core. Slow idle rotation + subtle shimmer. Its facets play
  especially well with the elite/rare emissive glow already in the variant system.

Each new family mirrors `SlimeModel.tsx`'s contract:
- Per-family randomized config (color + minor shape params) via a types module.
- Accepts the same model props slime/golem already accept (variant, scale, etc.) and
  applies **variant emissive glow + scale automatically** (rare pulses), so elite/rare
  monsters of the new families glow with no extra wiring.
- A subtle idle animation appropriate to the family.

## Selection

Replace the flat `Math.random() > 0.5` family coin-flip in `App.tsx generateNewMonster`
with a pure, tested **weighted** picker:

```
pickMonsterFamily(rng): MonsterFamily
```

Weights (tunable, sum to 1):

| Family   | Weight |
|----------|--------|
| slime    | 0.35   |
| golem    | 0.35   |
| mushroom | 0.18   |
| crystal  | 0.12   |

All four are available from kill 1; slime/golem stay the bread-and-butter, the new
families feel like a treat. Lives in `monsterSpawn.ts` beside `pickMonsterType` /
`pickMonsterVariant`, with injectable `rng` for deterministic tests.

## Cosmetic-only

New families do **not** change HP, tier behavior, variant rewards, or combat. They are
purely a visual axis. A mushroom or crystal can still be normal/mini-boss/boss and
common/elite/rare exactly like slime/golem.

## Files

- `frontend/src/components/Monster.tsx` — extend `MonsterFamily` type + family→model switch.
- `frontend/src/components/MushroomModel.tsx` — NEW, procedural.
- `frontend/src/components/CrystalModel.tsx` — NEW, procedural.
- `frontend/src/types/MushroomTypes.ts` — NEW, per-family color/shape config + randomizer.
- `frontend/src/types/CrystalTypes.ts` — NEW, same.
- `frontend/src/utils/monsterSpawn.ts` — `pickMonsterFamily(rng)` (pure, tested).
- `frontend/src/App.tsx` — use `pickMonsterFamily` in `generateNewMonster`; pass family through.

## Testing

- Pure: `pickMonsterFamily` weight distribution over a seeded rng sequence; weights sum
  to 1; every family reachable. Vitest, injectable rng.
- Manual: Endless run — mushrooms and crystals spawn alongside slimes/golems, animate
  (bob / rotate), and when they roll elite/rare they show the glow + nameplate + bigger
  death burst exactly like the existing families.

## Out of scope

- Family-specific HP, attacks, or rewards (cosmetic only).
- GLB families.
- Re-tuning the variant or tier systems.
