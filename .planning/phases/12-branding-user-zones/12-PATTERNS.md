# Phase 12: Branding & User Zones — Pattern Map

**Mapped:** 2026-08-01
**Files analyzed:** 3 (1 modified, 2 new)
**Analogs found:** 3 / 3

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/layout/app-sidebar.tsx` (MODIFIED) | component (client) | request-response (render) | the file itself (current 109-line structure — insertion points at `<Sidebar>`/`<SidebarContent>`); `src/components/explorer/explorer-menu.tsx` (canonical vendored DropdownMenu usage); `src/components/enrichment/enrichment-review-dialog.tsx` (DropdownMenu action-item pattern) | exact (same file) + role-match (dropdown usage) |
| `src/lib/user.ts` (NEW) | utility (pure function) | transform (Clerk user → display string) | `src/lib/nav.ts` — same convention, same phase family, same purpose (nullability lock for sidebar rendering) | exact |
| `src/lib/user.test.ts` (NEW) | test | unit | `src/lib/nav.test.ts` | exact |

**Scope fence (hard):** the phase touches ONLY `app-sidebar.tsx` (+ `src/lib/user.ts` + `src/lib/user.test.ts`). `src/components/ui/sidebar.tsx`, `dropdown-menu.tsx`, `tooltip.tsx`, `src/app/globals.css`, `src/app/(dashboard)/layout.tsx`, `app-shell-layout.tsx`, `package.json`, `package-lock.json` are **consumers only — UNTOUCHED** (fence gates verify empty `git diff`). Zero new npm packages (UI-SPEC §Registry Safety).

---

## Pattern Assignments

### `src/components/layout/app-sidebar.tsx` (component — client; MODIFIED)

**Analog:** the file itself (its current structure defines every insertion point and class convention) + `explorer-menu.tsx`/`enrichment-review-dialog.tsx` for DropdownMenu composition. There is **no** `avatar.tsx` (glob-verified) and **zero** `useUser`/`SignOutButton`/`useClerk` usage anywhere in `src/` (grep-verified) — the user zone is the repo's first client-identity consumer and first sign-out path, built only from vendored primitives.

**Imports pattern — current block (app-sidebar.tsx:1-16), to EXTEND, not replace:**
```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, Inbox, LayoutDashboard, Users } from 'lucide-react';
import { getActiveNavKey } from '@/lib/nav';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuBadge,
} from '@/components/ui/sidebar';
```
New imports to add (all already installed): `useUser`, `SignOutButton` from `'@clerk/nextjs'`; `Mail` from `'lucide-react'` (collapsed-rail pill icon, Q3); `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuItem`, `DropdownMenuTrigger` from `'@/components/ui/dropdown-menu'`; `getUserDisplayName`, `getUserInitials` from `'@/lib/user'`; `SidebarFooter`, `SidebarHeader`, `SidebarSeparator` added to the existing `'@/components/ui/sidebar'` import. Import style: `@/` alias (the current layout-component convention — `app-shell-layout.tsx:2-5`, `explorer-menu.tsx:5-11` all use `@/`; the CLAUDE.md "relative imports" note is stale Astro-era guidance).

**Why-comment convention (app-sidebar.tsx:18-25) — the model for the new zones' comments:**
```tsx
// Active-key detection comes from the tested getActiveNavKey pure function
// (src/lib/nav.ts, 11-case Vitest suite) — it locks the /companies/[id] detail
// highlight and the /companies-archive sibling-prefix guard so a drive-by
// "simplification" can never silently break the v1.1 active treatment.
//
// pendingCount is threaded from the server shell (app-shell-layout.tsx) — a
// client component cannot query the DB itself (09-03: Reviews sidebar badge,
// UI-SPEC §4). Shown only when > 0; an empty queue earns no visual noise.
```
Phase 12 gets the same treatment: one block above the user zone explaining `useUser()`'s discriminated-union guards + hydration contract (server frame renders identical empty state), one above `FEEDBACK_MAILTO` explaining D2 (static module-level constant, never user-interpolated). **Grep-gate hygiene (11-02 Rule 1):** comments must NOT contain literal class strings the acceptance gates count (e.g. do not write `hover:bg-sidebar-accent` in prose) — describe mechanisms without quoting swept tokens.

**Component signature — the server-threading pattern Phase 12 deliberately does NOT extend (app-sidebar.tsx:26):**
```tsx
export function AppSidebar({ pendingCount = 0 }: { pendingCount?: number }) {
```
`app-shell-layout.tsx:27-32,36` (server `countPendingProposals()` → prop) is the frozen pattern for **server data only**. Identity is client-side per BRND-02: `useUser()` reads the Clerk context already provided by `ClerkProvider` (`src/app/layout.tsx:20`) behind the `requireStaffAccess()` gate (`src/app/(dashboard)/layout.tsx:9`). **Do NOT add a server identity prop or touch `app-shell-layout.tsx`.**

**Current tree — insertion points (app-sidebar.tsx:30-108):**
```tsx
  return (
    <Sidebar>                                        {/* line 31 — SidebarHeader goes here, FIRST */}
      <SidebarContent>                               {/* line 32 — flex-1 (sidebar.tsx:373) */}
        ...two SidebarGroup blocks, unchanged...      {/* lines 33-105 */}
      </SidebarContent>
    </Sidebar>                                       {/* line 107 — SidebarFooter goes before this, LAST */}
  );
```
`SidebarContent` is `flex-1` (sidebar.tsx:373), so a `SidebarFooter` child of `<Sidebar>` pins to the bottom automatically. Order per RESEARCH architecture diagram: `SidebarHeader` → `SidebarContent` → `SidebarFooter`.

**Dormant collapsed-rail precedent — the Phase 11 dot (app-sidebar.tsx:97-100):**
```tsx
<span
  aria-hidden="true"
  className="absolute right-1.5 top-1/2 hidden h-2 w-2 -translate-y-1/2 rounded-full bg-sidebar-accent group-data-[collapsible=icon]:block"
/>
```
This is the exact mechanism Phase 12 pre-wires: `group-data-[collapsible=icon]:` classes are dormant today (`collapsible` defaults to `"offcanvas"`, sidebar.tsx:154) but resolve the moment Phase 13 flips `collapsible="icon"`. The desktop wrapper sets `group` + `data-collapsible` at sidebar.tsx:208-214, and header/footer are descendants, so the selectors resolve there too (RESEARCH A4).

**Nav-row styling reference for the user trigger (app-sidebar.tsx:37-46):**
```tsx
<SidebarMenuButton
  asChild
  isActive={activeKey === 'start'}
  className="h-[30px] p-0 px-2 gap-2.5 rounded-[4px] text-[15px] font-normal"
>
```
The user trigger follows the same `SidebarMenuButton` composition but with `size="lg"` (primitive h-12) per Q1 — wrapped via `<DropdownMenuTrigger asChild>` so Radix forwards `aria-expanded` to the `SidebarMenuButton` child (the canonical explorer-menu.tsx:24-50 precedent).

**Error handling:** n/a beyond the `useUser()` guard chain — see Shared Patterns → Client-identity guard chain.

---

### `src/lib/user.ts` (utility — pure function; NEW)

**Analog:** `src/lib/nav.ts` — the closest possible in-repo analog (same directory, same phase family, same extraction motive: inline nullable logic in `app-sidebar.tsx` becomes a tested pure function). Both are dependency-free, named-export, total-function modules.

**Whole-file template — `src/lib/nav.ts` (15 lines, verbatim):**
```typescript
// Active-route detection for the sidebar nav, extracted as a pure function
// so the /companies/[id] highlight can never be silently broken by a
// drive-by "simplification" (QLTY-01; PITFALLS Pitfall 7). The key is the
// ROUTE segment ('personas'), not the visible label ('Key Personas').

export type NavKey = 'start' | 'companies' | 'personas' | 'reviews';

export function getActiveNavKey(pathname: string): NavKey | null {
  if (pathname === '/') return 'start'; // exact — every route is a prefix match for '/'
  // Boundary guard: sibling prefixes like /companies-archive must not match.
  if (pathname === '/companies' || pathname.startsWith('/companies/')) return 'companies';
  if (pathname === '/personas' || pathname.startsWith('/personas/')) return 'personas';
  if (pathname === '/reviews' || pathname.startsWith('/reviews/')) return 'reviews';
  return null; // /sign-in, '', unknown
}
```
`user.ts` mirrors: 3-4 line why-comment block (every Clerk display field is individually nullable → the fallback chain is the regression lock; a null field must never render a blank row — Pitfall 2), named exports only, no imports needed from the repo, `null`-safe total functions (never throw — ASVS V5).

**Param-type pattern — IMPORTANT verified finding:** RESEARCH Assumption A2 (`import type { UserResource } from '@clerk/types'`) is **FALSE** — `@clerk/types` is NOT directly resolvable (no `node_modules/@clerk/types` at top level or under `@clerk/nextjs/node_modules`, verified 2026-08-01). Use a local structural `interface` instead — this matches CONVENTIONS.md (`interface` for object shapes; `type` reserved for unions) and the in-repo structural-param precedent (`src/lib/params/companyFilters.ts:27-33` — `parseSelectedId(params: { [key: string]: string | string[] | undefined })`). The real Clerk `UserResource` is structurally compatible with the declared fields:
```typescript
// Minimal structural slice of Clerk's UserResource (BRND-02). @clerk/types is
// not directly resolvable here, and UserResource's full shape is 30+ fields —
// declaring only the fields the display logic reads keeps this module
// dependency-free and total (any input matching the shape → string, never throws).
interface UserDisplayFields {
  username: string | null;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  primaryEmailAddress: { emailAddress: string } | null;
}
```

**Core functions (from RESEARCH §Code Examples; fallback chain per research A5):**
```typescript
export function getUserDisplayName(user: UserDisplayFields): string {
  return (
    user.username ??
    user.fullName ??
    user.primaryEmailAddress?.emailAddress ??
    'User'
  );
}

export function getUserInitials(user: UserDisplayFields): string {
  const first = user.firstName?.trim();
  const last = user.lastName?.trim();
  if (first || last) return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase();
  const email = user.primaryEmailAddress?.emailAddress;
  if (email) return email.slice(0, 2).toUpperCase();
  return 'A';
}
```
Style per repo: single quotes, semicolons, 2-space indent, camelCase, no JSDoc (CONVENTIONS.md).

---

### `src/lib/user.test.ts` (test — unit; NEW)

**Analog:** `src/lib/nav.test.ts` — exact (same directory, same file shape, the phase's own precedent for testing a sidebar-display pure function). Auto-discovered: `vitest.config.ts:12` is `include: ['src/**/*.test.ts']` — placement at exactly `src/lib/user.test.ts` is required (Pitfall 6 from Phase 10).

**Imports + structure template — `src/lib/nav.test.ts:1-7` (verbatim):**
```typescript
import { describe, it, expect } from 'vitest';
import { getActiveNavKey } from './nav';

describe('getActiveNavKey', () => {
  it("returns 'start' for the exact root path", () => {
    expect(getActiveNavKey('/')).toBe('start');
  });
```
`user.test.ts` mirrors: `import { describe, it, expect } from 'vitest';` + `import { getUserDisplayName, getUserInitials } from './user';` — the module under test is imported **relatively** (`./user`), the repo's test-file convention (nav.test.ts:2; vitest alias `@` → `./src` exists but tests use relative).

**Fixture pattern (structural stand-ins — the `as any` base object RESEARCH §Code Examples shows; the `interface UserDisplayFields` from user.ts makes the casts unnecessary):**
```typescript
const baseUser = {
  username: null,
  fullName: null,
  firstName: null,
  lastName: null,
  primaryEmailAddress: null,
};
```
With the exported `UserDisplayFields` interface, tests can type fixtures as `UserDisplayFields` — no `as any` needed. One `describe` per function; one `it` per behavior; `expect(...).toBe(...)`.

**Case set (6-8 cases, from RESEARCH §Code Examples — the nullability lock):**
- `getUserDisplayName`: prefers `username`; falls back to `fullName` when username is null; falls back to email when both names are null; **never returns an empty string** (all-null → `'User'`).
- `getUserInitials`: combines first+last initials (`'Jane Doe'` → `'JD'`); single-name → one letter; falls back to email prefix when names are null (`'jane@x.com'` → `'JA'`); all-null → `'A'`.

**Verification:** `npx vitest run src/lib/user.test.ts -x` green (node env, no DOM — vitest.config.ts:11); full suite `npm test` stays green alongside nav.test.ts 11/11.

---

### Vendored primitives consumed by app-sidebar.tsx (READ-ONLY contracts — the "do not edit" set)

**`SidebarHeader` / `SidebarFooter` (sidebar.tsx:331-351) — bare containers, NO built-in collapse handling:**
```tsx
function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-header"
      data-sidebar="header"
      className={cn("flex flex-col gap-2 p-2", className)}
      {...props}
    />
  )
}
```
Same shape for `SidebarFooter` (342-351, identical `flex flex-col gap-2 p-2`). Implication (Pitfall 3): every collapsed-rail class the zones need is **self-applied** — the header passes `className="gap-1 p-3"` (Q4 spacing), the footer relies on the primitive's `gap-2 p-2` default. `cn` merge is how app-sidebar.tsx passes className (sidebar.tsx uses `cn` from `@/lib/utils`, verified `src/lib/utils.ts:4`).

**`SidebarSeparator` (sidebar.tsx:353-365) — already tokenized to Exa's divider (Q5):**
```tsx
className={cn("mx-2 w-auto bg-sidebar-border", className)}
```
One line, zero custom classes — matches Exa's gray-200 hairline exactly (`--sidebar-border: #e5e7eb`).

**`sidebarMenuButtonVariants` (sidebar.tsx:468-488) — the trigger/pill class source:**
```tsx
const sidebarMenuButtonVariants = cva(
  "peer/menu-button group/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm ... group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ... data-active:bg-sidebar-accent data-active:font-medium data-active:text-sidebar-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&>span:last-child]:truncate",
  {
    variants: {
      variant: {
        default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        outline: "bg-background shadow-[0_0_0_1px_var(--sidebar-border)] ...",
      },
      size: {
        default: "h-8 text-sm",
        sm: "h-7 text-xs",
        lg: "h-12 text-sm group-data-[collapsible=icon]:p-0!",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)
```
Extracts the Phase 12 relies on: **hover is inherited** from the default variant (Q3 — the pill adds ZERO explicit hover classes; `h-9` overrides the size default); **`size="lg"`** gives the user trigger h-12 (Q1, 48px); `group-data-[collapsible=icon]:size-8!` gives the dormant 32px rail slot; `[&>span:last-child]:truncate` clips long names. Focus-visible ring (`focus-visible:ring-2 ring-sidebar-ring` in the base string, line 469) is inherited too.

**`SidebarGroupLabel` fade — the Q4 fade contract (sidebar.tsx:404):**
```
... group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0 ...
```
The wordmark block's `group-data-[collapsible=icon]:opacity-0 transition-opacity duration-200` (Q4) mirrors this primitive's own label-fade mechanism — fade, not `hidden`, preserving the Phase 13 letter-mark swap seam.

**`DropdownMenuContent` (dropdown-menu.tsx:34-51) — the D4 portal + app-theme default, UNTOUCHED:**
```tsx
function DropdownMenuContent({ className, align = "start", sideOffset = 4, ...props }) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        align={align}
        className={cn("z-50 ... rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 ...", className )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}
```
Portals to `document.body` with `bg-popover text-popover-foreground` — exactly the D4 app-theme surface (global tokens, correct because the portal leaves the `[data-sidebar="sidebar"]` subtree, UI-SPEC line 30). `side="top" align="start"` (Q1) are ordinary Radix props — `align` already defaults to `"start"`. `DropdownMenuLabel` (161-179) ships `text-xs font-medium text-muted-foreground` — Phase 12 overrides via className for the 15px/600 display name and the 12px/400 "Signed in as" line. `DropdownMenuSeparator` (181-192) ships `bg-border` — acceptable inside the portaled menu (global token surface). Zero edits to this file.

**DropdownMenu composition — `explorer-menu.tsx:24-50` (canonical in-repo usage):**
```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline">Menu <ChevronDownIcon className="size-4" /></Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    {items.map((item) =>
      item.href && !item.disabled ? (
        <DropdownMenuItem key={item.label} asChild>
          <Link href={item.href}>{item.label}</Link>
        </DropdownMenuItem>
      ) : (
        <DropdownMenuItem key={item.label} disabled={item.disabled}>{item.label}</DropdownMenuItem>
      )
    )}
  </DropdownMenuContent>
</DropdownMenu>
```
The trigger-asChild + item-asChild composition is the repo's established DropdownMenu idiom. For the user trigger, the `asChild` child is a `SidebarMenuButton size="lg"` (NOT a plain Button — the sidebar-surface styling comes from the sidebar primitive).

**DropdownMenu action items — `enrichment-review-dialog.tsx:183-199` (the sign-out fallback pattern):**
```tsx
<DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon" aria-label="Menu"><EllipsisVerticalIcon /></Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem disabled={!canEnrich} onSelect={startEnrichment}>Enrich</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```
`onSelect` on a plain `DropdownMenuItem` is the in-repo precedent for action items (vs. `asChild` for links). If `SignOutButton` inside `DropdownMenuItem asChild` (Slot-cloning a Clerk component) warns (RESEARCH A3), the verified fallback is `useClerk().signOut({ redirectUrl: '/sign-in' })` wired through `onSelect` on a token-styled item — this file is the concrete precedent for that shape.

**Client-context chain (proves `useUser()` works in AppSidebar — READ-ONLY):**
- `src/app/layout.tsx:20` — `<ClerkProvider>` wraps the app (client context for `useUser()`)
- `src/app/(dashboard)/layout.tsx:9` — `await requireStaffAccess();` server gate covers the whole route group (so `isSignedIn` is true after load; guards still mandatory for TS narrowing + SSR frame)
- `src/app/sign-in/[[...sign-in]]/page.tsx:1` — `import { SignIn } from '@clerk/nextjs';` — the `redirectUrl="/sign-in"` target EXISTS (Q1's sign-out destination is a real route)
- `src/proxy.ts` — `clerkMiddleware` registered (per RESEARCH; not re-read)

---

## Shared Patterns

### Client-identity guard chain (hydration contract)
**Source:** RESEARCH §Pattern 1 (verified against `@clerk/shared` union types in installed 7.5.22) — no in-repo consumer exists yet, this is the first
**Apply to:** the user zone inside `app-sidebar.tsx`
```tsx
const { isLoaded, isSignedIn, user } = useUser();
if (!isLoaded) return null;      // server frame + first hydrate tick → identical empty markup
if (!isSignedIn) return null;    // unreachable under requireStaffAccess; belt-and-suspenders
```
`user` is `undefined` (not null) before `isLoaded` — any `user.*` access before the guard throws (Pitfall 1). The two guards render the same empty frame on server and client, preventing hydration mismatch / blank-flash.

### QLTY-04 sweep + grep-gate hygiene (11-02 Rule 1)
**Source:** `.planning/phases/11-nav-items-restyle/11-02-PLAN.md` (lines 77, 116, 124 — the sweep precedent)
**Apply to:** all new code in `src/components/layout/`
- Phase 12 gate: `test -z "$(grep -rnE 'indigo|amber|#[0-9a-fA-F]{3,8}|\bdark:' src/components/layout/)"` → must print nothing. Phase 12 ships zero indigo (`--sidebar-primary #333333` avatar is the letter-mark language, not palette) — the gate must stay 0.
- **Comment hygiene:** why-comments must NOT contain the literal class strings the gates count (11-02's comment said "the v1.1 colored hover" instead of naming `hover:bg-indigo-200`). Phase 12's gates count `ArcLumen 360` ×1, `ArcLumen Partners` ×1, the D2 mailto ×1, `Give us feedback` ≥1, `useUser` ≥1 — keep those strings out of comment prose or line-scope the gates.
- 11-02 verification idiom to reuse: `grep -c '<string>' <file>` for exact counts, `test -z "$(...)"` for sweep gates.

### Dormant collapsed-rail classes (`group-data-[collapsible=icon]:`)
**Source:** app-sidebar.tsx:97-100 (Phase 11 dot), sidebar.tsx:404 (SidebarGroupLabel fade), sidebar.tsx:469/480 (menu-button variants)
**Apply to:** every text/label element in both new zones — "labels fade, icons/avatar stay" contract
- Wordmark block: `group-data-[collapsible=icon]:opacity-0 transition-opacity duration-200` (Q4 — fade, not hide)
- Pill text span: `group-data-[collapsible=icon]:hidden`; `Mail` icon `hidden group-data-[collapsible=icon]:block size-4` with `aria-hidden="true"` + `<a aria-label="Give us feedback">` (Q3)
- User trigger: `group-data-[collapsible=icon]:justify-center`; name span `group-data-[collapsible=icon]:hidden`; the 24px avatar survives the 32px rail box (`size="lg"` collapse `p-0!` handles inset)
- Dormant today (`collapsible` defaults to `"offcanvas"`, sidebar.tsx:154); Phase 13 flips `collapsible="icon"` and these resolve with zero rework

### Why-comment convention (class-string-free)
**Source:** app-sidebar.tsx:18-25, nav.ts:1-4, 11-02-PLAN.md:77
**Apply to:** app-sidebar.tsx new zones, user.ts
- 3-4 line blocks above non-obvious decisions: the useUser guard chain (hydration), the FEEDBACK_MAILTO static constant (D2 — never user-interpolated, V5), the fallback chain (nullability lock)
- No JSDoc; comments explain *why*, not *what*; never quote swept class strings

### Vitest unit-test conventions
**Source:** nav.test.ts (whole file), vitest.config.ts:10-13
**Apply to:** user.test.ts
- `import { describe, it, expect } from 'vitest';` — named imports, never globals
- One `describe` per exported function; one `it` per behavior; `expect(...).toBe(...)`
- Module under test imported relatively (`./user`); single quotes, semicolons, 2-space indent
- node environment (vitest.config.ts:11), auto-discovered via `src/**/*.test.ts` include (vitest.config.ts:12) — file MUST live at exactly `src/lib/user.test.ts`
- Run: `npx vitest run src/lib/user.test.ts -x` targeted; `npm test` full suite

### Named-export module convention
**Source:** nav.ts:6,8; `src/lib/import/dedupKeys.ts` (per Phase 10 map); `src/lib/params/companyFilters.ts:27-33`
**Apply to:** user.ts
- Named exports only, no default exports anywhere in `src/lib/`
- `interface` for object shapes (`UserDisplayFields`), `export type` reserved for unions/aliases
- Total functions: any input matching the declared shape → string, never throws, never returns empty string (`'User'`/`'A'` are explicit terminal fallbacks)

### Token-only styling (sidebar scoped / global portal)
**Source:** sidebar.tsx:469,473,480 (menu-button token classes); dropdown-menu.tsx:46 (`bg-popover text-popover-foreground`); globals.css Phase 10 token block (frozen)
**Apply to:** all Phase 12 className strings
- In-subtree surfaces: `--sidebar-*` tokens only (`text-sidebar-foreground`, `text-sidebar-foreground/70`, `border-sidebar-border`, `bg-sidebar-primary` + `text-sidebar-primary-foreground` avatar pair at 12.63:1 — Q2)
- Portaled dropdown content (at `document.body`, OUTSIDE the `[data-sidebar="sidebar"]` subtree): **global** tokens (`bg-popover`, `text-popover-foreground`, `text-muted-foreground`) — intentional per D4/UI-SPEC line 30, not a leak
- Avatar image: plain `<img src={user.imageUrl} alt="" className="size-6 rounded-full" />` when `user.hasImage` — NOT `next/image` (no `images.remotePatterns` in next.config.ts) and NOT Clerk `<UserAvatar>` (no `className` prop → BRND-04 blocker); `alt=""` is correct — the adjacent name carries identity

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none — all 3 files have strong analogs) | — | — | `app-sidebar.tsx` maps to itself + `explorer-menu.tsx`/`enrichment-review-dialog.tsx`; `user.ts`/`user.test.ts` map exactly to `nav.ts`/`nav.test.ts` |

**Planner notes for novel-but-simple surfaces (no direct in-repo precedent, rely on RESEARCH §Code Examples + the excerpts above):**
1. **User-menu dropdown with sign-out** — the repo's first `SignOutButton` usage and first `side="top"` dropdown (existing usages are `align="end"`, explorer-menu.tsx:37 / enrichment-review-dialog.tsx:189). Composition precedent exists (explorer-menu.tsx); the sign-out item is new. RESEARCH A3: if `DropdownMenuItem asChild` + `SignOutButton` Slot-cloning warns, the `onSelect` + `useClerk().signOut()` fallback has a real analog in enrichment-review-dialog.tsx:190-198.
2. **Hand-rolled avatar** — no `avatar.tsx` vendored (glob-verified absent). The initials circle (`bg-sidebar-primary text-sidebar-primary-foreground`, `size-6`, 10px/600 glyph) is ~5 lines of token classes with no existing analog — do not vendor a new primitive.
3. **`UserResource` type import** — `@clerk/types` is NOT directly resolvable (verified this session; RESEARCH A2 FALLBACK REQUIRED). Use the structural `interface UserDisplayFields` defined in user.ts, not a Clerk type import.

---

## Metadata

**Analog search scope:** `src/components/layout/` (app-sidebar.tsx, app-shell-layout.tsx, sidebar-resize-handle.tsx), `src/components/ui/` (sidebar.tsx 702 lines full read, dropdown-menu.tsx full read, avatar.tsx — confirmed absent), `src/lib/` (nav.ts, nav.test.ts, utils.ts cn), `src/components/explorer/explorer-menu.tsx`, `src/components/enrichment/enrichment-review-dialog.tsx`, `src/app/` (layout.tsx ClerkProvider, (dashboard)/layout.tsx gate, sign-in route), `vitest.config.ts`, `.planning/phases/11-nav-items-restyle/11-02-PLAN.md` (sweep-gate precedent)
**Files scanned:** ~15 (glob + targeted reads; sidebar.tsx, dropdown-menu.tsx, explorer-menu.tsx, enrichment-review-dialog.tsx, nav.ts, nav.test.ts, app-sidebar.tsx, app-shell-layout.tsx read in full)
**Pattern extraction date:** 2026-08-01
**Key verifications:** `@clerk/types` not resolvable (A2 fallback required); zero `useUser`/`SignOutButton`/`useClerk` in `src/` (user zone is first); no `avatar.tsx`; `ClerkProvider` at layout.tsx:20; `requireStaffAccess` gate at (dashboard)/layout.tsx:9; sign-in route exists at `src/app/sign-in/[[...sign-in]]/page.tsx`; `cn` at src/lib/utils.ts:4; vitest include `src/**/*.test.ts` at vitest.config.ts:12; DropdownMenuContent portal + `bg-popover` at dropdown-menu.tsx:41-46; SidebarHeader/Footer bare `flex flex-col gap-2 p-2` at sidebar.tsx:331-351; sidebarMenuButtonVariants size-lg `h-12` + collapse `size-8!` at sidebar.tsx:469-488; SidebarContent flex-1 at 373; group + data-collapsible wrapper at 208-214.
