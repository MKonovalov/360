---
phase: 02-company-explorer
verified: 2026-07-23T16:44:30Z
status: human_needed
score: 10/10 must-haves verified (code-level); 4 human-verification items outstanding
overrides_applied: 0
mvp_mode_discrepancy:
  declared_mode: mvp
  goal_is_user_story: false
  action_taken: "Proceeded with standard goal-backward verification (ROADMAP Success Criteria + PLAN must_haves) since the phase goal is not in 'As a X, I want Y, so that Z' format. Flagging as a discrepancy per references/verify-mvp-mode.md rather than blocking verification outright — recommend running `/gsd mvp-phase 2` to reformat the goal, or clearing `mode: mvp` in ROADMAP.md if MVP framing wasn't actually intended for this phase."
human_verification:
  - test: "Drag the sidebar's right-edge resize handle wider/narrower, release, then hard-reload the page"
    expected: "Sidebar width follows the cursor smoothly between ~200-400px; the dragged width survives a full page reload (sidebar_width cookie)"
    why_human: "Real-time pointer-drag behavior and visual smoothness cannot be verified via static code inspection"
  - test: "Sign in, visit /companies, click a company row"
    expected: "URL becomes /companies/{id}; the list stays visible with the clicked row highlighted (indigo-600 left border); the detail pane shows firmographics, tech stack badges, buying signals with source+date, and linked personas"
    why_human: "Visual layout, highlight styling, and end-to-end click navigation require a browser"
  - test: "Copy a /companies/{id} URL (optionally with ?search=&industry=&signal=... active) into a fresh tab; narrow the browser window below the md breakpoint with a company selected"
    expected: "Fresh tab restores the exact same filtered/selected view; narrow viewport hides the list and shows only the detail pane with a working 'Back to list' link; /companies/999999 shows a 404, not a crash"
    why_human: "Deep-link round-trip and responsive breakpoint behavior are runtime/visual and not fully assertable from source alone"
  - test: "Type in the search box and wait ~300ms; select two filters together (e.g. industry + signal type)"
    expected: "List narrows after the debounce delay and the URL gains ?search=...; selecting both filters narrows to companies matching BOTH (AND); a query matching nothing shows 'No companies match your filters'"
    why_human: "Debounce timing and combined-filter narrowing are best confirmed interactively; automated checks here only confirm the code paths exist (grep/tsc/build), not the felt UX"
---

# Phase 2: Company Explorer Verification Report

**Phase Goal:** Staff can find and fully review any Company end-to-end — search, filter, scan signal badges in a list, and open complete 360 detail (firmographics, tech stack, buying signals with source/date, linked personas) — all gated behind existing Clerk auth, with search/filter state URL-synced, establishing the master-detail/URL-state pattern Phase 3 reuses.

**Verified:** 2026-07-23T16:44:30Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Note on MVP Mode

