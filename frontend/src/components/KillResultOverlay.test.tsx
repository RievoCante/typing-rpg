import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import KillResultOverlay, { type KillResult } from './KillResultOverlay';

const result: KillResult = {
  title: 'FAST',
  wpm: 82,
  accuracy: 96,
};

const noop = () => {};

describe('KillResultOverlay', () => {
  it('renders the speed title, WPM, accuracy, and continue prompt', () => {
    const html = renderToString(
      <KillResultOverlay visible result={result} onContinue={noop} />
    );
    expect(html).toContain('FAST');
    expect(html).toContain('82');
    expect(html).toContain('WPM');
    expect(html).toContain('96%');
    expect(html).toContain('Accuracy');
    expect(html).toContain('Press SPACE to continue');
  });

  it('shows the XP figure only when provided (endless)', () => {
    const withXp = renderToString(
      <KillResultOverlay
        visible
        result={{ ...result, xp: 120 }}
        onContinue={noop}
      />
    );
    expect(withXp).toContain('+120');
    expect(withXp).toContain('XP');

    const withoutXp = renderToString(
      <KillResultOverlay visible result={result} onContinue={noop} />
    );
    expect(withoutXp).not.toContain('+120');
  });

  it('renders the optional subline (daily quote progress)', () => {
    const html = renderToString(
      <KillResultOverlay
        visible
        result={{ ...result, subline: 'medium quote completed!' }}
        onContinue={noop}
      />
    );
    expect(html).toContain('medium quote completed!');
  });

  it('renders nothing when not visible or when result is null', () => {
    expect(
      renderToString(
        <KillResultOverlay visible={false} result={result} onContinue={noop} />
      )
    ).toBe('');
    expect(
      renderToString(
        <KillResultOverlay visible result={null} onContinue={noop} />
      )
    ).toBe('');
  });
});
