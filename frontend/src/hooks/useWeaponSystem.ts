import { useCallback, useRef, useState } from 'react';
import type { MonsterVariant } from '../context/GameContext';
import { rollWeaponDrop, weaponPower, type Weapon } from '../utils/weapons';

// Per-run weapon loot (Endless). A kill may drop a weapon (chance + rarity scale
// with the monster variant); a strictly-better drop auto-equips. The equipped
// weapon modifies combat via rollDamage. Inventory is a single slot and is
// cleared on death/restart via reset() (called from resetGameState), so weapons
// never persist and never touch the server-authoritative XP pipeline.
export function useWeaponSystem() {
  const [equippedWeapon, setEquippedWeapon] = useState<Weapon | null>(null);

  // Ref mirror so tryDrop can compare against the latest equipped weapon without
  // changing identity (keeps the GameProvider effect dep stable).
  const equippedRef = useRef<Weapon | null>(null);
  equippedRef.current = equippedWeapon;

  // Roll a drop for a kill of `variant`. Auto-equips a strictly-better weapon
  // and fires `weapon-drop` (picked up by useWeaponPopups for the popup + SFX).
  // No-op when nothing drops. rng injectable for tests.
  const tryDrop = useCallback(
    (variant: MonsterVariant, rng: () => number = Math.random) => {
      const dropped = rollWeaponDrop(variant, rng);
      if (!dropped) return;
      const equipped = weaponPower(dropped) > weaponPower(equippedRef.current);
      if (equipped) setEquippedWeapon(dropped);
      window.dispatchEvent(
        new CustomEvent('weapon-drop', {
          detail: { name: dropped.name, rarity: dropped.rarity, equipped },
        })
      );
    },
    []
  );

  const reset = useCallback(() => setEquippedWeapon(null), []);

  return { equippedWeapon, tryDrop, reset };
}
