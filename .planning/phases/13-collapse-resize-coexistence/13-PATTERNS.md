# Phase 13: Collapse & Resize Coexistence — Pattern Map

**Mapped:** 2026-08-01
**Files analyzed:** 4 (2 modified, 2 optional new)
**Analogs found:** 4 / 4 (plus vendored read-only contracts; 2 novel-but-trivial usages flagged)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/layout/app-sidebar.tsx` (MODIFIED) | component (client) | request-response (render) | the file itself (201-line current structure — insertion points at `<Sidebar>`:56, `SidebarHeader`:57-62, nav rows:68-118, pill:141-152, user trigger:164-181); `SidebarMenuButton` `tooltip` prop mechanism (`src/components/ui/sidebar.tsx:490-538`); `SidebarTrigger` (`sidebar.tsx:253-277`) as the toggle-button idiom | exact (same file) + role-match (vendored consumers) |
| `src/components/layout/sidebar-resize-handle.tsx` (MODIFIED) | component (client) | event-driven (pointer drag) + request-response (render) | the file itself (91-line drag contract — early-return insertion after line 19); `SidebarTrigger`/`SidebarRail` (`sidebar.tsx:253-302`) as the only existing `useSidebar()` consumer components | exact (same file) + role-match |
| `src/lib/sidebar-collapse.ts` (NEW — optional) | utility (pure function) | transform (state/key/count → label string) | `src/lib/nav.ts` — same directory, same convention (NavKey union + pure function), same extraction motive | exact |
| `src/lib/sidebar-collapse.test.ts` (NEW — optional) | test | unit | `src/lib/nav.test.ts` (11 cases) / `src/lib/user.test.ts` (8 cases) | exact |

**Scope fence (hard):** the phase touches ONLY `app-sidebar.tsx` + `sidebar-resize-handle.tsx` (collapse-hide lines only) (+ the 2 optional `src/lib/sidebar-collapse*` files). `src/components/ui/sidebar.tsx`, `tooltip.tsx`, `button.tsx`, `dropdown-menu.tsx`, `src/app/globals.css`, `app-shell-layout.tsx`, `package.json`, `package-lock.json` are **consumers only — UNTOUCHED** (fence gates verify empty `git diff`). Zero new npm packages — `lucide-react` (`PanelLeftClose`/`PanelLeftOpen` verified at `node_modules/lucide-react/dist/lucide-react.d.ts:14590/14603`), `radix-ui`, `vitest` all already installed.

---

## Pattern Assignments

### `src/components/layout/app-sidebar.tsx` (component — client; MODIFIED)

**Analog:** the file itself (every insertion point and class convention is already in this file) + the vendored `SidebarMenuButton` `tooltip` prop (sidebar.tsx:490-538) which is the entire rail-tooltip mechanism, + `SidebarTrigger` (sidebar.tsx:253-277) as the icon-button-toggle idiom. There is **zero** app-level `useSidebar()` usage today (grep-verified: all 5 usages are inside the vendored sidebar.tsx at 46/164/258/280/504) — AppSidebar becomes the first phase-owned `useSidebar()` consumer. AppSidebar renders inside `SidebarProvider` (app-shell-layout.tsx:35-36), so the hook is legal here.

**Imports pattern — current block (app-sidebar.tsx:1-29), to EXTEND, not replace:**
```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser, SignOutButton } from '@clerk/nextjs';
import { Building2, Inbox, LayoutDashboard, Mail, Users } from 'lucide-react';
import { getActiveNavKey } from '@/lib/nav';
import { getUserDisplayName, getUserInitials } from '@/lib/user';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarMenuBadge, SidebarSeparator,
} from '@/components/ui/sidebar';
```
New imports to add (all already installed): `PanelLeftClose, PanelLeftOpen` appended to the existing lucide import (app-sidebar.tsx:6); `useSidebar` added to the `'@/components/ui/sidebar'` import block (line 17-29); `Tooltip, TooltipContent, TooltipProvider, TooltipTrigger` from `'@/components/ui/tooltip'` (new import line). Import style: `@/` alias — the established layout-component convention (app-shell-layout.tsx:2-4, sidebar.tsx:7-24, dropdown-menu.tsx all use `@/`; the CLAUDE.md "relative imports" note is stale Astro-era guidance, per the Phase 12 map).

**The single activation switch — `<Sidebar>` at line 56:**
```tsx
return (
  <TooltipProvider delayDuration={200}>   {/* NEW — D-09 ~200ms; NO existing analog (see No Analog Found #1) */}
    <Sidebar collapsible="icon">          {/* line 56 — was <Sidebar> (offcanvas default) */}
      ...
    </Sidebar>
  </TooltipProvider>
);
```
`collapsible="icon"` is the whole COLR-01 activation: the desktop wrapper's `data-collapsible={state === "collapsed" ? collapsible : ""}` (sidebar.tsx:211) makes every `group-data-[collapsible=icon]:` selector resolve exactly when collapsed with this prop set — 48px rail width (`w-(--sidebar-width-icon)`, sidebar.tsx:225/236), nav rows `size-8!` (sidebar.tsx:469), label fade (sidebar.tsx:404). **Do NOT thread a prop through app-shell-layout.tsx** (frozen contract; hardcoding here is the one-line change in the phase's own file).

**Header restructure — current block (app-sidebar.tsx:57-62), the 2-row D-03/D-12 layout:**
```tsx
<SidebarHeader className="gap-1 p-2">     {/* was p-3 → p-2 per D-12 (48px rail, 8px gutters) */}
  <div className="flex justify-end">       {/* D-03 row 1: collapse button top-right, 32px */}
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
  <div className="flex flex-col gap-1">    {/* D-03 row 2: letter-mark above the faded wordmark */}
    {/* D-11 letter-mark — 28px, tokens only, 12.63:1; aria-hidden: the faded wordmark
        below stays in the accessibility tree, so the mark is decorative (RESEARCH A3) */}
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
</SidebarHeader>
```
`Button size="icon"` = 32px (button.tsx:29 `icon: "size-8"`). The button's `onClick={toggleSidebar}` drives the ONE shared open state (D-06) — same `toggleSidebar` ⌘B and the topbar `SidebarTrigger` call (sidebar.tsx:91-93); the `sidebar_state` cookie write lives inside the vendored `setOpen` (sidebar.tsx:84-85), byte-identical. **Why-comment hygiene (11-02 Rule 1):** describe the swap/state mechanism without quoting swept class strings (see Shared Patterns → comment hygiene).

**Nav rows — the `tooltip` prop (4 rows; D-07/D-08). Current row shape (app-sidebar.tsx:68-77) with the ONE new prop:**
```tsx
<SidebarMenuButton
  asChild
  isActive={activeKey === 'start'}
  tooltip="Start"                             {/* NEW — one prop per row (D-08 verbatim copy) */}
  className="h-[30px] p-0 px-2 gap-2.5 rounded-[4px] text-[15px] font-normal"
