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
// The component loads/saves the leaderboard display name via useApi (which calls
// Clerk's useAuth); mock it so the SSR smoke render doesn't need a ClerkProvider.
vi.mock('../hooks/useApi', () => ({
  useApi: () => ({
    getMe: async () => ({ ok: false }),
    updateDisplayName: async () => ({ ok: true }),
  }),
}));

import CharacterCustomizer from './CharacterCustomizer';

describe('CharacterCustomizer', () => {
  it('renders the preview, all knob group labels, and Save', () => {
    const html = renderToString(<CharacterCustomizer onClose={() => {}} />);
    expect(html).toContain('data-avatar'); // live preview
    expect(html).toContain('Armor');
    expect(html).toContain('Helmet');
    expect(html).toContain('Skin');
    expect(html).toContain('Color');
    expect(html).toContain('Save');
  });
});
