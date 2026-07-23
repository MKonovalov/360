---
phase: 03-persona-explorer
verified: 2026-07-23T20:54:37Z
status: gaps_found
score: 13/15 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Selecting seniority, current company, or has-signals filters narrows the list; multiple active filters AND-combine (03-02-PLAN must_have)"
    status: failed
    reason: >
      The "has signals: No" filter option is a no-op. `parsePersonaFilters` (src/app/personas/page.tsx:23,
      src/app/personas/[id]/page.tsx:26) collapses the UI's tri-state Select ("unset" / "Yes" / "No") into a
      plain boolean via `firstValue(params.hasSignals) === 'true'` — so "no param" and "explicitly No" both
      become `false`. `listPersonas` (src/lib/db/queries/personas.ts:67-81) only implements the truthy branch
      (`filters.hasSignals ? exists(...) : undefined`), with no `NOT EXISTS` branch, so `false` is treated
      identically to "don't filter at all." Verified empirically against the live Neon seed data by calling
      listPersonas() directly: `hasSignals: undefined` -> 10 personas, `hasSignals: true` -> 10 personas,
      `hasSignals: false` -> 10 personas (should be 0, since every seeded company has at least one signal).
      A staff user who explicitly selects "No" to find personas at companies without buying signals instead
      sees every persona, silently and with no error — directly undermining the "trustworthy 360 view" value
      proposition CLAUDE.md states as this product's core value. This is CR-01 from 03-REVIEW.md (Critical),
      independently reproduced here at the code and data level, not just accepted on the review's word.
    artifacts:
      - path: "src/lib/db/queries/personas.ts"
        issue: "hasSignals leg (lines 67-81) has no NOT EXISTS branch; `false` and `undefined` are indistinguishable at this layer since PersonaFilters.hasSignals is typed `boolean` (line 9), not a tri-state."
      - path: "src/app/personas/page.tsx"
        issue: "parsePersonaFilters (line 23): `hasSignals: firstValue(params.hasSignals) === 'true'` cannot express 'user explicitly chose No' vs 'no filter applied'."
      - path: "src/app/personas/[id]/page.tsx"
        issue: "Same parsePersonaFilters logic duplicated (line 26), same defect."
    missing:
      - "PersonaFilters.hasSignals should be a tri-state (boolean | undefined, or a separate hasSignalsSet flag) so 'No' is distinguishable from 'unset' at the type level."
      - "listPersonas needs a `not(exists(...))` branch for the explicit-false case, alongside the existing exists(...) branch for explicit-true."
      - "Both parsePersonaFilters copies (list page + detail page) need the tri-state parsing fix, or the duplicate logic (03-REVIEW.md IN-02) should be extracted to one shared module first to avoid fixing it twice."
---

# Phase 3: Persona Explorer Verification Report

