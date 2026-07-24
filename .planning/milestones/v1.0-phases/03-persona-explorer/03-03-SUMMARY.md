---
phase: 03-persona-explorer
plan: 03
subsystem: ui
tags: [nextjs, app-router, drizzle]

# Dependency graph
requires:
  - phase: 03-persona-explorer plan 01
    provides: "getPersonaById, listCompanyRolesForPersona(personaId) — live against seeded Neon data"
  - phase: 03-persona-explorer plan 02
    provides: "PersonaList/PersonaSearchInput/PersonaFilters, gated /personas route, AppSidebar .startsWith() pattern"
  - phase: 02-company-explorer
    provides: "CompanyDetail/company-detail.tsx section-per-concern template, companies/[id]/page.tsx Promise-based params pattern, company-list.tsx Link+selectedId highlight template"
provides:
  - "PersonaDetail component: Role & Seniority, Current Company (linked to /companies/[id]), Career History with date ranges, Contact Info (mailto/external link), correct empty-state copy per section"
  - "Gated /personas/[id] route, mirroring /companies/[id] exactly"
  - "PersonaList row Link to /personas/{id} + selected-row highlight (border-l-indigo-600/bg-indigo-50)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PersonaDetail mirrors CompanyDetail file-for-file: local per-file copies of humanizeEnum/dateFormatter/FirmographicField helpers (no shared util extracted, matching established duplication convention)"

key-files:
  created:
    - src/components/personas/persona-detail.tsx
    - src/app/personas/[id]/page.tsx
  modified:
    - src/components/personas/persona-list.tsx

key-decisions:
  - "personas/page.tsx required no change — its placeholder pane already had the hidden ... md:flex responsive class matching companies/page.tsx (verified during Task 2's read_first step), so Task 2's second file-modification instruction was a no-op this plan"

patterns-established:
  - "Persona detail/list-navigation layer mirrors Company detail/list-navigation layer file-for-file, same mirroring convention Plans 01/02 established at the query and list-UI layers"

requirements-completed: [PERS-01, PERS-02, PERS-03, PERS-04, DATA-01]

# Metrics
duration: ~10min
completed: 2026-07-23
---

# Phase 3 Plan 3: Persona Detail View & Navigation Summary

**Added `PersonaDetail` (Role & Seniority / Current Company linked to `/companies/[id]` / Career History with date ranges / Contact Info) and the gated `/personas/[id]` route, then wired `PersonaList` row clicks + selected-row highlight — completing full click-through browsability across both explorers.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-23T22:34:38+02:00 (worktree base commit)
- **Completed:** 2026-07-23T22:41:25+02:00
- **Tasks:** 2 completed
- **Files modified:** 3

## Accomplishments
- `persona-detail.tsx` built by cloning `company-detail.tsx`'s helper/layout template: local `humanizeEnum`/`dateFormatter`/`FirmographicField` copies, `space-y-12` section rhythm, `notFound()` on a missing persona
- `PersonaDetail` renders all four PERS sections: Role & Seniority (Title/Seniority `FirmographicField`s), Current Company (indigo-600 link to `/companies/{id}` + role title, "No current company on record." empty state), Career History (`<ul>` of non-current roles with `{start} – {end|Present}` date ranges, "No career history recorded." empty state), Contact Info (mailto: email link, target=_blank LinkedIn link, both indigo-600, "No contact info on record." empty state when neither present)
- `src/app/personas/[id]/page.tsx` mirrors `companies/[id]/page.tsx` exactly: `requireStaffAccess()` first, both `params`/`searchParams` Promises awaited, `Number(id)` + `notFound()` on NaN, two-column grid with `PersonaList` (selectedId set) + mobile-only "← Back to list" `Link` (not `router.back()`) + `PersonaDetail`
- `persona-list.tsx` Name cell wrapped in `<Link href={`/personas/${persona.id}`}>`; selected row gets `border-l-2 border-l-indigo-600 bg-indigo-50/50`, matching `company-list.tsx`'s exact class shape
- `npx tsc --noEmit` and `npm run build` both pass; production build registers `/personas/[id]` as a dynamic route (`ƒ /personas/[id]`)
- Automated smoke test against the built binary: unauthenticated `GET /personas/1` and `GET /personas` both 307-redirect to `/sign-in`

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the Persona detail pane and /personas/[id] route** - `07176617` (feat)
2. **Task 2: Wire list-to-detail navigation, selected-row highlight, and mobile responsive swap** - `22ad1b12` (feat)

