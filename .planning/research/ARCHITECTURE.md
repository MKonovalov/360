# Architecture Research: Dark Exa-Style Sidebar Theme (v1.2)

**Domain:** Dark sidebar theme scoped inside an existing light-only Next.js 16 + Tailwind v4 + shadcn app
**Researched:** 2026-08-01
**Confidence:** HIGH (mechanism, verified by direct source reads) / MEDIUM (Exa token values) / LOW (Exa dropdown-in-sidebar styling)

## Executive Answer

The vendored `src/components/ui/sidebar.tsx` (702 lines) is **100% CSS-variable driven and has no theme/variant mechanism** — its `variant` prop is layout-only (`"sidebar" | "floating" | "inset"`). Every visual (panel bg, foreground, accent, hover, active, border, ring, group-label opacity) flows through the seven `--sidebar-*` custom properties defined in `src/app/globals.css` and consumed via Tailwind v4 utilities (`bg-sidebar`, `text-sidebar-foreground`, `data-active:bg-sidebar-accent`, …).

Because `globals.css` uses **`@theme inline`** (`--color-sidebar: var(--sidebar)`), the generated utilities resolve `var(--sidebar)` **per-element at runtime**, not at build time. Redefining `--sidebar-*` on a sidebar-scoped hook therefore flips the *entire sidebar subtree* to dark while the light app surface keeps resolving the `:root` values. This is the load-bearing fact of the whole feature: **the dark theme is a ~15-line scoped CSS token block, not a component rework.**

The two elements that carry the panel background are exactly the two elements tagged `data-sidebar="sidebar"`: the desktop `sidebar-inner` div (sidebar.tsx:242) and the mobile `SheetContent` (sidebar.tsx:187). Scoping the dark tokens to `[data-sidebar="sidebar"]` covers **desktop expanded, desktop icon-collapsed, and the mobile sheet with one rule and zero JSX changes** — no `app-sidebar.tsx`, `app-shell-layout.tsx`, or vendored-primitive edits are required to make the panel itself dark. A class on `<Sidebar>` would NOT work cleanly: `className` is dropped on the mobile branch (sidebar.tsx:155 destructures it out; `{...props}` lands on `Sheet`, not `SheetContent`), so a root class would leave the mobile sheet light.

The only hardcoded-light code inside the sidebar is in the *consumer*: four `data-active:bg-indigo-50 data-active:text-indigo-600` class strings in `src/components/layout/app-sidebar.tsx` (near-white pills on a near-black panel) and the `bg-amber-100 text-amber-800` pending badge. Those are the real "must modify" items, and they live exactly where per-item styling belongs — the consumer file.

The one structural trap is **Radix portal inheritance**: `DropdownMenuContent` renders `DropdownMenuPrimitive.Portal` with no `container` prop → portals to `document.body`, which is outside the sidebar subtree, so neither scoped vars nor `.dark` ancestors reach it. The default, zero-change behavior is a **light** dropdown over a dark sidebar (fine contrast, current ExplorerMenu surfaces are light anyway). If the design commits to dark menus inside the sidebar, the mechanism exists: add a `container` prop passthrough to `dropdown-menu.tsx` (small, default-preserving vendored edit) + optional `container` threading through `ExplorerMenu`, and define dark `--popover`/`--accent` values in the same scoped block.

## System Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                        globals.css (single token source)                │
│  :root { --sidebar: oklch(0.985…)  …7 vars }   ← light default (exists) │
│  .dark { …shadcn neutral dark… }               ← unused today (exists)  │
│  [data-sidebar="sidebar"] { …Exa near-black… } ← NEW scoped block       │
└───────────────┬────────────────────────────────────────────────────────┘
                │ CSS custom-property inheritance (per-element resolution)
                ▼
┌────────────────────────────────────────────────────────────────────────┐
│  Tailwind v4 @theme inline:  --color-sidebar: var(--sidebar) …        │
│  (already present in globals.css — utilities compile to var() at      │
│   use-site, resolved at the element where the class is applied)       │
└───────────────┬────────────────────────────────────────────────────────┘
                ▼
