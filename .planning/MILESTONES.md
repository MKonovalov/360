# Milestones

## v1.2 Exa-Style Left Panel (Shipped: 2026-08-01)

**Phases completed:** 5 phases, 10 plans, 26 tasks

**Key accomplishments:**

- `getActiveNavKey(pathname)` — a pure, boundary-guarded, total-function active-route detector (`NavKey` union) shipped with an 11-case Vitest regression suite that permanently locks the `/companies/[id]` detail highlight and the `/companies-archive` sibling-prefix null case; function unwired by design until Phase 11's consumer swap.
- Nav regrouped into Explore/Manage intent sections with 13px/600 labels, all 4 rows restyled to the Exa 30px/16px/15px/10px/8px anatomy, active state delegated to the tested `getActiveNavKey` pure function with the v1.1 indigo overrides deleted, and the pending-reviews badge converted to a mono 10px/600 sidebar-accent chip with a collapsed-rail dot
- Replaced the sidebar subtree's last hardcoded indigo utility (resize-handle `hover:bg-indigo-200`) with the token-derived `hover:bg-foreground/10`, verified the Phase 10 `border-r` → `border-sidebar-border` companion rule in place without redoing it, and closed Phase 11 with a fully green regression battery (sweep-clean, 224/2 tests, nav lock 11/11, build green, fence-clean).
- Sidebar chrome completed: SidebarHeader branding zone (ArcLumen 360 wordmark + org label with Q4 fade), SidebarFooter feedback pill (D2 static mailto) + divider + DropdownMenu user zone (token avatar/initials + display name + first in-app sign-out to /sign-in), backed by the extracted, Vitest-locked getUserDisplayName/getUserInitials pure functions.
- Phase-12 close verified: QLTY-04 sweep gate clean across `src/components/layout/` (zero indigo/amber/hex/dark:), all 8 protected files byte-identical (fence-clean), whole-phase diff scope = exactly app-sidebar.tsx + src/lib/user.ts + src/lib/user.test.ts, and the full regression battery green (tsc exit 0, nav.test.ts 11/11, user.test.ts 8/8, npm test 232 passed/2 skipped ≥ 224 baseline, npm run build exit 0) — BRND-01..04 landed with zero collateral damage to the frozen contract.
- Activated the dormant icon-rail collapse system in app-sidebar.tsx (single `collapsible="icon"` switch + TooltipProvider 200ms mount + always-visible collapse button + 28px letter-mark + tooltips on all 6 interactive icons) and hid the drag-resize handle while collapsed via a post-hooks `useSidebar()` early return — with the D-08 tooltip copy contract-locked by a new tested pure helper, and the frozen 200-400px clamp / sidebar_width cookie / ⌘B / sidebar_state machinery left byte-identical.
- Closed Phase 13 with zero production changes: the QLTY-04 sweep gate prints `sweep-clean` (0 indigo/amber/hex/dark: across `src/components/layout/`), the 9-file fence is byte-identical (`8b9d6e42`..HEAD — vendored primitives incl. button.tsx, globals.css token block, dashboard/auth layout, app-shell layout, package manifests), the whole-phase diff is exactly the 4 planned source files (app-sidebar.tsx + sidebar-resize-handle.tsx + sidebar-collapse.ts + sidebar-collapse.test.ts), and the full regression battery is green — `npx tsc --noEmit` exit 0, nav.test.ts 11/11, user.test.ts 8/8, sidebar-collapse.test.ts 7/7, `npm test` exit 0 (25 files / 239 passed / 2 skipped — the exact Wave-1 baseline), `npm run build` exit 0.
- WCAG contrast math unit-locked in src/lib/contrast.ts (4 Vitest-locked ratios: 12.30 / 4.89 / 3.11 / 1.09), followed by a fully-passing 18-test live-browser UAT: the 12-cell expanded/collapsed/mobile × 4-route matrix with exactly-one-active-row assertions and committed screenshot evidence, plus interaction micro-tests M1-M5 (collapse button, ⌘B + sidebar_state cookie, drag-resize [200,400] clamp + sidebar_width cookie, six rail tooltips, badge/dot gating proven both branches via a SHA-256-gated fixture).
- Live browser-computed WCAG AA evidence for all 6 shipped sidebar token pairs (12.30 / 4.89 / 3.11 / 5.91 / 4.30 / 12.63, all passing their thresholds with sampled computed colors), the Exa divergence review (element-wise pass/fail with an explicit auth-wall fallback to the dated FEATURES.md capture), and the full hard-constraint regression battery (11-file fence byte-identical, QLTY-04 sweep clean, tsc/test/build green, live unauthenticated → /sign-in redirect observed) — recorded in 14-VERIFICATION.md, closing Phase 14 (D-08).

---

## v1.1 Start Page + Import + Analytic Agent (Shipped: 2026-08-01)

**Phases completed:** 5 phases, 27 plans, 32 tasks

**Key accomplishments:**