ROADMAP.md declares `mode: mvp` for Phase 2, but the phase `goal` field is not in the "As a [role], I want to [capability], so that [outcome]." format required for MVP-mode UAT framing (`gsd-sdk query user-story.validate` returns `valid: false` against the current goal text). Per `references/verify-mvp-mode.md` this is a discrepancy that should route back to `/gsd mvp-phase 2` for reformatting, or the `mode: mvp` flag should be cleared if MVP framing wasn't actually intended. Rather than blocking verification entirely, this report proceeds with the standard goal-backward methodology (ROADMAP Success Criteria + PLAN.md `must_haves`), which is a strict superset of what MVP framing would additionally require here. This does not affect the findings below — it is a process/documentation note for the developer to resolve before the next MVP-mode phase.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria — the contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Staff sees a collapsible/resizable left nav (Companies + Key Personas) and can search/filter the Company list by name, industry, signal type, and other attributes | ✓ VERIFIED | `src/components/layout/app-sidebar.tsx` (two-section nav, Companies active/Key Personas disabled per D-11); `src/components/layout/sidebar-resize-handle.tsx` + `src/app/companies/layout.tsx` (drag-resize 200-400px, `sidebar_width` cookie read server-side); `src/components/companies/company-search-input.tsx` (nuqs debounced search); `src/components/companies/company-filters.tsx` (industry/signal/revenueBand/ownershipType Selects) |
| 2 | Clicking a Company row opens full detail in a master-detail pane while the list stays visible; list rows show signal badges | ✓ VERIFIED | `src/components/companies/company-list.tsx` (`Link href=/companies/{id}` per row, indigo-600 selected-row highlight, `SignalBadge` per distinct signal type); `src/app/companies/[id]/page.tsx` (two-column grid renders `CompanyList` + `CompanyDetail` side by side; list only hides on mobile via `hidden md:block`) |
| 3 | Company detail shows firmographics, tech stack, and buying signals each with source + last-updated date | ✓ VERIFIED | `src/components/companies/company-detail.tsx`: Firmographics section (employeeCountBand/hqLocation/revenueBand/ownershipType), Tech Stack section (`Badge variant="outline"` per techStack entry), Buying Signals section (`SignalBadge` + `signal.source` + `Intl.DateTimeFormat`-formatted `detectedAt`) |
| 4 | Company detail shows linked Personas inline | ✓ VERIFIED | `company-detail.tsx` "Linked Personas" section renders `listPersonasForCompany(id)` results (name + role title) inline, no separate route needed |
| 5 | Selected Company and active filters are reflected in the URL (shareable/reopenable) | ✓ VERIFIED | `company-search-input.tsx`/`company-filters.tsx` use `useQueryState(..., { shallow: false })` (real navigation, not client-only mutation); `src/app/companies/page.tsx` and `src/app/companies/[id]/page.tsx` both parse `searchParams` into `CompanyFilters` and pass to `listCompanies`/`CompanyList`; `/companies/[id]` itself encodes the selection in the path |

**Score:** 5/5 ROADMAP success criteria verified at code level.

### Additional PLAN-frontmatter Must-Haves (spot-checked, not duplicating the above)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 6 | Unauthenticated visitor hitting `/companies` or `/companies/[id]` is redirected to `/sign-in`, never sees company data | ✓ VERIFIED | `requireStaffAccess()` is the first line of `companies/layout.tsx`, `companies/page.tsx`, and `companies/[id]/page.tsx`. Runtime check: `curl -o /dev/null -w "%{http_code} %{redirect_url}"` against a local production build (`npm run build && npm run start`) returned `307 http://localhost:3000/sign-in` for both `/companies` and `/companies/1` |
| 7 | Seed dataset contains 9 companies with full firmographic/signal/persona variety, loaded into Neon | ✓ VERIFIED | Direct query against the live Neon instance (via `@neondatabase/serverless`, `.env.local` credentials) returned `company=9, persona=10, signal=12, company_persona_role=11` — matches the plan's exact target counts; `company` table columns confirmed present (`revenue_band`, `ownership_type`, `hq_location`, `tech_stack`, `employee_count_band`) |
| 8 | A zero-match search/filter combination shows "No companies match your filters", not a blank table or crash | ✓ VERIFIED | `company-list.tsx` branches on `hasActiveFilters` before rendering the empty state; exact copy string present (`grep` confirms `"No companies match your filters"` literal in file) |
| 9 | Pasting a copied `/companies/[id]` URL (with filters) into a fresh tab restores the exact view | ✓ VERIFIED (code-level) | Both routes derive all state (selection via path param, filters via `searchParams`) server-side with no client-only state dependency — architecturally guarantees round-trip; full interactive confirmation listed under Human Verification below |
| 10 | `npx tsc --noEmit` and `npm run build` both pass | ✓ VERIFIED | Ran both directly against the current working tree: `tsc --noEmit` exits 0 with no output; `npm run build` completes successfully, listing `ƒ /companies` and `ƒ /companies/[id]` as dynamic routes |