>
  <Link href="/"><LayoutDashboard /><span>Start</span></Link>
</SidebarMenuButton>
```
Rows 2/3/4 at lines 80-89 (`tooltip="Companies"`), 92-101 (`tooltip="Key Personas"`), 109-118 (`tooltip={pendingCount > 0 ? `Reviews (${pendingCount})` : 'Reviews'}` — the D-08 context-aware copy). The vendored mechanism (sidebar.tsx:527-536): string `tooltip` → `Tooltip` + `TooltipTrigger asChild` wrapping the button, `TooltipContent side="right" align="center" hidden={state !== "collapsed" || isMobile}` — armed ONLY in the desktop collapsed rail, so expanded-state hover is unaffected. **Do NOT hand-roll these tooltips** — the prop is the whole mechanism.

**Pill — `tooltip="Give us feedback"` (app-sidebar.tsx:141-152).** Same one-prop addition to the existing `SidebarMenuButton asChild` wrapping the mailto `<a>` (line 145). Matches its existing `aria-label="Give us feedback"` (line 145) — D-08 lock.

**User trigger — `tooltip={getUserDisplayName(user)}` (app-sidebar.tsx:164-181).** One-prop addition to the `SidebarMenuButton size="lg"` inside `DropdownMenuTrigger asChild` (line 165-168). Note the two stacked `asChild` boundaries (`DropdownMenuTrigger asChild > SidebarMenuButton tooltip` — where the button's own output wraps in `TooltipTrigger`); the documented shadcn composition under React 19 ref-as-prop (RESEARCH A2 — the one non-pre-verified interaction). **Fallback if Slot-in-Slot misbehaves (runtime symptom: dropdown fails to open / console warning):** wrap the `DropdownMenu` in a manual `Tooltip` at the `DropdownMenuTrigger` level instead of the `tooltip` prop — manual composition precedent below.

**The collapse-button `useSidebar()` — where it's called from:** AppSidebar's body, alongside the existing `usePathname()`/`useUser()` hooks (app-sidebar.tsx:45-53):
```tsx
const { state, toggleSidebar } = useSidebar();   // NEW — legal: AppSidebar renders inside SidebarProvider (app-shell-layout.tsx:36)
```
`useSidebar` contract (sidebar.tsx:46-53): returns `{ state, open, setOpen, openMobile, setOpenMobile, isMobile, toggleSidebar }`, throws outside the provider. The destructure only needs `state` (icon swap) + `toggleSidebar` (click).

**Error handling:** n/a — pure client render work; the only failure mode is `useSidebar()` throwing outside the provider, which is structurally impossible (provider containment verified at app-shell-layout.tsx:35-42).

---

### `src/components/layout/sidebar-resize-handle.tsx` (component — client; MODIFIED — the ONLY production change beyond app-sidebar.tsx)

**Analog:** the file itself (91-line drag contract — the D-04 hide is a two-line insertion) + `SidebarTrigger`/`SidebarRail` (sidebar.tsx:253-302) as the only existing components that call `useSidebar()` and render inside the provider. No app-level `useSidebar()` consumer exists to copy — this file becomes the first (the collapse button in app-sidebar.tsx is the second).

**Imports + early return — current block (sidebar-resize-handle.tsx:1-19) with the D-04 insertion:**
```tsx
'use client';

