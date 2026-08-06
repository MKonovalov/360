---
phase: 30-offerings-ui-v1-6-queued
plan: 04
subsystem: ui
tags: [nextjs, react, shadcn, sheet, server-actions, drizzle, offerings]

# Dependency graph
requires:
  - phase: 30-offerings-ui-v1-6-queued
    provides: Practice Area + Domain Server Actions (create/update/archive/delete/reorder, zod-validated, staff-gated) in src/app/actions/offerings.ts
provides:
  - PracticeAreaForm Sheet CRUD component (create/edit, 4 fields)
  - DomainForm Sheet CRUD component (create/edit, 1 field, no status)
affects: [30-08 ServicePortfolio hierarchy component, 30-11 verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Controlled-open Sheet form: open/pending/error state trio + resetFields on open + canSave-gated Save — signal-form.tsx template scaled down"
    - "Status Select options driven by pgEnum .enumValues import (practiceAreaStatusEnum) — never a hardcoded array"
    - "Parent-scope prop instead of a form field (DomainForm practiceAreaId) — entity scope implied by where the Sheet was opened"

key-files:
  created:
    - src/components/offerings/practice-area-form.tsx
    - src/components/offerings/domain-form.tsx
  modified: []

key-decisions:
  - "PracticeAreaForm: 4 fields (Name, Short Code, Description, Status); Status Select renders exactly practiceAreaStatusEnum.enumValues = ['active','draft'] — no 'retired' (schema.ts:305)"
  - "DomainForm: single Name field; Domain has no status column (30-02 design note) so no Status control and no status enum import — grep-verified"
  - "Both forms call the 30-02 Server Actions inside useTransition with plain-object payloads (never FormData); on success close Sheet + router.refresh()"
  - "sortOrder never sent from either form — server-computed by the actions (T-30-02-03); client canSave gating is UX-only, zod safeParse is authoritative (T-30-04-01)"
  - "Error state renders the generic 'Could not save this X' string, never the action's raw reason (T-30-04-02)"

patterns-established:
  - "Pattern 1: Sheet CRUD forms for the offerings hierarchy follow signal-form.tsx's exact controlled-open/reset-on-open/canSave/submit shape, scaled to the entity's field count"
  - "Pattern 2: Enum-driven Selects import the pgEnum object from @/lib/db/schema — the enum is the single source of truth for options"

requirements-completed: [OFR-03]

# Metrics
duration: 9min
completed: 2026-08-06
---

# Phase 30: Plan 04 Summary

**Two minimal Sheet CRUD forms for the top two Service Portfolio hierarchy levels — PracticeAreaForm (4 fields, 2-value status enum) and DomainForm (1 field, no status) — both following signal-form.tsx's controlled-open/reset-on-open/canSave pattern verbatim and calling the 30-02 Server Actions**

## Performance

- **Duration:** 9 min
- **Started:** 2026-08-06T02:08:00Z
- **Completed:** 2026-08-06T02:17:44Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `PracticeAreaForm` — create/edit Sheet with Name, Short Code, Description, Status; Status options driven by `practiceAreaStatusEnum.enumValues` (`['active','draft']`, schema.ts:305), never a hardcoded array; calls `createPracticeAreaAction`/`updatePracticeAreaAction`; 184 lines
- `DomainForm` — create/edit Sheet with a single Name field; no Status control and no status-enum import (Domain has no status column); `practiceAreaId` passed from the parent hierarchy row prop, not a form field; calls `createDomainAction`/`updateDomainAction`; 118 lines
- Both forms: plain-object payloads (never FormData) inside `useTransition`, `!result.ok` renders the generic "Could not save this X" copy (never the action's raw reason, T-30-04-02), success closes the Sheet + `router.refresh()`, sortOrder never sent (server-computed, T-30-02-03)

## Task Commits

Each task was committed atomically:

1. **Task 1: PracticeAreaForm (Sheet CRUD, 4 fields)** - `2292aa17` (feat)
2. **Task 2: DomainForm (Sheet CRUD, 1 field, no status)** - `fe498cfc` (feat)

**Plan metadata:** (docs: complete plan — final commit, below)

## Self-Check: PASSED

Verified before state updates:

- `src/components/offerings/practice-area-form.tsx` — FOUND
- `src/components/offerings/domain-form.tsx` — FOUND
- `.planning/phases/30-offerings-ui-v1-6-queued/30-04-SUMMARY.md` — FOUND
- Commit `2292aa17` (Task 1) — FOUND
- Commit `fe498cfc` (Task 2) — FOUND

## Files Created/Modified
- `src/components/offerings/practice-area-form.tsx` - PracticeAreaForm: create/edit Sheet with 4 field groups (Name Input, Short Code Input, Description Textarea, Status Select driven by practiceAreaStatusEnum)
- `src/components/offerings/domain-form.tsx` - DomainForm: create/edit Sheet with a single Name Input, parent-scoped via practiceAreaId prop

## Decisions Made
- Followed the plan as specified. The two implementation details worth recording: (1) Status options come from the `practiceAreaStatusEnum.enumValues` import (schema single source of truth), and (2) DomainForm deliberately omits any status surface because the domain table has no status column (30-02 design note) — both grep-verified against the plan's acceptance greps.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. Both `npx tsc --noEmit` checks pass; full `npm test` suite shows 567 passed | 37 skipped with only the pre-existing VER-03 live-API/credits failure (`src/lib/agents/openrouter-only-chain.test.ts`, Phase 22-04, untouched by Phase 30).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- 30-08's ServicePortfolio hierarchy can drop these in as "New Practice Area"/"New Domain" CTAs and per-row Edit triggers — props are `{ mode, practiceArea?/practiceAreaId+domain?, trigger }`, matching the trigger-asChild pattern used by Phase 29's SignalForm
- 30-05 (OfferingForm) builds on the same template but widens `SheetContent` to `sm:max-w-lg` and adds the ranked Buyer Roles picker + reverse-lookup section

---
*Phase: 30-offerings-ui-v1-6-queued*
*Completed: 2026-08-06*
