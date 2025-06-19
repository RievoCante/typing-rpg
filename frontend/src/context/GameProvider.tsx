import { GameContext } from "./GameContext";
import { useState } from "react";

export const GameProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentMode, setCurrentMode] = useState<'daily' | 'endless'>('daily');

  return <GameContext.Provider value={{ currentMode, setCurrentMode }}>{children}</GameContext.Provider>;
};