import { useCallback, useRef } from 'react';
import { useSidebar } from '@/components/ui/sidebar';   // NEW — only new import

const MIN_WIDTH = 200;
const MAX_WIDTH = 400;
const COOKIE_NAME = 'sidebar_width';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export function SidebarResizeHandle() {
  const { state } = useSidebar();                       // NEW
  if (state === 'collapsed') return null;               // NEW — D-04: no resize affordance in the 48px rail
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const wrapperRef = useRef<HTMLElement | null>(null);
  // ...rest of the drag contract UNCHANGED (handlePointerMove/Up/Down, the 200-400 clamp,
  //    the sidebar_width cookie write at line 45, the imperative --sidebar-width write at line 27)...
```
Everything from line 21 down stays byte-identical (COLR-02). **Early-return placement is BEFORE the refs** (hook order — `useSidebar()` is a hook and must not be conditional, but the early return after all hooks is fine; refs are hooks too, so the early return goes AFTER the three `useRef` declarations, i.e., after line 19). The handle's imperative `style.setProperty('--sidebar-width', ...)` (line 27) can never run while collapsed → the cookie-threaded var stays at its last persisted value → automatic D-05 width restore on expand. Layout stability: the sidebar's in-flow gap div reserves the width (sidebar.tsx:217-227), so the handle vanishing doesn't shift anything.

**Why-comment for the hide (1-2 lines, above the early return, class-string-free):** explain that the rail is fixed-width (D-04) and the imperative width write must not run mid-collapse (Pitfall 5) — follow the existing file's comment density (lines 10-15, 73-78).

---

### `src/lib/sidebar-collapse.ts` (utility — pure function; NEW — optional, planner's call per RESEARCH Open Question 2)

**Analog:** `src/lib/nav.ts` (15 lines, whole-file template) and `src/lib/user.ts` (32 lines) — same directory, same phase-family convention: dependency-free, named-export, total-function modules extracting inline sidebar logic from `app-sidebar.tsx` into tested pure functions. Both exist as committed precedents; this helper is the third.

**Whole-file template — mirroring `nav.ts:1-6` + `user.ts:1-14` (why-comment + union type + named exports):**
```typescript
// Tooltip-label copy for the collapsed rail (D-08). The labels are contract-
// locked (10-UI-SPEC §Copywriting Contract: "Reviews (N)" when pendingCount
// > 0, else "Reviews"), so the exact strings live here under Vitest — a
// drive-by wording edit in the sidebar can never silently break the copy
// contract. NavKey is reused from nav.ts for type-safe routing keys.

import type { NavKey } from '@/lib/nav';

export function getCollapseToggleLabel(state: 'expanded' | 'collapsed'): 'Collapse' | 'Expand' {
  return state === 'collapsed' ? 'Expand' : 'Collapse';
}

export function getNavTooltipLabel(key: NavKey, pendingCount: number): string {
  if (key === 'reviews') return pendingCount > 0 ? `Reviews (${pendingCount})` : 'Reviews';
  return { start: 'Start', companies: 'Companies', personas: 'Key Personas' }[key];
}
```
Style per repo (CONVENTIONS.md + nav.ts/user.ts): single quotes, semicolons, 2-space indent, camelCase, no JSDoc, why-comments that do NOT quote swept class strings. Named exports only. Total functions — every input maps to a string, never throws (matches nav.ts's `null` terminal return and user.ts's `'User'`/`'A'` terminal fallbacks).

**Reuse decision (RESEARCH Q2):** extraction vs. inline ternaries is the planner's call. If inlined, the `Reviews (N)`/`Collapse`/`Expand` strings live directly in `app-sidebar.tsx` props and the COLR-03 D-08 gate becomes a line-scoped grep instead of a unit test. The extraction path adds 2 files but locks the copy with Vitest per the Phase 10/12 convention.

---

### `src/lib/sidebar-collapse.test.ts` (test — unit; NEW — optional, pairs with the helper)

**Analog:** `src/lib/nav.test.ts` (48 lines) / `src/lib/user.test.ts` (50 lines) — exact (same directory, same file shape, the phase-family precedent for testing sidebar pure functions). Auto-discovered: `vitest.config.ts:12` is `include: ['src/**/*.test.ts']` — placement at exactly `src/lib/sidebar-collapse.test.ts` is required.

**Imports + structure template — `nav.test.ts:1-7` (verbatim):**
```typescript
import { describe, it, expect } from 'vitest';
import { getActiveNavKey } from './nav';

describe('getActiveNavKey', () => {
  it("returns 'start' for the exact root path", () => {
    expect(getActiveNavKey('/')).toBe('start');
  });
```
`sidebar-collapse.test.ts` mirrors: `import { describe, it, expect } from 'vitest';` + `import { getCollapseToggleLabel, getNavTooltipLabel } from './sidebar-collapse';` — module under test imported **relatively** (`./sidebar-collapse`), the repo's test convention (nav.test.ts:2, user.test.ts:2). One `describe` per exported function; one `it` per behavior; `expect(...).toBe(...)`. No fixtures needed (both functions are string-param pure functions — simpler than user.test.ts's `baseUser` fixture).

**Case set (per RESEARCH §Code Examples):**
- `getNavTooltipLabel`: verbatim labels for non-Reviews keys (`('start', 0)` → `'Start'`, `('companies', 5)` → `'Companies'`, `('personas', 0)` → `'Key Personas'`); the D-08 lock — `('reviews', 0)` → `'Reviews'` and `('reviews', 3)` → `'Reviews (3)'`.
- `getCollapseToggleLabel`: `('expanded')` → `'Collapse'`; `('collapsed')` → `'Expand'`.

**Verification:** `npx vitest run src/lib/sidebar-collapse.test.ts --bail=1` green (node env, no DOM — vitest.config.ts:11). **`--bail=1`, NOT `-x`** — the `-x` flag was removed in Vitest 4 (Phase 12 Deviation 1, documented in 12-01-SUMMARY). Full suite `npm test` stays green alongside nav.test.ts 11/11 + user.test.ts 8/8.

---

### Vendored primitives consumed (READ-ONLY contracts — the "do not edit" set)

**`SidebarMenuButton` `tooltip` prop (sidebar.tsx:490-538) — the entire rail-tooltip mechanism, one prop:**
```tsx
function SidebarMenuButton({
  asChild = false, isActive = false, variant = "default", size = "default",
  tooltip, className, ...props
}: React.ComponentProps<"button"> & {
  asChild?: boolean
  isActive?: boolean
  tooltip?: string | React.ComponentProps<typeof TooltipContent>
} & VariantProps<typeof sidebarMenuButtonVariants>) {
  const Comp = asChild ? Slot.Root : "button"
  const { isMobile, state } = useSidebar()

  const button = (<Comp ... className={cn(sidebarMenuButtonVariants({ variant, size }), className)} {...props} />)

  if (!tooltip) return button
  if (typeof tooltip === "string") tooltip = { children: tooltip }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right" align="center" hidden={state !== "collapsed" || isMobile} {...tooltip} />
    </Tooltip>
  )
}
```
This block is ALSO the only in-repo precedent for the manual `Tooltip`/`TooltipTrigger`/`TooltipContent` composition the collapse button needs (app-sidebar header) — copy the composition shape, minus the `hidden` gate (the collapse button's tooltip shows in BOTH states per D-02/D-08).

**`sidebarMenuButtonVariants` (sidebar.tsx:468-488) — the dormant rail classes the nav rows already get for free:**
```
"peer/menu-button group/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm ring-sidebar-ring outline-hidden transition-[width,height,padding] ... group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent ... data-active:bg-sidebar-accent data-active:font-medium data-active:text-sidebar-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&>span:last-child]:truncate",
```
`data-active:bg-sidebar-accent` is state-independent → the ≥3:1 active pill (COLR-03, QLTY-02 pre-verified #909090) is active in the rail with zero Phase 13 code. `[&_svg]:size-4` auto-sizes the 16px icons. `size="lg"` variant (`h-12 ... group-data-[collapsible=icon]:p-0!`, line 480) is already on the user trigger.

**`useSidebar` contract (sidebar.tsx:46-53) + `toggleSidebar` (sidebar.tsx:91-93) + `setOpen` cookie write (sidebar.tsx:84-85):**
```tsx
function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) throw new Error("useSidebar must be used within a SidebarProvider.")
  return context
}
// toggleSidebar: isMobile ? setOpenMobile(!open) : setOpen(!open)  — line 91-93
// setOpen writes: document.cookie = `sidebar_state=${openState}; ...`  — line 84-85
```
The collapse button is just another caller of this same `toggleSidebar` (D-06 — ONE source of truth shared with ⌘B, sidebar.tsx:96-109, and the topbar `SidebarTrigger`). `data-collapsible={state === "collapsed" ? collapsible : ""}` (sidebar.tsx:211) is the switch the whole rail hangs off.

**`SidebarTrigger` (sidebar.tsx:253-277) — the icon-button-toggle idiom the collapse button extends:**
```tsx
function SidebarTrigger({ className, onClick, ...props }: React.ComponentProps<typeof Button>) {
  const { toggleSidebar } = useSidebar()
  return (
    <Button data-sidebar="trigger" data-slot="sidebar-trigger" variant="ghost" size="icon-sm"
      className={cn(className)}
      onClick={(event) => { onClick?.(event); toggleSidebar() }} {...props}>
      <PanelLeftIcon />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  )
}
```
The collapse button differs: `size="icon"` (32px, not `icon-sm` 28px — D-02/D-12), `PanelLeftClose`/`PanelLeftOpen` swap (not fixed `PanelLeftIcon`), `aria-label` swap by state, and a manual `Tooltip` wrapper (shows in both states). `variant="ghost"` + `toggleSidebar()` + lucide icon + `sr-only`-grade a11y are the shared idiom.

**`TooltipProvider` (tooltip.tsx:8-19) — the D-09 delay mount (usage of a vendored export, NOT an edit):**
```tsx
function TooltipProvider({ delayDuration = 0, ...props }) {
  return <TooltipPrimitive.Provider data-slot="tooltip-provider" delayDuration={delayDuration} {...props} />
}
```
Default `delayDuration = 0` at the vendored boundary; the mount passes `delayDuration={200}` (D-09 ~200ms). Without the mount, Radix runs its 700ms default — the tooltips "work" but feel laggy (Pitfall 2). **Never mounted anywhere in `src/` today** (grep-verified — see No Analog Found #1).

**`TooltipContent` (tooltip.tsx:33-55) — the D4 app-theme portal, already correct:**
```
"z-50 ... rounded-md bg-foreground px-3 py-1.5 text-xs text-background ... data-[side=right]:slide-in-from-left-2 ..."
```
Portals to `document.body` with `bg-foreground text-background` global tokens — exactly the D4 policy (light app-theme, zero tooltip.tsx edits). `side="right"` is what the collapse button and nav tooltips use.

**`Button size="icon"` (button.tsx:29) — the 32px box:**
```
icon: "size-8",   // button.tsx:29 — exactly 32px, the D-02/D-12 collapse-button size
```
Auto-sizes child svg to 16px (button.tsx:8 per RESEARCH) — same as `SidebarTrigger`'s child icon.

**`SidebarHeader` (sidebar.tsx:331-340) — bare container, no built-in collapse handling:**
```tsx
<div data-slot="sidebar-header" data-sidebar="header"
  className={cn("flex flex-col gap-2 p-2", className)} {...props} />
