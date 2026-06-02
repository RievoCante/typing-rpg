import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { WEAPON_IDS } from './weapons';

// Guards the sync rule in CLAUDE.md: backend WEAPON_IDS (core/weapons.ts) MUST
// match the weapon ids in frontend/src/utils/weapons.ts (WEAPON_POOL). The
// vault validates unlock/select against the backend list, so drift would let
// the frontend equip an id the backend rejects (or vice-versa). Runs in
// backend CI so a PR that changes one without the other fails before merge.
describe('weapon-id sync (frontend WEAPON_POOL ↔ backend WEAPON_IDS)', () => {
  it('the two id sets are identical', () => {
    const frontendSrc = readFileSync(
      resolve(__dirname, '../../../frontend/src/utils/weapons.ts'),
      'utf8'
    );
    // Pull every `id: '...'` literal from the pool definitions.
    const frontendIds = [...frontendSrc.matchAll(/id:\s*'([^']+)'/g)].map(
      m => m[1]
    );

    expect(new Set(frontendIds)).toEqual(new Set(WEAPON_IDS));
    // No accidental duplicates / extras on either side.
    expect(frontendIds.length).toBe(WEAPON_IDS.length);
  });
});
