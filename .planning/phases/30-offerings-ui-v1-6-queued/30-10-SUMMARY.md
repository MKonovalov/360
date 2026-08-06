---
phase: 30-offerings-ui-v1-6-queued
plan: 10
subsystem: ui
tags: [nextjs, react, server-components, tabs, offerings, clerk-auth, searchparams]

# Dependency graph
requires:
  - phase: 30-01
    provides: Offerings sidebar nav item (href /offerings), reorder/delete query helpers
  - phase: 30-07
    provides: BuyerRolePanel shared lookup CRUD Sheet ({ buyerRoles, trigger })
  - phase: 30-08
    provides: ServicePortfolio hierarchy manager (7 server props) + OfferingRow type
  - phase: 30-09
    provides: parseOfferingsFilters, OfferingsFilters, OfferingsMatrix (Matrix-scoped prop shapes)
  - phase: 29-07
    provides: signals/page.tsx server-page template (requireStaffAccess gate, try/catch error card, page shell) + vendored Tabs primitive via SignalsTabs

provides:
  - src/components/offerings/offerings-tabs.tsx — OfferingsTabs two-tab client shell (Service Portfolio | Matrix), pure prop pass-through, two independent BuyerRolePanel instances
  - src/app/(dashboard)/offerings/page.tsx — the /offerings server page: requireStaffAccess gate, full fetch orchestration (all practice areas, domains, offerings, buyer roles, N+1 ranked-buyer/trigger/link fan-out), OFR-05 GBS-default Matrix resolution, OFR-07 signal-name reverse lookup, error card, page shell
  - OFR-01/OFR-02/OFR-06/OFR-07 UI wiring — the phase's final integration point making /offerings a real navigable screen
