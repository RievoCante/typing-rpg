import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

// The component reads theme + game state via context hooks (which throw outside
// their providers); SSR smoke render mocks them like the other component tests.
vi.mock('../hooks/useThemeContext', () => ({
  useThemeContext: () => ({ theme: 'dark', toggleTheme: () => {} }),
}));
vi.mock('../hooks/useGameContext', () => ({
  useGameContext: () => ({
    endlessDifficulty: 'advanced',
    setEndlessDifficulty: () => {},
  }),
}));

import DifficultyDropdown from './DifficultyDropdown';

describe('DifficultyDropdown', () => {
  // isOpen defaults to false, so SSR renders only the closed button. It shows
  // the current difficulty label and its reward-multiplier badge.
  it('shows the multiplier badge for the selected difficulty on the button', () => {
    const html = renderToString(<DifficultyDropdown />);
    expect(html).toContain('Advanced (10k)');
    expect(html).toContain('3×'); // advanced = 3.0x reward
  });

  it('labels the badge with an accessible XP-reward title', () => {
    const html = renderToString(<DifficultyDropdown />);
    expect(html).toContain('3× XP reward');
  });
});