┌────────────────────────────────────────────────────────────────────────┐
│  Vendored shadcn primitives (sidebar.tsx — UNTOUCHED, 702 lines)      │
│  bg-sidebar · text-sidebar-foreground · hover:bg-sidebar-accent       │
│  data-active:bg-sidebar-accent · bg-sidebar-border · ring-sidebar-ring│
└───────────────┬────────────────────────────────────────────────────────┘
                ▼
┌────────────────────────────────────────────────────────────────────────┐
│  DOM hooks carrying the panel background                              │
│  desktop: <div data-sidebar="sidebar" data-slot="sidebar-inner">      │
│  mobile:  <SheetContent data-sidebar="sidebar" …bg-sidebar…>          │
│  → both inherit the dark token block → whole subtree dark             │
│  Sibling surfaces (SidebarInset, content, resize handle) stay light   │
│  Portaled surfaces (DropdownMenuContent → document.body) do NOT       │
│  inherit → default light, or container-scope for dark menus           │
└────────────────────────────────────────────────────────────────────────┘
```

## Theme Flow (data/state model)

There is **no React state or context involved in theming** — it is pure CSS custom-property resolution. The only React-driven pieces are:

1. `SidebarProvider` sets layout vars (`--sidebar-width`, `--sidebar-width-icon`) and the collapse state — **theme-agnostic, untouched**.
2. `SidebarResizeHandle` writes `--sidebar-width` imperatively during drag — **theme-agnostic, untouched**.
3. `usePathname()` drives `isActive` in `app-sidebar.tsx` — **logic untouched**; only the active *classes* change (Phase B).
4. Optional: `container` prop on dropdown content if dark menus are committed (Phase C).

### Theme resolution chain

```
1. globals.css :root          → light defaults (exists, untouched)
2. globals.css [data-sidebar="sidebar"]  → Exa dark overrides (NEW — the whole feature)
3. @theme inline mapping       → --color-sidebar: var(--sidebar)  (exists, untouched)
4. shadcn utilities            → bg-sidebar etc. resolve per-element
5. DOM subtree under [data-sidebar="sidebar"]  → dark
   DOM outside it             → :root → light
   DOM portaled to <body>     → :root → light (unless container-scoped)
```

### Why `@theme inline` matters (the mechanism's precondition)

`@theme inline { --color-sidebar: var(--sidebar) }` (globals.css:13–20) means Tailwind emits `background-color: var(--sidebar)` **inline** in the utility. The `var()` is resolved at the element that has the class. A non-inline `@theme` would emit `background-color: var(--color-sidebar)` with `--color-sidebar` defined on `:root` only, which would *not* follow a subtree redefinition of `--sidebar` — requiring the block to also redefine `--color-sidebar-*`. This codebase is inline, so redefining the 7 source vars is sufficient. **Do not "fix" the `@theme` block to non-inline** — that would break the entire scoping strategy.

## Recommended Mechanism (decision)

| Approach | Verdict | Why |
|----------|---------|-----|
| **Scoped `--sidebar-*` override on `[data-sidebar="sidebar"]`** | ✅ **Primary** | One rule darkens the full subtree on both breakpoints (the hook lands on the exact elements already carrying `bg-sidebar`); zero vendored changes; light app untouched; works with collapse/resize/collapsed-icon/tooltip states for free |
| Dedicated class on `<Sidebar>` root (e.g. `<Sidebar className="exa-sidebar">`) | ⚠️ Only as a complement | `className` is merged on the **desktop** container (sidebar.tsx:237) but **dropped on the mobile** branch (destructured out at :155) — the mobile sheet would stay light. Use it only for desktop-only tweaks (e.g. `border-sidebar-border`), never as the theme hook |
| Tailwind `dark:` variants / `.dark` class on a wrapper | ❌ Not primary | `@custom-variant dark (&:is(.dark *))` requires a `.dark` ancestor; the app is light-only and must stay that way. Wrapping the sidebar in `.dark` would also flip `--popover`, `--card`, `--muted`, `--border` for everything inside, drag shadcn's neutral (non-Exa) dark tokens in, and portaled dropdowns still wouldn't follow. Reserve `.dark` for a future whole-app dark mode |
| Add a `theme`/`variant` prop to the vendored `sidebar.tsx` | ❌ Anti-pattern | 702-line vendored file, shadcn's own variant prop is layout-scoped; extending it forks the primitive from upstream and widens blast radius for no benefit — the var mechanism already does it |

**Token values (MEDIUM confidence — validate in UI-SPEC):** Exa's dark canvas is a greige-tinted near-black (`#181815` family per shadcn's design-system analysis of exa.ai), not pure black; radii are tight (2px workhorse); brand voltage is electric blue `#1f40ed` used *scarcely* (inline links / small emphasis, never background fills). Recommend: `--sidebar` ≈ `#181815`-family dark; `--sidebar-accent` a slightly lighter hover (`white/8–10%`); `--sidebar-foreground` off-white; `--sidebar-border` subtle (dark-on-dark hairline); keep the app's existing amber *semantic* for the pending badge but dark-adapted.