**Phase Goal:** Staff can find and fully review any Persona end-to-end using the same search/filter/master-detail pattern from Phase 2 — completing full browsability of the seed dataset across both Companies and Personas.
**Verified:** 2026-07-23T20:54:37Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Persona table has `seniority` (enum), `email`, `linkedinUrl` nullable columns live in Neon | ✓ VERIFIED | `src/lib/db/schema.ts:41-47,66-74` — `seniorityEnum` pgEnum + 3 nullable columns; confirmed live by running `listPersonas()` against Neon and reading back seniority/email/linkedinUrl values |
| 2 | `listPersonas()` supports search/seniority/currentCompany/hasSignals filters, AND-composed, parameterized (incl. two-hop EXISTS for hasSignals) | ✗ FAILED | `src/lib/db/queries/personas.ts:15-84` — search/seniority/currentCompany legs are correct and parameterized (verified live: `seniority=vp` → 2 rows, `currentCompany=Acme Test Co` → 1 row, `search=Jordan` → 1 row); **hasSignals leg has no false/NOT-EXISTS branch** — see gap |
| 3 | `getPersonaById` and `listCompanyRolesForPersona(personaId)` exist, return current + historical roles | ✓ VERIFIED | `src/lib/db/queries/personas.ts:96-99`, `src/lib/db/queries/companyPersonaRoles.ts:33-39` — live-called, returns e.g. Jordan Sample: current=Acme Test Co (2024-01-01–present), history=Beta Sample Inc (2021-06-01–2023-12-31) |
| 4 | Seed dataset: 10 personas w/ all 5 seniority tiers; 3 personas (Jordan Sample, Taylor Placeholder, Sydney Placeholdt) with current + ≥1 historical role w/ populated end date | ✓ VERIFIED | `data/seed/personas.csv` (10 rows, tiers ic/manager/director×2/vp×2/c_level×2 present), `data/seed/company_persona_roles.csv` (13 rows; Jordan/Taylor/Sydney each have 1 current + 1 historical row w/ populated `end_date`) |
| 5 | Signed-in staff at `/personas` sees a collapsible/resizable left nav with both Companies and Key Personas sections real and clickable, active section highlighted by URL | ✓ VERIFIED | `src/components/layout/app-sidebar.tsx` — `'use client'`, `usePathname()`, both items are real `<Link>`s (no `disabled`), `isActive={pathname.startsWith(...)}` for both `/companies` and `/personas` |
| 6 | Personas list shows all 10 seeded personas w/ name, title, humanized seniority, current company | ✓ VERIFIED | `src/components/personas/persona-list.tsx:104-146` — Table columns Name/Title/Seniority/Current Company; `humanizeEnum` applied to seniority; live `listPersonas({})` returns all 10 rows |
| 7 | Typing in search narrows list by name/title/current-company after debounce, reflected in URL | ✓ VERIFIED | `src/components/personas/persona-search-input.tsx` — `nuqs` `useQueryState('search', ...)` w/ `debounce(300)`, `shallow: false` (URL-synced); `listPersonas` search leg is a 3-way OR incl. single-hop EXISTS on current company name, live-verified |
| 8 | Selecting seniority/currentCompany/hasSignals filters narrows list; multiple filters AND-combine | ✗ FAILED | Seniority and currentCompany legs verified correct and AND-composable (`and(cond ?? undefined, ...)`, `src/lib/db/queries/personas.ts:19-83`); **hasSignals "No" is a no-op** — same root cause as #2, confirmed live: `hasSignals=false` returns all 10 personas instead of the expected 0 |
| 9 | Unauthenticated visitor to `/personas` redirected to `/sign-in`, never sees persona data | ✓ VERIFIED (code) | `src/app/personas/layout.tsx` and `src/app/personas/page.tsx` both call `await requireStaffAccess()` first; `requireStaffAccess` (`src/lib/auth/requireStaffAccess.ts`) redirects on missing `userId` — same pattern already live-tested for `/companies` in Phase 2; 03-02-SUMMARY.md records a passing automated smoke test (unauthenticated `GET /personas` → 307 to `/sign-in`) |
| 10 | Clicking a Persona row navigates to `/personas/[id]` and opens full 360 detail while list stays visible | ✓ VERIFIED | `src/components/personas/persona-list.tsx:135-137` — Name cell wrapped in `<Link href={`/personas/${persona.id}`}>`; `src/app/personas/[id]/page.tsx` renders `PersonaList` (list visible, `selectedId` set) + `PersonaDetail` in the same two-column grid |
| 11 | Detail pane shows role/title/seniority, Current Company (linked to `/companies/[id]`), Career History w/ date ranges, Contact Info (mailto/external link), correct empty-state copy | ✓ VERIFIED | `src/components/personas/persona-detail.tsx` — all four sections present with the exact empty-state copy strings ("No current company on record.", "No career history recorded.", "No contact info on record."); Current Company links to `/companies/${current.company.id}`; email renders `mailto:`, linkedinUrl renders `target="_blank" rel="noopener noreferrer"` |
| 12 | Pasting a copied `/personas/[id]` URL into a fresh tab restores the exact same selected persona | ✓ VERIFIED | `src/app/personas/[id]/page.tsx` reads `id` directly from the route param (`Number(id)`), not client state — inherently URL-deterministic; same pattern already proven for `/companies/[id]` in Phase 2 |
| 13 | On narrow viewports, selecting a persona replaces the list with the detail pane; a back-to-list link restores the list without breaking the deep-linked URL | ✓ VERIFIED (code) | `persona-list.tsx:110` (`selectedId ? 'hidden md:block' : 'block'`), `persona-detail-page` mobile-only `<Link href="/personas">← Back to list</Link>` (plain `Link`, not `router.back()` — anti-pattern grep confirms 0 occurrences of `router.back` across the phase's files) |
| 14 | Unauthenticated visitor to `/personas/[id]` redirected to `/sign-in`, never sees persona data | ✓ VERIFIED (code) | `src/app/personas/[id]/page.tsx:40` — `await requireStaffAccess()` first line, belt-and-suspenders with the layout gate; 03-03-SUMMARY.md records a passing smoke test on the built binary |
| 15 | Full seed dataset of Companies and Personas is loaded and browsable end-to-end — both explorers functional (DATA-01) | ✓ VERIFIED | `npm run seed` output confirmed inserting 9 companies/10 personas/12 signals/13 company_persona_roles; both `/companies` and `/personas` routes build and render; browsability itself holds — the filter-correctness defect (#2/#8) is a data-*trust* gap within the persona filter UI, not a browsability gap |

**Score:** 13/15 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/db/schema.ts` | `seniorityEnum` + persona.seniority/email/linkedinUrl | ✓ VERIFIED | Present, nullable, live in Neon |
| `src/lib/db/queries/personas.ts` | `PersonaFilters`, `listPersonas`, `getPersonaById`, `listDistinctCurrentCompanyNames` | ⚠️ PARTIAL | All exports present and wired; `listPersonas`'s hasSignals leg is functionally incorrect (see gap) |
| `src/lib/db/queries/companyPersonaRoles.ts` | `listCompanyRolesForPersona` | ✓ VERIFIED | Present, correct reverse-join shape, live-tested |
| `src/components/personas/persona-search-input.tsx` | `PersonaSearchInput` | ✓ VERIFIED | nuqs debounced, URL-synced |
| `src/components/personas/persona-filters.tsx` | `PersonaFilters` (seniority/currentCompany/hasSignals) | ⚠️ PARTIAL | Renders correctly, but the hasSignals Select's "No" value is not honored downstream |
| `src/components/personas/persona-list.tsx` | Table w/ name/title/seniority/current-company, row Link, selected highlight | ✓ VERIFIED | All present |
| `src/components/personas/persona-detail.tsx` | Role & Seniority / Current Company / Career History / Contact Info sections | ✓ VERIFIED | All 4 sections present w/ correct empty states |
| `src/app/personas/page.tsx` | `/personas` route, `requireStaffAccess` | ✓ VERIFIED | Gated, renders list + filters |
| `src/app/personas/[id]/page.tsx` | `/personas/[id]` route, `notFound` on invalid id | ✓ VERIFIED | Gated, `notFound()` on NaN id (note: `Number.isNaN` guard alone lets `1.5`/`Infinity` through per 03-REVIEW.md WR-03 — not part of this phase's must_haves, tracked as a pre-existing review warning, not a blocker here) |
| `src/components/layout/app-sidebar.tsx` | `usePathname()`-driven Client Component, both sections active | ✓ VERIFIED | Confirmed |
| `data/seed/personas.csv` | 10 rows backfilled | ✓ VERIFIED | 11 lines (header + 10), all 5 seniority tiers present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `persona-list.tsx` | `listPersonas()` | async Server Component fetch | ✓ WIRED | |
| `personas/page.tsx` | `requireStaffAccess` | first line | ✓ WIRED | |
| `app-sidebar.tsx` | `usePathname` | `.startsWith()` for both sections | ✓ WIRED | |
| `persona-list.tsx` | `/personas/[id]` | `Link href` per row | ✓ WIRED | |
| `persona-detail.tsx` | `getPersonaById` | async Server Component fetch | ✓ WIRED | |
| `persona-detail.tsx` | `listCompanyRolesForPersona` | async Server Component fetch, split current/history | ✓ WIRED | |
| `persona-detail.tsx` | `/companies/[id]` | Current Company block link | ✓ WIRED | |
| `PersonaFilters` (hasSignals Select) | `listPersonas` WHERE clause | `parsePersonaFilters` → `filters.hasSignals` | ✗ **BROKEN for the "No" value** | UI control exists, URL param round-trips correctly, but the boolean coercion and query-layer branch both drop the false case — see gap |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `PersonaList` | `personas` | `listPersonas(filters)` → Neon | Yes (live-queried, 10 rows in DB) | ✓ FLOWING |
| `PersonaFilters` (hasSignals) | `hasSignals` query param | UI Select → URL → `parsePersonaFilters` → `listPersonas` | Round-trips to the query layer, but the query layer discards the semantic meaning of "false" | ⚠️ **STATIC/HOLLOW for the No case** — the param reaches the query but has no effect on the SQL emitted |
| `PersonaDetail` | `persona`, `roles` | `getPersonaById`/`listCompanyRolesForPersona` → Neon | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `listPersonas({})` returns all 10 | Direct call via `tsx` against live Neon | `10` | ✓ PASS |
| `listPersonas({ seniority: 'vp' })` narrows correctly | Direct call | `2` (Jordan Sample, Reese Sampleton) | ✓ PASS |
| `listPersonas({ currentCompany: 'Acme Test Co' })` narrows correctly | Direct call | `1` (Jordan Sample) | ✓ PASS |
| `listPersonas({ search: 'Jordan' })` narrows correctly | Direct call | `1` (Jordan Sample) | ✓ PASS |
| `listPersonas({ hasSignals: true })` | Direct call | `10` (correct — every seeded company has ≥1 signal) | ✓ PASS |
| `listPersonas({ hasSignals: false })` | Direct call | `10` (**expected 0** — every company has signals, so "No" should exclude all) | ✗ FAIL |
| `listCompanyRolesForPersona()` returns current+history | Direct call for Jordan Sample | current=Acme Test Co (2024-01-01–present), history=Beta Sample Inc (2021-06-01–2023-12-31) | ✓ PASS |
| `npx tsc --noEmit` | project-wide | exit 0 | ✓ PASS |
| `npm run build` | project-wide | exit 0, `/personas` and `/personas/[id]` registered as dynamic routes | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` files or phase-declared probes found (`find scripts -path '*/tests/probe-*.sh'` returns nothing; no probe references in PLAN/SUMMARY files). Step 7c: SKIPPED — no probes declared for this phase, behavioral verification instead performed via direct query-layer invocation against live Neon data (see Behavioral Spot-Checks above).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| PERS-01 | 03-02, 03-03 | Staff can view a Persona's role/title and seniority | ✓ SATISFIED | `persona-list.tsx` (list scope), `persona-detail.tsx` Role & Seniority section |
| PERS-02 | 03-03 | Staff can view a Persona's career history (previous companies with dates) | ✓ SATISFIED | `persona-detail.tsx` Career History section, live-verified against Jordan/Taylor/Sydney |
| PERS-03 | 03-03 | Staff can view the Company a Persona is linked to, shown inline | ✓ SATISFIED | `persona-detail.tsx` Current Company section, linked to `/companies/[id]` |
| PERS-04 | 03-03 | Staff can view a Persona's contact info (email/LinkedIn), manually entered | ✓ SATISFIED | `persona-detail.tsx` Contact Info section (mailto + external link), backfilled seed data exercises full/email-only/linkedin-only/none paths |
| DATA-01 | 03-01, 03-02, 03-03 | A seed/manual dataset of Companies and Personas is loaded and browsable end-to-end | ⚠️ SATISFIED WITH CAVEAT | Dataset loaded (9 companies/10 personas/12 signals/13 roles) and both explorers are browsable end-to-end; however, one of the persona list's own filter controls (hasSignals "No") silently returns incorrect results, which is a correctness defect within the "browsable, trustworthy" contract this requirement implies — not a browsability blocker per se, but flagged since it ships as a normal, discoverable UI control |

**Note:** REQUIREMENTS.md's checkboxes for PERS-01 through PERS-04 are still unchecked (`- [ ]`) as of this verification, despite the phase-mapping table further down the same file correctly showing all four as "Mapped" to Phase 3. This looks like a documentation-sync gap (checkboxes not flipped after phase completion) rather than a functional gap — the actual UI/query evidence above satisfies all four. Recommend updating REQUIREMENTS.md's checkboxes as part of closing this phase's gaps.

### Anti-Patterns Found

No debt markers (`TBD`/`FIXME`/`XXX`/`TODO`/`HACK`) found in any file touched by this phase. No empty-implementation stubs (`return null`/`return {}`/`=> {}`) found in the reviewed component/query files. The one functional defect (hasSignals no-op) is not a stub or placeholder — it is a logic gap (missing branch), already documented above as the primary gap and cross-referenced to `03-REVIEW.md`'s CR-01.

Additional non-blocking findings already tracked in `03-REVIEW.md` (WR-01 through WR-09, IN-01 through IN-05) are not re-litigated here since they are not part of this phase's stated must_haves — they remain valid follow-up items but do not block the phase goal as scoped.

### Human Verification Required

The following items were deferred by the executor to end-of-phase manual QA (harvested from 03-02-PLAN.md and 03-03-PLAN.md `<human-check>` blocks) and have not been independently re-confirmed by this verifier beyond code inspection:

### 1. Sidebar active-state and full filter behavior on `/personas`

**Test:** Sign in, visit `/personas`. Confirm Key Personas is highlighted/active and Companies is inactive-but-clickable. Confirm the table lists all 10 seeded personas with correct title/seniority/current-company. Type in search and select each filter (seniority, current company, has signals) individually and combined.
**Expected:** Sidebar highlights correctly; list narrows correctly for search/seniority/currentCompany. **Note:** the "has signals: No" option will NOT narrow the list per the gap documented above — this is expected-broken behavior until the gap is closed, not a new finding to report.
**Why human:** Visual highlight state and interactive multi-filter combination behavior require a live authenticated browser session; grep/static analysis cannot confirm rendered pixel state.

### 2. Full click-through detail view and mobile responsive swap

**Test:** Click a persona row, confirm URL becomes `/personas/{id}`, list stays visible with the row highlighted, detail pane shows all four sections correctly for personas with different contact-info variety (Drew Testfield email-only, Reese Sampleton LinkedIn-only, Quinn Fakeworth "No contact info on record"), and Career History for Sydney Placeholdt/Jordan Sample/Taylor Placeholder. Copy the URL into a fresh tab. Narrow the viewport below `md` with a persona selected and confirm the list/detail swap plus back-link. Visit `/personas/999999` and confirm a clean 404.
**Expected:** All behaviors work as described in 03-03-PLAN.md's Task 2 human-check.
**Why human:** Visual master-detail layout, responsive breakpoint behavior, and real browser navigation (URL round-trip in a fresh tab) cannot be confirmed via static code/query inspection alone, though the underlying code (route-param-driven Server Components, plain `Link` navigation) strongly supports correct behavior.

### Gaps Summary

One Critical-severity functional gap blocks full achievement of the phase goal: the "Has signals: No" filter option (`PersonaFilters`'s `hasSignals` Select) is wired end-to-end at the UI and URL-state layer but is a silent no-op at the query layer — selecting "No" returns the same 10/10 personas as no filter or "Yes," which is empirically wrong (0 personas should match, since every seeded company has at least one signal). This was independently reproduced against the live Neon database, not just accepted from `03-REVIEW.md`'s CR-01 finding. Everything else — schema, seed data, search, seniority filter, current-company filter, master-detail navigation, all four PERS-0X detail sections, empty states, and auth gating — is verified working via direct code inspection and live query execution. The gap is narrow (one filter branch, in one function, duplicated across two page files' `parsePersonaFilters`) but is a normal, UI-discoverable staff action that silently returns wrong data, directly contradicting the product's stated "trustworthy 360 view" core value — this is why it is scored as a blocking gap rather than a deferred polish item.

---

_Verified: 2026-07-23T20:54:37Z_
_Verifier: Claude (gsd-verifier)_
