import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import WeaponDropModal from './WeaponDropModal';
import { ALL_WEAPONS, type Weapon } from '../utils/weapons';

const dragonfang = ALL_WEAPONS.find(w => w.id === 'dragonfang') as Weapon;
const noop = () => {};

describe('WeaponDropModal', () => {
  it('renders the weapon name, effect lines, and Take action', () => {
    const html = renderToString(
      <WeaponDropModal weapon={dragonfang} onTake={noop} />
    );
    expect(html).toContain('Dragonfang');
    expect(html).toContain('+5 Damage');
    expect(html).toContain('+10% Crit Chance');
    expect(html).toContain('Take');
    expect(html).toContain('Press ENTER to take');
  });

  it('applies the rarity color class', () => {
    const html = renderToString(
      <WeaponDropModal weapon={dragonfang} onTake={noop} />
    );
    // legendary -> text-amber-400 (RARITY_COLOR)
    expect(html).toContain('text-amber-400');
  });
});
