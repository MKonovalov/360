# Phase 13: Collapse & Resize Coexistence - Context

**Gathered:** 2026-08-01
**Status:** Ready for planning

<domain>
## Phase Boundary

The Exa collapse button (lucide `panel-left-close`, top-right) joins the existing drag-to-resize — animated icon-rail collapse with labels fading while icons stay — without breaking the preserved 200-400px clamp, `sidebar_width` cookie, or ⌘B `sidebar_state` cookie; the collapsed rail stays legible with per-item tooltips, a letter-mark logo, and an AA-compliant active pill. Delivers COLR-01, COLR-02, COLR-03. The 48px rail width, stock `--sidebar-width-icon: 3rem`, letter-mark treatment, tooltip portal policy, and the frozen drag-resize/cookie contract are LOCKED by Phase 10's UI-SPEC (D1/D3/D4) — not re-litigated here.

</domain>

<decisions>
## Implementation Decisions

### Collapse button placement
- **D-01:** The collapse button lives inside the sidebar's own header zone (top-right of the sidebar panel, in the `SidebarHeader` area) — NOT in the topbar (SidebarInset) and NOT replacing the existing `SidebarTrigger`. Exa-style: the control lives inside the sidebar chrome.
- **D-02:** The button is **always visible** (it does NOT self-hide into the rail) and swaps its icon by state: lucide `panel-left-close` when expanded (click → collapse to rail), `panel-left-open` when collapsed (click → expand). In the rail it stays mounted as a 32px square.
- **D-03:** Collapsed-header layout with the always-visible button: button at top-right (32px, `p-2`), the 28px letter-mark centered BELOW it. Header is a 2-row flex: button row + letter-mark row. No overlap, no inverted placement.

### Collapse ↔ resize interplay
- **D-04:** The drag-resize handle **hides when collapsed**. The 48px rail is fixed-width with no resize affordance; resize is an expanded-state-only interaction. The handle's flex-sibling placement (outside the sidebar subtree) means hiding is via the same `collapsible`/`state` signal the rail uses.
- **D-05:** On re-expand, the sidebar **restores the last persisted `sidebar_width`** (or the 256px default when no cookie). The two contracts never fight: `sidebar_state` cookie governs expanded/collapsed; `sidebar_width` cookie only matters in expanded state.
- **D-06:** The collapse button drives **shadcn's existing open state** (`SidebarProvider`'s `setOpen`/`toggleSidebar`) — ONE source of truth shared with ⌘B and the topbar hamburger. The `sidebar_state` cookie + ⌘B wiring already shipped in the vendored `SidebarProvider` stays byte-identical (COLR-02 preserved). Zero new cookies.

### Tooltip scope & content
- **D-07:** Tooltips appear on **all interactive icon-only elements** in the collapsed rail: the 4 nav rows, the feedback pill, the user avatar, and the collapse button. The letter-mark is self-explanatory (brand) — no tooltip.
- **D-08:** Context-aware copy: nav rows show their label verbatim (Start, Companies, Key Personas, Reviews); Reviews shows `Reviews (N)` when `pendingCount > 0` else `Reviews`; feedback pill shows `Give us feedback` (matches its Phase 12 aria-label); user avatar shows the display name (`getUserDisplayName`); collapse button shows `Collapse` / `Expand` by state.
- **D-09:** Tooltips trigger on **hover AND keyboard focus** (Radix Tooltip default), `side='right'`, short delay (~200ms). Uses the vendored `tooltip.tsx` (`bg-foreground text-background`, app-theme portal per D4) — zero edits, zero new deps.

### Collapsed rail anatomy
- **D-10:** The rail composes the Phase 11-12 pre-wired dormant classes as-is, plus the letter-mark: header = collapse button top-right + 28px letter-mark centered below; nav = icons-only rows (primitive `size-8!`, active pill ≥3:1 via `data-active:bg-sidebar-accent`); footer = feedback pill icon-only + centered 24px avatar (names/dot hidden per Phase 12 pre-wiring).
- **D-11:** Letter-mark = the D1-locked treatment verbatim: 28px `rounded-md` box, `bg-sidebar-primary text-sidebar-primary-foreground` (dark `#333333` box, white "A" glyph, Geist 600 13px). Shown when `group-data-[collapsible=icon]`, hidden in expanded (wordmark shows instead).
- **D-12:** Collapsed rail width = **48px**, stock `--sidebar-width-icon: 3rem`, no override (D3 locked). Header `p-2`, button 32px, letter-mark 28px, nav rows 32px, pill 32px, avatar 24px — all fit with 8px gutters.

### Claude's Discretion
- Animation timing/duration details beyond the primitive's stock `transition-[width] duration-200` (keep stock unless a reason emerges)
- Exact tooltip delay value within the ~200ms short-delay intent
- The `collapsible="icon"` wiring mechanics on the vendored `<Sidebar>` (whether via a prop change at the `app-shell-layout.tsx`/`AppSidebar` boundary — vendored `sidebar.tsx` itself must stay unedited per hard constraints)

</decisions>

<specifics>
## Specific Ideas