**Combined score:** 10/10 must-haves verified at the code/build/DB level.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/db/schema.ts` | `revenueBandEnum`/`ownershipTypeEnum` + 5 new company columns | ✓ VERIFIED | All present, nullable/additive as specified |
| `src/lib/db/queries/companies.ts` | `CompanyFilters`, `listCompanies(filters)`, `getCompanyById`, `listDistinctIndustries` | ✓ VERIFIED | All exported; `listCompanies` uses parameterized `and`/`eq`/`ilike`/`exists`, no raw SQL |
| `src/lib/db/queries/companyPersonaRoles.ts` | `listPersonasForCompany(companyId)` | ✓ VERIFIED | Inner join present |
| `data/seed/*.csv` | 9 companies / 10 personas / 12 signals / 11 roles | ✓ VERIFIED | Line counts match; live DB row counts match |
| `src/app/companies/layout.tsx` | Auth gate + Sidebar shell + resize width cookie read | ✓ VERIFIED | `requireStaffAccess()` first line; cookie-driven `--sidebar-width` |
| `src/components/layout/app-sidebar.tsx` | Two-section nav | ✓ VERIFIED | Companies (active link) / Key Personas (disabled) |
| `src/components/layout/sidebar-resize-handle.tsx` | Drag-resize + cookie persistence | ✓ VERIFIED | `pointerdown`/`pointermove`/`pointerup`, clamps 200-400px, writes `sidebar_width` cookie |
| `src/app/companies/page.tsx` | Gated list route | ✓ VERIFIED | `requireStaffAccess()`, renders search/filters + `CompanyList` |
| `src/components/companies/company-list.tsx` | Table w/ firmographics + signal badges + row links + selectedId highlight + mobile swap + error/empty states | ✓ VERIFIED | All present |
| `src/components/companies/signal-badge.tsx` | Single amber style, 4 signal-type labels | ✓ VERIFIED | No per-type color, human-readable labels |
| `src/app/companies/[id]/page.tsx` | Detail route, gated, awaits params+searchParams | ✓ VERIFIED | `requireStaffAccess()`, `await params`/`await searchParams`, `Number.isNaN` guard + `notFound()` |
| `src/components/companies/company-detail.tsx` | Firmographics, tech stack badges, signals w/ source+date, linked personas | ✓ VERIFIED | All 4 sections present; `notFound()` on missing company |
| `src/components/companies/company-search-input.tsx` | nuqs debounced search | ✓ VERIFIED | `useQueryState` + `debounce(300)`, `shallow: false` |
| `src/components/companies/company-filters.tsx` | 4 enum-validated Selects | ✓ VERIFIED | `parseAsStringEnum` sourced from schema `enumValues` for signal/revenueBand/ownershipType; industry from `listDistinctIndustries()` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `companies/layout.tsx` | `requireStaffAccess.ts` | `await requireStaffAccess()` first line | ✓ WIRED | Confirmed in source + runtime 307 redirect test |
| `sidebar-resize-handle.tsx` | `companies/layout.tsx` | `sidebar_width` cookie round-trip | ✓ WIRED | Client writes cookie on `pointerup`; layout reads via `cookies()` server-side with a clamped fallback |
| `company-list.tsx` | `listCompanies()` | Server Component data fetch | ✓ WIRED | Wrapped in `try/catch`, real query, real rows rendered |
| `company-list.tsx` | `signal-badge.tsx` | Per-row `SignalBadge` from `listSignalsForCompany` | ✓ WIRED | Distinct signal types deduped and rendered |
| `company-list.tsx` | `/companies/[id]` | `Link href=/companies/{id}` | ✓ WIRED | Present in table cell |
| `company-detail.tsx` | `getCompanyById` / `listSignalsForCompany` / `listPersonasForCompany` | Server Component data fetch | ✓ WIRED | All three called, results rendered, not discarded |
| `company-search-input.tsx` / `company-filters.tsx` | `companies/page.tsx` & `[id]/page.tsx` `searchParams` | `useQueryState(..., {shallow:false})` → real navigation → `searchParams` parsed into `CompanyFilters` | ✓ WIRED | `shallow:false` confirmed in both Client Components; both Server Components parse and forward `CompanyFilters` to `listCompanies` |
| `company-filters.tsx` | `schema.ts` enums | `parseAsStringEnum(schemaEnum.enumValues)` | ✓ WIRED | Signal/revenueBand/ownershipType filters imported directly from `@/lib/db/schema` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `company-list.tsx` | `companies` (from `listCompanies(filters)`) | Drizzle query against live Neon `company` table | Yes — confirmed 9 real rows via direct DB query | ✓ FLOWING |
| `company-detail.tsx` | `company`, `signals`, `personaRoles` | `getCompanyById`, `listSignalsForCompany`, `listPersonasForCompany` — all real Drizzle queries against Neon | Yes — same live DB, non-empty for all seeded companies | ✓ FLOWING |
| `company-filters.tsx` industry options | `industries` prop | `listDistinctIndustries()` called server-side in both page components, passed as a prop (not hardcoded) | Yes | ✓ FLOWING |

No hollow props or static-empty-return patterns found in any Phase 2 file.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Unauthenticated `/companies` redirects | `npm run build && npm run start` then `curl -o /dev/null -w "%{http_code} %{redirect_url}" localhost:3000/companies` | `307 http://localhost:3000/sign-in` | ✓ PASS |
| Unauthenticated `/companies/1` redirects | same, against `/companies/1` | `307 http://localhost:3000/sign-in` | ✓ PASS |
| `/` still loads (no regression) | `curl -o /dev/null -w "%{http_code}" localhost:3000/` | `200` | ✓ PASS |
| Live seed data matches plan's contract | Direct Neon query via `@neondatabase/serverless` | `company=9, persona=10, signal=12, company_persona_role=11` | ✓ PASS |
| Type-check clean | `npx tsc --noEmit` | Exit 0, no output | ✓ PASS |
| Production build clean | `npm run build` | Exit 0; `/companies` and `/companies/[id]` listed as dynamic (`ƒ`) routes | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` files exist in this repo and no plan/summary for this phase references probe-based verification. **Step 7c: SKIPPED (no probes declared or found).**

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| COMP-01 | 02-01, 02-02 | Company list w/ firmographics | ✓ SATISFIED | `company-list.tsx` table columns; REQUIREMENTS.md already checked `[x]` |
| COMP-02 | 02-01, 02-03 | Tech stack view | ✓ SATISFIED | `company-detail.tsx` Tech Stack section; REQUIREMENTS.md already checked `[x]` |
| COMP-03 | 02-03 | Buying signals w/ source + last-updated date | ✓ SATISFIED (code matches ROADMAP's exact wording) | `company-detail.tsx` Buying Signals section renders `SignalBadge` + `source` + `detectedAt`. **Note:** REQUIREMENTS.md still shows this item unchecked (`[ ]`) despite the code satisfying ROADMAP's Success Criterion #3 verbatim ("each with a source and last-updated date") — this looks like a stale checklist, not a functional gap; recommend updating REQUIREMENTS.md's checkbox. |
| COMP-04 | 02-01, 02-03 | Linked personas inline | ✓ SATISFIED | `company-detail.tsx` Linked Personas section; REQUIREMENTS.md already checked `[x]` |
| EXPL-01 | 02-04 | Search Companies by name (Persona search is Phase 3 scope) | ✓ SATISFIED | `company-search-input.tsx` + `listCompanies`'s `ilike` |
| EXPL-02 | 02-04 | Filter by industry/signal type/etc | ✓ SATISFIED | `company-filters.tsx` |
| EXPL-03 | 02-02 | Collapsible/resizable left nav, 2 sections | ✓ SATISFIED | `app-sidebar.tsx` + `sidebar-resize-handle.tsx` |
| EXPL-04 | 02-03 | Master-detail pane, list stays visible | ✓ SATISFIED (code matches ROADMAP's exact wording) | `[id]/page.tsx` two-column grid. **Note:** REQUIREMENTS.md still shows this item unchecked (`[ ]`) — same stale-checklist pattern as COMP-03; recommend updating. |
| EXPL-05 | 02-02 | Signal badges on rows | ✓ SATISFIED | `company-list.tsx` per-row `SignalBadge`; REQUIREMENTS.md already checked `[x]` |
| EXPL-07 | 02-03, 02-04 | Selection + filters in URL | ✓ SATISFIED | Path param + `searchParams`/`shallow:false`; REQUIREMENTS.md already checked `[x]` |

**Orphaned requirements check:** REQUIREMENTS.md maps only COMP-01..04 and EXPL-01..07 (minus EXPL-06, explicitly Phase 4) to Phase 2 — all of them appear in at least one plan's `requirements:` frontmatter field. No orphaned requirements found.

**Documentation gap (non-blocking):** COMP-03 and EXPL-04 are implemented and verified in code but remain unchecked (`[ ]`) in `.planning/REQUIREMENTS.md`. This is a checklist-maintenance gap, not a functional gap — recommend the developer check these two boxes to keep REQUIREMENTS.md in sync with the verified codebase.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/layout/sidebar-resize-handle.tsx` | 30 | `react-hooks/immutability` ESLint error (function-declaration-order pattern flagged by the React Compiler ESLint plugin) | ⚠️ Warning | Pre-existing since Plan 02-02 (this phase), surfaced by `npm run lint`, logged in `deferred-items.md` by Plan 02-04's executor but attributed there as "pre-existing/out-of-scope" — technically it was introduced by this same phase (Plan 02-02), just discovered later. Does not affect runtime behavior (confirmed via `tsc`, `build`, and manual drag-resize logic review) but should be fixed, not permanently deferred. |
| `src/hooks/use-mobile.ts` | 14 | `react-hooks/set-state-in-effect` ESLint error | ⚠️ Warning | Shadcn-CLI-generated file (transitive dependency of the `sidebar` primitive added in Plan 02-02), not hand-authored by this phase. Logged in `deferred-items.md`. No functional impact observed. |
| — | — | No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK` markers found in any Phase 2 file | ℹ️ Info | Clean — debt-marker gate does not trigger for this phase |

Neither anti-pattern is a blocker: both are lint-level warnings with no observed functional impact, already self-disclosed in `deferred-items.md` by the phase's own execution. Recommended follow-up, not a phase-goal blocker.

## Human Verification Required

The phase's own Plan 03 SUMMARY explicitly states: *"Manual/browser QA ... was not performed interactively in this automated run (`human_verify_mode: end-of-phase`) — recommended at phase-end review."* This phase-end review is now. The following items were deferred from per-plan `<human-check>` blocks (Plans 02, 03, 04) and must be confirmed interactively before this phase can be marked fully `passed`:

### 1. Sidebar drag-to-resize

**Test:** Sign in, visit `/companies`. Grab the thin drag handle at the sidebar's right edge and drag it wider/narrower.
**Expected:** Sidebar width follows the cursor smoothly between roughly 200-400px. Release, then hard-reload the page — the sidebar keeps the dragged width instead of snapping back to the default.
**Why human:** Real-time pointer-drag smoothness and visual feedback cannot be confirmed from source code alone.

### 2. Row click → master-detail navigation

**Test:** Sign in, visit `/companies`, click a company row.
**Expected:** URL becomes `/companies/{id}`; the list stays visible with the clicked row highlighted; the detail pane shows firmographics, tech stack badges, buying signals with source+date, and linked personas.
**Why human:** End-to-end click navigation and visual highlight/layout confirmation require a browser.

### 3. Deep-link round-trip and mobile responsive swap

**Test:** Copy a `/companies/{id}` URL (optionally with search/filters active) into a fresh tab. Narrow the browser window below the `md` breakpoint with a company selected. Visit `/companies/999999`.
**Expected:** Fresh tab restores the exact same view; narrow viewport hides the list and shows only the detail pane with a working "Back to list" link; `/companies/999999` shows a 404, not a crash.
**Why human:** Deep-link restoration and responsive breakpoint behavior are best confirmed visually in a real browser across viewport sizes.

### 4. Debounced search and AND-combined filters

**Test:** Visit `/companies`. Type a search term and wait ~300ms. Select an industry filter and a signal-type filter together. Search for a nonsense string matching nothing.
**Expected:** List narrows after the debounce delay and the URL gains `?search=...`; combined filters narrow to companies matching BOTH (AND); a no-match query renders "No companies match your filters".
**Why human:** Debounce timing and the felt UX of combined filtering are best confirmed interactively — code inspection confirms the mechanism exists but not the timing/feel.

## Gaps Summary

No functional gaps found. All 10 must-haves (5 ROADMAP Success Criteria + 5 additional PLAN-level must-haves) are verified at the code, type-check, build, and live-database level. Auth gating was confirmed at runtime via a local production server. The phase's own SUMMARY documents explicitly acknowledge that interactive browser QA was deferred to phase-end review (`human_verify_mode: end-of-phase`) — that review is what produces the `human_needed` status here, not a code defect.

Two non-blocking documentation/quality items are worth developer attention but do not block phase completion:
1. REQUIREMENTS.md checkboxes for COMP-03 and EXPL-04 are stale (unchecked) despite both being implemented and verified.
2. Two pre-existing ESLint errors (`sidebar-resize-handle.tsx`, `use-mobile.ts`) are logged in `deferred-items.md` but not yet fixed.

---

*Verified: 2026-07-23T16:44:30Z*
*Verifier: Claude (gsd-verifier)*