```
The `gap-1 p-2` override comes from app-sidebar.tsx's className (D-12). Descendant of the `group` + `data-collapsible` wrapper (sidebar.tsx:209-214), so `group-data-[collapsible=icon]:` selectors resolve inside the header — the letter-mark and button classes fire there.

**Server shell threading (app-shell-layout.tsx:34-42, READ-ONLY fence):**
```tsx
<SidebarProvider style={{ '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties}>
  <AppSidebar pendingCount={pendingCount} />
  <SidebarResizeHandle />
  <SidebarInset>
    <SidebarTrigger />
    {children}
  </SidebarInset>
</SidebarProvider>
```
Frozen. The provider's `...style` spread wins over its `16rem` default (sidebar.tsx:132-138) → `--sidebar-width` is cookie-threaded; collapse only swaps the CSS width class (`group-data-[collapsible=icon]:w-(--sidebar-width-icon)`, sidebar.tsx:225/236), the var untouched → D-05 restore automatic. `pendingCount` (server `countPendingProposals()` at app-shell-layout.tsx:27-32) is what the Reviews tooltip string consumes — client can't query the DB (09-03 precedent, why-comment at app-sidebar.tsx:36-38).

---

## Shared Patterns

### `useSidebar()` consumption (first app-level consumers)
**Source:** vendored `useSidebar` (sidebar.tsx:46-53); component-level idiom from `SidebarTrigger` (sidebar.tsx:258) / `SidebarRail` (sidebar.tsx:280)
**Apply to:** `app-sidebar.tsx` (collapse button: `const { state, toggleSidebar } = useSidebar()`), `sidebar-resize-handle.tsx` (D-04 hide: `const { state } = useSidebar()`)
- Legal because both components render inside `SidebarProvider` (app-shell-layout.tsx:35-42, verified)
- Hook throws outside the provider (sidebar.tsx:49) — never call it in a server component
- In the resize handle, the early return MUST come after all hook calls (refs at lines 17-19) to preserve hook order

### Dormant collapsed-rail classes (`group-data-[collapsible=icon]:`) — activation, not authoring
**Source:** app-sidebar.tsx:130 (Reviews dot), 149 (pill icon), 58 (wordmark fade); sidebar.tsx:469/480 (menu-button variants), 404 (label fade)
**Apply to:** all Phase 13 class additions in `app-sidebar.tsx` — the rail anatomy (D-10) is composed of ALREADY-SHIPPED dormant classes plus the letter-mark's `group-data-[collapsible=icon]:flex` toggle (RESEARCH A4: proven at app-sidebar.tsx:130/149). Any NEW width/animation CSS or second cookie violates COLR-02/D-06 — reject it.

### Why-comment convention (class-string-free, 11-02 Rule 1 / QLTY-04)
**Source:** app-sidebar.tsx:31-42, 48-52, 159-162; nav.ts:1-4; user.ts:1-6; 11-02-PLAN.md
**Apply to:** all new code in `app-sidebar.tsx` + `sidebar-resize-handle.tsx` + `sidebar-collapse.ts`
- 3-4 line blocks above non-obvious decisions: the letter-mark `aria-hidden` rationale (A3), the shared-state rationale for `toggleSidebar` (D-06), the resize-handle early-return rationale (D-04/Pitfall 5), the helper's copy-contract lock
- No JSDoc; comments explain *why*, not *what*; never quote the swept token strings (e.g., don't write `group-data-[collapsible=icon]:block` in a comment when a gate counts its instances — Pitfall 3 / 11-02 Rule 1)

### Vitest unit-test conventions
**Source:** nav.test.ts (whole file), user.test.ts (whole file), vitest.config.ts:10-13
**Apply to:** `sidebar-collapse.test.ts` (if the helper is extracted)
- `import { describe, it, expect } from 'vitest';` — named imports, never globals
- One `describe` per exported function; one `it` per behavior; `expect(...).toBe(...)`
- Module under test imported relatively (`./sidebar-collapse`); single quotes, semicolons, 2-space indent
- node environment (vitest.config.ts:11), auto-discovered via `src/**/*.test.ts` include (vitest.config.ts:12) — file MUST live at exactly `src/lib/sidebar-collapse.test.ts`
- Run: `npx vitest run src/lib/sidebar-collapse.test.ts --bail=1` (**NOT `-x`** — removed in Vitest 4, Phase 12 Deviation 1); `npm test` full suite

### Named-export module convention
**Source:** nav.ts:6,8; user.ts:8,16,25; `src/lib/import/dedupKeys.ts`; `src/lib/params/companyFilters.ts:27-33`
**Apply to:** `sidebar-collapse.ts`
- Named exports only, no default exports anywhere in `src/lib/`
- `import type { NavKey }` (type-only import for the union — nav.ts:6 is the source of the union)
- Total functions: every input matching the declared shape → string, never throws

### Token-only styling
**Source:** sidebar.tsx:469/473/480; tooltip.tsx:45 (`bg-foreground text-background`); globals.css:90-91 (`--sidebar-primary #333333` / `--sidebar-primary-foreground`)
**Apply to:** all Phase 13 className strings in `src/components/layout/`
- In-subtree surfaces: `--sidebar-*` tokens only — collapse button `text-sidebar-foreground`, letter-mark `bg-sidebar-primary text-sidebar-primary-foreground` (12.63:1, D-11)
- Portaled tooltips (at `document.body`, OUTSIDE the `[data-sidebar="sidebar"]` subtree): **global** tokens (`bg-foreground text-background`) — correct per D4, not a leak
- QLTY-04 sweep gate stays 0: `test -z "$(grep -rnE 'indigo|amber|#[0-9a-fA-F]{3,8}|\bdark:' src/components/layout/)"`

### Verification gates (COLR-02 fence + COLR-01/03 grep)
**Source:** Phases 10-12 (11-02-PLAN.md sweep precedent; 12-PATTERNS.md)
**Apply to:** every Phase 13 task
- Fence: `git diff <base> HEAD -- src/components/ui/sidebar.tsx src/components/ui/tooltip.tsx src/components/ui/button.tsx src/components/ui/dropdown-menu.tsx src/components/layout/app-shell-layout.tsx src/app/globals.css package.json package-lock.json` = empty
- Fence (resize contract): `git diff <base> HEAD -- src/components/layout/sidebar-resize-handle.tsx` = ONLY the `useSidebar` import + `const { state }` + early return; `MIN_WIDTH`/`MAX_WIDTH` = 200/400, `COOKIE_NAME = 'sidebar_width'`, the line-27 `setProperty` and line-45 cookie write unchanged
- Grep: `grep -c 'collapsible="icon"' src/components/layout/app-sidebar.tsx` = 1; `grep -c 'tooltip=' src/components/layout/app-sidebar.tsx` ≥ 5 (6 SidebarMenuButtons); `grep -c 'PanelLeftClose'` ≥ 1 and `PanelLeftOpen` ≥ 1; `grep -c '<TooltipProvider'` = 1 — **line-scope new-content gates where strings already exist in the file** (Pitfall 3: `bg-sidebar-primary` already on the avatar at line 173; `group-data-[collapsible=icon]:block` already on the dot at 130 and pill icon at 149)
- Static gates: `npx tsc --noEmit`; `npm test`; `npm run build`

---

## No Analog Found

| File / Surface | Role | Data Flow | Reason |
|----------------|------|-----------|--------|
| `TooltipProvider` mount (in `app-sidebar.tsx`) | provider (vendored export usage) | request-response (render) | **No existing analog** — grep-verified: `TooltipProvider` appears only at tooltip.tsx:8 (definition) and 57 (export); **never mounted anywhere in `src/`**. Novel-but-trivial: mounting a vendored provider with `delayDuration={200}` wrapping `<Sidebar>` is usage, not an edit, and is the documented shadcn composition (RESEARCH A1: if Radix's unprovided default were already short, the mount is still harmless). Planner should NOT treat this as a new pattern to invent — it's a one-line wrapper around an existing export |
| Manual `<Tooltip>` wrapper (collapse button) | component composition | event-driven (hover/focus) | **No app-level analog** — no `<Tooltip>`/`TooltipContent` usage outside the vendored sidebar.tsx (grep-verified: 528-535 only). The composition shape to copy IS the vendored `SidebarMenuButton` tooltip block (sidebar.tsx:527-537) minus the `hidden` gate; `TooltipContent side="right"` ships `bg-foreground text-background` already |
| `PanelLeftClose`/`PanelLeftOpen` icon swap | component (icon) | event-driven | No existing app usage; closest analog is `SidebarTrigger`'s `PanelLeftIcon` (sidebar.tsx:273). Icons verified as `ForwardRefExoticComponent` exports in installed `lucide-react@1.26.0` (d.ts:14590/14603, index 23876/23878) |
| `collapsible="icon"` prop value | config (component prop) | — | The `"icon"` variant of the `collapsible` prop (sidebar.tsx:154 default `"offcanvas"`, 162 union `"offcanvas" | "icon" | "none"`) has never been used in the repo — this is its first activation, by design (dormant mechanism shipped in Phases 10-12) |

**Planner notes for the novel surfaces (all usage-of-vendored, zero edits):**
1. **TooltipProvider mount** — place `<TooltipProvider delayDuration={200}>` in `app-sidebar.tsx` wrapping `<Sidebar>`, NOT in `app-shell-layout.tsx` (frozen; RESEARCH alternatives table — app-sidebar keeps the diff in the phase's file and the provider adjacent to its consumers). Mount in the client component (app-sidebar.tsx:1 is `'use client'`).
2. **Collapse-button tooltip** — the button is NOT a `SidebarMenuButton` (it's a plain `Button`), so the `tooltip` prop doesn't apply; use the manual `Tooltip`/`TooltipTrigger asChild`/`TooltipContent side="right"` composition from sidebar.tsx:527-537, with content `{state === 'collapsed' ? 'Expand' : 'Collapse'}` (D-08) and NO `hidden` gate (shows in both states, D-02).
3. **Nested Slot composition on the user trigger** — `DropdownMenuTrigger asChild > SidebarMenuButton tooltip={getUserDisplayName(user)}` stacks two Radix `asChild` boundaries (RESEARCH A2). Implement per Pattern 2 and runtime-verify (hover shows name, click opens dropdown). Fallback: manual `Tooltip` at the `DropdownMenuTrigger` level.
4. **Optional helper vs. inline** — extraction (2 files) locks D-08 copy with Vitest; inlining (0 files) keeps the single-file diff. RESEARCH Q2 recommends extraction (precedent-aligned); planner may inline if diff discipline dominates.

---

## Metadata

**Analog search scope:** `src/components/layout/` (app-sidebar.tsx 201 lines full read, sidebar-resize-handle.tsx 91 lines full read, app-shell-layout.tsx 44 lines full read), `src/components/ui/` (sidebar.tsx 702 lines full read, tooltip.tsx 57 lines full read, button.tsx grep-verified `icon: "size-8"`), `src/lib/` (nav.ts, nav.test.ts, user.ts, user.test.ts full reads), `node_modules/lucide-react/dist/lucide-react.d.ts` (grep-verified `PanelLeftClose`/`PanelLeftOpen` exports), `vitest.config.ts` (per 12-PATTERNS: include `src/**/*.test.ts`, node env)
**Files scanned:** ~10 (4 full reads of phase files + 3 full reads of vendored/analog files + targeted greps)
**Pattern extraction date:** 2026-08-01
**Key verifications:** zero app-level `useSidebar()` consumers (all 5 usages inside vendored sidebar.tsx); `TooltipProvider` never mounted in `src/` (2 matches, both in tooltip.tsx); no manual `<Tooltip>` outside sidebar.tsx:527-537; `PanelLeftClose`/`PanelLeftOpen` verified in installed lucide-react; `Button size="icon"` = `size-8` (button.tsx:29); `SidebarProvider` containment at app-shell-layout.tsx:35-42; `data-collapsible` switch at sidebar.tsx:211; `SidebarMenuButton` tooltip prop + `hidden={state !== "collapsed" || isMobile}` at sidebar.tsx:490-538; `SidebarTrigger`/`SidebarRail` `useSidebar` idiom at sidebar.tsx:253-302; `toggleSidebar` at sidebar.tsx:91-93; `sidebar_state` cookie write at sidebar.tsx:84-85; resize contract (MIN 200 / MAX 400 / `sidebar_width` cookie / line-27 `setProperty`) byte-verified in sidebar-resize-handle.tsx.
