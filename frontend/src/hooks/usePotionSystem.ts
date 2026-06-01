import { useCallback, useRef, useState } from 'react';
import { MAX_POTIONS, rollHealAmount, shouldDropPotion } from '../utils/potion';

// Endless potion inventory.
//
// Potions drop on a *word* clock (a chance every few correct words) so heal
// frequency scales with fight length, decoupled from monster size. The player
// banks up to MAX_POTIONS and spends them manually, which keeps long fights
// survivable without making short ones trivial. Inventory is per-run and is
// cleared on death/restart via resetPotionState (called from resetGameState).
export function usePotionSystem(
  healPlayer: (amount: number) => void,
  playerHealth: number,
  maxPlayerHealth: number
) {
  const [potionCount, setPotionCount] = useState<number>(0);

  // Refs mirror the latest values so the callbacks can read fresh state without
  // changing identity, and without running side effects inside a setState
  // updater (which StrictMode would double-invoke).
  const correctWordCount = useRef<number>(0);
  const potionCountRef = useRef<number>(0);
  potionCountRef.current = potionCount;
  const healthRef = useRef<number>(playerHealth);
  healthRef.current = playerHealth;

  // Call once per correct word (endless only). Every few words it rolls for a
  // drop; a successful roll adds a potion up to the cap. We fire `potion-drop`
  // only when a potion is actually banked (not when already at the cap) so the
  // popup/SFX never lie about a gain. usePotionPopups listens for the event.
  const registerCorrectWord = useCallback(() => {
    correctWordCount.current += 1;
    if (!shouldDropPotion(correctWordCount.current)) return;
    if (potionCountRef.current >= MAX_POTIONS) return;
    window.dispatchEvent(new Event('potion-drop'));
    setPotionCount(prev => Math.min(MAX_POTIONS, prev + 1));
  }, []);

  // Consume one potion to heal. No-op (and does not consume) when the inventory
  // is empty or the player is already at full HP, so a potion is never wasted.
  // Fires `potion-heal` with the amount actually restored (capped at max HP) so
  // the floating "+N HP" popup matches the health bar.
  const drinkPotion = useCallback(() => {
    if (potionCountRef.current <= 0) return;
    if (healthRef.current >= maxPlayerHealth) return;
    const rolled = rollHealAmount();
    const healed = Math.min(rolled, maxPlayerHealth - healthRef.current);
    healPlayer(rolled);
    window.dispatchEvent(
      new CustomEvent('potion-heal', { detail: { amount: healed } })
    );
    setPotionCount(prev => Math.max(0, prev - 1));
  }, [healPlayer, maxPlayerHealth]);

  const resetPotionState = useCallback(() => {
    setPotionCount(0);
    correctWordCount.current = 0;
  }, []);

  return {
    potionCount,
    maxPotions: MAX_POTIONS,
    registerCorrectWord,
    drinkPotion,
    resetPotionState,
  };
}
