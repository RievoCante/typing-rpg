# Phase 3b — Persistent Weapon Vault + Loadout (cross-stack)

**Status:** design · **Date:** 2026-06-02 · **Mode:** Endless only

## Goal

Add meta-progression on top of the Phase 3 per-run weapon loop **without killing the
roguelike arc**. Players permanently **collect** the weapons they find (a "vault") and,
before a run, pick **one** collected weapon as the run's **starting loadout** (instead
of Fists). Inside a run, drops still auto-equip-if-better and death still resets — but
resets to the chosen loadout, not Fists. So runs still go "get strong, push your luck,
die, replay," while long-term play unlocks better starting points.

Account-tied persistence → this is **cross-stack** (D1 table change + API + frontend).
Endless is already authenticated, so this fits the existing auth model.

## Design tension resolution

- Vault = which of the **fixed 8-weapon pool** a user has unlocked (bounded set, not an
  infinite inventory).
- Loadout = exactly **one** unlocked weapon id (or none → Fists).
- Per-run combat (Phase 3) is **unchanged** except the run's *starting* weapon is the
  loadout instead of always Fists.
- Logged-out / no loadout → Fists, per-run only, no vault (graceful fallback).

## Backend (additive, no new table)

Mirror the existing `users.character` JSON-column precedent. Two new columns on `users`:

| Column             | Type          | Default | Meaning                          |
|--------------------|---------------|---------|----------------------------------|
| `unlocked_weapons` | `text` (JSON) | `'[]'`  | JSON `string[]` of weapon ids    |
| `loadout_weapon`   | `text` null   | `null`  | selected loadout weapon id       |

Migration generated via `bun run db:gen` (additive, safe). Applied locally by the
`dev` script (`wrangler d1 migrations apply typing-rpg-db --local`); CD applies
`--remote` on merge to `main`.

**Routes** (all `authMiddleware` + `limiter`, registered after `/me/*` in `index.ts`,
preserving middleware order; mirror `updateCharacter` — `getAuth`, Zod, Drizzle, JSON):

- `GET /me/vault` → `{ unlocked: string[], loadout: string | null }`
- `POST /me/vault/unlock { weaponIds: string[] }` → union with current set, **validate
  each id against `WEAPON_IDS`**, dedupe, cap at pool size; returns updated `unlocked`.
- `POST /me/vault/select { weaponId: string | null }` → set loadout; must be in the
  user's `unlocked` set (or `null` to clear); returns `loadout`.

**New backend constant `WEAPON_IDS`** (the 8 ids) → **new documented sync rule**: must
match the ids in `frontend/src/utils/weapons.ts`. Add to root `CLAUDE.md` Critical Rules.

Handlers live in `backend/src/handlers/vault.ts`; helper to read/parse the JSON column
mirrors how `character` is parsed.

## Frontend

**API client** (`hooks/useApi.ts`): add
- `getWeaponVault()` → `GET /me/vault`
- `unlockWeapons(ids: string[])` → `POST /me/vault/unlock`
- `selectLoadout(id: string | null)` → `POST /me/vault/select`

**Vault hook** (`hooks/useWeaponVault.ts`):
- On mount (if signed in) loads `{ unlocked, loadout }`; logged-out → empty + disabled.
- `setLoadout(id)` — optimistic local update + `selectLoadout` POST.
- `unlockMany(ids)` — merge into local `unlocked` + `unlockWeapons` POST (fire-and-forget
  with retry, mirroring `EndlessCompletionHandler`'s `createSession` resilience).
- Exposes `{ unlocked, loadout, setLoadout, unlockMany, isSignedIn, isLoading }`.

**Run integration** (`GameProvider` + `useWeaponSystem`):
- A run's starting `equippedWeapon` = the loadout weapon (looked up by id from the pool)
  instead of `null`. `resetGameState()` resets equipped to the **loadout** weapon
  (Fists if none / logged out).
- Mid-run drops: auto-equip-if-better, unchanged from Phase 3.
- **Run-end flush:** during a run, accumulate found weapon ids not already in `unlocked`;
  on the HP-defeat / run-end, call `unlockMany(newIds)` once (batched), then merge locally.

**Loadout UI** (`components/WeaponLoadoutPanel.tsx`, mounted in `EndlessOptions.tsx`
beside `DifficultyDropdown`, so it shows in Endless before the first keystroke starts
the run):
- Renders all 8 pool weapons: **unlocked** = colored by rarity + stat summary + selectable;
  **locked** = greyed + lock icon. A "Fists" (none) option is always selectable.
- Selecting sets the loadout (highlights current).
- Logged-out → panel shows "Sign in to collect and equip weapons" and is read-only.

**Pool** (`utils/weapons.ts`): ensure every weapon has a stable `id`; export a
`getWeaponById(id)` helper and the id list used to keep backend `WEAPON_IDS` in sync.

## Testing

- **Backend** (`bun test`): `unlock` union/dedupe/validation-against-`WEAPON_IDS`/cap;
  `select` membership enforcement + null clear; 401 when unauthenticated; JSON column
  round-trip.
- **Frontend**: `useWeaponVault` state transitions (load, optimistic select, batched
  unlock, logged-out no-op); loadout → starting-equip wiring; run-end flush only sends
  genuinely new ids; `WeaponLoadoutPanel` locked/unlocked rendering. Pure `getWeaponById`.
- **Manual:** sign in, play Endless, find weapons → they appear unlocked in the panel
  next run; pick a loadout → run starts with it equipped; die → resets to loadout (not
  Fists); logged out → Fists + read-only panel.

## Out of scope

- Multi-slot loadout / mid-run manual swapping (single starting loadout only).
- Weapon visuals on the avatar / monster.
- Trading, crafting, weapon levelling.
- Vault for guests (account-tied only).
