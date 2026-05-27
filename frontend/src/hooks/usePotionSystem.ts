import { useCallback, useState } from 'react';

const POTION_CHANCE = 0.3; // 30% chance per defeat
const POTION_MIN_HEAL = 25;
const POTION_MAX_HEAL = 50;

export function usePotionSystem(healPlayer: (amount: number) => void) {
  const [hasPotion, setHasPotion] = useState<boolean>(false);
  const [potionHealAmount, setPotionHealAmount] = useState<number>(0);

  const givePotion = useCallback(() => {
    if (Math.random() >= POTION_CHANCE) return;
    const healAmount =
      Math.floor(Math.random() * (POTION_MAX_HEAL - POTION_MIN_HEAL + 1)) +
      POTION_MIN_HEAL;
    setPotionHealAmount(healAmount);
    setHasPotion(true);
  }, []);

  const drinkPotion = useCallback(() => {
    if (!hasPotion || potionHealAmount <= 0) return;
    healPlayer(potionHealAmount);
    setHasPotion(false);
    setPotionHealAmount(0);
  }, [hasPotion, potionHealAmount, healPlayer]);

  const resetPotionState = useCallback(() => {
    setHasPotion(false);
    setPotionHealAmount(0);
  }, []);

  return {
    hasPotion,
    potionHealAmount,
    givePotion,
    drinkPotion,
    resetPotionState,
  };
}
