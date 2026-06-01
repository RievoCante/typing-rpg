---
name: vault-update
description: >-
  Use this skill right after merging a feature/fix into the Typing RPG `dev`
  branch to keep the product vault (~/Workspace/ai-brain/business/typing-rpg/)
  in sync. Trigger it whenever you finish a merge to `dev`, ship a new feature,
  change documented product behavior (game rules, modes, XP, user flow), or
  whenever someone says "update the vault", "sync the vault", "log this",
  "document this feature in the vault", or asks where a feature spec should go.
  This project runs many parallel agents, so the skill exists to update shared
  vault files WITHOUT git conflicts — do not hand-edit log.md/index.md without it.
---

# Vault Update

Keep the Typing RPG **product vault** current after merging work into `dev`. The vault holds product/feature knowledge (the "what" and "why"); the code repo holds the "how". They drift apart unless updated deliberately — this skill is that step.

**Vault location:** `~/Workspace/ai-brain/business/typing-rpg/` — a **separate git repo** (`ai-brain`) from the code repo. Its own rules live in that folder's `CLAUDE.md`; read it if you need context.

## When to run this (the filter)

Run this skill only for **vault-worthy** changes. The vault is product knowledge, not a changelog — keeping it signal-dense is the whole point.

| Run the skill | Skip it |
|---|---|
| A new feature shipped | Styling / layout / spacing tweaks |
| Documented product behavior changed (game rules, modes, XP numbers, user flow, balance) | Performance optimizations |
| A feature was removed or fundamentally reworked | Refactors with no behavior change |
| A new product-level constraint or decision | Pure bug fixes (behavior returns to intended) |

Why skip the right column: those are fully captured by git history + claude-mem already. Logging them in the vault just buries the product signal under noise. When unsure, ask: *"Would a teammate reading the vault need this to understand what the product does?"* If no, skip.

## The two kinds of vault files

The conflict-avoidance strategy depends on which file you're touching, because many agents merge to `dev` concurrently.

1. **Owned files — edit directly.** Each is effectively owned by the one agent working that feature, so concurrent edits don't collide:
   - `canonical/features/<feature>.md` — the per-feature spec.
   - `canonical/prd.md` — only if *documented product behavior* changed.
2. **Shared files — NEVER edit directly.** `log.md` and `index.md` are append-at-top / shared-table files. If every parallel agent edits the same region, git conflicts are guaranteed. Instead, drop a **uniquely-named inbox fragment** and let a later consolidation pass fold it in.

## Procedure

### 1. Update the owned feature spec

- **Existing feature changed:** edit `canonical/features/<feature>.md` — update the affected section (constants table, game loop, data model, etc.) and bump the `updated:` date in the frontmatter.
- **Brand-new feature:** create `canonical/features/<new-feature>.md`. Match the shape of the existing specs (see `canonical/features/raid-boss.md` — the most complete example). A good spec has: frontmatter (`type: feature-spec`, `feature`, `updated`, `status`), an **Overview**, the **flow / game loop**, a **Constants** table, a **Data model** if it touches the DB, **Files of record** (real code paths), **Critical sync rules** if any, and **Out of scope**. Ground every claim in the actual code — read the files before writing.
- If product behavior visible to users changed, also update `canonical/prd.md`.

Keep specs grounded and precise — they are the source of truth, not marketing. Link related specs with `[[wikilinks]]` (e.g. `[[leveling-xp]]`).

### 2. Drop a log-inbox fragment (instead of editing log.md / index.md)

Create one file: `log-inbox/YYYY-MM-DD-<feature-slug>.md`. The unique filename guarantees no two parallel agents collide. Use the template at `log-inbox/_TEMPLATE.md`; the shape is:

```markdown
---
type: log-fragment
venture: typing-rpg
feature: <feature-slug>
date: <YYYY-MM-DD>
---

# <YYYY-MM-DD> — <short milestone title>

- **What shipped:** <1–3 product-level lines — what a player can now do / what changed>
- **Spec touched:** <canonical/features/<feature>.md (new? updated?), prd.md (if behavior changed), or "none">
- **index.md row to add/update:** <proposed `| [[canonical/features/<feature>]] | status | one-liner |`, or "none">
- **Dev branch ref:** <merge commit SHA or feature branch, optional>
```

Do **not** touch `log.md` or `index.md` yourself during a normal merge — the fragment carries everything the consolidation pass needs.

### 3. Commit + push the vault repo

The vault is a separate repo, so commit there too (not just the code repo):

```bash
cd ~/Workspace/ai-brain
git add business/typing-rpg/          # scope to this venture only
git commit -m "typing-rpg: <feature> — spec + log fragment"
git push origin HEAD
```

Scope the `git add` to `business/typing-rpg/` so you don't sweep in unrelated vault edits from the user's Obsidian session.

## Consolidation pass (periodic, not per-merge)

Inbox fragments accumulate; periodically (a human, or an agent explicitly asked to "consolidate the vault inbox") fold them in:

1. Read every `log-inbox/*.md` fragment (ignore `_TEMPLATE.md`).
2. For each, prepend a dated entry to the top of `log.md` (newest-first), merging same-day items sensibly.
3. Apply any "index.md row to add/update" into the `canonical/features/` table in `index.md`.
4. Bump the `updated:` date in `log.md` and `index.md`.
5. **Delete** the consumed fragment files.
6. Commit + push the vault.

Because consolidation is a single, deliberate, non-parallel action, editing the shared files directly here is safe.

## Examples

**Example 1 — vault-worthy (new feature):**
Input: merged `feature/endless-potion-inventory` into `dev` — players can now collect and use potions in Endless.
Action: create `canonical/features/potion-inventory.md` (grounded spec), drop `log-inbox/2026-06-01-potion-inventory.md`, commit+push vault.

**Example 2 — not vault-worthy:**
Input: merged a fix increasing typing-card padding.
Action: nothing in the vault. (Git + claude-mem already capture it.)

**Example 3 — behavior change to existing feature:**
Input: Endless base XP changed from 100 → 120.
Action: edit `canonical/features/endless-mode.md` and `canonical/features/leveling-xp.md` constants + bump `updated:`, edit `canonical/prd.md` if it cited the number, drop a `log-inbox/` fragment, commit+push.
