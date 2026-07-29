# Phase 5: Layout Consolidation + Rework - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-29
**Phase:** 5-Layout Consolidation + Rework
**Areas discussed:** URL param + old route fate, List density when full-width, Close control design, Scroll + mobile behavior

---

## URL param + old route fate

### Q1: Old /companies/[id] route — keep or drop?

| Option | Description | Selected |
|--------|-------------|----------|
| Redirect to param URL | /companies/42 still resolves — 302s to /companies?param=42. Preserves existing bookmarks. | ✓ |
| Drop entirely | Delete the [id] route. Simpler, but saved links break. | |
| Keep as separate full-page route | Both stay as distinct routes. More routes to maintain. | |

**User's choice:** Redirect to param URL

### Q2: Query param name

| Option | Description | Selected |
|--------|-------------|----------|
| selected | ?selected=42 — generic, works identically for both entities. | ✓ |
| expanded | ?expanded=42 — names the UI behavior instead of the concept. | |
| entity-specific (company/persona) | Two different param names per domain. | |

**User's choice:** selected

**Notes:** Extends the existing nuqs filter URL-sync convention already used for search/industry.

---

## List density when full-width

### Q1: Use freed space for more columns, or keep existing?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep same columns, just wider | No new data shown — same 7 columns, more padding. | ✓ |
| Add more columns | Surface detail-panel-only fields directly in the list row. | |
| You decide | Claude picks per entity type during implementation. | |

**User's choice:** Keep same columns, just wider

---

## Close control design

### Q1: How should the explicit close control work?

| Option | Description | Selected |
|--------|-------------|----------|
| Both: row toggle + close button | Click open row to close, AND a dedicated ✕ Close button inside the panel. | ✓ |
| Row toggle only | Click the open row again to close — no separate button. | |
| Close button only | Only a dedicated ✕ Close button; clicking the row does nothing. | |

**User's choice:** Both: row toggle + close button

**Notes:** Close button placement reserved top-right of expanded panel, same corner Phase 6's Menu button will land in later.

---

## Scroll + mobile behavior

### Q1: Where should the clicked row land after scroll-into-view?

| Option | Description | Selected |
|--------|-------------|----------|
| Row scrolls to top of viewport | Newly-expanded detail panel is immediately visible below. | ✓ |
| Row scrolls to center | Detail content mostly still requires further scrolling. | |

**User's choice:** Row scrolls to top of viewport

### Q2: Keep hide-list-on-mobile-when-expanded, or always show both stacked?

| Option | Description | Selected |
|--------|-------------|----------|
| Hide list on mobile when expanded | Keeps today's D-07 behavior — avoids scrolling past a long list on small screens. | ✓ |
| Always show both, stacked | Consistent with desktop, but requires scrolling past the full list every time on mobile. | |

**User's choice:** Hide list on mobile when expanded

---

## Claude's Discretion

- Exact shared-component API (props/slots for Companies vs. Personas differing detail content) — implementation architecture, left to research/planning.
- Whether the `selected` param uses `shallow: false` (matching existing filter-param convention) — follow existing convention unless research finds a reason to deviate.

## Deferred Ideas

None — discussion stayed within phase scope.
