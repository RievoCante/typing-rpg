import { createContext } from 'react';
import type { PlayerAvatarConfig } from '../utils/avatarConfig';

export type CharacterContextValue = {
  // The user's saved custom config, or null if they have not customized.
  config: PlayerAvatarConfig | null;
  // Persist a new config (backend if signed in, else localStorage).
  save: (config: PlayerAvatarConfig) => Promise<void>;
  // True once the initial load has settled.
  ready: boolean;
};

export const CharacterContext = createContext<CharacterContextValue | null>(
  null
);

export const CHARACTER_STORAGE_KEY = 'raid:character';
