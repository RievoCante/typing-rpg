import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

// @react-three/fiber Canvas cannot server-render in the node test env; stub it.
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children?: unknown }) => (
    <div data-boss-canvas="true">{children as never}</div>
  ),
  useFrame: () => {},
}));

import RaidBoss3D from './RaidBoss3D';

describe('RaidBoss3D', () => {
  it('renders a canvas without crashing across states', () => {
    const html = renderToString(
      <RaidBoss3D hpPercent={100} isHit={false} isDefeated={false} />
    );
    expect(html).toContain('data-boss-canvas');
  });
  it('renders when defeated', () => {
    const html = renderToString(<RaidBoss3D hpPercent={0} isHit isDefeated />);
    expect(html).toContain('data-boss-canvas');
  });
});
