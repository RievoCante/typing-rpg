import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

vi.mock('./PlayerAvatar3D', () => ({
  default: () => <i data-avatar="true" />,
}));
vi.mock('../hooks/useCharacter', () => ({
  useCharacter: () => ({ config: null, save: async () => {}, ready: true }),
}));
// The component reads theme via useThemeContext (throws outside a ThemeProvider);
// SSR smoke render mocks it like the other context hooks above.
vi.mock('../hooks/useThemeContext', () => ({
  useThemeContext: () => ({ theme: 'dark', toggleTheme: () => {} }),
}));

import CharacterCustomizer from './CharacterCustomizer';

describe('CharacterCustomizer', () => {
  it('renders the preview, all knob group labels, and Save', () => {
    const html = renderToString(<CharacterCustomizer onClose={() => {}} />);
    expect(html).toContain('data-avatar'); // live preview
    expect(html).toContain('Body');
    expect(html).toContain('Color');
    expect(html).toContain('Eyes');
    expect(html).toContain('Accessory');
    expect(html).toContain('Save');
  });
});