## Edge Surfaces (dark-sidebar-adjacent)

### ExplorerMenu dropdown opened from a dark sidebar item
- **Mechanic:** `DropdownMenuContent` (dropdown-menu.tsx:34–51) renders `DropdownMenuPrimitive.Portal` with **no `container` prop** → content lands in `document.body`, outside the sidebar subtree. It uses `bg-popover text-popover-foreground` → resolves `:root` → **light**, regardless of sidebar theme. It also never receives the sidebar's `--sidebar-*` vars.
- **Default (recommended for v1.2):** keep dropdown content light. It sits over the dark panel on a white surface — high contrast, shadcn default, zero changes, and today's `ExplorerMenu` placements (list/detail surfaces, explorer-menu.tsx) are all in the *light* area anyway.
- **If dark menus are committed:** (a) add `container` prop passthrough to `DropdownMenuContent` in `dropdown-menu.tsx` (one optional prop, default = current portal behavior — safe); (b) thread an optional `container` through `ExplorerMenu`; (c) include dark `--popover`, `--popover-foreground`, `--accent`, `--accent-foreground` values in the same `[data-sidebar="sidebar"]` scoped block so portaled-into-sidebar content inherits them. Portaling *into* the subtree is the only way CSS inheritance reaches the menu — a `.dark` ancestor outside the portal also fails.
- **Decision gate for roadmap:** UI-SPEC must state "dark menus" or "light menus" before Phase C; the architecture cost of each is one small vendored prop either way.

### Amber pending badge (`SidebarMenuBadge`, app-sidebar.tsx:75)
- Base class already derives text from tokens (`text-sidebar-foreground`, `peer-hover:…text-sidebar-accent-foreground`); the app overrides with fixed light-amber `bg-amber-100 text-amber-800`. On near-black that pill is high-contrast but not Exa-like.
- **Needs dark-aware restyle — one line in app-sidebar.tsx** (e.g. `bg-amber-400/15 text-amber-200` or a `bg-amber-500/20 text-amber-300` chip). Logic lives with the placement (consumer), not the primitive. Note the base `peer-hover:…text-sidebar-accent-foreground` still wins on row hover (existing behavior, fine).
- The *other* amber badge (`proposal-badge.tsx`) lives in the light Company detail panel — **untouched**.

### Collapse/expand control
- `SidebarTrigger` sits in `SidebarInset` (app-shell-layout.tsx:39) — the **light** content area; `variant="ghost"` on light bg. **Untouched.**
- `SidebarRail` (the vendored edge-strip toggle) is **exported but never used** in this app — `SidebarResizeHandle` replaced it. Non-issue.
- Keyboard shortcut (`⌘B`) and cookie-persisted `sidebar_state` are theme-agnostic. Untouched.

