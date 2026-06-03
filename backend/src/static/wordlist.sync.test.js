import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
// Guards the invariant in CLAUDE.md: backend and frontend MUST ship the same
// english_1k.json. Backend uses its copy at module init for raid text;
// frontend uses its copy for daily/endless typing. If they drift, players in
// the same raid see different words. Test runs in `backend-ci` so any PR that
// touches one file without the other fails CI before merge.
describe('english_1k wordlist sync', () => {
    it('backend and frontend wordlists are byte-identical', () => {
        const backendPath = resolve(__dirname, 'english_1k.json');
        const frontendPath = resolve(__dirname, '../../../frontend/src/static/english/english_1k.json');
        const backend = readFileSync(backendPath);
        const frontend = readFileSync(frontendPath);
        expect(backend.equals(frontend)).toBe(true);
    });
});
