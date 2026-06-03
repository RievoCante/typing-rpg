import { useCallback, useRef, useState } from 'react';
import type { MonsterVariant } from '../context/GameContext';
import { rollWeaponDrop, type Weapon } from '../utils/weapons';

// Per-run weapon loot (Endless). A kill may drop a weapon (chance + rarity scale
// with the monster variant), surfaced as a pending drop for the weapon-drop
// modal. Dropping does NOT auto-equip — the loadout stays fixed for the whole
// run; the equipped weapon modifies combat via rollDamage.
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

  // The most recent unacknowledged drop (Endless). Drives the weapon-drop modal;
  // cleared by clearPendingDrop (the player's "Take") or a run reset. Does NOT
  // equip — the loadout stays fixed for the whole run.
  const [pendingDrop, setPendingDrop] = useState<Weapon | null>(null);

  // Latest loadout, so reset() restores the current starting weapon without
  // needing to re-create the callback when the loadout changes.
  const loadoutRef = useRef<Weapon | null>(loadoutWeapon);
  loadoutRef.current = loadoutWeapon;

  // Roll a drop for a kill of `variant`. On a hit, sets it as the pending drop
  // (surfaced to the modal) and fires `weapon-drop` (picked up by useWeaponVault
  // to persist the find for signed-in players). No auto-equip: the run's weapon
  // stays the chosen loadout. No-op when nothing drops. rng injectable for tests.
  const tryDrop = useCallback(
    (variant: MonsterVariant, rng: () => number = Math.random) => {
      const dropped = rollWeaponDrop(variant, rng);
      if (!dropped) return;
      setPendingDrop(dropped);
      window.dispatchEvent(
        new CustomEvent('weapon-drop', {
          detail: {
            id: dropped.id,
            name: dropped.name,
            rarity: dropped.rarity,
            equipped: false,
          },
        })
      );
    },
    []
  );

  // Acknowledge the pending drop (player's "Take"). Persisting already happened
  // via the weapon-drop event; this just dismisses the modal.
  const clearPendingDrop = useCallback(() => setPendingDrop(null), []);

  // Restore to the current loadout and drop any unacknowledged drop (death/restart).
  const reset = useCallback(() => {
    setEquippedWeapon(loadoutRef.current);
    setPendingDrop(null);
  }, []);

  // Equip a specific weapon — used by GameProvider to apply the loadout at the
  // start of a fresh run (incl. when the vault loads async / the player changes
  // their loadout before typing).
  const equipLoadout = useCallback(
    (weapon: Weapon | null) => setEquippedWeapon(weapon),
    []
  );

  return {
    equippedWeapon,
    tryDrop,
    reset,
    equipLoadout,
    pendingDrop,
    clearPendingDrop,
  };
}