### Drag-resize handle (sidebar-resize-handle.tsx)
- A sibling flex item **outside** the sidebar subtree — does not inherit `--sidebar-*`. Its `hover:bg-indigo-200` is a fixed color (visible on both light and dark edges). It sits exactly on the dark/light boundary.
- **No change required for correctness.** Optional polish: switch hover to a boundary-neutral `hover:bg-foreground/20` or the token-based `hover:bg-sidebar-border`… note `--sidebar-border` *won't* inherit here (outside subtree) — if token-based, use a non-sidebar token. Low priority; defer to a polish phase.

### Desktop right edge border
- The container's `group-data-[side=left]:border-r` (sidebar.tsx:236) colors from the base layer `* { @apply border-border }` → `--border` (light). The scoped block should **not** redefine `--border` (too broad — it'd leak into any other `border-border` use inside the subtree).
- Fix: pass `border-sidebar-border` to `<Sidebar className>` (merges on desktop container only; mobile already has no border to worry about here). Exa aesthetic = subtle or invisible edge, so this may be a no-op — UI-SPEC call.

### Mobile sheet
- Covered automatically by the `[data-sidebar="sidebar"]` scope (SheetContent:187 has the attribute + `bg-sidebar`). Verify dark rendering + the sheet's own close button in UAT.

### Collapsed icon mode + tooltips
- Icon-mode sizing (`group-data-[collapsible=icon]:…`) is layout-only; var-driven colors follow the scoped block. `SidebarMenuButton` `tooltip` (not currently used) renders portaled `TooltipContent` with *inverted* `bg-foreground text-background` — works on any background, no work needed if tooltips are added later.

## Component Responsibilities

| Component | Role in this feature | Change |
|-----------|----------------------|--------|
| `src/app/globals.css` | Single source of truth for all theme tokens; hosts the new scoped Exa dark block | **Modified** (add one scoped token block) |
| `src/components/layout/app-sidebar.tsx` | Consumer; owns per-item styling (active classes, badge), nav anatomy (logo/user zones) | **Modified** (active-state classes, badge class; optional `border-sidebar-border`, header/footer zones) |
| `src/components/ui/sidebar.tsx` | Vendored primitive; var-driven, no theme variant; provides `SidebarHeader`/`SidebarFooter`/`SidebarMenuBadge` for the new zones | **Untouched** |
| `src/components/layout/app-shell-layout.tsx` | Server shell; theme-agnostic (width + pendingCount) | **Untouched** |
| `src/app/(dashboard)/layout.tsx`, `companies/layout.tsx`, `personas/layout.tsx` | All three wrap the single `AppShellLayout` → one shell change covers Start/Companies/Personas/Reviews | **Untouched** |
| `src/components/ui/dropdown-menu.tsx` | Portal boundary for menus; only touched if dark menus are committed | **Untouched** (default) / Modified (optional `container` prop) |
| `src/components/explorer/explorer-menu.tsx` | Menu placements currently on light surfaces only | **Untouched** (default) / Modified (optional `container` threading) |
| `src/components/layout/sidebar-resize-handle.tsx` | Boundary strip outside the subtree | **Untouched** (optional cosmetic hover tweak) |
| `proposal-badge.tsx`, explorer/content/dashboard components | Light content area | **Untouched** |
| `src/lib/**`, DB queries, routes | No involvement | **Untouched** |

## Recommended Project Structure (deltas)

```
src/
├── app/
│   └── globals.css              # MODIFIED — add [data-sidebar="sidebar"] Exa dark block
│                                #   (7× --sidebar-*; +4× --popover/--accent dark values
│                                #    only if dark menus are committed)
└── components/
    ├── layout/
    │   └── app-sidebar.tsx      # MODIFIED — replace 4× data-active:indigo-50 strings,
    │                            #   dark-adapt badge, optional logo/user zones via
    │                            #   SidebarHeader/SidebarFooter (both already exported)
    ├── ui/
    │   ├── sidebar.tsx          # UNTOUCHED (702 lines — the point)
    │   └── dropdown-menu.tsx    # UNTOUCHED unless dark menus → add container prop
    └── explorer/
        └── explorer-menu.tsx    # UNTOUCHED unless dark menus → optional container prop
```