- Shared entity-agnostic accordion-table foundation (generic Server Component + nuqs-backed client behavior wrapper) that Plans 02/03 wire into Company/Persona list pages — no page imports it yet.
- Company explorer rewired onto the Phase 05-01 shared accordion foundation: single-column stacked list with full-width inline expand/collapse, URL-synced via `?selected=`, and `/companies/[id]` reduced to a thin auth-gated redirect stub.
- Persona list/detail wired onto the shared ExplorerAccordionTable/ExplorerTableBehavior components, mirroring the Company explorer's stacked single-expand accordion layout, with /personas/[id] reduced to a thin redirect to /personas?selected=<id>
- recentlyViewed table (upsert-on-view via composite unique constraint) plus four dashboard aggregate queries and a session-derived recordView Server Action, all live against Neon Postgres
- Deduped the companies/personas sidebar shell into one `AppShellLayout` component, vendored shadcn's `dropdown-menu` primitive, built the shared `ExplorerMenu` (labeled/icon variants), and added an exact-match "Start" nav item above Companies/Key Personas.
- Wired the shared `ExplorerMenu` dropdown (Import on both list pages, Analyze on both detail panels) and a new `RecordViewTracker` mount-effect component into Company/Persona explorers, making MENU-01, MENU-02, and the write half of START-03 observable in the running app
- New `(dashboard)` route group fully replaces `/` with a Start Page (3 stat cards + 4 independently-failing widgets), consuming Plan 06-01's dashboard queries and Plan 06-02's AppShellLayout/Start-nav-item — closing the app's one prior anonymous-access exception.
- CSV Import pipeline: `company.domain`/`persona.email` unique dedup keys, `import_batch`/`import_log` tables, and a 6-server-action wizard (upload → auto-map columns/enums → partial-commit validation → commit → history → rollback with dependency checks) behind `/companies/import` and `/personas/import`, plus a schema-generated template download and a Vitest test harness bootstrap (07-01..07-11).
- Enrichment API: Apollo.io companies / Prospeo personas integration with fill-empty-only merge policy, field-level `fieldSources` provenance, merge-conflict review dialog, and auth-gated run/commit Server Actions — proven live against real vendor data in `08-06-UAT.md` (08-01..08-06).
- Agent-core seam (flat ai@7 generateText + env-gated Firecrawl webSearch + single-source zod output schema), fail-closed AIRS gate port, and signal/agent-run/correction tables on Neon with optional server-only keys
- analyzeCompany orchestration (run -> evidence appendix -> verdict -> fail-closed gate -> dedup) plus durable runs/proposals/corrections query modules with an idempotent guarded Accept (ONE Accept = ONE Signal) and structured Reject with Langfuse mirror
- First Route Handler (POST /api/companies/[id]/analyze) with distinct fail-loud error domains, staff-gated accept/reject server actions, /reviews review queue UI with inline evidence + Langfuse trace links, live Menu Analyze trigger with run-feedback strip, amber pending badge, and sidebar Reviews entry — the analytic agent's full propose→review→accept/reject user loop, UAT-approved live

---

## v1.0 MVP (Shipped: 2026-07-24)

**Phases completed:** 4 phases, 14 plans, 31 tasks

**Key accomplishments:**

- Migrated the repo from Astro/@clerk/astro/Sanity to Next.js 16 App Router with @clerk/nextjs, deleting all retiring code and centralizing staff-access authorization in one `requireStaffAccess()` function.
- Neon `company` table extended with 5 firmographic columns and 2 new pgEnums (revenue_band, ownership_type), a filterable `listCompanies`/`getCompanyById`/`listDistinctIndustries` query layer, a `listPersonasForCompany` join query, and the seed dataset grown from 2 to 9 fully-fleshed fake companies.
- Radix-based shadcn/ui sidebar (collapsible + drag-to-resize, cookie-persisted) wrapping a `requireStaffAccess()`-gated `/companies` route that renders all 9 seeded companies' firmographics with amber signal badges.
- `/companies/[id]` master-detail route: firmographics, tech-stack badges, sourced/dated buying signals, and linked personas, with row-click navigation, selected-row highlight, and a mobile list/detail swap.
- Debounced nuqs search box and four schema-enum-validated filter Selects wired into both `/companies` and `/companies/[id]`, with URL-synced state, AND-combined Drizzle filtering, and UI-SPEC's filtered-empty/true-empty/error copy — completing EXPL-01, EXPL-02, and EXPL-07.
- Extended `persona` schema with a seniority enum and nullable contact fields, built the `listPersonas(filters)` query layer including a two-hop EXISTS join, and backfilled the 10-persona seed dataset with full seniority/contact variety — all pushed and loaded live into Neon.
- Gated `/personas` route with debounced search, AND-combined seniority/currentCompany/hasSignals filters over the full 10-persona seed set, and `AppSidebar` converted to a `usePathname()`-driven Client Component so both explorer sections highlight correctly.
- Added `PersonaDetail` (Role & Seniority / Current Company linked to `/companies/[id]` / Career History with date ranges / Contact Info) and the gated `/personas/[id]` route, then wired `PersonaList` row clicks + selected-row highlight — completing full click-through browsability across both explorers.
- Read-only Arcpedia "Related Knowledge" section wired into both Company and Persona 360 views via a never-throws fetch client, plus DB-fetch try/catch error cards extending Phase 2/3's list-pane resilience pattern to the two detail panes.
- Cloudflare Access Service Token provisioned for arcpedia.arclumen.de; Related Knowledge sections and detail-pane error cards confirmed working end-to-end in a live environment

---
