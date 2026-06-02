# Phase 2 — Monster Variety (Elite / Rare variants)

**Status:** design · **Date:** 2026-06-02 · **Mode:** Endless only (Daily/Raid untouched)

## Goal

Make Endless more fun/addicting by adding **monster variants** layered on top of the
existing family (slime/golem) × tier (normal/mini-boss/boss) × color/shape randomization.
Variants create anticipation ("is the next one elite?"), risk/reward (tougher but
rewarding), and dopamine spikes on a rare spawn — without new 3D models and without
touching the server-authoritative XP pipeline.

## Why not XP-based rewards

Endless XP is **server-authoritative** and computed **per 50-word block** from the
session payload (`calculateXP.ts` ↔ `backend/src/core/xp.ts`, a documented sync
invariant). A per-monster XP bonus would mean extending the payload + both XP calcs +
the invariant. Out of scope for Phase 2. Instead, elites reward through **existing
frontend systems**: a **combo surge** (instant crit-chance boost — the juiciest reward,
since more crits = faster kills) and, for rares, a **potion drop**.

## The variant model

```
MonsterVariant = 'common' | 'elite' | 'rare'
```

| Variant | HP ×  | Spawn chance        | Glow            | Scale × | Reward on kill                  |
|---------|-------|---------------------|-----------------|---------|---------------------------------|
| common  | 1.0   | remainder           | none            | 1.0     | none                            |
| elite   | 1.5   | 12% (after 3 kills) | amber/gold aura | 1.15    | combo surge +8                  |
| rare    | 2.0   | 5%  (after 8 kills) | cyan/violet, pulsing | 1.3 | combo surge +15 **and** +1 potion |

- HP scaling stacks on tier HP: `MONSTER_MAX_HP[type] × VARIANT_HP_MULT[variant]`.
- Selection is independent of the tier pick and gated by run progress (mirrors
  `pickMonsterType`'s "safe start, escalating pressure" philosophy).
- Common is the remainder; first 3 kills are always common.

## Visual identity

- **Glow:** elite/rare set `emissive` + `emissiveIntensity` on the model material(s);
  rare pulses via `useFrame`. Common keeps current flat shading.
- **Scale:** multiply the existing randomized scale by the variant scale factor.
- **Death spectacle:** elite/rare get a larger, variant-colored `ParticleBurst`
  (more particles) and a brighter explosion. Common unchanged.
- **Nameplate:** a small floating label above the health bar — `"⚡ Elite Slime"`,
  `"✦ Rare Golem"`, or plain `"Slime"` / `"Golem"` for common. Tier is implied by
  the existing health bar; nameplate carries family + variant flavor.

## Reward wiring

On the Endless HP-defeat event (monsterHp ≤ 0, in `GameProvider`), after counting the
kill, if the defeated monster's variant is:
- **elite** → `combo.addStreak(8)`
- **rare**  → `combo.addStreak(15)` + `potion.addPotion()`

New hook methods (small, pure-ish, tested):
- `useComboSystem.addStreak(n)` — reducer action `BONUS` adds `n` to streak (clamped ≥0).
- `usePotionSystem.addPotion()` — `+1` clamped to `MAX_POTIONS`.

## Files of record (to touch)

- `frontend/src/context/GameContext.ts` — add `MonsterVariant`, `currentMonsterVariant`, widen `spawnMonster`.
- `frontend/src/utils/combatTuning.ts` — `VARIANT_HP_MULT`, variant scale factors.
- `frontend/src/utils/monsterSpawn.ts` — `pickMonsterVariant(monstersDefeated, rng)` (pure, tested).
- `frontend/src/context/GameProvider.tsx` — variant state, HP scaling in `spawnMonster`, reward-on-kill.
- `frontend/src/hooks/useComboSystem.ts` — `addStreak` (reducer `BONUS`, tested).
- `frontend/src/hooks/usePotionSystem.ts` — `addPotion`.
- `frontend/src/App.tsx` — `pickMonsterVariant` in `generateNewMonster`, pass variant to `spawnMonster` + `Monster`.
- `frontend/src/components/Monster.tsx` — accept `variant`, scale, variant-scaled particle burst.
- `frontend/src/components/SlimeModel.tsx` / `GolemModel.tsx` — emissive glow by variant (rare pulses).
- `frontend/src/components/MonsterNameplate.tsx` — NEW, floating family+variant label.

## Out of scope (deferred)

- **Phase 2b:** entirely new 3D monster families (procedural or GLB).
- **Elite XP bonus** (needs backend + XP-sync invariant change).
- Variant-specific attack patterns.

## Testing

- Pure: `pickMonsterVariant` distribution/gating, `VARIANT_HP_MULT` application, combo
  `BONUS` reducer, potion `addPotion` clamp. Vitest, injectable rng.
- Manual: Endless run — elites glow + show badge, rares pulse, killing an elite spikes
  the combo meter, rare drops a potion; common monsters look exactly as today.
