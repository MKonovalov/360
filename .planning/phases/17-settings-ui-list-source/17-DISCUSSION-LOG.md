# Phase 17: Settings UI + List Source - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-02
**Phase:** 17-Settings UI + List Source
**Areas discussed:** Model roster breadth, Reorder interaction, Duplicate handling, Save UX

---

## Model Roster Breadth

| Option | Description | Selected |
|--------|-------------|----------|
| Re-verify haiku-4-5, add if pass | Picker gets 2 models, fallback feature real | ✓ |
| Ship sonnet-only | Settings works, fallback picker dead (no models available) | |
| Other | | |

**User's choice:** 1 — Re-verify haiku-4-5 (standing maintenance); picker gets 2 models if pass.
**Notes:** User explicitly chose the roster-expansion path to make the fallback feature meaningful.

**Q2 — haiku re-verify fails again:**

| Option | Description | Selected |
|--------|-------------|----------|
| Ship sonnet-only gracefully | Empty fallback state, no phase block | ✓ |
| Block phase | Until a second model is verified | |
| Add dated -20251001 | Violates D-02 no-dated-ID rule | |

**User's choice:** 1 — graceful sonnet-only fallback.

**Q3 — picker row content:**

| Option | Description | Selected |
|--------|-------------|----------|
| Name + cost | Clean, enough to choose | ✓ |
| Name + cost + context window | More informative, busier | |
| Name only | Minimal | |

**User's choice:** 1 — name + cost.

**Q4 — "last synced" display:**

| Option | Description | Selected |
|--------|-------------|----------|
| Show "Catalog synced {date}" footer | Small footer on Settings | ✓ |
| Omit | Not needed | |
| Claude discretion | | |

**User's choice:** 1 — show footer.

---

## Reorder Interaction

**Q1 — reorder mechanism:**

| Option | Description | Selected |
|--------|-------------|----------|
| Up/down arrow buttons | No new dep, matches existing primitives | ✓ |
| Drag-and-drop | Needs new dependency, more polished/risky | |
| Select dropdown per slot | Clunky | |

**User's choice:** 1 — up/down arrows.

**Q2 — add/remove rows:**

| Option | Description | Selected |
|--------|-------------|----------|
| "+ Add fallback" appends row; per-row X + arrows | | ✓ |
| Pre-rendered 2 fixed slots with "none" option | | |
| Other | | |

**User's choice:** 1 — append-row pattern.

**Q3 — single-model roster edge:**

| Option | Description | Selected |
|--------|-------------|----------|
| Hide fallback section + note | | ✓ |
| Show but disable | | |
| Claude discretion | | |

**User's choice:** 1 — hide fallback section, show note.

**Q4 — reorder persistence:**

| Option | Description | Selected |
|--------|-------------|----------|
| Draft-only, one Save persists | | ✓ |
| Each arrow = immediate save | | |
| Claude discretion | | |

**User's choice:** 1 — draft-only.

---

## Duplicate Handling

**Q1 — primary as fallback:**

| Option | Description | Selected |
|--------|-------------|----------|
| Block — primary excluded from fallback options | | ✓ |
| Allow — runtime dedupe (Phase 16 D-08) | | |
| Other | | |

**User's choice:** 1 — block.

**Q2 — duplicates within fallbacks:**

| Option | Description | Selected |
|--------|-------------|----------|
| Block — chosen model removed from remaining options | | ✓ |
| Allow — runtime dedupe | | |
| Other | | |

**User's choice:** 1 — block.

**Q3 — stale saved config:**

| Option | Description | Selected |
|--------|-------------|----------|
| Disabled option + inline warning, replacement required | | ✓ |
| Auto-remove silently | | |
| Show raw ID, block save | | |

**User's choice:** 1 — disabled + warning, replacement required.

**Q4 — stale primary with valid fallbacks:**

| Option | Description | Selected |
|--------|-------------|----------|
| Block save until primary replaced | Chain needs valid head | ✓ |
| Allow — fallbacks only, run defaults to FAST_MODEL_ID | | |
| Claude discretion | | |

**User's choice:** 1 — block save until primary replaced.

---

## Save UX

**Q1 — save trigger:**

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit Save, draft local, disabled while pending | | ✓ |
| Auto-save on every change | | |
| Save + auto-save reorder | | |

**User's choice:** 1 — explicit Save.

**Q2 — failure feedback:**

| Option | Description | Selected |
|--------|-------------|----------|
| Inline error + keep draft | Matches reviews.ts pattern | ✓ |
| Toast + reset | | |
| Claude discretion | | |

**User's choice:** 1 — inline error, draft kept.

**Q3 — success feedback:**

| Option | Description | Selected |
|--------|-------------|----------|
| Inline "Saved" + revalidatePath | | ✓ |
| No confirmation | | |
| Toast | | |

**User's choice:** 1 — inline "Saved" + revalidate.

**Q4 — unsaved-changes guard:**

| Option | Description | Selected |
|--------|-------------|----------|
| No guard — draft lost silently | Simplest | ✓ |
| beforeunload prompt | Heavier | |
| Claude discretion | | |

**User's choice:** 1 — no guard.

---

## Claude's Discretion

- `NavKey` union change, sidebar item shape/icon, ExplorerMenu wiring for Settings (SET-01)
- `/settings` route placement + page structure (follow Reviews page pattern)
- Zod schema for the save action (validate against allowlist ∩ snapshot at server)
- Reorder/remove edge behaviors not covered above
- "last synced" footer derivation (`catalog.json` `generatedAt`)

## Deferred Ideas

- Per-model advanced settings / per-agent assignment (MRG-01/03), team defaults (MRG-04) — REQUIREMENTS.md Future Requirements
- Drag-and-drop fallback reordering — rejected v1.3, possible later polish
- Unsaved-changes navigation guard — deliberately not added (D-15)