**No new files are required.** If the team prefers the Exa block out of `globals.css` for readability, it can live in `src/app/sidebar-dark.css` imported from `globals.css` — but keeping it beside the existing `:root`/`.dark` blocks is the smaller diff and matches the current single-source convention. **Structure rationale:** the feature is a token-scope change (globals.css) + a consumer restyle (app-sidebar.tsx); both are exactly where the existing architecture already puts theming and per-item styling.

## Architectural Patterns

### Pattern 1: Subtree-scoped CSS custom-property override
**What:** Redefine the `--sidebar-*` variables on a hook that sits *on* the panel-background element, relying on custom-property inheritance + Tailwind v4 `@theme inline` per-element resolution.
**When:** Any "this region looks different from the app" theme requirement (dark sidebar, dark editor chrome, branded panel) — instead of a global `.dark` flip or per-component overrides.
**Trade-offs:** One rule covers the whole subtree; zero primitive churn; trivial to revert. Cost: the scope must be chosen carefully (see mobile `className` drop); hardcoded colors inside the subtree (the indigo-50 classes) must be migrated to tokens or explicit utilities.

```css
/* globals.css — the entire dark-sidebar feature's CSS footprint */
[data-sidebar="sidebar"] {
  --sidebar: oklch(0.16 0.008 90);            /* Exa near-black, greige-tinted */
  --sidebar-foreground: oklch(0.92 0.005 90); /* off-white */
  --sidebar-primary: oklch(0.55 0.25 265);    /* electric-blue voltage, scarce use */
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(1 0 0 / 10%);       /* hover/active = white-alpha */
  --sidebar-accent-foreground: oklch(0.97 0 0);
  --sidebar-border: oklch(1 0 0 / 8%);        /* subtle dark hairline */
  --sidebar-ring: oklch(0.556 0 0);
  /* only if dark menus are committed: */
  --popover: oklch(0.16 0.008 90);
  --popover-foreground: oklch(0.92 0.005 90);
  --accent: oklch(1 0 0 / 10%);
  --accent-foreground: oklch(0.97 0 0);
}
```

### Pattern 2: Portal-container scoping for overlays anchored to a themed region
**What:** When an overlay (dropdown/popover) must inherit a region's theme, pass the region's DOM node as Radix's `container` so the portal mounts *inside* the inheriting subtree instead of `document.body`.
**When:** Only when the design requires dark dropdown content from a dark sidebar. Default (light overlay) needs nothing.
**Trade-offs:** Enables full token inheritance with one optional prop; requires a small, default-preserving edit to `dropdown-menu.tsx` and explicit `container` threading; portaled-into-subtree content then participates in that subtree's layout context (scroll/stacking) — verify the z-index holds (`z-50` on content; sidebar is `z-10`).

```tsx
// dropdown-menu.tsx — only if dark menus are committed
function DropdownMenuContent({ className, container, ...props }) {
  return (
    <DropdownMenuPrimitive.Portal container={container}>
      <DropdownMenuPrimitive.Content ... />
    </DropdownMenuPrimitive.Portal>
  )
}
```

### Pattern 3: Consumer-owned per-item styling (keep primitives generic)
**What:** All Exa-specific treatment (active pill, badge color, grouping, logo/user zones) lives in `app-sidebar.tsx`, never in the vendored `sidebar.tsx`. The primitive stays upstream-pullable.
**When:** Always, for this codebase — it's the existing convention (the indigo-50 classes already live in the consumer).

```tsx
// app-sidebar.tsx — Exa treatment for the active state (replaces data-active:bg-indigo-50…)
className="data-active:bg-white/10 data-active:text-white data-active:hover:bg-white/10 data-active:hover:text-white"
```

