import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

// @react-three/fiber Canvas cannot server-render in the node test env; stub it.
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children?: unknown }) => (
    <div data-monster-canvas="true">{children as never}</div>
  ),
  useFrame: () => {},
}));
vi.mock('../hooks/useSfx', () => ({
  useSfx: () => ({ playExplosion: () => {} }),
}));
// GolemModel calls useGLTF.preload() at module load; stub drei so the import is safe.
vi.mock('@react-three/drei', () => ({
  useGLTF: Object.assign(
    () => ({ scene: { clone: () => ({ traverse: () => {} }) } }),
    { preload: () => {} }
  ),
}));

import Monster from './Monster';

describe('Monster', () => {
  it('renders a slime canvas without crashing', () => {
    const html = renderToString(
      <Monster monsterFamily="slime" monsterType="normal" isDefeated={false} />
    );
    expect(html).toContain('data-monster-canvas');
  });
});
