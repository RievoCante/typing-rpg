import { useCallback, useRef, useState } from 'react';
import type { MonsterVariant } from '../context/GameContext';
import { rollWeaponDrop, weaponPower, type Weapon } from '../utils/weapons';

// Per-run weapon loot (Endless). A kill may drop a weapon (chance + rarity scale
// with the monster variant); a strictly-better drop auto-equips. The equipped
// weapon modifies combat via rollDamage.
//
// Phase 3b: a run STARTS from the persistent loadout weapon (the player's chosen
// starting weapon) instead of always Fists. reset() (called from resetGameState
// on death/restart) returns to that loadout, so each run begins from the same
// starting point. The loadout itself is per-account and lives in useWeaponVault;
// combat damage stays client-side and never touches the XP pipeline.
export function useWeaponSystem(loadoutWeapon: Weapon | null = null) {
  const [equippedWeapon, setEquippedWeapon] = useState<Weapon | null>(
    loadoutWeapon
  );

  // Ref mirror so tryDrop can compare against the latest equipped weapon without
  // changing identity (keeps the GameProvider effect dep stable).
  const equippedRef = useRef<Weapon | null>(null);
  equippedRef.current = equippedWeapon;

  // Latest loadout, so reset() restores the current starting weapon without
  // needing to re-create the callback when the loadout changes.
  const loadoutRef = useRef<Weapon | null>(loadoutWeapon);
  loadoutRef.current = loadoutWeapon;

  // Roll a drop for a kill of `variant`. Auto-equips a strictly-better weapon
  // and fires `weapon-drop` (picked up by useWeaponPopups for the popup + SFX,
  // and by useWeaponVault to persist the find). No-op when nothing drops. rng
  // injectable for tests.
  const tryDrop = useCallback(
    (variant: MonsterVariant, rng: () => number = Math.random) => {
      const dropped = rollWeaponDrop(variant, rng);
      if (!dropped) return;
      const equipped = weaponPower(dropped) > weaponPower(equippedRef.current);
      if (equipped) setEquippedWeapon(dropped);
      window.dispatchEvent(
        new CustomEvent('weapon-drop', {
          detail: {
            id: dropped.id,
            name: dropped.name,
            rarity: dropped.rarity,
            equipped,
          },
        })
      );
    },
    []
  );

  // Restore to the current loadout (death/restart).
  const reset = useCallback(() => setEquippedWeapon(loadoutRef.current), []);

  // Equip a specific weapon — used by GameProvider to apply the loadout at the
  // start of a fresh run (incl. when the vault loads async / the player changes
  // their loadout before typing).
  const equipLoadout = useCallback(
    (weapon: Weapon | null) => setEquippedWeapon(weapon),
    []
  );

  return { equippedWeapon, tryDrop, reset, equipLoadout };
}
