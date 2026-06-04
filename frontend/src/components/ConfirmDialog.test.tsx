import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';

// Theme is read via context (throws outside its provider); mock like the other
// component SSR smoke tests.
import { vi } from 'vitest';
vi.mock('../hooks/useThemeContext', () => ({
  useThemeContext: () => ({ theme: 'dark', toggleTheme: () => {} }),
}));

import ConfirmDialog from './ConfirmDialog';

describe('ConfirmDialog', () => {
  const render = () =>
    renderToString(
      <ConfirmDialog
        title="Restart run?"
        message="Changing difficulty will restart your current run."
        confirmLabel="Restart"
        cancelLabel="Keep playing"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );

  it('renders the title, message, and both action labels', () => {
    const html = render();
    expect(html).toContain('Restart run?');
    expect(html).toContain(
      'Changing difficulty will restart your current run.'
    );
    expect(html).toContain('Restart');
    expect(html).toContain('Keep playing');
  });

  it('marks the card as a modal dialog', () => {
    const html = render();
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
  });
});
