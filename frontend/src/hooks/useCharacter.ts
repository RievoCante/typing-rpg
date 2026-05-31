import { useContext } from 'react';
import { CharacterContext } from '../context/characterContext';

export function useCharacter() {
  const ctx = useContext(CharacterContext);
  if (!ctx) {
    throw new Error('useCharacter must be used within a CharacterProvider');
  }
  return ctx;
}
