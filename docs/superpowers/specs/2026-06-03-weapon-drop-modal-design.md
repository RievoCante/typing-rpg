# Weapon Drop Modal — Endless Mode (Design Spec)

Date: 2026-06-03
Status: Approved

## Goal

When a weapon drops in Endless mode, present a center-screen celebration modal (rarity-framed icon, weapon name, effect stats) that the player dismisses with a single **Take** action (Spacebar/Enter or button) — shown on top of everything, **before** the existing kill-result overlay.

## Behavior

| Aspect | Design |
| --- | --- |
| Trigger | `weapon-drop` CustomEvent fired on monster kill (Endless only) |
| Content | Rarity-colored icon frame, weapon name, conditional effect stat lines |
| Icon | Per-`WeaponId` Lucide icon (sword → `Sword`, wand → `Wand2`, club → blunt icon, bow → target icon) inside a rarity-colored frame. Built as a drop-in slot so real PNG art can replace it later without layout changes. |
| Action | Single **Take** — Space/Enter **or** an on-screen button |
| Layering | Modal at `z-50`, above `KillResultOverlay`; gates it — `awaitingContinue` is held back until `pendingDrop` is null |
| Input | Top-priority branch in `TypingInterface.handleKeyDown`: captures Space/Enter, prevents typing leaking to underlying game state |
| Stat lines | Rendered conditionally: `bonusDamage > 0`, `bonusCritChance > 0`, `critMultBonus > 0`. Rarity color reuses the `RARITY_COLOR` constant. |

## Behavior changes

- **Remove auto-equip.** Delete the "auto-equip if stronger" logic (`setEquippedWeapon` call) from `useWeaponSystem.tryDrop`. The equipped weapon stays locked to the chosen loadout for the entire run — no mid-fight weapon changes.
- **Remove the floating drop popup.** The modal replaces the tiny fading weapon-drop popup. Potion/hit/attack/combat popups are untouched.
- **Take → persistent vault (already works).** `useWeaponVault` already auto-unlocks the dropped weapon on the `weapon-drop` event for signed-in users. No backend/API work required. Take does **not** equip mid-run.

## Component changes

- `frontend/src/hooks/useWeaponSystem.ts` — add `pendingDrop` state + `clearPendingDrop`; remove auto-equip.
- `frontend/src/context/GameProvider.tsx` + `GameContext` — expose `pendingDrop` and `clearPendingDrop`.
- `frontend/src/components/TypingInterface.tsx` — render the modal, gate the kill-result overlay reveal, add the top-priority keydown branch.
- New modal component — style modeled on `WeaponLoadoutPanel` (rarity chips/colors) + `KillResultOverlay` (centered overlay, awaiting-input pattern).
- `frontend/src/hooks/useWeaponVault.ts` — leave untouched (existing unlock path).
- Remove weapon-drop popup wiring from `useWeaponPopups` / `WeaponPopups`.

## Edge cases

- **Guests:** modal still shows; no vault persistence (sign-in required to persist) — unchanged from today.
- **No-drop kills:** no modal; go straight to kill-result overlay.
- **Restart mid-modal:** pending drop cleared on run reset.

## Testing

- `useWeaponSystem`: drop no longer auto-equips; `pendingDrop` set on drop, cleared by `clearPendingDrop`.
- Modal component: renders rarity color, stat lines (conditional), Take action.
- Sequencing: modal gates the kill-result overlay (`awaitingContinue` waits for `pendingDrop` null); Space/Enter does not leak into typing.
