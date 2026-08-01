# Phase 13: Collapse & Resize Coexistence — Research

**Researched:** 2026-08-01
**Domain:** shadcn vendored `Sidebar` `collapsible="icon"` activation + lucide collapse button + Radix tooltips in a 48px rail, coexisting with the frozen drag-resize/cookie contract
**Confidence:** HIGH (every mechanism verified against the actual repo files and the installed `lucide-react@1.26.0` / `radix-ui@1.6.5` packages in this session)

<user_constraints>
## User Constraints (from 13-CONTEXT.md — LOCKED, do NOT re-research or overturn)

### Locked Decisions

- **D-01:** The collapse button lives inside the sidebar's own header zone (top-right of the sidebar panel, in the `SidebarHeader` area) — NOT in the topbar (SidebarInset) and NOT replacing the existing `SidebarTrigger`. Exa-style: the control lives inside the sidebar chrome.
- **D-02:** The button is **always visible** (it does NOT self-hide into the rail) and swaps its icon by state: lucide `panel-left-close` when expanded (click → collapse to rail), `panel-left-open` when collapsed (click → expand). In the rail it stays mounted as a 32px square.
- **D-03:** Collapsed-header layout with the always-visible button: button at top-right (32px, `p-2`), the 28px letter-mark centered BELOW it. Header is a 2-row flex: button row + letter-mark row. No overlap, no inverted placement.
- **D-04:** The drag-resize handle **hides when collapsed**. The 48px rail is fixed-width with no resize affordance; resize is an expanded-state-only interaction. The handle's flex-sibling placement (outside the sidebar subtree) means hiding is via the same `collapsible`/`state` signal the rail uses.
- **D-05:** On re-expand, the sidebar **restores the last persisted `sidebar_width`** (or the 256px default when no cookie). The two contracts never fight: `sidebar_state` cookie governs expanded/collapsed; `sidebar_width` cookie only matters in expanded state.
- **D-06:** The collapse button drives **shadcn's existing open state** (`SidebarProvider`'s `setOpen`/`toggleSidebar`) — ONE source of truth shared with ⌘B and the topbar hamburger. The `sidebar_state` cookie + ⌘B wiring already shipped in the vendored `SidebarProvider` stays byte-identical (COLR-02 preserved). Zero new cookies.
- **D-07:** Tooltips appear on **all interactive icon-only elements** in the collapsed rail: the 4 nav rows, the feedback pill, the user avatar, and the collapse button. The letter-mark is self-explanatory (brand) — no tooltip.
- **D-08:** Context-aware copy: nav rows show their label verbatim (Start, Companies, Key Personas, Reviews); Reviews shows `Reviews (N)` when `pendingCount > 0` else `Reviews`; feedback pill shows `Give us feedback` (matches its Phase 12 aria-label); user avatar shows the display name (`getUserDisplayName`); collapse button shows `Collapse` / `Expand` by state.
- **D-09:** Tooltips trigger on **hover AND keyboard focus** (Radix Tooltip default), `side='right'`, short delay (~200ms). Uses the vendored `tooltip.tsx` (`bg-foreground text-background`, app-theme portal per D4) — zero edits, zero new deps.
- **D-10:** The rail composes the Phase 11-12 pre-wired dormant classes as-is, plus the letter-mark: header = collapse button top-right + 28px letter-mark centered below; nav = icons-only rows (primitive `size-8!`, active pill ≥3:1 via `data-active:bg-sidebar-accent`); footer = feedback pill icon-only + centered 24px avatar (names/dot hidden per Phase 12 pre-wiring).
- **D-11:** Letter-mark = the D1-locked treatment verbatim: 28px `rounded-md` box, `bg-sidebar-primary text-sidebar-primary-foreground` (dark `#333333` box, white "A" glyph, Geist 600 13px). Shown when `group-data-[collapsible=icon]`, hidden in expanded (wordmark shows instead).
- **D-12:** Collapsed rail width = **48px**, stock `--sidebar-width-icon: 3rem`, no override (D3 locked). Header `p-2`, button 32px, letter-mark 28px, nav rows 32px, pill 32px, avatar 24px — all fit with 8px gutters.

### Claude's Discretion

- Animation timing/duration details beyond the primitive's stock `transition-[width] duration-200` (keep stock unless a reason emerges)
- Exact tooltip delay value within the ~200ms short-delay intent
- The `collapsible="icon"` wiring mechanics on the vendored `<Sidebar>` (whether via a prop change at the `app-shell-layout.tsx`/`AppSidebar` boundary — vendored `sidebar.tsx` itself must stay unedited per hard constraints)

### Deferred Ideas (OUT OF SCOPE — ignore during planning)