- "Collapse should feel like Exa's rail — labels fade while icons stay, width animates"
- "The collapse button and ⌘B should never fight — one state, two triggers"
- "Keyboard users must get rail labels too" (focus-triggered tooltips)

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Collapse & resize contract (the LOCKED mechanisms this phase activates)
- `.planning/phases/10-sidebar-token-foundation/10-UI-SPEC.md` §D1 (letter-mark treatment, wordmark), §D3 (48px rail, stock `--sidebar-width-icon: 3rem`, no override), §D4 (tooltip portal policy: Radix default portals, `bg-foreground text-background`, light app-theme, zero edits to tooltip.tsx), §Interaction & State Contract Collapsed row (icons stay, labels fade, tooltips right-side) — the upstream design contract
- `.planning/phases/10-sidebar-token-foundation/10-RESEARCH.md` §Common Pitfalls Pitfall 2 (portal policy → moot per D4), Pitfall 6 (collapsed rail / logo overflow), §Architectural Responsibility Map
- `.planning/phases/11-nav-items-restyle/11-01-SUMMARY.md` — the committed collapsed-dot dormant mechanism precedent (`group-data-[collapsible=icon]:block`), grep-gate hygiene (11-02 Rule 1)
- `.planning/phases/12-branding-user-zones/12-01-SUMMARY.md` — the committed header/footer pre-wired collapsed classes (wordmark fade Q4, icon-only pill Q3, avatar center + name hidden), `12-UI-SPEC.md` §Q1-Q6 (user-zone trigger anatomy, avatar treatment, pill anatomy)
- `.planning/ROADMAP.md` §Phase 13 — goal + success criteria (COLR-01..03)

### Frozen contracts (must NOT break — COLR-02)
- `src/components/ui/sidebar.tsx` — vendored `SidebarProvider` (sidebar_state cookie, ⌘B, `toggleSidebar`, `SidebarTrigger`), `Sidebar` `collapsible="icon"` dormant classes, `--sidebar-width-icon: 3rem` (READ ONLY)
- `src/components/layout/sidebar-resize-handle.tsx` — the drag-resize contract (200-400px clamp, `sidebar_width` cookie, imperative `--sidebar-width` write) — READ ONLY for Phase 13 except the collapse-hide interaction
- `src/components/layout/app-shell-layout.tsx` — server shell threading `sidebar_width` cookie + `pendingCount` into `SidebarProvider`/`AppSidebar`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SidebarProvider`/`useSidebar()` (`src/components/ui/sidebar.tsx:55`): already owns `state` (expanded/collapsed), `setOpen`, `toggleSidebar`, ⌘B handler, `sidebar_state` cookie — the collapse button can call `useSidebar()` directly, zero new state machinery
- `SidebarTrigger` (`src/components/ui/sidebar.tsx:253`): existing topbar hamburger using `PanelLeftIcon` — the pattern for the header collapse button (swap to `panel-left-close`/`panel-left-open`)
- `Tooltip` primitive (`src/components/ui/tooltip.tsx`, `bg-foreground text-background` app-theme portal per D4) + the `SidebarMenuButton` `tooltip` prop (sidebar.tsx:480ish shows tooltip wiring `hidden={state !== "collapsed"}`) — the vendored primitive ALREADY has the collapsed-rail tooltip mechanism built in
- `useIsMobile()` (`src/hooks/use-mobile.ts`): mobile breakpoint for the sheet-vs-rail branch
- Phase 12 dormant classes already in `app-sidebar.tsx`: wordmark fade (`group-data-[collapsible=icon]:opacity-0`), pill icon-only (`hidden group-data-[collapsible=icon]:block`), avatar center + name hidden, Reviews collapsed dot (`group-data-[collapsible=icon]:block` bg-sidebar-accent)

### Established Patterns
- Dormant collapsed-rail styling via `group-data-[collapsible=icon]:` pre-wired in Phases 11-12 — Phase 13 flips the `collapsible="icon"` switch and they activate
- Grep-gate + Vitest + build-gate validation architecture (Phases 10-12: `indigo`/`amber`/hex/`dark:` sweep = 0, fence gates on vendored files, per-task tsc + targeted suites)
- QLTY-04 comment hygiene: no swept class strings in comments
- Zero new npm packages; zero edits to vendored `sidebar.tsx`/`tooltip.tsx`/`dropdown-menu.tsx`; no `.dark`/`dark:` variants

### Integration Points
- `src/components/layout/app-sidebar.tsx` — header zone gets the collapse button + letter-mark; nav rows get tooltips; footer already pre-wired
- `src/components/layout/sidebar-resize-handle.tsx` — needs the collapse-hide behavior (D-04) while keeping the 200-400 clamp + `sidebar_width` cookie
- `src/components/layout/app-shell-layout.tsx` — where `collapsible="icon"` gets wired onto the `<Sidebar>` (via `AppSidebar` props or here), and the width-restore-on-expand (D-05) coordinate
- `src/components/ui/sidebar.tsx` vendored `Sidebar` `collapsible` prop (`"offcanvas"` default → `"icon"`) — the switch that activates all dormant classes

</code_context>

<deferred>
## Deferred Ideas

- Mobile-sheet-specific collapse affordances beyond the stock shadcn sheet behavior — Phase 14 UAT matrix will verify the mobile sheet; mobile collapse behavior stays stock unless the audit demands otherwise
- Rail-width customization (e.g., 56px) — rejected; D3 locked 48px stock
- Replacing the topbar hamburger with the collapse button only — rejected (D-01: header placement chosen; topbar `SidebarTrigger` stays for ⌘B affordance)
- Tooltips on the letter-mark — rejected (D-07: brand mark is self-explanatory)

</deferred>

---

*Phase: 13-collapse-resize-coexistence*
*Context gathered: 2026-08-01*
