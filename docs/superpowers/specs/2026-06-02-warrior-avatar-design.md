# Warrior Avatar — Design Spec

Date: 2026-06-02
Branch: `feature/warrior-avatar` (off `dev`)

## Goal

Replace the abstract "blob" player avatar (sphere/box with eyes + accessory) with a
**humanoid warrior**, rebuild the customizer around warrior-appropriate options, and
show the warrior in **Endless** and **Daily** modes (it already appears in Raid).

## Decisions (locked)

- **Scope:** Replace the blob entirely. Redesign the customizer.
- **Rendering:** Keep 3D (Three.js / `@react-three/fiber`) — rebuild the model as a humanoid.
- **Customizer axes:** Armor (3 types × 5 colors), Helmet (3 types × 5 colors), Skin (5 tones).
- **Helmet:** 3 open-faced helmets (no bare-head option); face/skin still reads.
- **Weapon:** A fixed sword prop (not customizable). Sells "warrior" + drives the attack lunge.
- **Placement (Endless + Daily):** Portrait slot **left of the typing box**, between the
  vertical health bar and the typing container — mirrors the right-side potion slot.

## Data model

New `PlayerAvatarConfig` (replaces `{ bodyShape, bodyColor, eyeStyle, accessory, accessoryColor }`):

```ts
interface PlayerAvatarConfig {
  armorType:  'plate' | 'tunic' | 'heavy';
  armorColor: ArmorColor;   // 5-hex enum
  helmetType: 'barbute' | 'horned' | 'crowned';
  helmetColor: HelmetColor; // 5-hex enum
  skinTone:   SkinTone;     // 5-hex enum
}
```

Palettes (exact hexes, used in BOTH frontend enums and backend Zod schema):

- `armorColor` / `helmetColor` (5): `#9aa4b2` steel, `#d4af37` gold, `#b23a48` crimson,
  `#3b5bdb` royal blue, `#2f9e69` emerald.
- `skinTone` (5): `#f1c9a5`, `#e0a878`, `#c68642`, `#8d5524`, `#5c3317`.

(Helmet reuses the same 5-color palette as armor for simplicity — one shared palette.)

## Schema sync invariant (NEW critical rule)

The avatar config schema lives in two places that MUST stay identical:

- `frontend/src/utils/avatarConfig.ts` — TS types + enum arrays + validation/seed.
- `backend/src/core/character.ts` — Zod schema (`.strict()`), used by `PATCH /me/character`
  and raid `join` validation in `RaidRoom.ts`.

If one changes, the other must change in the same PR. Add this rule to `CLAUDE.md`.

## Components & files

| File | Change |
|------|--------|
| `frontend/src/utils/avatarConfig.ts` | New type, palettes, type enums, `validateAvatarConfig`/normalize (reject non-matching → fallback), `avatarConfigFromSeed` rewritten to emit warrior configs, new `DEFAULT_AVATAR_CONFIG`. |
| `frontend/src/context/characterContext.ts` | Update default/constants if they reference old shape. Storage key unchanged (`raid:character`). |
| `frontend/src/context/CharacterProvider.tsx` | Normalize loaded config (backend GET /me + localStorage) through the new validator; old blob configs fall back to seed/default. |
| `frontend/src/components/PlayerAvatar3D.tsx` | Rebuild model as humanoid warrior from primitives. Preserve animation hooks: attack lunge (group z + scale), hurt (tint ALL body materials red), critical-HP wobble, death droop/desaturate. |
| `frontend/src/components/CharacterCustomizer.tsx` | New UI: ARMOR (3 types + 5 colors), HELMET (3 types + 5 colors), SKIN (5 tones). Remove shape/eyes/accessory sections. Keep live 3D preview. |
| `frontend/src/components/BattleAvatar.tsx` (NEW) | Lean portrait wrapper (sized box around `PlayerAvatar3D`, optional "You" label). Used by Endless/Daily. |
| `frontend/src/components/TypingInterface.tsx` | Insert `BattleAvatar` slot between health bar and typing container, for both endless & daily. Wire HP%, isAlive, attack-on-word-complete, hurt-on-player-damage. |
| `backend/src/core/character.ts` | Rewrite Zod schema to match new shape + palettes. |
| `backend/src/core/character.test.ts` | Update tests for new schema (valid new config passes; old shape + extra fields rejected). |
| `CLAUDE.md` | Add avatar-schema sync rule to Critical Rules. |

## Rendering details (PlayerAvatar3D)

Humanoid group, centered, scaled to fit the existing camera:

- **Head** (skinTone) + simple dark-dot eyes on the front face.
- **Helmet** sits on/around head, colored `helmetColor`:
  - `barbute` — rounded cap with a T-slot opening (face visible).
  - `horned` — barbute + two cones on the sides.
  - `crowned` — open circlet/crown band (most of face visible).
- **Torso + pelvis** colored `armorColor`; silhouette by `armorType`:
  - `plate` — boxy chest + flat pauldrons.
  - `tunic` — slimmer torso, no pauldrons.
  - `heavy` — bulky chest + large rounded pauldrons.
- **Arms**: upper arm in armorColor, **hands** in skinTone. **Legs**: armored (armorColor, darker).
- **Sword**: fixed prop in the right hand (blade + crossguard + grip), neutral steel.

Animation: the existing logic tints the single body material on hurt/death. Refactor so the
group exposes a list of "body" materials; hurt lerps them all toward `#ff4d4d`, death
desaturates them. Lunge/wobble apply to the group transform (unchanged approach).

## Placement details (Endless + Daily)

`TypingInterface.tsx` layout becomes:

```
[ HP bar ] [ BattleAvatar ] [ ...typing container (flex-1)... ] [ Potion (endless only) ]
```

`BattleAvatar` props: `config`, `hpPercent`, `isAlive`, `isAttacking`, `isHurt`.

- `hpPercent`/`isAlive` from the player health state already used by `VerticalPlayerHealthBar`.
- `isAttacking`: brief pulse triggered on word completion / monster taking damage.
- `isHurt`: brief pulse triggered when the player takes damage.

If a given event isn't cleanly available at this layer, fall back to idle for that signal
(critical wobble + death still work from HP). MVP must at least render the warrior with
HP-driven critical/death states in both modes.

## Migration / backward compatibility

- Avatar config is cosmetic JSON. No DB migration.
- On load (backend `GET /me` `character` string, or `raid:character` localStorage), parse
  and run through `validateAvatarConfig`. Anything not matching the new schema (every
  existing saved blob) → discard → fall back to `avatarConfigFromSeed(userId)` (deterministic)
  or `DEFAULT_AVATAR_CONFIG`. Existing users silently get a default warrior and can re-customize.
- Backend `parseCharacterConfig` returns `null` for old/invalid → frontend already handles null.

## Testing

- **Frontend (unit):** `validateAvatarConfig` (valid passes; old blob shape → null/fallback;
  extra fields rejected); `avatarConfigFromSeed` determinism + always-valid output;
  customizer interaction (selecting armor/helmet/skin updates the config).
- **Backend (unit):** `character.test.ts` — new valid config passes; old shape rejected;
  strict extra-field rejected; each enum boundary.
- **Manual:** dev server — customizer preview updates live; warrior renders in Endless,
  Daily, and Raid; HP-driven animations behave.
- **CI:** frontend (lint → format:check → typecheck → test → build), backend (typecheck → test).

## Out of scope

- Weapon customization, hair, capes, idle breathing animation, new accessories beyond helmets.
- Any change to XP, combat numbers, or raid protocol beyond the config shape.
