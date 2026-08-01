# Phase 12: Branding & User Zones — Research

**Researched:** 2026-08-01
**Domain:** Clerk client-side identity (`useUser()`) + shadcn sidebar header/footer zones with sidebar-token-only styling
**Confidence:** HIGH (every mechanism verified against the actual repo files and the installed `@clerk/nextjs@7.5.22` package in this session)

<user_constraints>
## User Constraints (from Phase 10 UI-SPEC — LOCKED, do NOT re-research or overturn)

> No `12-CONTEXT.md` exists for this phase (`has_context: false`). The binding constraints are the four Phase-0 decisions locked in the approved Phase 10 UI-SPEC (`10-UI-SPEC.md`) plus the milestone hard constraints. These are copied verbatim — the planner MUST honor them.

### Locked Decisions (UI-SPEC §Phase Decisions)

- **D1. Logo treatment — text wordmark + collapsed letter-mark (Phase 13).** No ArcLumen logo asset exists (`public/` holds only Next/Vercel defaults). Locked: text wordmark, zero new assets.
  - Expanded (Phase 12): **"ArcLumen 360" — Geist 15px/600, `text-sidebar-foreground`** — with an org sub-label **"ArcLumen Partners" at 12px/400, `text-sidebar-foreground/70`** (4.89:1 — passes). Both styled with sidebar tokens only.
  - Collapsed rail (Phase 13): a 28px `rounded-md` letter-mark box — `bg-sidebar-primary text-sidebar-primary-foreground` (dark `#333333` box, white "A" glyph, Geist 600 13px).
  - Implementable with tokens only; no SVG, no favicon change, no hotlinked assets.
- **D2. Feedback destination — team-inbox mailto.** Locked: **`mailto:hello@arclumenpartners.com?subject=360%20sidebar%20feedback`**. Rationale: zero infra, no invented wiki page. Implemented as the "Give us feedback" pill in Phase 12; **the copy and destination are locked here**. (The UI-SPEC note "confirm/replace the address at plan time if a different team inbox is preferred" remains a plan-time confirmation point, not a re-research.)
- **D4. Portal policy — portaled, light app-theme, NO carve-out.** Locked: **Radix default portals (`DropdownMenuContent`/`TooltipContent` render at `document.body`), light app-theme — zero edits to `dropdown-menu.tsx`/`tooltip.tsx`.** "The Phase 12 user-menu dropdown and Phase 13 collapsed-rail tooltips (`bg-foreground text-background`, dark-on-white — legible over light content) both render app-theme by default."
- **D3 (context):** Collapse target width 48px, stock `--sidebar-width-icon: 3rem`, no override — governs the `group-data-[collapsible=icon]` classes Phase 12 must pre-wire (dormant until Phase 13).

### Hard Constraints (milestone, verbatim)

- Zero new npm packages; zero edits to vendored `src/components/ui/sidebar.tsx`; zero edits to `globals.css` token block; no `.dark`/`dark:` variants; `@theme inline` untouched.
- Sidebar tokens consumed exclusively: `text-sidebar-foreground`, `bg-sidebar`, `hover:bg-sidebar-accent`, `border-sidebar-border`.
- QLTY-04: no hardcoded `indigo`/`amber` (or any palette/hex) utilities in `src/components/layout/`.
- Routes unchanged; `pendingCount` badge gating unchanged; collapse/resize/cookie contract frozen (Phase 13 owns collapse).

### Deferred / Out of Scope (ignore during planning)

- Real team/org switcher (no multi-team model), team-name loading skeleton (needs server-side org concept), sidebar search box, external-link affordance, dark variant, anti-spam hardening of the feedback pill.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BRND-01 | Top branding zone: ArcLumen 360 wordmark/logo per UI-SPEC + org/team label | D1 locks the exact treatment (15px/600 "ArcLumen 360" + 12px/400/70 "ArcLumen Partners") and the insertion point: `SidebarHeader` (`sidebar.tsx:331-340`) goes between `<Sidebar>` (app-sidebar.tsx:31) and `<SidebarContent>` (app-sidebar.tsx:32). Collapsed-rail behavior pre-wired via `group-data-[collapsible=icon]:` (dormant mechanism, Phase 11 precedent) |
| BRND-02 | Bottom user zone: signed-in identity from Clerk session via `useUser()` — avatar/initials + username | `useUser()` verified in installed `@clerk/nextjs@7.5.22` (re-export of `@clerk/react`/`@clerk/shared`): returns `{isLoaded, isSignedIn, user}` discriminated union; `user` has `username/fullName/firstName/lastName` (all nullable), `imageUrl`, `hasImage`, `primaryEmailAddress`. Works in the client `AppSidebar` under `ClerkProvider` (layout.tsx:20) + `clerkMiddleware` (src/proxy.ts). No `avatar.tsx` primitive vendored — hand-rolled token-styled circle is the BRND-04-compliant path; `UserAvatar` rejected (no `className` prop) |
| BRND-03 | Full-width "Give us feedback" pill above the user zone → decided destination | D2 locks copy + `mailto:hello@arclumenpartners.com?subject=360%20sidebar%20feedback`. Semantic `<a>` (not button). Placement: `SidebarFooter` (sidebar.tsx:342-351), pill → `SidebarSeparator` (`bg-sidebar-border`, 353-365) → user zone, matching Exa's "pill → 0.6px divider → avatar + username" order (FEATURES.md) |
| BRND-04 | Branding + user zones use sidebar tokens only, follow panel theme in expanded/collapsed/mobile | All surfaces are tokenized: `text-sidebar-foreground`, `text-sidebar-foreground/70`, `hover:bg-sidebar-accent`, `hover:text-sidebar-accent-foreground`, `bg-sidebar-accent`, `border-sidebar-border`. Mobile sheet inherits the scoped block automatically (`data-sidebar="sidebar"` on `SheetContent`, sidebar.tsx:186). Collapsed state pre-wired with dormant `group-data-[collapsible=icon]:` classes (Phase 11 dot precedent). QLTY-04 sweep gate extends to the new code |

</phase_requirements>

---

## Summary

Phase 12 completes the sidebar anatomy by adding two zones to `src/components/layout/app-sidebar.tsx` — a top branding zone in a new `SidebarHeader` and a bottom user zone in a new `SidebarFooter` — using only primitives already exported by the vendored `sidebar.tsx` and the `useUser()` hook already shipped in the installed `@clerk/nextjs@7.5.22`. The component tree is already correct: `ClerkProvider` (root layout, `layout.tsx:20`) + `clerkMiddleware` (`src/proxy.ts`) mean `useUser()` works in the client `AppSidebar` exactly as the roadmap's BRND-02 mandates ("Clerk identity via `useUser()`"), with **zero server changes** — `app-shell-layout.tsx` stays untouched because no new server-driven data is needed (the pendingCount prop pattern is for server data; identity is explicitly client-side per the locked decision).