## Anti-Patterns

### 1. Adding a `.dark` class / `dark:` variants to the sidebar subtree
The app is light-only; `.dark` also flips `--popover`/`--card`/`--muted`/`--border` for everything inside, imports shadcn's neutral (not Exa) dark tokens, and does nothing for portaled menus. Reserve `.dark` for a future whole-app dark mode. **Do instead:** the scoped `--sidebar-*` block.

### 2. Editing the vendored `sidebar.tsx` to add a theme variant
Forks the 702-line primitive from upstream shadcn; the var mechanism already delivers the theme. **Do instead:** scoped tokens + consumer classes.

### 3. Hardcoded light colors inside the dark subtree
The four `data-active:bg-indigo-50/…` strings are exactly this — they'd render near-white pills on near-black. Any *new* content added to the sidebar must use tokens (`bg-sidebar-accent`, `text-sidebar-foreground`, …) or explicit dark utilities. **Do instead:** token-based or white-alpha utilities.

### 4. Redefining broad tokens (`--border`, `--foreground`) in the scoped block
Leaks into every `border-border`/`text-foreground` use inside the subtree and obscures intent. **Do instead:** scope only `--sidebar-*` (+ the 4 popover/accent vars if dark menus), and use explicit utilities for one-offs (e.g. `border-sidebar-border`).

### 5. Forgetting the portal boundary when styling "the sidebar's menu"
Any overlay portaled to `document.body` cannot inherit sidebar-scoped CSS — styling it as if it were a sidebar child silently does nothing. **Do instead:** decide light-by-default or container-scope deliberately (Pattern 2).

### 6. Switching `@theme` to non-inline
Would make utilities resolve `var(--color-sidebar)` from `:root` and break the whole subtree-scoping strategy. The `@theme inline` block is load-bearing — do not touch it.

## Integration Points

### Internal boundaries (concrete)

| Boundary | Communication | Change |
|----------|---------------|--------|
| `globals.css` tokens → shadcn primitives | CSS custom properties via `@theme inline` utilities | ADD scoped block on `[data-sidebar="sidebar"]` |
| primitives → sidebar DOM | `data-sidebar="sidebar"` hooks (desktop :242 / mobile :187) | NONE — the hooks already exist |
| primitives → `app-sidebar.tsx` | `className` passthrough (`cn`/tailwind-merge) | Replace 4 indigo-50 strings; badge class; optional `border-sidebar-border` |
| `app-shell-layout.tsx` → `AppSidebar` | `pendingCount` prop (unchanged) | NONE |
| sidebar DOM → portaled dropdowns | Radix Portal → `document.body` | NONE (light menus) or `container` prop (dark menus) |
| `sidebar-resize-handle.tsx` → wrapper | `--sidebar-width` imperative write (unchanged) | NONE (optional hover class) |

### Verification checklist (per phase)
- Desktop expanded + icon-collapsed states: sidebar dark, content light.
- Mobile sheet (`md` breakpoint): sheet background dark (proves the attribute hook works).
- Hover/active/focus-visible states on menu buttons: dark-appropriate.
- `⌘B` toggle, drag-resize (`200–400px`), cookie persistence: unchanged behavior.
- Contrast: `--sidebar-foreground/70` group labels, badge, active text meet AA on near-black.
- Portaled dropdown (if dark): content inherits dark tokens and stays `z-50` above sidebar (`z-10`).
- Regression: light Start/Companies/Personas/Reviews content surfaces unchanged; Arcpedia/enrichment/import/agent UI untouched.

## Suggested Build Order (dependency-aware)

