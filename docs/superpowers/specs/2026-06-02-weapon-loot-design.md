# Phase 3 — Weapons + Loot (per-run roguelike)

**Status:** design · **Date:** 2026-06-02 · **Mode:** Endless only

## Goal

Add an addictive build-progression loop to Endless: monsters **drop weapons** on
kill, better weapons **auto-equip**, and the equipped weapon **modifies combat**
(more damage, more crit, harder crits). Weapons are **per-run** — they reset on
death/restart, just like potions / combo / killStreak — so each run is a fresh
"get strong, push your luck, die, replay" arc. Frontend-only: no backend table,
no migration, no `calculateXP.ts ↔ xp.ts` invariant risk (weapons touch combat
damage, which is already client-side; XP is untouched).

## Weapon model

```ts
type WeaponRarity = 'common' | 'rare' | 'epic' | 'legendary';
interface Weapon {
  id: string; name: string; rarity: WeaponRarity;
  bonusDamage: number;     // flat add to base hit damage
  bonusCritChance: number; // added to streak crit chance (0–1)
  critMultBonus: number;   // added to CRIT_MULT on a crit
}
```

No weapon equipped = **Fists** (all bonuses 0) — the current baseline. A small
fixed pool (2 per rarity), e.g. Wooden Club / Iron Sword / Flaming Blade /
Dragonfang.

## Combat integration

`rollDamage(streak, rng, weapon?)` (combatTuning):
- crit chance = `min(0.95, critChanceForStreak(streak) + weapon.bonusCritChance)`
- base = `BASE_DMG + weapon.bonusDamage`; mult = `CRIT_MULT + weapon.critMultBonus`
- damage = `round(crit ? base*mult : base)`

`useComboSystem.registerCorrectWord(weapon?, rng?)` threads the weapon into
`rollDamage`. `TypingInterface.handleWordCompleted` reads `equippedWeapon` from
context and passes it.

## Drops

On the Endless HP-defeat event (GameProvider), `tryDropWeapon(variant, rng)`:
- **Drop chance** by monster variant: common 8%, elite 35%, **rare 100%** (jackpot).
- **Rarity roll** when a drop occurs is weighted by variant (better monsters →
  better odds): common monsters lean common; rares lean epic/legendary.
- If the drop's **power** > equipped power → auto-equip; else keep current.
  `weaponPower(w)` = rarity rank dominates, then weighted stat sum.
- Fires a `weapon-drop` window event `{ name, rarity, equipped }` for a popup.

All pure + tested (`utils/weapons.ts`): pool, `rollWeaponDrop`, `weaponPower`.

## State (per-run)

`useWeaponSystem()`: `equippedWeapon: Weapon | null`, `tryDrop(variant, rng)`,
`reset()`. Exposed via context as `equippedWeapon`. `resetGameState()` calls
`reset()` (death/restart clears the weapon).

## UI

- `WeaponSlot.tsx` — right-side column next to `PotionSlot`: equipped weapon
  icon + name + rarity color + stat summary (or "Fists — no weapon"). Tooltip.
- `weapon-drop` popup — mirror `usePotionPopups`/`PotionPopups`: a floating
  "⚔️ Found [Rare] Iron Sword!" (or "Equipped …!") via `useWeaponPopups` +
  a `WeaponPopups` renderer, mounted beside the potion popups.

## Files

New: `utils/weapons.ts`, `hooks/useWeaponSystem.ts`, `hooks/useWeaponPopups.ts`,
`components/WeaponSlot.tsx`, `components/WeaponPopups.tsx` (+ tests).
Touched: `combatTuning.ts` (rollDamage weapon arg), `useComboSystem.ts`
(registerCorrectWord weapon arg), `GameContext.ts` / `GameProvider.tsx`
(equippedWeapon, drop-on-kill, reset), `TypingInterface.tsx` (pass weapon, mount
slot + popups).

## Out of scope (deferred — Phase 3b)

- **Persistent weapon collection** across runs (needs backend table + API + the
  same care as XP-sync). Per-run only for now.
- Multi-slot inventory / manual swapping (auto-equip-if-better only).
- Weapon visuals on the avatar / monster.

## Testing

Pure: `weaponPower` ordering, `rollWeaponDrop` chance + rarity bands per variant
(injectable rng), `rollDamage` with weapon mods + crit-chance cap. Manual:
Endless — kill monsters, see drops/auto-equip in the slot, damage numbers climb
with better weapons, rare monsters always drop; death resets to Fists.
