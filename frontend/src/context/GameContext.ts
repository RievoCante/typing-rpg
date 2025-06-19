import { createContext } from "react";

interface GameContextType {
  currentMode: 'daily' | 'endless';
  setCurrentMode: (mode: 'daily' | 'endless') => void;
}

export const GameContext = createContext<GameContextType>({
  currentMode: 'daily',
  setCurrentMode: () => {},
});