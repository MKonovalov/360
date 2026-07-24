---
phase: 03-persona-explorer
plan: 04
subsystem: persona-explorer-data-layer
tags: [gap-closure, drizzle, filters, tri-state]
dependency-graph:
  requires: [DATA-01]
  provides:
    - "listPersonas hasSignals tri-state filtering (true/false/undefined)"
    - "src/lib/params/personaFilters.ts shared parsePersonaFilters module"
  affects:
    - src/app/personas/page.tsx
    - src/app/personas/[id]/page.tsx
    - src/components/personas/persona-list.tsx
tech-stack:
  added: []
  patterns:
    - "Tri-state optional boolean filter (true/false/undefined) with a three-way ternary keyed on === true / === false, mirroring existing optional-filter legs (seniority, currentCompany)"
    - "Shared param-parsing module under src/lib/params/ instead of per-page duplication"
key-files:
  created:
    - src/lib/params/personaFilters.ts
  modified:
    - src/lib/db/queries/personas.ts
    - src/app/personas/page.tsx
    - src/app/personas/[id]/page.tsx
    - src/components/personas/persona-list.tsx
decisions:
  - "Built the two-hop EXISTS subquery once as a local variable (hasSignalsExistsSubquery) and referenced it from both the true and false branches, rather than duplicating the subquery body a second time for NOT EXISTS"
metrics:
  duration: 2m
  completed: 2026-07-23
---

# Phase 03 Plan 04: Persona hasSignals filter tri-state fix Summary

Fixed `listPersonas`'s `hasSignals` filter to distinguish "explicitly false" from "unset" with a real NOT EXISTS branch, and consolidated the duplicated `parsePersonaFilters` logic (previously copy-pasted across two page files, both with the same collapsing-boolean bug) into one shared module.

## What Was Built

**Task 1 — `src/lib/db/queries/personas.ts`:** Replaced the `filters.hasSignals ? exists(...) : undefined` ternary (which treated `false` and `undefined` identically — no filtering either way) with a three-way branch: `filters.hasSignals === true` → `exists(hasSignalsExistsSubquery)`, `filters.hasSignals === false` → `not(exists(hasSignalsExistsSubquery))`, unset → `undefined`. The two-hop EXISTS subquery (persona → companyPersonaRole(isCurrent) → company → signal) is now built once as `hasSignalsExistsSubquery` and reused by both branches instead of being duplicated. Added `not` to the `drizzle-orm` import and a comment on `PersonaFilters.hasSignals` documenting the tri-state contract.

**Task 2 — `src/lib/params/personaFilters.ts` (new) + consumers:** Created a single shared `firstValue` + `parsePersonaFilters` implementation. The previous per-page copies both computed `hasSignals: firstValue(params.hasSignals) === 'true'`, which collapses "no `?hasSignals=` param" and "`?hasSignals=false`" into the same `false` value. The shared version now does `hasSignalsRaw === 'true' ? true : hasSignalsRaw === 'false' ? false : undefined`, producing three genuinely distinct states. `src/app/personas/page.tsx` and `src/app/personas/[id]/page.tsx` had their local `firstValue`/`parsePersonaFilters` functions deleted and now import from the shared module. `src/components/personas/persona-list.tsx`'s `hasActiveFilters` computation was changed from a bare `filters?.hasSignals` truthy check to `filters?.hasSignals !== undefined`, so a zero-result "No" filter shows "No personas match your filters" instead of the wrong "No personas yet" empty state.

## Verification

- Live Neon query check (Task 1): `listPersonas({})` → 10, `listPersonas({ hasSignals: true })` → 10, `listPersonas({ hasSignals: false })` → 0 (was 10/10/10 before this fix — the last case is the closed gap).
- `parsePersonaFilters` unit check (Task 2): `{}` → `hasSignals: undefined`, `{ hasSignals: 'true' }` → `true`, `{ hasSignals: 'false' }` → `false`.
- `grep -c "function parsePersonaFilters"` on both page files → `0` (logic now lives only in the shared module).
- `grep -c "hasSignals !== undefined"` on `persona-list.tsx` → `1`.
- `npx tsc --noEmit` → exit 0 (project-wide, after both tasks).
- `npm run build` → exit 0; `/personas` and `/personas/[id]` still registered as dynamic (ƒ) routes.

## Deviations from Plan

None — plan executed exactly as written. Both tasks' `<action>` steps, file lists, and verify commands matched the implementation with no scope changes.

**Note on `tdd="true"` task attribute:** Both tasks carried `tdd="true"` in their frontmatter, but the plan's `<verify>` blocks specified live-query/grep/build checks rather than a separate test-file RED/GREEN cycle (no test runner exists in this project per `STACK.md` — "Not detected — no test runner, test config, or test files found in the repository," and `.planning/config.json`'s `workflow.tdd_mode` is `false`). Verification was executed as specified in each task's `<verify>` block before committing, functionally equivalent to a GREEN-only check against the plan's stated `<behavior>` — no dedicated `test(...)` commit was created since there is no test infrastructure to add it to. This mirrors how the plan's own automated verify commands were structured (inline `tsx -e` live-query assertions, not a persisted test file).

## Known Stubs

None found — no hardcoded empty values, placeholder text, or unwired data sources introduced by this plan's changes.

## Threat Flags

None — both changes stay within the trust boundary already documented in this plan's `<threat_model>` (T-03-10, T-03-11); no new endpoints, auth paths, or schema changes were introduced.

## Self-Check: PASSED
