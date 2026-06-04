import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { PotionPopups } from './TypingPopups';
import type { PotionPopupItem } from '../hooks/usePotionPopups';

const item = (over: Partial<PotionPopupItem>): PotionPopupItem => ({
  id: 1,
  topPct: 40,
  leftPct: 85,
  show: true,
  text: '',
  kind: 'drop',
  ...over,
});

describe('PotionPopups', () => {
  it('renders a drop popup with potion text in pink', () => {
    const html = renderToString(
      <PotionPopups popups={[item({ text: '+1 Potion', kind: 'drop' })]} />
    );
    expect(html).toContain('+1 Potion');
    expect(html).toContain('text-pink-400');
  });

  it('renders a heal popup with "+N HP" text in green', () => {
    const html = renderToString(
      <PotionPopups
        popups={[item({ id: 2, text: '+30 HP', kind: 'heal', leftPct: 16 })]}
      />
    );
    expect(html).toContain('+30 HP');
    expect(html).toContain('text-green-400');
  });

  it('renders nothing when there are no popups', () => {
    expect(renderToString(<PotionPopups popups={[]} />)).toBe('');
  });
});