The two hard technical facts the planner needs: **(1)** the vendored `SidebarHeader`/`SidebarFooter` are bare `flex flex-col gap-2 p-2` divs with *no* built-in collapsed-rail handling — every `group-data-[collapsible=icon]:` class the zones need in the 48px rail must be self-applied now, dormant until Phase 13 activates collapse (exactly the Phase 11 collapsed-dot precedent); **(2)** there is **no vendored `avatar.tsx`** and Clerk's own `UserAvatar` takes no `className`, so BRND-04's token-only constraint forces a hand-rolled 24px avatar (plain `<img>` when `user.hasImage`, else a token-styled initials circle). The nullability of every display field (`username`, `firstName`, `lastName`, `email`) makes a small tested pure function the right regression lock, mirroring the Phase 10 `getActiveNavKey` convention.

**Primary recommendation:** one plan, single-file diff confined to `app-sidebar.tsx` plus an optional `src/lib/user.ts` + `src/lib/user.test.ts` (pure `getUserDisplayName`/`getUserInitials` with the nullability fallback chain, Vitest-tested per the repo's "pure functions only" convention). Top zone = `SidebarHeader` with the D1 wordmark + org sub-label (fading in the collapsed rail). Bottom zone = `SidebarFooter`: feedback `<a>` pill (D2 mailto, `border-sidebar-border` + token hover) → `SidebarSeparator` → user row (`useUser()` guard → avatar + display name). Include the D4-referenced user-menu `DropdownMenu` (app-theme portal, zero `dropdown-menu.tsx` edits) with a sign-out item — the app currently has **zero sign-out affordance** (verified: no `SignOutButton`/`signOut` anywhere in `src/`), and the dropdown is the natural home.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Branding zone (wordmark + org label) | Browser / Client (static text + CSS) | — | Pure presentation per D1; static copy, no data fetch, no interactivity |
| User identity display (avatar/initials + username) | Browser / Client | API / Backend (Clerk session — unchanged) | `useUser()` reads Clerk's client-side context populated by `ClerkProvider` + middleware; the display is client-tier. The auth **gate** stays where it is: server `requireStaffAccess()` in `(dashboard)/layout.tsx` — NOT re-implemented client-side |
| Feedback pill (mailto) | Browser / Client | — | Semantic `<a href="mailto:…">`; the OS/browser mail client handles the destination; static D2 constant |
| User-menu dropdown (sign-out / account) | Browser / Client (Radix portal) | — | D4 locks Radix default portals at `document.body`, app-theme (`bg-popover`), zero `dropdown-menu.tsx` edits; sign-out via Clerk |
| Session / auth state | API / Backend (Clerk) | — | Entirely unchanged this phase: `clerkMiddleware` (proxy.ts) + `requireStaffAccess()`; the sidebar only *reads* identity |
| Server-driven data (`pendingCount`) | API / Backend | Browser / Client (prop) | Frozen: `app-shell-layout.tsx:27-32` continues to thread the count; Phase 12 adds NO new server props |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@clerk/nextjs` | `^7.5.22` (installed) | `useUser()` client hook — the locked BRND-02 identity source | Already installed; verified in `node_modules/@clerk/nextjs/dist/types/client-boundary/hooks.d.ts` (re-exports `useUser` from `@clerk/react`); `ClerkProvider` already wraps the app (layout.tsx:20); `clerkMiddleware` registered (src/proxy.ts). Zero new auth surface |
| shadcn `sidebar` primitives (vendored) | via `radix-ui@^1.6.5` | `SidebarHeader`, `SidebarFooter`, `SidebarMenu`, `SidebarMenuButton`, `SidebarSeparator` — the zone containers | Already vendored (`src/components/ui/sidebar.tsx`, 702 lines) and **not to be edited** (hard constraint). All needed exports verified at sidebar.tsx:331-365, 446-538 |
| shadcn `dropdown-menu` primitives (vendored) | via `radix-ui@^1.6.5` | The user-menu dropdown (D4) | Already vendored (`dropdown-menu.tsx`); `DropdownMenuContent` portals with `bg-popover text-popover-foreground` (dropdown-menu.tsx:42-50) — exactly the D4 app-theme default. **Not to be edited** |
| lucide-react | `^1.26.0` (installed) | Any icons (e.g. `Mail`/`MessageSquare` for the pill, `LogOut`, `ChevronsUpDown`) | Already installed and used by Phase 11; monochrome `currentColor` convention (inherits sidebar text tokens) |
| Vitest | `^4.1.10` (installed) | Unit tests for the extracted pure user-display functions | Already installed/configured; `src/**/*.test.ts` include (vitest.config.ts:12); repo convention = "pure functions only" (Phase 10 PITFALLS Pitfall 7) |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `SignOutButton` (from `@clerk/nextjs`) | `^7.5.22` | Official sign-out affordance for the user-menu dropdown | Verified exported (index.d.ts → client-boundary/uiComponents); props: `{ redirectUrl?, sessionId?, children? }`. Place inside a `DropdownMenuItem`. If Slot-asChild composition misbehaves, fall back to `useClerk().signOut({ redirectUrl: '/sign-in' })` on a token-styled button — planner's call, both verified available |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled avatar (`<img>` when `hasImage` + token initials circle) | Clerk `<UserAvatar />` | `UserAvatar` (verified `@clerk/shared/dist/types/clerk.d.ts:1843`) exposes only `{ appearance?, rounded? }` — **no `className`**, so BRND-04's token-only rule cannot style it. Hand-rolled is the only token-compliant path |
| Plain `<img src={user.imageUrl}>` | `next/image` | `next.config` has **no `images.remotePatterns`** and the repo has **zero `next/image` usage**; Clerk avatars live on `img.clerk.com` — `next/image` would force a config change. Plain `<img>` (24px, `alt=""` — decorative, adjacent username carries identity) is zero-config and consistent |
| `useUser()` client-side (locked) | Server-side `auth()` + `clerkClient` threaded as props (pendingCount pattern) | Roadmap SC #2 mandates `useUser()`; server-threading would add an `app-shell-layout.tsx` change and a hydration-sync prop for zero user-visible gain. The pendingCount pattern stays reserved for genuine server data (none needed here) |
| Keep zones inline in `app-sidebar.tsx` | Extract `sidebar-user-zone.tsx` component | Phase 11 kept everything in `app-sidebar.tsx` (109 lines); the two zones add ~60-80 lines. Single-file diff is the phase precedent; extract only if the file approaches 250+ lines |

**Installation:**
```bash
# ZERO installs this phase. @clerk/nextjs, lucide-react, radix-ui, vitest all already installed.
# No package.json changes, no npm install, no npx shadcn add.
```

**Version verification:** `@clerk/nextjs@7.5.22` confirmed via `node_modules/@clerk/nextjs/package.json`. `vitest@^4.1.10` verified live this session (`npx vitest run src/lib/nav.test.ts` → 11/11 passed, 161ms). `npx tsc --noEmit` → exit 0 (clean tree). Node v22.23.1, npm 10.9.8.

## Package Legitimacy Audit

> This phase installs **zero packages** — runtime or dev (hard constraint: "zero new npm packages"; UI-SPEC §Registry Safety "none added this phase"). The Package Legitimacy Gate is therefore **N/A by exemption**: no slopcheck run required, no registry verification needed. The plan must NOT add any dependency; a `package.json` diff should be empty.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| — (no packages installed this phase) | — | — | — | — | N/A | N/A — zero installs |

**Packages removed due to slopcheck [SLOP] verdict:** none (nothing installed)
**Packages flagged as suspicious [SUS]:** none (nothing installed)

*Note: every library referenced above is an already-installed dependency (`package.json` dependencies/devDependencies) consumed through its existing installed artifact — no registry action of any kind this phase.*

## Architecture Patterns

### System Architecture Diagram

```text
┌─ src/app/layout.tsx ──────────────────────────────┐
│  <ClerkProvider>  (client context for useUser)    │
│   └─ <NuqsAdapter><html>…<body>{children}</body>  │
└──────────────────────────────┬────────────────────┘
                               ▼  (auth gate)
┌─ src/app/(dashboard)/layout.tsx ──────────────────┐
│  requireStaffAccess()  →  <AppShellLayout>        │
└──────────────────────────────┬────────────────────┘
                               ▼
┌─ app-shell-layout.tsx (server, UNCHANGED) ───────────────┐
│  pendingCount = countPendingProposals()  (27-32)         │
│  <SidebarProvider> <AppSidebar pendingCount={n}/> …      │
└──────────────────────────────┬───────────────────────────┘
                               ▼
┌─ app-sidebar.tsx (client, 'use client')  —  THE PHASE 12 FILE ────────────────┐
│  <Sidebar>                                                                    │
│    <SidebarHeader>  ◄─ NEW BRANDING ZONE (BRND-01)                            │
│      "ArcLumen 360" 15px/600 text-sidebar-foreground        (D1)              │
│      "ArcLumen Partners" 12px/400 text-sidebar-foreground/70 (D1)             │
│      └─ group-data-[collapsible=icon]:opacity-0 (fade; Phase 13 letter-mark)  │
│    <SidebarContent>  … Explore/Manage nav (Phase 11, UNCHANGED) …             │
│    <SidebarFooter>   ◄─ NEW USER ZONE (BRND-02 + BRND-03)                     │
│      <SidebarMenu> feedback pill: <a href="mailto:hello@…360%20sidebar%20feedback">  (D2)
│          "Give us feedback" 14px/400, border-sidebar-border, hover:bg-sidebar-accent
│      <SidebarSeparator />  (bg-sidebar-border — Exa 0.6px divider, tokenized) │
│      <DropdownMenu> user row: 24px avatar/initials + display name (useUser)   │
│          └─ content portals to <body> bg-popover (D4, dropdown-menu.tsx:42)   │
│            "Signed in as {email}" + Sign out (SignOutButton / useClerk)       │
│  </Sidebar>                                                                   │
└────────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─ src/lib/user.ts (NEW, pure — recommended) ──┐   ┌─ src/lib/user.test.ts (NEW) ──┐
│  getUserDisplayName(user) → fallback chain   │──▶│  Vitest — nullability lock     │
│  getUserInitials(user) → first letters        │   │  (mirrors nav.test.ts, QLTY-01)│
└───────────────────────────────────────────────┘   └───────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── components/layout/app-sidebar.tsx   # MODIFIED — SidebarHeader branding zone + SidebarFooter user zone
├── lib/user.ts                         # NEW (recommended) — getUserDisplayName/getUserInitials pure functions
└── lib/user.test.ts                    # NEW (recommended) — Vitest nullability fallback-chain tests
```

Everything else untouched: `app-shell-layout.tsx`, `sidebar.tsx`, `dropdown-menu.tsx`, `globals.css`, `package.json`, `src/lib/nav.ts`.

### Pattern 1: Client-side identity consumption via `useUser()` with discriminated-union guards

**What:** `useUser()` returns a three-branch discriminated union (verified `@clerk/shared/dist/types/hooks.d.ts:201-221`): `{isLoaded:false}` → `{isLoaded:true, isSignedIn:false, user:null}` → `{isLoaded:true, isSignedIn:true, user:UserResource}`. The component must guard all three to satisfy TypeScript narrowing and avoid a blank flash.
**When to use:** Any client component that displays Clerk identity. In AppSidebar the route is server-gated (requireStaffAccess), so `isSignedIn` will be true after load — but the guards are still mandatory for TS narrowing and for the initial `isLoaded === false` render.
**Example:**
```tsx
'use client';
import { useUser } from '@clerk/nextjs';
// AppSidebar renders under ClerkProvider (layout.tsx:20) — the hook is
// guaranteed a provider. isLoaded starts false (SSR + first hydrate tick);
// the route gate means isSignedIn is true once loaded, but the guard chain
// is required for TS narrowing and to render nothing on the server frame
// (server and client must agree on the empty state — no hydration mismatch).
export function SidebarUserZone() {
  const { isLoaded, isSignedIn, user } = useUser();
  if (!isLoaded) return null;          // server frame + loading tick → identical empty markup
  if (!isSignedIn) return null;        // unreachable under requireStaffAccess; belt-and-suspenders
  return (
    <div className="flex items-center gap-2.5">
      {user.hasImage ? (
        // plain <img>: repo has zero next/image usage and no images.remotePatterns;
        // alt="" — the adjacent display name carries identity (decorative avatar)
        <img src={user.imageUrl} alt="" className="size-6 rounded-full" />
      ) : (
        <span className="flex size-6 items-center justify-center rounded-full bg-sidebar-accent text-[10px] font-semibold text-sidebar-accent-foreground">
          {getUserInitials(user)}
        </span>
      )}
      <span className="text-[15px] font-normal text-sidebar-foreground">{getUserDisplayName(user)}</span>
    </div>
  );
}
```

### Pattern 2: Dormant collapsed-rail styling via `group-data-[collapsible=icon]:` (Phase 13 pre-wiring)

**What:** The `Sidebar` primitive sets `data-collapsible` + `group` on the desktop wrapper (sidebar.tsx:209-214) and already ships `group-data-[collapsible=icon]:` variants inside menu buttons (`size-8!`, `p-2!`), group labels (`-mt-8 opacity-0`, line 404) and badges (`hidden`, line 575). These selectors are **dormant today** — `collapsible` defaults to `"offcanvas"` and no collapse UI exists until Phase 13 — but they resolve the moment Phase 13 flips `collapsible="icon"`. Phase 12 must pre-wire them on the new zones (exactly what Phase 11 did with the Reviews dot, `group-data-[collapsible=icon]:block`).
**When to use:** Every text/label element in the header and footer zones. Contract: **labels fade, icons/avatar stay** (UI-SPEC Interaction & State, collapsed row).
**Example:**
```tsx
// Branding zone — wordmark + org label fade in the 48px rail (Phase 13 swaps in
// the 28px letter-mark, D1). Matches the primitive's label-fade contract
// (SidebarGroupLabel: group-data-[collapsible=icon]:opacity-0, sidebar.tsx:404).
<div className="group-data-[collapsible=icon]:opacity-0 transition-opacity duration-200">
  <p className="text-[15px] font-semibold text-sidebar-foreground">ArcLumen 360</p>
  <p className="text-xs font-normal text-sidebar-foreground/70">ArcLumen Partners</p>
</div>

// User zone — the 24px avatar survives the 32px icon box; the name span hides:
<span className="group-data-[collapsible=icon]:hidden text-[15px] ...">{getUserDisplayName(user)}</span>
```

### Anti-Patterns to Avoid

- **Editing `sidebar.tsx` / `dropdown-menu.tsx` / `globals.css` / `app-shell-layout.tsx`:** hard constraints; the entire phase diff should be `app-sidebar.tsx` (+ `src/lib/user.ts`/`.test.ts` if extracted). `git diff` fence gates this.
- **Adding heading semantics to the wordmark:** the page's `<h1>`s live in content; the brand is decorative chrome. Use a `<p>`/`<span>` with the D1 Heading-tier classes — no `<h1>`/`<h2>` that would collide with the content heading hierarchy.
- **Rendering the user zone on the server frame with real data:** `useUser()` on the server returns `isLoaded:false` — the server HTML must render the same empty state the client renders while loading, or hydration mismatches. Guard `!isLoaded → null` before any `user.*` access.
- **Trusting `user.username`:** it is nullable (`string | null`, verified user.d.ts:96-98) and often unset — a fallback chain (`username ?? fullName ?? primaryEmailAddress?.emailAddress ?? 'User'`) is mandatory or the zone renders empty for real users.
- **Hardcoded avatar colors:** Exa's `#C3ECFF`/`text-blue-800` avatar (FEATURES.md) violates QLTY-04. Initials circle must use tokens (`bg-sidebar-accent text-sidebar-accent-foreground` — 5.91:1, or `bg-sidebar-primary text-sidebar-primary-foreground` — 12.63:1, the letter-mark language).
- **`dark:` variants or hardcoded hex anywhere** in the new code — the QLTY-04 sweep gate extends to Phase 12's diff (grep gate = 0).
- **Comment prose that embeds swept class strings** (e.g. a comment containing `hover:bg-sidebar-accent` flips count gates) — Phase 11-02's Rule 1 finding; keep comments class-string-free or line-scope the gates.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth identity in the sidebar | A new session fetch, server prop threading, or a hand-rolled profile API | `useUser()` from `@clerk/nextjs` | Roadmap SC #2 locks it; ClerkProvider + clerkMiddleware already provide client auth state app-wide; the pendingCount prop pattern is for *server* data only |
| Sign-out affordance | A custom logout endpoint / cookie deletion | `SignOutButton` or `useClerk().signOut({ redirectUrl: '/sign-in' })` | Clerk owns the session lifecycle (`__session` cookie, revocation); the app has **zero** sign-out today (grep-verified) — do not re-implement |
| Avatar rendering | A new avatar component, `next/image` config, or Clerk's `UserAvatar` | Hand-rolled: `<img>` when `user.hasImage`, else a token-styled initials circle | `UserAvatar` can't take `className` (BRND-04 blocker); `next/image` needs `remotePatterns` config for `img.clerk.com`; the hand-rolled circle is ~6 lines and 100% token-driven |
| User-display name/initials logic | Inline nullable-chain ternaries in JSX | Pure `getUserDisplayName(user)` / `getUserInitials(user)` + Vitest tests | The #1 silent regression for a user zone (a null username producing a blank row) becomes a permanent test — the Phase 10 `getActiveNavKey` convention (QLTY-01) |
| Feedback mailto | A form, a route handler, or a feedback API | Static `<a href="mailto:hello@arclumenpartners.com?subject=360%20sidebar%20feedback">` | D2 locks it; mailto is zero-infra by design; never make it server-rendered or user-interpolated |

**Key insight:** like Phase 10, this phase's risk is scope discipline, not engineering — the interesting decisions are (a) *not* adding a server path for identity (useUser is locked), (b) *not* vendoring an avatar primitive (hand-rolled tokens), and (c) pre-wiring the collapsed rail correctly so Phase 13's collapse button "just works" with zero rework. The one genuinely new mechanism is `useUser()`'s loading/hydration behavior, which the discriminated-union guards fully contain.

## Common Pitfalls

### Pitfall 1: Hydration mismatch / blank user zone from unguarded `useUser()`
**What goes wrong:** Server-rendered HTML shows no user zone (or an error if code touches `user.*` while `user` is `undefined`), then the client hydrates and the zone pops in — a flash or a React hydration error if the two frames disagree.
**Why it happens:** `useUser()` is `{isLoaded:false}` during SSR and the first hydrate tick (verified union type); `user` is `undefined`, not null — `user.username` throws.
**How to avoid:** `if (!isLoaded) return null;` before any `user.*` access; render the identical empty state on both frames. Never render `<Skeleton>` on the server and content on the client (mismatch).
**Warning signs:** React hydration warnings on dashboard load; a one-frame avatar flash.

### Pitfall 2: Nullable display fields → blank rows for real users
**What goes wrong:** `user.username` is `string | null` (user.d.ts:96-98) and is frequently unset for email/social sign-ins; `firstName`/`lastName` also nullable. A direct `{user.username}` renders an empty gap.
**Why it happens:** Clerk's User object has no guaranteed display-name field; each field is independently optional.
**How to avoid:** Extract `getUserDisplayName` with the fallback chain `username ?? fullName ?? primaryEmailAddress?.emailAddress ?? 'User'` and `getUserInitials` from `firstName`/`lastName` (fallback to first letter of display name), both unit-tested.
**Warning signs:** The bottom zone shows an avatar with no name; `user.username` undefined in the test user's session.

### Pitfall 3: Wordmark/user labels overflowing the 48px collapsed rail
**What goes wrong:** In the collapsed rail (Phase 13), the 15px wordmark and full-width feedback pill overflow or misalign the 48px rail; `SidebarMenuButton`'s `size-8!` (32px) + `[&>span:last-child]:truncate` silently clips text into unreadable slivers.
**Why it happens:** `SidebarHeader`/`SidebarFooter` (sidebar.tsx:331-351) carry **no** built-in collapse handling — unlike labels/badges, they don't auto-hide.
**How to avoid:** Self-apply `group-data-[collapsible=icon]:` classes on every text element now (opacity fade for the wordmark block, `hidden` for the name span, icon-only or `hidden` for the pill). Dormant selectors cost nothing today and make Phase 13 a pure toggle.
**Warning signs:** Phase 13's collapse reveals clipped text in header/footer; the pill becomes an unreadable 32px sliver.

### Pitfall 4: QLTY-04 sweep drift from avatar/pill colors
**What goes wrong:** The natural "brand-colored" avatar (Exa's `#C3ECFF` light blue with `text-blue-800` initials) or a colored pill reintroduces hardcoded palette utilities that the Phase 11 sweep eliminated; the Phase 14 audit then flags them.
**Why it happens:** The Exa reference literally shows those colors (FEATURES.md line 23), and they look "nice" — but QLTY-04 forbids hardcoded colors in `src/components/layout/`.
**How to avoid:** All avatar/pill colors from `--sidebar-*` tokens only: initials circle `bg-sidebar-accent text-sidebar-accent-foreground` (5.91:1) or `bg-sidebar-primary text-sidebar-primary-foreground` (12.63:1); pill `border-sidebar-border` + `hover:bg-sidebar-accent hover:text-sidebar-accent-foreground`. Keep the phase's grep gates (`indigo`/`amber`/hex) at 0.
**Warning signs:** Any `#…` hex or `text-blue-`/`bg-sky-` class in the Phase 12 diff.

### Pitfall 5: Feedback pill as a `<button>` or with user-interpolated mailto
**What goes wrong:** A `<button>` for a mailto implies app logic and breaks middle-click/context-menu semantics; interpolating any user data into the mailto subject/body creates a URL-injection vector.
**Why it happens:** The pill "looks like" a button; the D2 subject is static today but a well-meaning edit could parameterize it later.
**How to avoid:** Semantic `<a href={FEEDBACK_MAILTO}>` where `FEEDBACK_MAILTO` is a module-level static constant (D2 verbatim). Never concatenate user fields into it. Full-width per SC #3.
**Warning signs:** `mailto:` built at render time; the pill renders a `<button>`.

### Pitfall 6: Comment prose tripping grep-count gates (11-02 Rule 1)
**What goes wrong:** A why-comment containing the literal class string (e.g. "uses `hover:bg-sidebar-accent`") flips an acceptance grep from 1 → 2 and fails the gate.
**Why it happens:** Verified in Phase 11-02 (the `hover:bg-foreground/10` case); the comment explains the *mechanism* and embeds the class.
**How to avoid:** Keep comments free of literal class strings the gates count, or line-scope the gates (`grep -c '…' file` on the specific line range). Follow the repo's comments-explain-why style without quoting classnames.
**Warning signs:** A gate count of 2 where the plan expects 1, traced to a comment.

## Code Examples

### `src/lib/user.ts` — pure display-name/initials functions (NEW, recommended; repo conventions: named exports, `type` for unions, single quotes, semicolons)
```typescript
import type { UserResource } from '@clerk/types';

// Pure display helpers for the sidebar user zone (BRND-02). Every Clerk
// display field is individually nullable (username/firstName/lastName are
// string | null and often unset for email/social sign-ins), so the fallback
// chain is the regression lock — a null field must never render a blank row.
export function getUserDisplayName(user: UserResource): string {
  return (
    user.username ??
    user.fullName ??
    user.primaryEmailAddress?.emailAddress ??
    'User'
  );
}

export function getUserInitials(user: UserResource): string {
  const first = user.firstName?.trim();
  const last = user.lastName?.trim();
  if (first || last) return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase();
  const email = user.primaryEmailAddress?.emailAddress;
  if (email) return email.slice(0, 2).toUpperCase();
  return 'A';
}
```
> Note: `UserResource` type import — verify the exact export path at plan time (`@clerk/types` is a transitive dep of `@clerk/nextjs`; if it is not directly resolvable, type the param structurally via `Pick` or a local interface).

### `src/lib/user.test.ts` — Vitest nullability lock (NEW, recommended; auto-discovered by vitest.config.ts `src/**/*.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { getUserDisplayName, getUserInitials } from './user';

const baseUser = {
  username: null,
  fullName: null,
  firstName: null,
  lastName: null,
  primaryEmailAddress: null,
} as any; // structural stand-in for UserResource — plan: build minimal fixtures

describe('getUserDisplayName', () => {
  it('prefers username when present', () => {
    expect(getUserDisplayName({ ...baseUser, username: 'jdoe' })).toBe('jdoe');
  });
  it('falls back to fullName when username is null', () => {
    expect(getUserDisplayName({ ...baseUser, fullName: 'Jane Doe' })).toBe('Jane Doe');
  });
  it('falls back to email when names are null', () => {
    expect(getUserDisplayName({ ...baseUser, primaryEmailAddress: { emailAddress: 'j@x.com' } })).toBe('j@x.com');
  });
  it('never returns an empty string', () => {
    expect(getUserDisplayName(baseUser)).toBe('User');
  });
});

describe('getUserInitials', () => {
  it('combines first and last initials', () => {
    expect(getUserInitials({ ...baseUser, firstName: 'Jane', lastName: 'Doe' })).toBe('JD');
  });
  it('derives from email when names are null', () => {
    expect(getUserInitials({ ...baseUser, primaryEmailAddress: { emailAddress: 'jane@x.com' } })).toBe('JA');
  });
});
```

### Sidebar zones — the Phase 12 app-sidebar.tsx shape (source: vendored primitives sidebar.tsx:331-365, verified this session)
```tsx
// Inside <Sidebar> — branding zone FIRST, user zone LAST (SidebarContent is
// flex-1 (sidebar.tsx:373) so the footer pins to the bottom automatically).
<Sidebar>
  <SidebarHeader className="gap-1 p-3">
    <div className="group-data-[collapsible=icon]:opacity-0 transition-opacity duration-200">
      <p className="text-[15px] font-semibold text-sidebar-foreground">ArcLumen 360</p>   {/* D1 wordmark */}
      <p className="text-xs font-normal text-sidebar-foreground/70">ArcLumen Partners</p>  {/* D1 org label */}
    </div>
  </SidebarHeader>

  <SidebarContent>… Phase 11 Explore/Manage groups unchanged …</SidebarContent>

  <SidebarFooter className="gap-2 p-2">
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild className="h-9 rounded-[6px] border border-sidebar-border text-[14px] font-normal">
          <a href="mailto:hello@arclumenpartners.com?subject=360%20sidebar%20feedback">Give us feedback</a>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
    <SidebarSeparator />   {/* Exa 0.6px divider — tokenized bg-sidebar-border (sidebar.tsx:361) */}
    <SidebarMenu>
      <SidebarMenuItem>{/* DropdownMenu-triggered user row: 24px avatar/initials + display name */}</SidebarMenuItem>
    </SidebarMenu>
  </SidebarFooter>
</Sidebar>
```

### User-menu dropdown (D4 — app-theme portal, zero dropdown-menu.tsx edits)
```tsx
import { SignOutButton } from '@clerk/nextjs';
// D4: DropdownMenuContent portals to document.body with bg-popover (dropdown-menu.tsx:42-50)
// — light-on-light over the #fbfcfd panel, no flash, no carve-out. No className changes.
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <SidebarMenuButton size="lg" className="gap-2.5 group-data-[collapsible=icon]:justify-center">
      {/* avatar/initials circle */}
      <span className="group-data-[collapsible=icon]:hidden text-[15px] font-normal text-sidebar-foreground">
        {getUserDisplayName(user)}
      </span>
    </SidebarMenuButton>
  </DropdownMenuTrigger>
  <DropdownMenuContent side="top" align="start" className="w-56">
    <DropdownMenuLabel>{getUserDisplayName(user)}</DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuItem asChild><SignOutButton redirectUrl="/sign-in">Sign out</SignOutButton></DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```
> Planner note: `SignOutButton` renders its own `<button>` — if `DropdownMenuItem asChild` (Slot clone) warns, use `useClerk().signOut({ redirectUrl: '/sign-in' })` on a token-styled `DropdownMenuItem`. Both verified available in `@clerk/nextjs@7.5.22`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| v1.1: no bottom chrome — zero user identity in the sidebar, zero sign-out affordance in the app | Bottom `SidebarFooter` user zone: `useUser()` avatar/initials + display name + sign-out dropdown | This phase (v1.2) | The sidebar becomes a complete application chrome (brand top, identity bottom), matching the Exa reference's bottom anatomy (FEATURES.md) |
| v1.1: flat-white panel, no branding zone | `SidebarHeader` wordmark + org sub-label per D1 (text treatment, zero assets) | This phase (v1.2) | Brand presence without an asset pipeline; Phase 13 adds the collapsed letter-mark |
| Clerk auth used only server-side (`auth()` in requireStaffAccess) | Client-side identity consumption via `useUser()` under ClerkProvider | This phase (v1.2) | First client-context Clerk consumption in the repo; the pattern generalizes to any future identity-dependent client component |

**Deprecated/outdated:**
- **`@clerk/astro` / Astro-era auth docs in CLAUDE.md:** the stack migrated to Next.js App Router; `useUser` from `@clerk/nextjs` is the current API (verified in the installed 7.5.22 artifacts). The CLAUDE.md *conventions* section (single quotes, semicolons, named exports, comments-explain-why) remains binding.
- **The dark-panel portal carve-out (milestone PITFALLS Pitfall 2):** explicitly moot per D4 — the panel is light `#fbfcfd`, so the app-theme `bg-popover` dropdown is coherent with no edits to `dropdown-menu.tsx`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Phase 12 includes the D4-referenced user-menu dropdown (sign-out) even though roadmap SC #2 only says "avatar/initials + username" | Standard Stack / Code Examples | MEDIUM — D4 explicitly names "the Phase 12 user-menu dropdown", and the app has zero sign-out today; if the plan ships a static identity row instead, D4 stays dormant until Phase 13 and users gain no sign-out path. Planner should confirm scope at plan time (flagged in Open Questions) |
| A2 | `@clerk/types` is directly resolvable for a `UserResource` type import in `src/lib/user.ts` | Code Examples | LOW — it is a transitive dependency of `@clerk/nextjs`; if `tsc` cannot resolve the bare import, use a structural `Pick`/local interface. Verify at plan time |
| A3 | `SignOutButton` composes cleanly inside `DropdownMenuItem asChild` | Code Examples | LOW-MEDIUM — Slot-cloning a Clerk component may warn on refs; the `useClerk().signOut()` fallback is verified available. Planner picks one, both are token-styleable |
| A4 | The dormant `group-data-[collapsible=icon]:` classes resolve correctly inside `SidebarHeader`/`SidebarFooter` | Patterns | LOW — the desktop wrapper (sidebar.tsx:209-214) sets `group` + `data-collapsible`, and the primitive already uses these selectors on descendants (labels/badges/content); header/footer are descendants of the same wrapper. Phase 13 will confirm visually |
| A5 | `user.primaryEmailAddress?.emailAddress` is the right email fallback | Code Examples | LOW — verified nullable (`EmailAddressResource | null`, user.d.ts:74-78) with `.emailAddress`; sign-in method may be username-only, in which case the chain lands on `'User'` — acceptable, tested |

## Open Questions (RESOLVED)

1. **Dropdown scope: static identity row vs. user-menu dropdown (sign-out)?**
   - What we know: D4 locks the portal policy for "the Phase 12 user-menu dropdown"; roadmap SC #2 only mandates avatar/initials + username display; the app has **zero sign-out affordance** today (grep-verified); `SignOutButton`/`useClerk().signOut` both verified available.
   - What's unclear: whether the dropdown (with a sign-out item) is intended in Phase 12 scope or deferred.
   - Recommendation: **include the dropdown** — D4 names it, and shipping it is the only way users get a sign-out path this milestone; it is ~15 lines using vendored `DropdownMenu` primitives with zero edits. Planner should state the decision explicitly in the plan objective.
   - **[RESOLVED]** Included. Locked by 12-UI-SPEC Q1 (full-width `SidebarMenuButton size="lg"` trigger + exactly three items: label/separator/Sign out via `SignOutButton redirectUrl="/sign-in"`; no "Manage account" — no `/user-profile` route exists). Executed in 12-01 Task 3.

2. **Extract `src/lib/user.ts` pure functions or inline the fallback chain?**
   - What we know: repo convention = "pure functions only" for Vitest (Phase 10 Pitfall 7); Phase 10 extracted `getActiveNavKey` exactly because inline logic was the #1 silent-regression source; the user zone's nullable chain is the analogous risk.
   - Recommendation: **extract + test** (5-8 test cases). Cheap, matches precedent, gives the phase a unit-testable artifact. If the planner prefers the minimal diff, the fallback chain inline is acceptable but loses the regression lock.
   - **[RESOLVED]** Extract + test. Adopted per 12-UI-SPEC §Verification Gates ("Pure-function lock — `npx vitest run src/lib/user.test.ts -x`") and executed in 12-01 Task 1 (`src/lib/user.ts` + `src/lib/user.test.ts`, 8-case nullability lock).

3. **Feedback-pill collapsed-rail form (Phase 13 prep):** hide entirely (`group-data-[collapsible=icon]:hidden`) vs. icon-only (`Mail` icon, `aria-label`)? Recommendation: **icon-only** keeps a feedback channel in the rail and matches the "labels fade, icons stay" contract; tooltip wiring is Phase 13. Planner's call — both are pre-wired dormant classes either way.
   - **[RESOLVED]** Icon-only. Locked by 12-UI-SPEC Q3 (text span `group-data-[collapsible=icon]:hidden`; `Mail` icon `hidden group-data-[collapsible=icon]:block size-4` with `aria-hidden`; `<a aria-label="Give us feedback">`). Executed in 12-01 Task 2; tooltip wiring deferred to Phase 13.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | `npm test`, `npm run build`, `npx tsc` | ✓ | v22.23.1 (engines: `22.x`) | — |
| npm | package scripts | ✓ | 10.9.8 | — |
| Vitest | `src/lib/user.test.ts` (if extracted) + full suite | ✓ | ^4.1.10 (verified: nav 11/11 pass, 161ms) | — |
| `@clerk/nextjs` | `useUser`, `SignOutButton` | ✓ | 7.5.22 (installed; hook/type surfaces verified) | — |
| lucide-react / radix-ui | icons + dropdown/avatar primitives | ✓ | ^1.26.0 / ^1.6.5 (installed) | — |
| Clerk session (live render) | Manual visual check of the user zone | ✓ (production/staff account) | — | Phase 14 UAT matrix covers live-browser verification; no automated dependency |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.
Step 2.6 assessment: phase is code-only; tests are pure-function (node env, no DB/DOM); build + type-check run locally; no external services required at build or test time. Live rendering of the user zone needs a signed-in Clerk session — that is a manual check (Phase 14's live-browser matrix), not a build dependency.

## Validation Architecture

> `workflow.nyquist_validation: true` in `.planning/config.json` — section required. Precedent: Phase 10/11 grep gates + vitest + build gates (11-VALIDATION.md).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^4.1.10` (installed; verified running this session) |
| Config file | `vitest.config.ts` (exists — environment `node`, include `src/**/*.test.ts`, alias `@` → `./src`) |
| Quick run command | `npx vitest run src/lib/user.test.ts -x` (if extracted) — targeted; else `npm test` |
| Full suite command | `npm test` (script = `vitest run`; Phase 11 baseline: 23 files, 224 passed, 2 skipped) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BRND-01 | Wordmark + org label in `SidebarHeader`, D1 copy + typography | source + grep | grep `ArcLumen 360` / `ArcLumen Partners` / `text-sidebar-foreground/70` / `text-[15px] font-semibold` in `app-sidebar.tsx`; `npx tsc --noEmit` | ❌ Wave 0 (in-phase) |
| BRND-02 | `useUser()` consumed; avatar/initials + display name; nullability handled | unit (if `user.ts` extracted) + source | `npx vitest run src/lib/user.test.ts -x`; grep `useUser` in `app-sidebar.tsx` | ❌ Wave 0 (in-phase) |
| BRND-03 | Feedback pill `<a>` with D2 mailto, full-width, above user zone | source + grep | grep `mailto:hello@arclumenpartners.com?subject=360%20sidebar%20feedback` + `Give us feedback` = 1 each | ❌ Wave 0 |
| BRND-04 | Token-only classes; no hardcoded colors/hex/dark: in the diff | grep gates | `test -z "$(grep -rnE 'indigo|amber|#[0-9a-fA-F]{3,8}|\bdark:' src/components/layout/)"`; fence gate on protected files | n/a (guardrail) |
| Regression | Routes, pendingCount badge, nav, cookies unchanged | unit + diff fence | `npx vitest run src/lib/nav.test.ts --bail=1` (11/11); `npm run build`; `git diff` fence on `sidebar.tsx`, `dropdown-menu.tsx`, `globals.css`, `app-shell-layout.tsx`, `package.json`, `package-lock.json` | ✅ (existing) |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit` + `npx vitest run src/lib/nav.test.ts --bail=1` (nav regression lock) + phase grep gates
- **Per wave merge:** `npm test` + `npm run build`
- **Phase gate:** full suite green + build green + sweep gates (indigo/amber/hex/dark: = 0) + fence-clean before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/user.test.ts` — created in-phase if `user.ts` extraction is adopted (recommended; mirrors `nav.test.ts` convention)
- [ ] Framework install: **none needed** — vitest already installed and configured
- [ ] Shared fixtures: **none needed** — minimal structural user objects in the test file itself

## Security Domain

> `workflow.security_enforcement: true` in config — section required. ASVS level 1.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (read-only) | No new auth logic — identity is *displayed* via Clerk's `useUser()` under the existing `clerkMiddleware` (proxy.ts) + server `requireStaffAccess()` gate ((dashboard)/layout.tsx). The client zone never makes an authorization decision; the server gate remains authoritative |
| V3 Session Management | no | Clerk owns `__session`; the sidebar `sidebar_state`/`sidebar_width` cookie contract is frozen, not touched |
| V4 Access Control | no | The user zone displays the signed-in user; no roles/claims logic added (D-08 model unchanged) |
| V5 Input Validation | yes (minimal) | The mailto href is a **static module-level constant** (D2 verbatim) — never user-interpolated. Displayed user fields flow through React's automatic JSX escaping |
| V6 Cryptography | no | n/a — no crypto in scope |
| V8 Client-side / XSS | yes | `user.username`/`firstName`/`lastName`/`emailAddress` are **user-controlled profile data** rendered into the sidebar — React escapes text nodes by default; the hard rules: no `dangerouslySetInnerHTML` anywhere, no dynamic class strings, avatar `src` only from `user.imageUrl` (Clerk-controlled CDN) and only when `user.hasImage` |
| V9 Server Comm | no | Zero new network surface — no fetches, no route handlers, no server actions |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stored XSS via a malicious username/name in the user zone | Tampering / Info Disclosure | React auto-escaping on all `{user.*}` interpolations; no `dangerouslySetInnerHTML`; the pure display functions return strings, never markup |
| Mailto header/URL injection | Tampering | D2 href is a static constant; no user data is concatenated into `mailto:` (a future edit parameterizing it must be flagged in review) |
| Identity spoofing via avatar URL | Spoofing | `src` is `user.imageUrl` from Clerk's controlled CDN, gated by `user.hasImage`; a broken/failed image degrades to the initials circle, never to a hostile element |
| Auth-state regression (user zone appearing for anonymous visitors) | Elevation of Privilege | Impossible structurally: the (dashboard) route group is server-gated by `requireStaffAccess()` before `AppSidebar` renders; the client zone additionally guards `!isSignedIn → null` |

**Net assessment:** no new attack surface. The security-relevant behavior is *negative* — the phase must not add a client-side authorization path, must not interpolate user data into URLs, and must keep all portal surfaces app-theme (D4) with zero edits to vendored primitives.

## Sources

### Primary (HIGH confidence) — verified this session
- `node_modules/@clerk/nextjs/package.json` — version `7.5.22`
- `node_modules/@clerk/nextjs/dist/types/client-boundary/hooks.d.ts` — `useUser` re-export; `index.d.ts:10` — `UserAvatar`, `SignOutButton` exports
- `node_modules/@clerk/react/dist/index.d.mts:210-220` — `SignOutButtonProps` `{ redirectUrl?, sessionId?, children? }`
- `node_modules/@clerk/shared/dist/react/hooks/useUser.d.ts` — official hook docs (loading/signed-out/signed-in union)
- `node_modules/@clerk/shared/dist/types/hooks.d.ts:201-221` — `UseUserReturn` discriminated union (isLoaded / isSignedIn / user)
- `node_modules/@clerk/shared/dist/types/user.d.ts:74-118` — `username`, `fullName`, `firstName`, `lastName` (all `string | null`), `imageUrl: string`, `hasImage: boolean`, `primaryEmailAddress: EmailAddressResource | null`
- `node_modules/@clerk/shared/dist/types/clerk.d.ts:1843` — `UserAvatarProps` = `{ appearance?, rounded? }` (no `className` → BRND-04 blocker)
- `src/components/ui/sidebar.tsx` (702 lines, full read) — `SidebarHeader` 331-340, `SidebarFooter` 342-351, `SidebarSeparator` 353-365, `SidebarContent` flex-1 367-379, `SidebarGroupLabel` fade 404, `SidebarMenu` 446-455, `sidebarMenuButtonVariants` 468-488 (size lg `h-12`, collapse `size-8!`), `SidebarMenuBadge` hide 575, desktop `group`+`data-collapsible` wrapper 208-214, mobile `data-sidebar="sidebar"` SheetContent 186
- `src/components/ui/dropdown-menu.tsx:42-50` — `DropdownMenuContent` Portal + `bg-popover text-popover-foreground` (D4 app-theme default)
- `src/components/ui/tooltip.tsx:45` — `bg-foreground text-background` (app-theme portal, D4)
- `src/components/layout/app-sidebar.tsx` (109 lines) — current structure: `<Sidebar>` 31, `<SidebarContent>` 32-106, no header/footer yet
- `src/components/layout/app-shell-layout.tsx` — `pendingCount` server query 27-32, prop thread 36 (unchanged this phase)
- `src/app/layout.tsx:20` — `ClerkProvider` wraps the app; `src/proxy.ts` — `clerkMiddleware` registered
- `src/lib/auth/requireStaffAccess.ts` — the single server auth gate; `(dashboard)/layout.tsx` gating
- `src/app/globals.css:86-105` — Phase 10 token block + companion rules (frozen)
- `next.config.ts` — no `images.remotePatterns`; repo has zero `next/image` usage (grep)
- Live env: `npx vitest run src/lib/nav.test.ts` → 11/11 (161ms); `npx tsc --noEmit` → exit 0; Node v22.23.1, npm 10.9.8

### Secondary (MEDIUM confidence)
- `.planning/phases/10-sidebar-token-foundation/10-UI-SPEC.md` — APPROVED contract: D1-D4 locked decisions, typography tiers, token set, copywriting contract
- `.planning/research/FEATURES.md` — Exa bottom-zone anatomy (pill → 0.6px divider → 24px avatar + username; `#C3ECFF` reference colors — flagged as QLTY-04-violating, token replacements mandated)
- `.planning/research/PITFALLS.md` — Pitfall 2 (portal policy → moot per D4), Pitfall 6 (collapsed rail / logo overflow), Pitfall 7 (regression blindness), Pitfall 8 (don't copy Exa brand assets)
- `.planning/phases/11-nav-items-restyle/11-01-SUMMARY.md` + `11-02-SUMMARY.md` — collapsed-dot dormant-mechanism precedent, grep-gate hygiene (Rule 1)
- Context7 `/clerk/clerk-docs` — `useUser()` loading-state pattern (`if (!isLoaded) …`, `if (!isSignedIn) …`) corroborates installed-package types [CITED: github.com/clerk/clerk-docs use-user.mdx]

### Tertiary (LOW confidence)
- None required for stack claims (all verified against installed artifacts). Assumptions A1-A5 are the only soft spots, each flagged with a plan-time check.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages; `useUser`/`SignOutButton`/`UserAvatar` surfaces verified against the installed `@clerk/nextjs@7.5.22` artifacts; all sidebar primitives verified in the vendored source
- Architecture: HIGH — insertion points, flex flow, dormant collapse mechanism, and hydration behavior all verified against repo files + official hook types
- Pitfalls: HIGH — every pitfall grounded in a specific line/type verified this session (nullable fields in user.d.ts, no built-in header/footer collapse, no avatar primitive, D2 static mailto, 11-02 grep-gate finding)
- Scope fence: HIGH — the phase's file touch-list is exactly `app-sidebar.tsx` (+ optional `src/lib/user.ts`/`user.test.ts`); everything else frozen

**Research date:** 2026-08-01
**Valid until:** 2026-08-08 (fast-moving — `@clerk/nextjs` majors; re-verify only if the installed Clerk version changes or the UI-SPEC is amended, not on a time basis)