1. **Phase A — Token foundation (pure CSS).** Add the `[data-sidebar="sidebar"]` Exa block to `globals.css`. No JSX changes. Verify: whole sidebar dark on desktop (expanded + icon-collapsed) and mobile sheet; hover/active/separators follow; content area untouched. *Unblocks everything; the only prerequisite.*
2. **Phase B — Sidebar content restyle (consumer file).** In `app-sidebar.tsx`: replace the four indigo-50 active strings with Exa treatment; dark-adapt the pending badge; restructure into Exa anatomy (logo zone via `SidebarHeader`, groups, user/settings zone via `SidebarFooter` — both already exported by the primitive); optional `border-sidebar-border` on `<Sidebar>`. *Depends on A (var-based classes need the dark tokens to exist).*
3. **Phase C — Edge surfaces (conditional).** Only if the design commits: dark dropdown mechanism (`container` prop on `dropdown-menu.tsx` + optional `ExplorerMenu` threading + popover/accent dark vars in the A block); resize-handle hover polish. *Depends on A; menus also depend on the UI-SPEC dark/light decision.*
4. **Phase D — QA/polish.** Collapsed-icon tooltips (if introduced), keyboard shortcut, mobile sheet close control, contrast audit, cross-route smoke (all three layouts share `AppShellLayout`), `npm run build` + `tsc` + Vitest regression.

**Phase ordering rationale:** A is a standalone CSS diff that immediately delivers the visual (dark panel) with the smallest possible blast radius and zero component risk; B builds on A because Exa active/badge treatment is expressed through the tokens A defines; C is deliberately last and conditional because its only mandatory member (dropdown container) is a feature decision, not a dependency of A or B; D verifies the collapsed/mobile/portal states that the scoped mechanism claims to cover for free.

## Gaps / Research Flags

- **Exa sidebar token values** (near-black hue, accent treatment, radius): MEDIUM confidence — sourced from shadcn's design-system analysis of exa.ai marketing surfaces; the *dashboard* sidebar specifics are inferred. **Flag: UI-SPEC should lock the palette before Phase B.**
- **Exa dropdown-in-sidebar styling:** LOW confidence, unconfirmed. Architectural mechanism fully documented; the dark/light menu decision gates Phase C. **Flag: resolve in UI-SPEC.**
- **`SidebarInput`/`SidebarGroupAction`/`SidebarMenuAction`** (all exported, unused today): if future phases add a sidebar search box or per-item actions, they inherit dark automatically (var-based) — no research needed, but keep them out of the initial diff.
- **Tooltip usage in collapsed mode:** not present today; if added later, `TooltipContent` is portaled with inverted colors — works as-is; no action.

## Sources

- Direct source reads (HIGH confidence, verified this session): `src/components/ui/sidebar.tsx` (var-driven primitives, no theme variant, `data-sidebar="sidebar"` hooks at :187/:242, `className` dropped on mobile :155, `SidebarRail` unused), `src/app/globals.css` (`@theme inline` mapping, `:root`/`.dark` blocks, `@custom-variant dark`), `src/components/layout/app-sidebar.tsx` (indigo-50 active strings, amber badge), `src/components/layout/app-shell-layout.tsx` (shared shell, `pendingCount`, trigger in `SidebarInset`), `src/components/layout/sidebar-resize-handle.tsx` (sibling strip, `hover:bg-indigo-200`), `src/components/ui/dropdown-menu.tsx` (portal with no `container` prop), `src/components/explorer/explorer-menu.tsx` (light-surface placements), `(dashboard)`/`companies`/`personas` layouts (single shared `AppShellLayout`), `package.json` (Tailwind v4, Next 16.2, React 19.2).
- Exa design system analysis (MEDIUM confidence): https://www.shadcn.io/design/exa — near-black `#181815` canvas, tight 2px/4px radii, scarce electric-blue `#1f40ed` voltage; dark dashboard product chrome.
- Exa dashboard surface (LOW confidence for sidebar-menu specifics): https://dashboard.exa.ai — dark sidebar with light content confirmed visually; dropdown-in-sidebar coloring unconfirmed.

---
*Architecture research for: v1.2 Exa-Style Left Panel dark sidebar scoping*
*Researched: 2026-08-01*
