import { useEffect, useState } from 'react';

export interface XpPopupState {
  visible: boolean;
  show: boolean;
  topPct: number;
  leftPct: number;
}

// Drives the floating "+N XP" popup. Re-fires whenever `earnedXp` changes to
// a non-zero value, randomising position so successive XP awards don't stack.
export function useXpPopup(earnedXp: number): XpPopupState {
  const [state, setState] = useState<XpPopupState>({
    visible: false,
    show: false,
    topPct: 45,
    leftPct: 50,
  });

  useEffect(() => {
    if (!earnedXp || earnedXp <= 0) return;
    const left = 50 + (Math.random() * 30 - 15);
    const top = 45 + (Math.random() * 20 - 10);
    setState({ visible: true, show: false, topPct: top, leftPct: left });
    const t1 = setTimeout(() => setState(s => ({ ...s, show: true })), 20);
    const t2 = setTimeout(() => setState(s => ({ ...s, show: false })), 1200);
    const t3 = setTimeout(
      () => setState(s => ({ ...s, visible: false })),
      1600
    );
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [earnedXp]);

  return state;
}