## Files Created/Modified
- `src/components/personas/persona-detail.tsx` - `PersonaDetail({ id })`: fetches `getPersonaById`/`listCompanyRolesForPersona`, splits roles into `current`/`history` via `role.isCurrent`, renders the four PERS sections with empty-state copy
- `src/app/personas/[id]/page.tsx` - `PersonaDetailPage`: gated route, `Number(id)` + `notFound()` on NaN, renders `PersonaList` (selectedId set) + `PersonaDetail`
- `src/components/personas/persona-list.tsx` - Name cell now a `Link` to `/personas/{id}`; row highlight class added for `persona.id === selectedId`

## Decisions Made
- `personas/page.tsx`'s placeholder pane already carried the `hidden ... md:flex` class from Plan 02 (verified identical to `companies/page.tsx`'s equivalent) — Task 2's conditional file-modification instruction ("only if missing") correctly resolved to a no-op, so that file has no diff this plan

## Deviations from Plan

None functionally — plan executed exactly as written. Two of the plan's own `<acceptance_criteria>` grep-count expectations don't match the mirrored-template reality and are noted here for transparency, not as code deviations:

- `grep -c "requireStaffAccess" src/app/personas/[id]/page.tsx` returns **2** (import line + call line), not the plan's expected 1 — identical to `grep -c "requireStaffAccess" src/app/companies/[id]/page.tsx` on the file the plan explicitly says to "mirror... exactly," confirming this is a plan-authoring count artifact, not an implementation gap.
- `grep -c "getPersonaById\|listCompanyRolesForPersona" src/components/personas/persona-detail.tsx` returns **4** (both functions have separate import lines and separate call lines), not the plan's expected 2. All other acceptance-criteria greps (`notFound` ≥1, `mailto:` =1, three empty-state strings =3, `Link href` ≥1, `selectedId` ≥2, `border-l-indigo-600` =1, `router.back` total =0) match exactly.

Functional behavior (auth gating, notFound on invalid id, both data fetches, row navigation, selected-row highlight) is verified correct via `tsc`/`build`/smoke-test and by direct code inspection.

## Issues Encountered
- Worktree was missing `node_modules` and `.env.local` (both gitignored, not shared by `git worktree add`), same one-time setup noted in Plans 01/02's Summaries. Ran `npm install` and copied `.env.local` from the main repo checkout so `npx tsc --noEmit`, `npm run build`, and the smoke-test server could run. Neither is a plan deviation — nothing committed for either.
- Worktree HEAD was initially on stale pre-Phase-3 commit history (`ddd018d5`) rather than the expected wave-3 base (`c8815d7f`) — corrected via `git reset --hard` to the expected base per the branch-check protocol before any file edits, working tree was clean at the time so no work was at risk.

## Task 2 Human-Check Items (deferred to manual browser QA)

The plan's Task 2 `<verify>` block lists a `<human-check>` requiring an authenticated browser session (Clerk sign-in), which cannot be automated from this executor. Automated coverage (build success, `tsc`, and unauthenticated-redirect smoke test on both `/personas` and `/personas/1`) is complete and passing. The following remain for manual verification, consistent with Phase 2's `02-HUMAN-UAT.md` precedent:
- Sign in, visit `/personas`, click a persona row: URL becomes `/personas/{id}`, list stays visible with the clicked row highlighted, detail pane shows role/title/seniority, a working Current Company link to `/companies/[id]`, Career History (Sydney Placeholdt / Jordan Sample / Taylor Placeholder — past company + date range), and Contact Info (Drew Testfield email-only, Reese Sampleton LinkedIn-only, Quinn Fakeworth "No contact info on record")
- Copy the URL, open in a fresh tab: same persona opens directly (deep-link round-trip)
- Narrow the browser below the `md` breakpoint with a persona selected: list hides, detail pane + "Back to list" link show
- Visit `/personas/999999`: confirm a 404, not a crash
- Browse both `/companies` and `/personas` end-to-end once more to confirm the full seed dataset is browsable across both explorers (DATA-01)

## User Setup Required

None - no external service configuration required. Neon Postgres and Clerk were already provisioned in prior phases.

## Next Phase Readiness
- PERS-01 through PERS-04 and DATA-01 are now fully demonstrable end-to-end across both Companies and Personas explorers, pending the human-check items above
- No blockers for Phase 4 (Arcpedia read-integration and empty/loading/error-state hardening)

---
*Phase: 03-persona-explorer*
*Completed: 2026-07-23*

## Self-Check: PASSED

All created/modified files verified present on disk; both task commit hashes (`07176617`, `22ad1b12`) verified present in `git log`.
