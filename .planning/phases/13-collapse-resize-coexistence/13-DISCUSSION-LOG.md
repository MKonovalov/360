# Phase 13: Collapse & Resize Coexistence - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-01
**Phase:** 13-collapse-resize-coexistence
**Areas discussed:** Collapse button placement, Collapse ↔ resize interplay, Tooltip scope & content, Collapsed rail anatomy

---

## Collapse button placement

| Option | Description | Selected |
|--------|-------------|----------|
| In sidebar header | Button lives in the sidebar's own header zone (top-right), closest to Exa's reference; topbar stays free | ✓ |
| In topbar (SidebarInset) | Reuses the existing topbar trigger slot; simpler but a second toggle competing with ⌘B | |
| Replace topbar trigger | One affordance total; loses the always-visible hamburger, diverges from shadcn stock | |

**User's choice:** In sidebar header

**Follow-up: button behavior**

| Option | Description | Selected |
|--------|-------------|----------|
| Self-hiding toggle | panel-left-close/open swap; button fades with the header in the rail; ⌘B + topbar hamburger for re-expansion | |
| Always-visible swap | Button always visible, icon swaps by state, stays in the rail as 32px square | ✓ |

**User's choice:** Always-visible swap

**Follow-up: button vs letter-mark layout in rail**

| Option | Description | Selected |
|--------|-------------|----------|
| Button top-right, mark below | 2-row flex header: 32px button top-right, 28px letter-mark centered below | ✓ |
| Mark top-right, button left | Letter-mark where button was; reads inverted vs Exa | |

**User's choice:** Button top-right, mark below
**Notes:** Rail header is a 2-row flex; no overlap; matches Exa's top-right control + centered mark.

---

## Collapse ↔ resize interplay

| Option | Description | Selected |
|--------|-------------|----------|
| Hide handle when collapsed | 48px rail is fixed-width, no resize affordance; resize only in expanded state | ✓ |
| Keep handle always | Users can drag from 48px directly; fights the collapse animation | |

**User's choice:** Hide handle when collapsed

**Follow-up: expand restore width**

| Option | Description | Selected |
|--------|-------------|----------|
| Restore last width | Re-expand returns to `sidebar_width` cookie value (or 256 default); the two contracts never fight | ✓ |
| Reset to default 256 | Always 256 on expand; discards user's chosen width | |

**User's choice:** Restore last width

**Follow-up: state sharing**

| Option | Description | Selected |
|--------|-------------|----------|
| Share shadcn open state | Collapse button drives `SidebarProvider`'s `setOpen` — same state as ⌘B + topbar; `sidebar_state` cookie preserved | ✓ |
| Separate collapse state | Independent state + own cookie; more surface to break | |

**User's choice:** Share shadcn open state
**Notes:** One source of truth; COLR-02 contract preserved; zero new cookies.

---

## Tooltip scope & content

| Option | Description | Selected |
|--------|-------------|----------|
| All interactive icons | 4 nav rows + feedback pill + user avatar + collapse button; letter-mark skipped (self-explanatory) | ✓ |
| Nav rows only | Per roadmap's literal wording; pill/avatar rely on Phase 12 aria-labels | |

**User's choice:** All interactive icons

**Follow-up: tooltip copy**

| Option | Description | Selected |
|--------|-------------|----------|
| Context-aware copy | Nav labels verbatim; Reviews = `Reviews (N)` when count > 0; pill = `Give us feedback`; avatar = display name; button = `Collapse`/`Expand` | ✓ |
| Base labels only | Reviews never shows count in rail | |

**User's choice:** Context-aware copy

**Follow-up: trigger behavior**

| Option | Description | Selected |
|--------|-------------|----------|
| Hover + focus, side right | Radix Tooltip default, ~200ms delay, side='right', app-theme portal (D4) | ✓ |
| Hover only | Pointer-only; keyboard users get no rail labels | |

**User's choice:** Hover + focus, side right

---

## Collapsed rail anatomy

| Option | Description | Selected |
|--------|-------------|----------|
| As pre-wired, letter-mark added | Header = button top-right + 28px letter-mark; nav icons-only; footer pill icon-only + avatar; dormant classes activated | ✓ |
| Letter-mark only, hide button | Overrides the always-visible choice to maximize icon space | |

**User's choice:** As pre-wired, letter-mark added

**Follow-up: letter-mark treatment**

| Option | Description | Selected |
|--------|-------------|----------|
| D1 spec verbatim | 28px rounded-md, `bg-sidebar-primary text-sidebar-primary-foreground`, dark #333 box + white 'A', Geist 600 13px | ✓ |
| Accent-toned variant | Gray #909090; weaker brand anchor; diverges from locked D1 | |

**User's choice:** D1 spec verbatim

**Follow-up: rail width**

| Option | Description | Selected |
|--------|-------------|----------|
| 48px rail, stock token | `--sidebar-width-icon: 3rem`, no override (D3); all elements fit with 8px gutters | ✓ |
| Widen to 56px | More breathing room but requires token change + Phase 10 re-verification | |

**User's choice:** 48px rail, stock token

---

## Claude's Discretion

- Animation timing/duration beyond the primitive's stock `transition-[width] duration-200`
- Exact tooltip delay within the ~200ms short-delay intent
- `collapsible="icon"` wiring mechanics at the `app-shell-layout.tsx`/`AppSidebar` boundary (vendored `sidebar.tsx` stays unedited)

## Deferred Ideas

- Mobile-sheet-specific collapse affordances — Phase 14 UAT matrix scope
- Rail-width customization (56px) — rejected; D3 locked 48px stock
- Replacing the topbar hamburger with the collapse button only — rejected; topbar `SidebarTrigger` stays
- Tooltips on the letter-mark — rejected; brand mark self-explanatory

---

*Phase: 13-collapse-resize-coexistence*
*Discussion log generated: 2026-08-01*