affects: [30-11 (manual QA checkpoint), OFR-01/OFR-02/OFR-06/OFR-07 requirement closure at end-of-phase, end-of-phase verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Belt-and-suspenders per-page auth: await requireStaffAccess() as the literal first statement, redundant with the (dashboard) layout gate (T-30-10-01)"
    - "Server page fetch orchestration with typed let-buckets + try/catch → generic error card; per-PA Promise.all fan-out; N+1 accepted at seed scale (T-30-10-03)"
    - "GBS-default resolution: practiceAreas.find(pa => pa.shortCode === 'GBS') ?? practiceAreas[0], defensive against an empty practice-area table"
    - "OFR-07 name resolution: fetch all company/persona signal names up front, resolve link rows to names with a #id fallback for unknown ids"
    - "Matrix-scoped subset pre-computed server-side and passed down pre-scoped — the client tab receives only the selected practice area's data"

key-files:
  created:
    - src/components/offerings/offerings-tabs.tsx
    - src/app/(dashboard)/offerings/page.tsx
  modified: []

key-decisions:
  - "OfferingsTabsProps is typed via indexed access from ServicePortfolioProps / OfferingsMatrixProps / BuyerRolePanelRole — the page and tabs can never drift from the components' real contracts"
  - "Matrix-scoped props (matrixDomains / matrixOfferingsByDomainId / matrixOfferingsWithoutDomain) are pre-computed on the server for the selected practice area and passed down — the client tab does zero data work (T-30-10-02: the ?practiceArea= tamper-safe path flows through parseOfferingsFilters → GBS fallback, never a NaN into Drizzle)"
  - "hasActiveFilters = filters.practiceAreaId !== undefined — semantically correct for the Matrix tab's single filter dimension"
  - "Two independent BuyerRolePanel instances (one per tab) per the plan — separate Sheet open state is the correct pattern, not a shared instance"

patterns-established:
  - "Assembly-page pattern for this phase: all practice areas fetched admin-wide, bucketed once into Record<number, …> maps, then sliced server-side into the Matrix-scoped subset — one fetch pass serves both tabs"
  - "OFR-07 reverse-lookup contract: Record<number, Array<{ signalType, signalId, name }>> with names resolved server-side and a #id degrade path"

requirements-completed: [OFR-01, OFR-02, OFR-06, OFR-07]

# Metrics
duration: 22min
completed: 2026-08-06
---

# Phase 30 Plan 10: OfferingsTabs Shell + /offerings Server Page Summary

**The phase's final integration point: OfferingsTabs two-tab client shell plus the /offerings server page's full fetch orchestration — staff-gated, GBS-defaulted Matrix, and OFR-07 reverse-lookup signal names threaded to every component shipped in Waves 1-5**

## Performance

- **Duration:** 22 min
- **Started:** 2026-08-06T13:22:00Z (approx)
- **Completed:** 2026-08-06T13:44:00Z (approx)
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `OfferingsTabs` (`src/components/offerings/offerings-tabs.tsx`): `'use client'` pure prop pass-through reusing the vendored `Tabs` primitive exactly as `SignalsTabs` does (D-02) — `defaultValue="portfolio"`, `TabsTrigger`s "Service Portfolio"/"Matrix", and a "Manage Buyer Roles" `variant="outline"` button top-right on BOTH tabs via two independent `BuyerRolePanel` instances (separate Sheet open state per tab, matching the plan's independent-trigger pattern). Zero data fetching in the wrapper.
- `/offerings` server page (`src/app/(dashboard)/offerings/page.tsx`, 200 lines): `await requireStaffAccess()` as the literal first statement (belt-and-suspenders alongside the (dashboard) layout gate, T-30-10-01), `parseOfferingsFilters(await searchParams)`, then a try/catch fetch orchestration → generic "Couldn't load the Service Portfolio" error card (T-30-10-04).
- Fetch orchestration: `listAllPracticeAreas()` (admin list — drafts included for Service Portfolio management), per-PA `Promise.all` of `listDomainsForPracticeArea` + `listAllOfferingsForPracticeArea` bucketed into `domainsByPracticeAreaId` / `offeringsByDomainId` (non-null `domainId`) / `offeringsWithoutDomainByPracticeAreaId` (OFR-04 no-domain flow), `listBuyerRoles()`, then an N+1-accepted per-offering fan-out of ranked buyer roles + triggers + reverse links (T-30-10-03 accept, mirroring signals/page.tsx's own precedent).
- OFR-05 GBS default: `practiceAreas.find((pa) => pa.shortCode === 'GBS') ?? practiceAreas[0]`, with `filters.practiceAreaId ?? gbsPracticeArea?.id` and undefined-safe bucket lookups so an empty practice-area table degrades to the Matrix zero-state, never a crash.
- OFR-07 reverse lookup: all company + persona signal names fetched per practice area up front into `companySignalNamesById` / `personaSignalNamesById`, then every offering's `listLinksForOffering` rows resolved to `{ signalType, signalId, name }` with a `#${signalId}` fallback for unknown ids.
- Matrix-scoped subset (GBS-default or URL-filtered practice area) pre-computed server-side — `matrixDomains`, `matrixOfferingsByDomainId`, `matrixOfferingsWithoutDomain`, `hasAnyOfferingsForPracticeArea` — and passed pre-scoped to the tabs. Page shell byte-identical to signals/page.tsx.

## Task Commits

Each task was committed atomically:

1. **Task 1: OfferingsTabs shell (two-tab, "Manage Buyer Roles" on both tabs)** - `c3f2681e` (feat)
2. **Task 2: /offerings server page — fetch orchestration, GBS default, OFR-07 name resolution, page shell** - `5936dab8` (feat)

**Plan metadata:** pending in the final docs commit (`docs(30-10)`)

## Files Created/Modified
- `src/components/offerings/offerings-tabs.tsx` - `OfferingsTabs` + `OfferingsTabsProps` (indexed-access typing from the five sibling components' contracts); pure pass-through shell
- `src/app/(dashboard)/offerings/page.tsx` - the `/offerings` server page: staff gate, full fetch orchestration, GBS default, OFR-07 name resolution, Matrix-scoped subset, error card, page shell

## Decisions Made
- `OfferingsTabsProps` types every prop via indexed access from the actual component contracts (`ServicePortfolioProps['…']`, `OfferingsMatrixProps['…']`, `BuyerRolePanelRole`) — a future prop change in any Wave 5 component surfaces as a type error here, not silent drift.
- Matrix-scoped data is sliced on the server (single fetch pass serves both tabs); the client Matrix tab is a pure renderer of the pre-scoped subset — no client-side data work anywhere (per the plan's key_link pattern).
- `hasActiveFilters` is computed as `filters.practiceAreaId !== undefined` — truthful for the Matrix tab's single filter dimension (the prop is plan-mandated in the OfferingsMatrix contract even though its literal empty-state branches key off `hasAnyOfferingsForPracticeArea`).
- Full DB rows are passed directly as component props — the query layer's rows are structurally assignable to the interfaces (extra audit columns are simply not projected), so no manual row-mapping shims were needed.
- The error-card heading uses the exact plan-mandated copy `Couldn&apos;t load the Service Portfolio` (Copywriting Contract line 112) — never a raw DB error or stack trace (T-30-10-04).

## Deviations from Plan

None - plan executed exactly as written. Both tasks compiled clean on first pass (`npx tsc --noEmit` exit 0), the build emitted `/offerings`, and every acceptance grep matched (2 `BuyerRolePanel` sites, 2 tab triggers, 1 `OfferingsFilters` total — Matrix tab only, `pa.shortCode === 'GBS'`, `await requireStaffAccess();`, both signal-name maps).

**Total deviations:** 0
**Impact on plan:** N/A — no scope creep.

## Issues Encountered
- None. The only test-suite failure is the documented pre-existing VER-03 `openrouter-only-chain.test.ts` (Phase 22-04, live-API/credits, untouched by Phase 30): 567 passed / 37 skipped / 1 failed.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `/offerings` is now a fully functional, staff-gated, two-tab screen: nav item (30-01) → page (30-10) → both tabs wired to every Wave 1-5 component with real GBS seed data.
- 30-11 (Manual QA checkpoint, Wave 7) is the remaining plan: a live UAT sweep of OFR-01..OFR-08 against GBS seed data. The local-dev Clerk credentials note from 29-08 still applies (`.env.local` Clerk keys were re-added during Phase 29 troubleshooting).
- REQUIREMENTS.md stays Pending (queued milestone precedent) — OFR-01/OFR-02/OFR-06/OFR-07 UI wiring is complete here, but requirement closure happens at end-of-phase verification after 30-11.
- Manual behaviors to confirm in 30-11: unauthenticated `/offerings` redirects to `/sign-in` (requireStaffAccess), Matrix defaults to GBS with no `?practiceArea=`, the Practice Area filter updates the URL + grouped table, and an offering with seeded signal links shows them in its edit Sheet's Linked Signals section.

---
*Phase: 30-offerings-ui-v1-6-queued*
*Completed: 2026-08-06*
## Self-Check: PASSED
- FOUND: src/components/offerings/offerings-tabs.tsx
- FOUND: src/app/(dashboard)/offerings/page.tsx
- FOUND: .planning/phases/30-offerings-ui-v1-6-queued/30-10-SUMMARY.md
- FOUND: c3f2681e (Task 1 commit)
- FOUND: 5936dab8 (Task 2 commit)
