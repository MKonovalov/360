---
phase: 12-branding-user-zones
plan: 01
subsystem: ui
tags: [sidebar, clerk, use-user, dropdown-menu, vitest, tailwind]

# Dependency graph
requires:
  - phase: 10-sidebar-token-foundation
    provides: Phase 10 --sidebar-* token block on [data-sidebar="sidebar"] (globals.css, frozen) + D1-D4 locked decisions
  - phase: 11-nav-items-restyle
    provides: Phase 11 nav anatomy in app-sidebar.tsx (Explore/Manage groups, pendingCount badge, dormant group-data-[collapsible=icon]: precedent)
provides:
  - "SidebarHeader branding zone: ArcLumen 360 wordmark (15px/600 text-sidebar-foreground) + ArcLumen Partners org label (12px/400 text-sidebar-foreground/70) with Q4 collapsed-rail fade"
  - "SidebarFooter user zone: 'Give us feedback' pill (D2 static FEEDBACK_MAILTO) + SidebarSeparator divider + DropdownMenu-wrapped signed-in identity (24px avatar or token initials circle + display name)"
  - "First in-app sign-out path: SignOutButton redirectUrl=\"/sign-in\" in a portaled dropdown using global popover tokens (D4)"
  - "src/lib/user.ts pure functions (getUserDisplayName/getUserInitials) + UserDisplayFields structural interface + 8-case Vitest nullability lock"