- Mobile-sheet-specific collapse affordances beyond the stock shadcn sheet behavior — Phase 14 UAT matrix will verify the mobile sheet; mobile collapse behavior stays stock unless the audit demands otherwise
- Rail-width customization (e.g., 56px) — rejected; D3 locked 48px stock
- Replacing the topbar hamburger with the collapse button only — rejected (D-01: header placement chosen; topbar `SidebarTrigger` stays for ⌘B affordance)
- Tooltips on the letter-mark — rejected (D-07: brand mark is self-explanatory)

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COLR-01 | Collapse button (lucide `panel-left-close`, top-right) collapses the sidebar to an icon rail with a width animation — labels fade while icons stay (Exa behavior) | `collapsible="icon"` prop on `<Sidebar>` (app-sidebar.tsx:56 — the single instantiation) activates the vendored dormant mechanism: `data-collapsible={state === "collapsed" ? collapsible : ""}` (sidebar.tsx:211) drives `group-data-[collapsible=icon]:w-(--sidebar-width-icon)` (sidebar.tsx:225/236), label fades (`SidebarGroupLabel` sidebar.tsx:404), menu-button `size-8!` (sidebar.tsx:469). Button = `Button size="icon"` (32px, button.tsx:29) with `useSidebar().toggleSidebar()` (sidebar.tsx:91-93) + `PanelLeftClose`/`PanelLeftOpen` swap (verified exports, lucide-react@1.26.0). Width animates via the primitive's stock `transition-[width] duration-200` |
| COLR-02 | Collapse coexists with drag-to-resize — the 200-400px clamp, `sidebar_width` cookie persistence, and the ⌘B toggle (`sidebar_state` cookie) all continue to work unchanged | D-06 verified: the button calls the existing `toggleSidebar` — the vendored `setOpen` writes `sidebar_state` (sidebar.tsx:84-85) byte-identical; ⌘B handler untouched (sidebar.tsx:96-109). Width restore (D-05) is automatic: `--sidebar-width` is threaded from the `sidebar_width` cookie (app-shell-layout.tsx:18-22,35) and the collapse only swaps the CSS width class, never the var (sidebar.tsx:225/236). Resize handle (sidebar.tsx clamp 200-400, cookie write) is READ-ONLY except the D-04 hide via `useSidebar()` |
| COLR-03 | Collapsed rail keeps nav legibility — ≥3:1 active pill, per-item tooltips (Reviews tooltip includes the pending count), and a collapsed letter-mark logo form | Active pill = primitive `data-active:bg-sidebar-accent` (#909090, 3.11:1 — QLTY-02 pre-verified) active in the rail (data-active is state-independent). Tooltips = `SidebarMenuButton` `tooltip` prop (sidebar.tsx:490-538) renders `TooltipContent hidden={state !== "collapsed" \|\| isMobile} side="right"` — zero new code; Reviews count via `tooltip={pendingCount > 0 ? \`Reviews (${pendingCount})\` : 'Reviews'}` (copy contract locked in 10-UI-SPEC). Letter-mark = D-11 tokens (`bg-sidebar-primary text-sidebar-primary-foreground` 12.63:1, globals.css:90-91) with the Phase 11/12 dormant-toggle precedent |

</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

Actionable directives from `./CLAUDE.md` that constrain Phase 13 planning/implementation:

- **GSD workflow enforcement:** start work through a GSD command (`/gsd-plan-phase 13`, then `/gsd-execute-phase`) — no direct repo edits outside the workflow; `commit_docs: true` in config.
- **Naming/conventions:** named exports only (no default exports — the `src/lib/sanity.ts` precedent); `interface` for object shapes, `type` for unions; camelCase; prefer relative imports in edited files; `@/*` alias available for new files (optional).
- **Strict TypeScript:** `tsconfig.json` extends strict; `npx tsc --noEmit` is the per-task static gate.
- **Stack:** TypeScript + React/Next (App Router) + Tailwind v4; no separate backend language; single-file-diff discipline per Phase 11/12 precedent.
- **Error handling:** fail-safe, fail-silent toward a known-good UI state — the resize-handle cookie parse and `pendingCount` fallback patterns already follow this; new code must not introduce unhandled rejections.
- **Comment style:** comments explain *why*, not *what*; keep why-comments free of swept class/copy strings (11-02 Rule 1, QLTY-04).
- **Repo state caution:** `packageManager` declares Yarn Classic but README/npm usage and `package-lock.json` are present — use **npm** for any local install (none expected this phase; package.json diffs must be empty).

This research does not recommend anything contradicting the above (zero installs, named exports in the optional helper, token-only styling, GSD workflow entry).

---

## Summary

Phase 13 flips a single dormant switch and then composes already-shipped machinery. The vendored `Sidebar` component (`src/components/ui/sidebar.tsx`) has had the complete icon-rail collapse system dormant since Phase 10 — `collapsible?: "offcanvas" | "icon" | "none"` (sidebar.tsx:162), `group-data-[collapsible=icon]:` width/label/tooltip classes, the `--sidebar-width-icon: 3rem` token — and every Phase 11/12 class was deliberately pre-wired to fire under it. The entire activation is **one prop**: `collapsible="icon"` on the single `<Sidebar>` instantiation at `app-sidebar.tsx:56`. The outer div's `data-collapsible={state === "collapsed" ? collapsible : ""}` (sidebar.tsx:211) means that when the sidebar is collapsed (via ⌘B, the topbar `SidebarTrigger`, OR the new header button — all the same `toggleSidebar`) and `collapsible="icon"`, the `group` div matches every `group-data-[collapsible=icon]:` selector: gap and container snap to 48px (`w-(--sidebar-width-icon)`), nav rows become `size-8!` icon boxes, group labels fade, the count badge hides and the Phase 12 Reviews dot appears, and tooltips arm. No edits to the vendored file, no new CSS, no new packages.

The collapse button, tooltips, letter-mark, and resize-handle hide are all consumer-side work in the phase's own files. `useSidebar()` (sidebar.tsx:46-53) is callable from `AppSidebar` and `SidebarResizeHandle` — both render inside `SidebarProvider` (app-shell-layout.tsx:35-42) — so the button drives the shared open state (D-06) and the handle can early-return when `state === 'collapsed'` (D-04). The nav-row tooltips come from the `SidebarMenuButton` `tooltip` prop (sidebar.tsx:490-538), which already wraps the button in `TooltipTrigger` and renders `TooltipContent side="right" hidden={state !== "collapsed" || isMobile}` — D-07/D-08/D-09's mechanism with zero new code. **One real gap surfaced:** the vendored `TooltipProvider` (tooltip.tsx:8-19) is defined but **never mounted anywhere** in `src/` (grep-verified), so today's Radix tooltips would run at Radix's default 700ms delay — D-09's ~200ms requires mounting `<TooltipProvider delayDuration={200}>` (usage of the vendored export, not an edit) wrapping `<Sidebar>` in app-sidebar.tsx.

Width-restore (D-05) needs **zero code**: `app-shell-layout.tsx:35` threads the clamped `sidebar_width` cookie into `--sidebar-width` on the provider, the provider's `...style` spread wins over its `16rem` default (sidebar.tsx:132-138), and collapse only swaps the CSS width class (`group-data-[collapsible=icon]:w-(--sidebar-width-icon)`, sidebar.tsx:225/236) — the var is untouched while collapsed, so re-expand returns to the last persisted width automatically. The two contracts never fight.

**Primary recommendation:** a 1-2 plan split on the Phase 11/12 single-file precedent — (1) `collapsible="icon"` + header restructure (button + letter-mark + TooltipProvider) + nav/pill/user tooltip props in `app-sidebar.tsx`, (2) `sidebar-resize-handle.tsx` collapse-hide via `useSidebar()` + optional `src/lib/sidebar-collapse.ts` pure-label helper with a Vitest lock + full grep/fence/build regression battery. Keep `app-shell-layout.tsx`, all vendored primitives, `globals.css`, and `package.json` byte-identical.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Collapse toggle (button + shared open state) | Browser / Client | — | `useSidebar().toggleSidebar()` flips the existing React state; the button is pure client chrome inside `SidebarHeader` |
| Rail width animation / layout | Browser / Client (CSS) | — | Vendored `group-data-[collapsible=icon]:` classes + stock `transition-[width] duration-200`; zero new CSS, zero JS per-pixel |
| Collapsed-rail tooltips | Browser / Client (Radix, portal to body) | — | `SidebarMenuButton` `tooltip` prop + one `TooltipProvider` mount; D4 portal policy (portaled, app-theme, zero tooltip.tsx edits) |
| Resize-handle hide (D-04) | Browser / Client | — | `useSidebar().state` early-return in the existing client handle component; flex-sibling layout unaffected (gap div reserves width) |
| `sidebar_state` cookie + ⌘B | Browser / Client | — | Frozen: vendored `setOpen` writes the cookie (sidebar.tsx:84-85), ⌘B handler untouched (96-109). The new button is just another caller of the same `toggleSidebar` |
| `sidebar_width` cookie → `--sidebar-width` | Frontend Server | Browser / Client (CSS var) | Frozen: `app-shell-layout.tsx` (server) reads the clamped cookie and threads the var; restore-on-expand is automatic via the class switch |
| Letter-mark ⇄ wordmark swap | Browser / Client (CSS) | — | Dormant `group-data-[collapsible=icon]:` toggle activation; token-only presentation |
| `pendingCount` (Reviews badge/dot/tooltip copy) | API / Backend (DB) | Browser / Client (prop) | Frozen server thread (app-shell-layout.tsx:27-32); Phase 13 only consumes it for the tooltip string |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| shadcn `sidebar` primitive (vendored) | via `radix-ui@^1.6.5` | `Sidebar` `collapsible="icon"` rail + `SidebarMenuButton` `tooltip` prop + `useSidebar()` | Already vendored (`src/components/ui/sidebar.tsx`, 702 lines), **not to be edited** (hard constraint). The full rail mechanism is dormant inside it; Phase 13 only activates via the prop and consumes its hooks |
| `useSidebar()` (sidebar.tsx:46-53) | — | `state`, `setOpen`, `toggleSidebar` for the collapse button + resize-handle hide | The one source of truth (D-06); throws outside `SidebarProvider` — both consumers (`AppSidebar`, `SidebarResizeHandle`) are inside the provider (app-shell-layout.tsx:35-42), verified |
| shadcn `tooltip` primitives (vendored) | via `radix-ui@^1.6.5` | `TooltipProvider` (delay mount) + manual `Tooltip`/`TooltipTrigger`/`TooltipContent` for the collapse-button tooltip | Already vendored (`tooltip.tsx`, 57 lines); `bg-foreground text-background` app-theme portal per D4. **Not to be edited** — mounting is usage |
| lucide-react | `1.26.0` (installed) | `PanelLeftClose` / `PanelLeftOpen` (collapse button), existing `Mail`/`LayoutDashboard`/`Building2`/`Users`/`Inbox` (nav/pill) | Both icons verified as `ForwardRefExoticComponent` exports in the installed package (d.ts + runtime). Monochrome `currentColor` convention |
| shadcn `button` primitive (vendored) | via `radix-ui@^1.6.5` | `Button variant="ghost" size="icon"` = 32px collapse-button box | Already vendored (button.tsx:29 `icon: "size-8"`); auto-sizes child svg to 16px (button.tsx:8). Mirrors the existing `SidebarTrigger` pattern (sidebar.tsx:253-277) |
| Vitest | `4.1.10` (installed) | Unit lock on extracted pure tooltip/label helpers (optional) | Precedent: `nav.test.ts` (11 cases), `user.test.ts` (8 cases); `--bail=1`, NOT `-x` (Vitest 4 removed the alias) |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `getUserDisplayName` / `getUserInitials` (`@/lib/user`) | — | Avatar tooltip copy + existing aria-label | Already extracted + tested (Phase 12); the avatar tooltip consumes `getUserDisplayName(user)` verbatim |
| `getActiveNavKey` / `NavKey` (`@/lib/nav`) | — | Nav-row tooltip labels keyed by route | Already extracted + tested (Phase 10); a tooltip-label helper can consume `NavKey` for type safety |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `collapsible="icon"` hardcoded on `<Sidebar>` in `app-sidebar.tsx` (recommended) | Thread a `collapsible` prop from `app-shell-layout.tsx` through `AppSidebar` | The shell is a frozen contract; threading adds an indirection with zero consumers and touches a protected file. Hardcoding is a one-line change in the phase's own file |
| Early-return hide on the resize handle | Conditional `hidden` class on the existing div | Early return is simpler (no `cn` import, DOM fully removed, no cursor affordance in the rail — D-04 intent) and re-mounts fresh on expand (no stale refs) |
| Mount `TooltipProvider delayDuration={200}` in `app-sidebar.tsx` (recommended) | Mount in `app-shell-layout.tsx` (server imports client — works) | Both are usage, not edits; app-sidebar keeps the diff in the phase's file and the provider adjacent to its consumers |
| Extract `src/lib/sidebar-collapse.ts` pure label helpers (recommended) | Inline ternaries in `app-sidebar.tsx` | Inline is fewer files; extraction locks the D-08 contract copy (`Reviews (N)`, `Collapse`/`Expand`) with Vitest per the Phase 10/12 convention. Planner's call — both acceptable |
| `Button size="icon"` (32px) for the collapse button | `Button size="icon-sm"` (28px, SidebarTrigger's size) | D-02/D-12 lock 32px with `p-2` gutters; `size="icon"` is exactly 32px |

**Installation:**
```bash
# ZERO installs this phase. lucide-react, radix-ui, @clerk/nextjs, vitest, tailwindcss all already installed.
# No package.json changes, no npm install, no npx shadcn add — package.json/package-lock.json diffs must be empty.
```

**Version verification:** `lucide-react@1.26.0` (package.json in node_modules) with `PanelLeftClose`/`PanelLeftOpen` verified as top-level exports (d.ts: `declare const PanelLeftClose: react.ForwardRefExoticComponent<...>` + runtime `typeof === 'object'`). `vitest@4.1.10` per package.json (the `-x` flag is removed — use `--bail=1`, documented in 12-01-SUMMARY Deviation 1). Node v22.23.1. `npx tsc --noEmit` currently exit 0.

## Package Legitimacy Audit

> This phase installs **zero packages** — runtime or dev (hard constraint: "zero new npm packages"; 10-UI-SPEC §Registry Safety). The Package Legitimacy Gate is therefore **N/A by exemption** — no slopcheck run required, no registry verification needed. The plan must NOT add any dependency; a `package.json` diff should be empty.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| — (no packages installed this phase) | — | — | — | — | N/A | N/A — zero installs |

**Packages removed due to slopcheck [SLOP] verdict:** none (nothing installed)
**Packages flagged as suspicious [SUS]:** none (nothing installed)

*Note: every library referenced above is an already-installed dependency (`package.json`) consumed through its existing installed artifact — no registry action of any kind this phase. `lucide-react` icons were verified inside the installed `node_modules` artifact, not via registry lookup.*

## Architecture Patterns

### System Architecture Diagram

```text
┌─ src/app/(dashboard|companies|personas)/layout.tsx ──────────────┐
│  requireStaffAccess()  →  <AppShellLayout>                      │
└───────────────────────────────┬─────────────────────────────────┘
                                ▼
┌─ app-shell-layout.tsx (server, FROZEN this phase) ───────────────┐
│  sidebar_width cookie → clamp 200-400 → --sidebar-width style    │
│  pendingCount = countPendingProposals()  → prop                  │
│  <SidebarProvider style={{'--sidebar-width': …}}>                │
└───────────────┬──────────────────────────┬───────────────────────┘
                ▼                          ▼
┌─ app-sidebar.tsx (client — Phase 13 EDITS) ─┐   ┌─ sidebar-resize-handle.tsx ─┐
│  <TooltipProvider delayDuration={200}>       │   │  (client — D-04 edit)       │
│   <Sidebar collapsible="icon">               │   │  const { state } = useSidebar()│
│    Header:  [button row: collapse btn        │   │  if (state === 'collapsed')  │
│             (toggleSidebar + icon swap +     │   │      return null             │
│             Collapse/Expand tooltip)]        │   │  …drag contract UNCHANGED:  │
│             [letter-mark row: wordmark       │   │  200-400 clamp, sidebar_width│
│             (Q4 fade) ⇄ 28px "A" box]        │   │  cookie, --sidebar-width     │
│    Content: 4 nav rows + Reviews badge/dot   │   │  imperative write            │
│             + tooltip prop on each row       │   └──────────────┬───────────────┘
│    Footer:  pill (icon-only, tooltip)        │                  ▼
│             + user dropdown (tooltip=name)   │   ┌─ sidebar.tsx (vendored, FROZEN) ┐
│   </Sidebar>                                 │   │  data-collapsible="icon" (when  │
│  </TooltipProvider>                          │   │  collapsed) → group-data-       │
└──────────────────────────────────────────────┘   │  [collapsible=icon]:* activate: │
                                                    │  48px width, label fade, size-8!│
                                                    │  badge hidden, tooltip armed,  │
                                                    │  ⌘B + sidebar_state cookie     │
                                                    └────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── components/
│   └── layout/
│       ├── app-sidebar.tsx            # Phase 13 edits: collapsible="icon", TooltipProvider, header restructure (button + letter-mark), tooltip props
│       └── sidebar-resize-handle.tsx  # Phase 13 edit: useSidebar() + collapsed early-return (D-04) — clamp/cookie untouched
├── lib/
│   └── sidebar-collapse.ts (OPTIONAL) # pure label helpers: getCollapseToggleLabel(state), getNavTooltipLabel(key, pendingCount)
│   └── sidebar-collapse.test.ts (OPTIONAL) # Vitest lock on D-08 copy
└── components/ui/sidebar.tsx          # FROZEN — READ ONLY (collapsible prop, tooltip mechanism, useSidebar, badge/dot classes live here)
```

### Pattern 1: The `collapsible="icon"` activation switch
**What:** One prop on the vendored `Sidebar` flips the whole dormant rail system on. The outer div carries `group` (sidebar.tsx:209) and `data-collapsible={state === "collapsed" ? collapsible : ""}` (sidebar.tsx:211) — so `group-data-[collapsible=icon]:` selectors match exactly when (a) the sidebar is collapsed AND (b) `collapsible="icon"`. Today (default `"offcanvas"`) the sidebar hides entirely when collapsed; with `"icon"` it snaps to the 48px rail.
**When to use:** Any phase that must add collapse without touching the vendored primitive.
**Example (app-sidebar.tsx:56):**
```jsx
<Sidebar collapsible="icon">   {/* was <Sidebar> — offcanvas default */}
  ...
</Sidebar>
```
Source: verified against `src/components/ui/sidebar.tsx:151-251` in this session.

### Pattern 2: `SidebarMenuButton` `tooltip` prop — the built-in rail tooltip
**What:** Passing `tooltip` to a `SidebarMenuButton` wraps it in `Tooltip`/`TooltipTrigger` and renders `TooltipContent side="right" align="center" hidden={state !== "collapsed" || isMobile}` — i.e., the tooltip is armed only in the desktop collapsed rail. D-07's "all interactive rail elements" map exactly onto the six `SidebarMenuButton`s already in `app-sidebar.tsx` (4 nav rows, pill, user trigger).
**When to use:** Every collapsed-rail tooltip that hangs off a `SidebarMenuButton`.
**Example (app-sidebar.tsx, nav rows + pill + user trigger):**
```jsx
<SidebarMenuButton asChild isActive={...} className="h-[30px] ..." tooltip="Start">
  <Link href="/"><LayoutDashboard /><span>Start</span></Link>
</SidebarMenuButton>
{/* Reviews — D-08 context-aware copy */}
<SidebarMenuButton asChild isActive={...} className="h-[30px] ..."
  tooltip={pendingCount > 0 ? `Reviews (${pendingCount})` : 'Reviews'}>
  <Link href="/reviews"><Inbox /><span>Reviews</span></Link>
</SidebarMenuButton>
{/* pill */}
<SidebarMenuButton asChild className="h-9 ..." tooltip="Give us feedback">
  <a href={FEEDBACK_MAILTO} aria-label="Give us feedback">...</a>
</SidebarMenuButton>
{/* user trigger — D-08 */}
<SidebarMenuButton size="lg" aria-label={getUserDisplayName(user)} tooltip={getUserDisplayName(user)} className="gap-2.5 group-data-[collapsible=icon]:justify-center">
  ...
</SidebarMenuButton>
```
Source: verified against `sidebar.tsx:490-538` (tooltip prop → TooltipContent `hidden` gate) and the existing `app-sidebar.tsx` rows in this session.

### Pattern 3: The collapse button — shared state, icon swap, manual tooltip
**What:** A 32px `Button size="icon"` in the header calls `toggleSidebar()` (D-06 — same state as ⌘B/topbar), swaps `PanelLeftClose`/`PanelLeftOpen` by `state`, and — because it is NOT a `SidebarMenuButton` — gets its tooltip from a manual `Tooltip` wrapper that shows in BOTH states (unlike the rail-only nav tooltips).
**When to use:** Any in-sidebar control that toggles the provider's open state.
**Example (inside `SidebarHeader`, app-sidebar.tsx):**
```jsx
'use client';
// inside AppSidebar:
const { state, toggleSidebar } = useSidebar();
...
<SidebarHeader className="gap-1 p-2">        {/* D-12: p-2 (was p-3) */}
  <div className="flex justify-end">          {/* D-03 row 1: button top-right */}
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon"
          aria-label={state === 'collapsed' ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={toggleSidebar}
          className="text-sidebar-foreground">
          {state === 'collapsed' ? <PanelLeftOpen /> : <PanelLeftClose />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">{state === 'collapsed' ? 'Expand' : 'Collapse'}</TooltipContent>
    </Tooltip>
  </div>
  ...
</SidebarHeader>
```
Source: `useSidebar` contract sidebar.tsx:46-53 + `toggleSidebar` 91-93; icons verified in installed `lucide-react@1.26.0`.

### Pattern 4: Resize-handle hide via `useSidebar()` early return
**What:** The handle is a flex sibling inside `SidebarProvider`, so it can read `state` directly and disappear when collapsed — no context threading, no CSS tricks.
**When to use:** Hiding a sibling of `<Sidebar>` based on collapse state.
**Example (sidebar-resize-handle.tsx):**
```tsx
'use client';
import { useSidebar } from '@/components/ui/sidebar';

export function SidebarResizeHandle() {
  const { state } = useSidebar();
  if (state === 'collapsed') return null;   // D-04: no resize affordance in the 48px rail
  // ...existing drag contract (200-400 clamp, sidebar_width cookie) unchanged...
}
```
Source: provider containment verified at app-shell-layout.tsx:35-42; layout stability from the gap div (sidebar.tsx:217-227).

### Pattern 5: Letter-mark swap in the header slot
**What:** The D-11 letter-mark is a token-styled 28px box that toggles with the Phase 11/12 dormant pattern (`hidden group-data-[collapsible=icon]:flex`) in the header row below the collapse button, while the wordmark block keeps its Q4 fade class verbatim (D-10 "as-is").
**Example (app-sidebar.tsx, header row 2):**
```jsx
<div className="flex flex-col gap-1">
  {/* D-11 letter-mark — 28px, tokens only, 12.63:1 (aria-hidden: the faded wordmark
      below remains in the accessibility tree, so the mark is decorative) */}
  <div aria-hidden="true"
       className="hidden size-7 items-center justify-center rounded-md bg-sidebar-primary
                  text-sidebar-primary-foreground text-[13px] font-semibold
                  group-data-[collapsible=icon]:flex">
    A
  </div>
  {/* Q4 wordmark block — class list VERBATIM from Phase 12 (do not edit) */}
  <div className="group-data-[collapsible=icon]:opacity-0 transition-opacity duration-200">
    <p className="text-[15px] font-semibold text-sidebar-foreground">ArcLumen 360</p>
    <p className="text-xs font-normal text-sidebar-foreground/70">ArcLumen Partners</p>
  </div>
</div>
```
Source: D-11 token pair verified in globals.css:90-91; dormant-toggle precedent verified at app-sidebar.tsx:146-150 (pill) and 128-131 (Reviews dot).

### Anti-Patterns to Avoid
- **Editing the Q4 wordmark fade class:** `group-data-[collapsible=icon]:opacity-0 transition-opacity duration-200` is a locked Phase 12 contract (D-10 "pre-wired classes as-is"). Note opacity-0 retains layout space — the faded wordmark keeps ~40px in the rail. Order the letter-mark before it (as in Pattern 5) so it sits immediately below the button per D-03; do NOT switch the wordmark to `hidden` (kills the fade) or overlap it (D-03 "no overlap").
- **Adding `aria-hidden`-less decorative chrome:** the letter-mark "A" must be `aria-hidden` because the wordmark text stays in the a11y tree (opacity-0); a second brand announcement is noise.
- **New CSS or new state machinery:** the rail is 100% dormant-class activation + existing hooks. Any new width/animation CSS or a second cookie would violate COLR-02 and D-06.
- **Putting the collapse button in the topbar:** D-01 locks the header placement; the topbar `SidebarTrigger` stays as the ⌘B affordance.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Collapsed-rail width/label-fade/animation | Custom CSS + custom state | `collapsible="icon"` on the vendored `Sidebar` | The primitive ships `group-data-[collapsible=icon]:w-(--sidebar-width-icon)`, `transition-[width] duration-200`, label fades, and `--sidebar-width-icon: 3rem` — byte-tested dormant machinery (sidebar.tsx:207-251). Hand-rolling duplicates it and drifts from the frozen contract |
| Rail tooltips per nav row | Custom tooltip components / context | `SidebarMenuButton` `tooltip` prop | sidebar.tsx:527-536 already gates on `state !== "collapsed" || isMobile`, defaults `side="right"`, and portals via the vendored D4 `TooltipContent`. One prop per row |
| Tooltip delay timing | Re-implementing a timer | Mount the vendored `TooltipProvider` with `delayDuration` | Radix owns hover/focus trigger + delay; the vendored provider exists (tooltip.tsx:8-19) but is currently never mounted, so tooltips would run at Radix's 700ms default — a `delayDuration={200}` mount fixes D-09 with zero edits |
| Collapse/open state sharing | New state, new cookie, sync logic | `useSidebar().toggleSidebar` / `setOpen` | The provider already owns `open`/`state`, the `sidebar_state` cookie write, and the ⌘B handler. The button is one more caller (D-06) |
| Width restore on expand | Reading/writing width on toggle | The existing `--sidebar-width` var thread | Collapse only swaps the CSS width class; the cookie-threaded var is untouched while collapsed → restore is automatic (D-05) |

**Key insight:** every "hard part" of collapse was shipped dormant in Phases 10-12. Phase 13 is consumer work: one prop, one provider mount, props and classes on existing elements, and a two-line hide on the resize handle. Any plan task that proposes new CSS, new state, or a new cookie is building something the primitive already provides — reject it.

## Common Pitfalls

### Pitfall 1: Leaving `collapsible` at its `"offcanvas"` default
**What goes wrong:** ⌘B and the new button collapse the sidebar but it *hides entirely* (offcanvas slide-out) — no 48px rail, no letter-mark, no tooltips; the dormant `group-data-[collapsible=icon]:` classes stay inert and every Phase 11/12 pre-wire appears dead.
**Why it happens:** `Sidebar` defaults to `collapsible="offcanvas"` (sidebar.tsx:154) and `data-collapsible` only carries the `"icon"` value when the prop is set AND the state is collapsed (sidebar.tsx:211).
**How to avoid:** `collapsible="icon"` on `<Sidebar>` at app-sidebar.tsx:56 — the phase's single activation point. Verify with a grep gate (`collapsible="icon"` = 1) and by rendering.
**Warning signs:** collapsed state shows a 0-width/off-canvas sidebar instead of a 48px rail.

### Pitfall 2: Forgetting the TooltipProvider mount → 700ms tooltips
**What goes wrong:** Nav-row tooltips "work" but feel laggy; D-09's ~200ms intent missed.
**Why it happens:** `TooltipProvider` is defined but never mounted (grep = 0 usages in `src/`); unprovided Radix `Tooltip.Root`s fall back to the 700ms default delay.
**How to avoid:** mount `<TooltipProvider delayDuration={200}>` wrapping `<Sidebar>` in app-sidebar.tsx (usage of the vendored export — constraint-compliant). The collapse-button tooltip needs the same provider.
**Warning signs:** tooltips appear noticeably late on hover.

### Pitfall 3: Grep-gate arithmetic drift on shared token strings
**What goes wrong:** The plan's verification counts miss: `bg-sidebar-primary`/`text-sidebar-primary-foreground` already appear in the Phase 12 avatar initials circle (app-sidebar.tsx:173); `group-data-[collapsible=icon]:block` already appears on the Reviews dot (app-sidebar.tsx:130) and the pill icon (app-sidebar.tsx:149); `font-semibold` is on 2 group labels + badge.
**Why it happens:** Phase 13 adds more instances of strings that already exist in the file (11-02 "Issues Encountered" documents the identical class of problem).
**How to avoid:** line-scope new-content gates (e.g., `grep -c 'tooltip="'` per row; letter-mark check scoped to its div) or assert new composite strings; follow 11-02 Rule 1 comment hygiene (no swept class strings in why-comments).
**Warning signs:** a "PASS" gate asserting 1 instance of a string that legitimately now appears 2-3 times.

### Pitfall 4: Breaking the wordmark fade while restyling the header
**What goes wrong:** In restructuring the header for the button + letter-mark, someone converts the Q4 fade (`group-data-[collapsible=icon]:opacity-0 transition-opacity duration-200`) to `hidden` — the swap animation dies, or the header p-3→p-2 (D-12) change misses and the 32px button/28px letter-mark no longer fit the 48px rail with 8px gutters.
**Why it happens:** The fade class is subtle; p-3 vs p-2 is a one-char diff.
**How to avoid:** fence-gate the wordmark block's class list verbatim; verify header is `p-2` (D-12); keep the button row and letter-mark row as separate flex rows (no overlap, D-03).
**Warning signs:** grep shows the wordmark fade class modified or missing; header padding ≠ `p-2`.

### Pitfall 5: Resize handle fighting the collapsed width
**What goes wrong:** If the handle stays mounted when collapsed, it either leaves a stray hover cursor at the rail edge, or a drag writes `--sidebar-width` mid-collapse and the icon-rail width glitches on expand.
**Why it happens:** The handle's imperative `style.setProperty('--sidebar-width', …)` (sidebar-resize-handle.tsx:27) writes the var the collapse switch depends on.
**How to avoid:** early-return when `state === 'collapsed'` (D-04) — the handle cannot be interacted with while collapsed, so no writes occur; the var stays at its cookie value for the automatic restore (D-05).
**Warning signs:** drag cursor visible on the collapsed rail; width jumps after collapse→expand.

### Pitfall 6: Tooltip on the dropdown-triggered user button misbehaving
**What goes wrong:** The user trigger is `DropdownMenuTrigger asChild > SidebarMenuButton tooltip={displayName}` — nested Slot composition (DropdownMenu.Trigger clones the SidebarMenuButton whose own output wraps the button in TooltipTrigger).
**Why it happens:** Two Radix `asChild` boundaries stack. React 19 (installed 19.2.4) passes refs as regular props, so the trigger props flow through to the inner button — the documented shadcn composition — but it is the one interaction not pre-verified in the repo.
**How to avoid:** implement per Pattern 2 and runtime-verify (hover in the rail shows the name; click opens the dropdown). Fallback if Slot-in-Slot misbehaves: wrap the `DropdownMenu` in its own manual `Tooltip` at the `DropdownMenuTrigger` level instead of using the `tooltip` prop.
**Warning signs:** dropdown fails to open, or ref/event-handler warning in the console.

## Code Examples

Verified patterns from the installed/vendored sources:

### Activating the rail (the whole phase in one prop)
```jsx
// src/components/layout/app-sidebar.tsx:56 — the ONLY instantiation of <Sidebar>
<Sidebar collapsible="icon">
```
Source: verified `Sidebar` props at `src/components/ui/sidebar.tsx:151-163`; single instantiation grep-verified across `src/`.

### TooltipProvider mount for the ~200ms delay (D-09)
```jsx
// src/components/layout/app-sidebar.tsx — wrap the Sidebar in the vendored provider
import { TooltipProvider } from '@/components/ui/tooltip';
...
return (
  <TooltipProvider delayDuration={200}>
    <Sidebar collapsible="icon">…</Sidebar>
  </TooltipProvider>
);
```
Source: vendored `TooltipProvider` default `delayDuration = 0` (tooltip.tsx:8-19) — the prop overrides it; never mounted anywhere in `src/` today (grep-verified).

### Collapse-button icon swap (D-02) with the built-in tooltip mechanism (D-08)
```jsx
const { state, toggleSidebar } = useSidebar(); // inside AppSidebar (inside SidebarProvider)
...
<Tooltip>
  <TooltipTrigger asChild>
    <Button variant="ghost" size="icon" onClick={toggleSidebar}
      aria-label={state === 'collapsed' ? 'Expand sidebar' : 'Collapse sidebar'}>
      {state === 'collapsed' ? <PanelLeftOpen /> : <PanelLeftClose />}
    </Button>
  </TooltipTrigger>
  <TooltipContent side="right">{state === 'collapsed' ? 'Expand' : 'Collapse'}</TooltipContent>
</Tooltip>
```
Source: `toggleSidebar` (sidebar.tsx:91-93), `Button size="icon"` = `size-8` (button.tsx:29), icons verified in installed lucide-react.

### Resize-handle collapse hide (D-04)
```tsx
import { useSidebar } from '@/components/ui/sidebar';
export function SidebarResizeHandle() {
  const { state } = useSidebar();
  if (state === 'collapsed') return null;
  // …existing MIN_WIDTH/MAX_WIDTH clamp, COOKIE_NAME write, imperative --sidebar-width — UNCHANGED
}
```
Source: provider containment app-shell-layout.tsx:35-42; current handle contract sidebar-resize-handle.tsx (91 lines).

### Optional pure helper + test (locks D-08 copy)
```ts
// src/lib/sidebar-collapse.ts (optional — precedent: nav.ts / user.ts)
import type { NavKey } from '@/lib/nav';

export function getCollapseToggleLabel(state: 'expanded' | 'collapsed'): 'Collapse' | 'Expand' {
  return state === 'collapsed' ? 'Expand' : 'Collapse';
}

export function getNavTooltipLabel(key: NavKey, pendingCount: number): string {
  if (key === 'reviews') return pendingCount > 0 ? `Reviews (${pendingCount})` : 'Reviews';
  return { start: 'Start', companies: 'Companies', personas: 'Key Personas' }[key];
}
```
```ts
// src/lib/sidebar-collapse.test.ts — 10-UI-SPEC Copywriting Contract lock (Reviews (N))
import { describe, expect, it } from 'vitest';
import { getCollapseToggleLabel, getNavTooltipLabel } from './sidebar-collapse';

describe('getNavTooltipLabel', () => {
  it('returns the verbatim label for non-Reviews keys', () => {
    expect(getNavTooltipLabel('start', 0)).toBe('Start');
    expect(getNavTooltipLabel('companies', 5)).toBe('Companies');
    expect(getNavTooltipLabel('personas', 0)).toBe('Key Personas');
  });
  it('shows Reviews (N) only when pendingCount > 0', () => {
    expect(getNavTooltipLabel('reviews', 0)).toBe('Reviews');
    expect(getNavTooltipLabel('reviews', 3)).toBe('Reviews (3)');
  });
});
describe('getCollapseToggleLabel', () => {
  it('maps state to the D-08 copy', () => {
    expect(getCollapseToggleLabel('expanded')).toBe('Collapse');
    expect(getCollapseToggleLabel('collapsed')).toBe('Expand');
  });
});
```
Source: contract copy verbatim from 10-UI-SPEC §Copywriting Contract ("Collapsed-rail tooltip (Phase 13): `"Reviews ({n})"` when `pendingCount > 0`, else `"Reviews"`") and D-08.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ⌘B / topbar hamburger collapse hides the sidebar entirely (`collapsible="offcanvas"` — the current default) | `collapsible="icon"` — collapse snaps to a 48px icon rail with animated width, faded labels, tooltips | Phase 13 (this phase) | The dormant `group-data-[collapsible=icon]:` system (shipped dormant in Phases 10-12) activates; Exa-style rail behavior with zero new CSS |
| Nav-row collapsed legibility = nothing (rail never existed) | Per-item Radix tooltips (hover + focus, ~200ms, side-right), Reviews dot + `Reviews (N)` tooltip, letter-mark, ≥3:1 active pill | Phase 13 | COLR-03 legibility contract; keyboard users get labels too (focus-triggered tooltips) |

**Deprecated/outdated:**
- The v1.1 `-x` vitest flag: removed in Vitest 4 — use `--bail=1` (Phase 12 Deviation 1, verified in this repo's execution history).
- The "collapse = full hide" mental model: `offcanvas` remains valid for mobile sheets (stock), but desktop collapse now means the icon rail.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Radix `Tooltip.Root` without a mounted `TooltipProvider` uses its default ~700ms delay, so the `delayDuration={200}` mount is required to meet D-09's ~200ms | Pattern 2 / Pitfall 2 | LOW — if Radix's unprovided default were already short, the mount is still harmless and D-09 is still met; the mount is the robust action either way. `TooltipProvider` being unmounted was grep-verified, so the "provider exists but must be mounted" half is [VERIFIED] |
| A2 | React 19's ref-as-prop semantics make the nested `DropdownMenuTrigger asChild > SidebarMenuButton tooltip>` composition work without `forwardRef` | Pitfall 6 | LOW-MEDIUM — this is the one non-pre-verified interaction; runtime verification is cheap, and the fallback (manual Tooltip at the DropdownMenuTrigger level) is documented |
| A3 | `opacity: 0` elements remain in the accessibility tree, so the faded wordmark is still announced in the rail and the letter-mark "A" should be `aria-hidden` | Pattern 5 | LOW — if it were otherwise, the `aria-hidden` would be unnecessary noise, not a defect |
| A4 | `group-data-[collapsible=icon]:flex` overrides `hidden` reliably (Tailwind v4 variant specificity) | Pattern 5 | LOW — same mechanism proven in production at app-sidebar.tsx:130 (Reviews dot) and 149 (pill icon) |

## Open Questions (RESOLVED)

1. **Header row-2 stacking with the faded wordmark (D-03 vs Q4)** **[RESOLVED]**
   - What we know: Q4 locks the wordmark to `opacity-0` (space retained, ~40px) in the rail; D-03 wants the letter-mark "centered below" the button.
   - What's unclear: whether the letter-mark should be ordered immediately after the button row (letter-mark snug under button, faded wordmark trailing below — recommended, Pattern 5) or after the wordmark block (letter-mark ~48px lower; more literal Q4 "same slot" reading). Both keep Q4 classes verbatim; neither overlaps.
   - Recommendation: planner picks Pattern 5 ordering (letter-mark first in row 2); it best matches "letter-mark centered below the button" (D-03) and costs nothing. Not a blocking question.
   - **Resolved by:** 13-01 Task 2 step 9 — the letter-mark div is ordered FIRST in header row 2 (Pattern 5: snug under the button, faded wordmark trailing), Q4 wordmark classes kept verbatim.
2. **Extract the pure label helper or inline?** **[RESOLVED]**
   - What we know: D-08 copy is contract-locked; Phases 10/12 extracted pure functions + Vitest for sidebar logic; inline ternaries are 1-2 lines each.
   - What's unclear: whether the phase wants the 2-file diff (helper + test) or the minimal single-file diff.
   - Recommendation: extract `src/lib/sidebar-collapse.ts` (+ test) — precedent-aligned and locks the exact `Reviews (N)` contract copy; planner may inline if diff discipline dominates.
   - **Resolved by:** 13-01 Task 1 — extraction; `src/lib/sidebar-collapse.ts` + `src/lib/sidebar-collapse.test.ts` created with 7 Vitest cases locking the D-08 copy.
3. **Collapse-button `aria-label` copy** **[RESOLVED]**
   - What we know: D-08 locks the tooltip copy `Collapse`/`Expand`; the button's own `aria-label` is unspecified.
   - What's unclear: exact accessible label wording ("Collapse"/"Expand" vs "Collapse sidebar"/"Expand sidebar").
   - Recommendation: `aria-label` = "Collapse sidebar"/"Expand sidebar" (SR clarity); tooltip stays the locked short copy. Non-blocking.
   - **Resolved by:** 13-01 Task 2 step 9 — `aria-label` = 'Collapse sidebar'/'Expand sidebar' (SR clarity); the tooltip stays the locked short copy via `getCollapseToggleLabel`.

## Environment Availability

> Phase 13 has no new external dependencies (pure client UI work on already-installed libraries). The audit documents the local toolchain that gates execution.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | build/test (`engines` 22.x) | ✓ | v22.23.1 | — |
| lucide-react | `PanelLeftClose` / `PanelLeftOpen` | ✓ | 1.26.0 | — (icons verified in installed artifact) |
| radix-ui | `Sidebar`/`Tooltip`/`Button`/`DropdownMenu` primitives | ✓ | 1.6.5 | — |
| react / react-dom | client components, ref-as-prop (A2) | ✓ | 19.2.4 | — |
| next | App Router shell + build | ✓ | 16.2.11 | — |
| tailwindcss | `group-data-[collapsible=icon]:` variants, `size-*` | ✓ | 4.x | — |
| vitest | unit tests (`--bail=1`, not `-x`) | ✓ | 4.1.10 | — |
| @clerk/nextjs | `useUser()` display-name tooltip | ✓ | 7.5.22 | — |
| Neon/DB (`countPendingProposals`) | `pendingCount` for Reviews tooltip | ✓ | — (existing server thread) | degrades to 0 (existing try/catch) |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` — section required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (node env) |
| Config file | `vitest.config.ts` (`include: ['src/**/*.test.ts']`, `@` → `./src`) |
| Quick run command | `npx vitest run src/lib/<file>.test.ts --bail=1` (NOT `-x` — removed in Vitest 4) |
| Full suite command | `npm test` (currently 232 passed, 2 skipped) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COLR-01 | `collapsible="icon"` wired on `<Sidebar>` (app-sidebar.tsx:56) | grep gate (class/DOM assertion) | `grep -c 'collapsible="icon"' src/components/layout/app-sidebar.tsx` = 1 | ✅ Wave 0 (target file exists) |
| COLR-01 | Collapse button: `PanelLeftClose`/`PanelLeftOpen` + `toggleSidebar` + 32px `size="icon"` | grep gate | `grep -cE 'PanelLeft(Close\|Open)'` ≥ 1 each; `size="icon"` = 1 | ✅ Wave 0 |
| COLR-01 | Rail anatomy activates (badge `group-data-[collapsible=icon]:hidden` in sidebar.tsx, dot `:block` in app-sidebar.tsx) | grep gate | `grep -c 'group-data-\[collapsible=icon\]:block' src/components/layout/app-sidebar.tsx` (dot + pill icon + letter-mark = ≥3 — line-scope) | ✅ Wave 0 |
| COLR-02 | Resize contract untouched | fence gate | `git diff <base> HEAD -- sidebar-resize-handle.tsx` = only the hide lines; `grep -c 'sidebar_width'` unchanged; `MIN_WIDTH`/`MAX_WIDTH` = 200/400 | ✅ Wave 0 |
| COLR-02 | ⌘B + `sidebar_state` cookie byte-identical | fence gate | `git diff <base> HEAD -- src/components/ui/sidebar.tsx src/components/layout/app-shell-layout.tsx src/app/globals.css package.json package-lock.json` = empty | ✅ Wave 0 |
| COLR-02 | D-05 restore automatic (no new width code) | grep gate (negative) | `grep -cE 'setProperty|sidebar_width' src/components/layout/app-sidebar.tsx` = 0 (no width writes in the sidebar) | ✅ Wave 0 |
| COLR-03 | Tooltips on 4 nav rows + pill + user trigger | grep gate | `grep -c 'tooltip=' src/components/layout/app-sidebar.tsx` ≥ 5 (6 `SidebarMenuButton`s) — plus the manual collapse-button tooltip (`<Tooltip>`) | ✅ Wave 0 |
| COLR-03 | Reviews tooltip includes count (D-08) | unit (if helper extracted) / grep | `getNavTooltipLabel('reviews', 3)` = `'Reviews (3)'` — or `grep -c 'Reviews ('` = 1 | ✅ / ❌ Wave 0 if helper added |
| COLR-03 | Letter-mark tokens (D-11) | grep gate (line-scoped — `bg-sidebar-primary` also on avatar) | letter-mark div carries `bg-sidebar-primary text-sidebar-primary-foreground text-[13px] font-semibold` | ✅ Wave 0 |
| COLR-03 | Q4 wordmark class verbatim | fence grep | `group-data-[collapsible=icon]:opacity-0 transition-opacity duration-200` = 1, unchanged | ✅ Wave 0 |
| QLTY-04 | No hardcoded colors / dark variants | grep gate | `grep -rnE 'indigo\|amber\|#[0-9a-fA-F]{3,8}\|\bdark:' src/components/layout/` = 0 | ✅ Wave 0 (currently 0) |
| All | Type safety + regression | automated | `npx tsc --noEmit`; `npm test`; `npm run build` | ✅ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit` + the task's targeted grep/vitest gates
- **Per wave merge:** `npm test` (full suite) + fence gates (`git diff <base> HEAD -- <protected files>` = empty)
- **Phase gate:** full suite green + build green + sweep-clean + fence-clean before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/sidebar-collapse.test.ts` — covers COLR-03 D-08 copy (ONLY if the pure helper is extracted; framework already configured, zero infra gaps otherwise)
- If the helper is NOT extracted: "None — existing test infrastructure (`vitest.config.ts`, `nav.test.ts`, `user.test.ts`) covers all phase requirements; everything else is grep/fence/build gates"

## Security Domain

> `security_enforcement` is `true` (ASVS L1, `security_block_on: high`) in `.planning/config.json`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Auth entirely unchanged: `clerkMiddleware` (src/proxy.ts) + `requireStaffAccess()` route gates untouched |
| V3 Session Management | no | Session model untouched; the collapse button writes the existing `sidebar_state` cookie through the vendored `setOpen` — same write ⌘B performs |
| V4 Access Control | no | The sidebar renders only inside auth-gated layouts (`requireStaffAccess` in (dashboard)/companies/personas layouts); no new access paths |
| V5 Input Validation | partial (no new input) | No new user-input surfaces. Tooltip strings are static/locked or derived from server-gated `pendingCount` and Clerk identity (the same data already rendered as the existing `aria-label`). The mailto stays a static module constant (existing ASVS V5 control from Phase 12) — never interpolated |
| V6 Cryptography | no | No new crypto surface |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cookie manipulation (`sidebar_state`/`sidebar_width`) | Tampering | Layout-preference cookies only — no authz/session impact; writes go through the vendored, unchanged `setOpen` (sidebar.tsx:84-85) and the frozen resize handle. No new cookie code |
| XSS via tooltip/label content | Tampering | Radix renders tooltip children as text nodes (no `dangerouslySetInnerHTML`); labels are static strings; the display name comes from Clerk identity and is already rendered as an `aria-label` today. No new injection surface |
| Information disclosure (collapsed-rail labels/count) | Information Disclosure | Unchanged from the expanded badge: the sidebar (and its `pendingCount` data) only renders behind `requireStaffAccess`; tooltips add no new data exposure |

**Verification:** fence gates prove the auth/cookie/drag surfaces byte-identical (`sidebar.tsx`, `app-shell-layout.tsx`, `globals.css`, `package.json` empty diffs) — COLR-02's security-relevant property.

## Sources

### Primary (HIGH confidence — verified against repo files + installed packages in this session)
- `src/components/ui/sidebar.tsx` (702 lines, READ) — `Sidebar` `collapsible` prop + `data-collapsible` gating (151-251), `SidebarProvider` cookie/⌘B/`toggleSidebar` (55-149), `SidebarMenuButton` `tooltip` mechanism (490-538), `SidebarMenuBadge` `group-data-[collapsible=icon]:hidden` (566-581), `--sidebar-width-icon: 3rem` (31), gap/container width classes (217-251)
- `src/components/ui/tooltip.tsx` (57 lines, READ) — vendored `TooltipProvider` (default `delayDuration = 0`, never mounted — grep-verified), `TooltipContent` portal + `bg-foreground text-background` app theme
- `src/components/layout/app-sidebar.tsx` (201 lines, READ) — the single `<Sidebar>` instantiation (:56), Phase 11/12 dormant classes (wordmark fade :58, pill :146-150, Reviews dot :128-131, user trigger :165-180)
- `src/components/layout/sidebar-resize-handle.tsx` (91 lines, READ) — 200-400 clamp, `sidebar_width` cookie, imperative `--sidebar-width` write; client component inside the provider
- `src/components/layout/app-shell-layout.tsx` (44 lines, READ) — cookie → `--sidebar-width` thread (:18-22, :35), provider containment (:35-42)
- `src/components/ui/button.tsx` — `size="icon"` = `size-8` (32px) (:29), svg auto-size (:8)
- `node_modules/lucide-react` (installed 1.26.0) — `PanelLeftClose`/`PanelLeftOpen` verified as top-level exports (d.ts + runtime + dist icons)
- `src/app/globals.css` — Phase 10 scoped token block (87-96): `--sidebar-primary`/`--sidebar-primary-foreground` present for the D-11 letter-mark
- `.planning/phases/13-collapse-resize-coexistence/13-CONTEXT.md` — D-01..D-12 locked decisions, deferred ideas, frozen contracts
- `.planning/phases/10-sidebar-token-foundation/10-UI-SPEC.md` — D1 letter-mark treatment, D3 48px rail, D4 portal policy, Collapsed Interaction row, Copywriting Contract (`Reviews ({n})`)
- `.planning/phases/12-branding-user-zones/12-01-SUMMARY.md` + `12-UI-SPEC.md` — pre-wired classes, Q4 fade contract, validation battery (sweep/fence tables)
- `.planning/phases/11-nav-items-restyle/11-01-SUMMARY.md` — dormant-class precedent, grep-gate hygiene (Rule 1)
- `.planning/REQUIREMENTS.md` — COLR-01..03 verbatim; `.planning/ROADMAP.md` §Phase 13
- `.planning/config.json` — `nyquist_validation: true`, `security_enforcement: true`, ASVS L1

### Secondary (MEDIUM confidence)
- Radix UI Tooltip default `delayDuration` (~700ms when no provider mounted) — training knowledge cross-referenced with the vendored provider's explicit `delayDuration = 0` default, which exists precisely to override it (A1)

### Tertiary (LOW confidence — flagged for validation)
- React 19 ref-as-prop interaction with nested Radix `asChild` (DropdownMenuTrigger + tooltip SidebarMenuButton) — A2, runtime-verify during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library is already installed and every mechanism was verified against the vendored sources and installed packages in this session; zero new packages by hard constraint
- Architecture: HIGH — the `collapsible="icon"` activation, tooltip gating, width-restore, and resize-hide paths were each traced line-by-line in the actual files
- Pitfalls: HIGH — pitfalls 1-5 derive from verified code paths; Pitfall 6 (Slot-in-Slot) is the single MEDIUM item, mitigated by a documented fallback

**Research date:** 2026-08-01
**Valid until:** 2026-08-08 (7 days — fast-moving vendored shadcn/Tailwind surface; re-verify the vendored `sidebar.tsx`/`tooltip.tsx` line numbers if the phase starts later)