affects: [13-collapse (letter-mark swap seam + dormant selectors), 14-uat (live-browser render), verify-work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-function + Vitest-lock convention extended from nav.ts to user.ts (nullability fallback chain for nullable Clerk display fields)"
    - "useUser() three-branch discriminated-union guard for client identity: conditional zone render (isLoaded && isSignedIn && user) — identical empty frame on server + loading tick, nav always renders"
    - "Dormant group-data-[collapsible=icon]: pre-wiring on header/footer zones (Phase 13 collapse prep)"
    - "Structural interface over non-resolvable package type (@clerk/types not directly resolvable → local UserDisplayFields)"
    - "Portaled dropdown uses global popover tokens outside the [data-sidebar=sidebar] subtree (D4)"

key-files:
  created:
    - src/lib/user.ts
    - src/lib/user.test.ts
  modified:
    - src/components/layout/app-sidebar.tsx

key-decisions:
  - "Followed the plan's structural UserDisplayFields interface in src/lib/user.ts — @clerk/types is not directly resolvable (verified) so the param is a local structural slice, matching companyFilters.ts precedent"
  - "Used SignOutButton redirectUrl=\"/sign-in\" (primary sanctioned form) — the redirectUrl[=:].*sign-in gate = 1; no useClerk fallback needed"
  - "Kept the standard multi-line JSX formatting for SidebarFooter (open/close tags on separate lines), which makes the SidebarFooter grep count 3 (import + open + close) not the plan's expected 2 — documented as a plan arithmetic discrepancy"
  - "Substituted --bail=1 for the plan's -x flag in vitest commands — Vitest 4 removed the -x alias (unknown option error); --bail=1 is the functional equivalent (stop on first failure)"

patterns-established:
  - "Client-identity guard chain: hook → isLoaded/isSignedIn/user three-branch union → conditional render scoped to the zone"
  - "Comment-hygiene rule (11-02 Rule 1) held: no why-comment quotes a swept string, class string, copy string, or the mailto literal"
  - "Avatar: plain <img> gated by hasImage, else token initials circle (bg-sidebar-primary/text-sidebar-primary-foreground 12.63:1) — no next/image, no Clerk UserAvatar"

requirements-completed: [BRND-01, BRND-02, BRND-03, BRND-04]

# Metrics
duration: 5min
completed: 2026-08-01
---

# Phase 12 Plan 1: Branding & User Zones Summary

**Sidebar chrome completed: SidebarHeader branding zone (ArcLumen 360 wordmark + org label with Q4 fade), SidebarFooter feedback pill (D2 static mailto) + divider + DropdownMenu user zone (token avatar/initials + display name + first in-app sign-out to /sign-in), backed by the extracted, Vitest-locked getUserDisplayName/getUserInitials pure functions.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-01T17:44:29Z
- **Completed:** 2026-08-01T17:49:06Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- BRND-01: `SidebarHeader` branding zone — D1 wordmark "ArcLumen 360" (15px/600 `text-sidebar-foreground`) + "ArcLumen Partners" org label (12px/400 `text-sidebar-foreground/70`), both in one wrapper with the Q4 fade (`group-data-[collapsible=icon]:opacity-0 transition-opacity duration-200`) matching `SidebarGroupLabel`'s own label-fade contract; decorative `<p>` chrome, no heading semantics.
- BRND-03: full-width "Give us feedback" pill in `SidebarFooter` — `SidebarMenuButton asChild` h-9 `rounded-[6px] border border-sidebar-border text-[14px] font-normal` (zero explicit hover classes; hover inherited from the primitive default variant), semantic `<a href={FEEDBACK_MAILTO}>` (D2 verbatim static constant, ASVS V5), dormant Mail icon + `aria-label` for the collapsed rail (Q3); `SidebarSeparator` divider (Q5).
- BRND-02: user zone reads Clerk identity via `useUser()` behind a discriminated-union guard with conditional render (`{isLoaded && isSignedIn && user && ...}`) — server frame and loading tick render an identical empty zone, nav always renders; 24px avatar (`user.imageUrl` plain `<img>` when `hasImage`, else `bg-sidebar-primary` initials circle 12.63:1) + display name from the tested `getUserDisplayName` chain; portaled dropdown (side=top, w-56) shows name + "Signed in as {email}" + separator + the app's first sign-out path (`SignOutButton redirectUrl="/sign-in"`).
- BRND-04: sidebar subtree uses `--sidebar-*` tokens only; the portaled dropdown uses global popover tokens per D4; zero indigo/amber/hex/dark: in `src/components/layout/` (sweep-clean); zero new packages; zero edits to vendored primitives.
- `src/lib/user.ts` (dependency-free pure functions + exported `UserDisplayFields` structural interface) + `src/lib/user.test.ts` (8-case nullability lock mirroring nav.test.ts) — display name never returns '' ('User' terminal), initials always produce a glyph ('A' terminal).

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract src/lib/user.ts pure display functions + src/lib/user.test.ts nullability lock (BRND-02 regression lock)** - `07d455d6` (feat)
2. **Task 2: Add branding zone (SidebarHeader wordmark + org label + Q4 fade) + feedback pill + SidebarSeparator (BRND-01, BRND-03, BRND-04)** - `78936fe5` (feat)
3. **Task 3: Add user zone — useUser() identity guard + avatar/initials + sign-out dropdown (BRND-02, BRND-04)** - `88f18165` (feat)

**Plan metadata:** pending (docs commit after SUMMARY)

## Files Created/Modified
- `src/lib/user.ts` - `getUserDisplayName` (`username ?? fullName ?? primaryEmailAddress?.emailAddress ?? 'User'`) and `getUserInitials` (trimmed first/last initials → email slice(0,2) → 'A'), both total and never returning ''; exported `UserDisplayFields` structural interface (5 nullable fields); no imports, named exports only.
- `src/lib/user.test.ts` - 8 Vitest cases (4 display-name + 4 initials) over a typed `baseUser` fixture; single relative import line `from './user'`; no `as any`.
- `src/components/layout/app-sidebar.tsx` - 94-line diff: SidebarHeader branding zone, FEEDBACK_MAILTO constant, SidebarFooter with feedback pill + SidebarSeparator + conditional user zone (DropdownMenu trigger/content, avatar/initials, sign-out item).

## Decisions Made
- **Structural interface over Clerk type import:** `@clerk/types` is not directly resolvable in this repo (verified by 12-RESEARCH A2) — `src/lib/user.ts` declares a local `UserDisplayFields` interface matching only the fields the display logic reads; the real `UserResource` is structurally compatible. Matches the `companyFilters.ts` structural-param precedent and CONVENTIONS (interface for object shapes).
- **Primary sign-out form (no fallback needed):** `SignOutButton redirectUrl="/sign-in"` inside `DropdownMenuItem asChild` type-checked and built cleanly; the `useClerk().signOut()` onSelect fallback (RESEARCH A3) was not needed. The gate `grep -cE "redirectUrl[=:].*sign-in"` = 1.
- **Conditional zone render vs early return:** the user zone renders conditionally in the footer rather than early-returning the whole `AppSidebar`, so the nav always renders while only the zone shows the identical empty frame during load.
- **`--bail=1` for `-x`:** the plan's vitest `-x` flag errors under installed Vitest 4.1.10 ("Unknown option `-x`"); `--bail=1` is the functional equivalent and was used for all targeted runs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Vitest 4 removed the `-x` short flag from `vitest run`**
- **Found during:** Task 1 (verification step)
- **Issue:** `npx vitest run src/lib/user.test.ts -x` aborted with `CACError: Unknown option -x` — the `-x` alias for `--bail` was removed in Vitest 4 (installed 4.1.10); `npx vitest run --help` confirms only `--bail <number>` exists.
- **Fix:** Used `npx vitest run src/lib/user.test.ts --bail=1` (stop after first failing test — the identical intent) for all targeted runs.
- **Files modified:** none (command substitution only)
- **Verification:** `npx vitest run src/lib/user.test.ts --bail=1` → 8/8 passed; `npx vitest run src/lib/nav.test.ts --bail=1` → 11/11 passed
- **Committed in:** n/a (verification command only; the plan's `--bail=1` on nav.test.ts already used the valid flag)

**2. [Plan arithmetic discrepancy] `SidebarFooter` grep count is 3, not the plan's expected 2**
- **Found during:** Task 2 (verification step)
- **Issue:** The plan's verify block expects `grep -Fc 'SidebarFooter'` = 2 ("import + usage"), but `grep -Fc` counts matching **lines**: the import (1) plus the element's open tag `<SidebarFooter>` (1) and close tag `</SidebarFooter>` (1) = 3, because the footer is formatted as standard multi-line JSX (matching the repo convention and the plan's own RESEARCH code example). The plan assumed a single-line element.
- **Fix:** None applied — the intent (SidebarFooter imported AND rendered in the footer) is fully satisfied; no Task 2 acceptance criterion asserts this count (it appears only in the verify-block annotation). Standard formatting preserved rather than contorting the JSX into one line.
- **Files modified:** none
- **Verification:** `grep -Fc 'SidebarFooter' src/components/layout/app-sidebar.tsx` = 3 (line 10 import, lines 121/139 open/close tags); all other counts exact
- **Committed in:** 78936fe5 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking tooling-version, 1 plan annotation discrepancy)
**Impact on plan:** None on correctness or scope. The `-x` substitution preserved test-failure semantics; the count discrepancy is a plan-side arithmetic assumption that does not affect any acceptance criterion or the shipped markup. All other grep gates match the plan's exact expected counts.

## Issues Encountered
- **Vitest `-x` flag:** resolved with `--bail=1` (see Deviation 1). No other issues — the plan executed as written.

## User Setup Required

None - no external service configuration required. (Live-browser render verification is Phase 14's UAT contract; the sign-out redirect target `src/app/sign-in/[[...sign-in]]` already exists.)

## Next Phase Readiness
- Phase 12 Wave 1 complete; **12-02 (Wave 2)** can scan the whole `src/components/layout/` dir — all sweep and fence gates are already clean at the 12-01 close (sweep-clean, fence-clean vs `d8795a11`).
- The dormant `group-data-[collapsible=icon]:` classes on the wordmark block, pill text/icon, and user-trigger name span are pre-wired for **Phase 13 (collapse)** with zero rework — the letter-mark swap seam (wordmark fade wrapper) is in place.
- Manual UAT items deferred to Phase 14: user-zone render, dropdown portal, sign-out round-trip, collapsed-rail behavior.

## Self-Check: PASSED

All acceptance criteria and plan-level verification re-run post-commit (verified 2026-08-01T17:49:06Z):

| Gate | Command | Result |
|------|---------|--------|
| tsc | `npx tsc --noEmit` | exit 0 |
| BRND-02 unit lock | `npx vitest run src/lib/user.test.ts --bail=1` | 8/8 passed |
| Nav regression lock | `npx vitest run src/lib/nav.test.ts --bail=1` | 11/11 passed |
| Full suite | `npm test` | 232 passed, 2 skipped (24 files) |
| Build | `npm run build` | exit 0 |
| D1 copy | `grep -Fc 'ArcLumen 360'` / `'ArcLumen Partners'` | 1 / 1 |
| D1 typography | `text-[15px] font-semibold text-sidebar-foreground` / `text-sidebar-foreground/70` | 1 / 1 |
| D2 mailto | full mailto literal / `FEEDBACK_MAILTO` | 1 / 2 |
| D2 copy | `Give us feedback` | 2 (visible span + aria-label) |
| Q4 fade | `group-data-[collapsible=icon]:opacity-0` | 1 |
| Q3 dormant icon | `hidden group-data-[collapsible=icon]:block` / `<Mail` | 1 / 1 |
| Q5 divider | `SidebarSeparator` | 2 |
| Identity | `useUser` / `hasImage` / `Signed in as` | 2 / 1 / 1 |
| Avatar | `bg-sidebar-primary` / `text-sidebar-primary-foreground` / `size-6` | 1 / 1 / 2 |
| Sign-out | `SignOutButton` / `grep -cE "redirectUrl[=:].*sign-in"` | 2 / 1 |
| Dropdown | `w-56` / `side="top"` / `Manage account` | 1 / 1 / 0 |
| Pure-function delegation | `getUserDisplayName` | 4 (>= 4) |
| user.ts structure | `interface UserDisplayFields` / `from '@clerk/types'` | 1 / 0 |
| Test import convention | `from './user'` in user.test.ts | 1 |
| QLTY-04 sweep | `test -z "$(grep -rnE 'indigo|amber|#[0-9a-fA-F]{3,8}|\bdark:' src/components/layout/)"` | sweep-clean |
| Diff scope | `git diff d8795a11 HEAD --stat` | exactly app-sidebar.tsx, user.ts, user.test.ts (3 files, 175 insertions, 1 deletion) |
| Fence | `git diff d8795a11 HEAD -- sidebar.tsx dropdown-menu.tsx tooltip.tsx globals.css (dashboard)/layout.tsx app-shell-layout.tsx package.json package-lock.json` | fence-clean (empty) |

Note: `SidebarFooter` = 3 (import + open/close tag lines) — documented in Deviation 2; not asserted by any acceptance criterion.

---
*Phase: 12-branding-user-zones*
*Completed: 2026-08-01*
