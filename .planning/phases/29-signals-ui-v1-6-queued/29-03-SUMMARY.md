---
phase: 29-signals-ui-v1-6-queued
plan: 03
subsystem: server-actions
tags: [server-actions, signals, crud, zod, tdd, nextjs, neon-http]

# Dependency graph
requires:
  - phase: 28-signals-data-model-seed
    provides: companySignals/personaSignals/signalOfferingLinks query modules + catalogStatusEnum used for zod status validation
provides:
  - createCompanySignalAction — staff-gated, zod-validated Server Action creating a company signal + syncing Linked Offerings
  - updateCompanySignalAction — staff-gated, zod-validated Server Action updating a company signal + diffing Linked Offerings
  - archiveCompanySignalAction — staff-gated Server Action soft-archiving a company signal (status='retired', never a hard delete)
  - createPersonaSignalAction / updatePersonaSignalAction / archivePersonaSignalAction — the persona trio, mirroring the company trio with the required buyerRoleId
  - SignalsActionResult — discriminated-union result type shared by all 6 actions
  - syncSignalOfferingLinks — shared internal helper for create/update link diffing (no db.transaction, surfaces practice_area_mismatch verbatim)
affects: [29-signals-ui-v1-6-queued (29-05 signal-form + 29-06 archive-dialog consume these actions)]

# Tech tracking
tech-stack:
  added: []
  patterns: [TDD red-green, requireStaffAccess-first ordering, zod safeParse on unknown input, discriminated-union envelope, sequential dependency-ordered writes (no transactions)]

key-files:
  created:
    - src/app/actions/signals.ts
    - src/app/actions/signals.test.ts
  modified: []

key-decisions:
  - "requireStaffAccess() is the literal first line of every action (destructured to { userId }) — independent of the page's own gate, so a caller invoking the Server Action directly (bypassing the UI) redirects before any DB call (T-29-03-01)"
  - "Linked Offerings sync is sequential dependency-ordered (signal row first, then link inserts/deletes) with NO transaction wrapper — neon-http has zero transaction support (Pitfall 2); a practice_area_mismatch from insertSignalOfferingLink surfaces verbatim through the action's return with no rollback attempt (T-30-08 accepted small race window, T-29-03-03)"
  - "Archive routes through the named updateCompanySignal/updatePersonaSignal query function with { status: 'retired' } — never a raw Drizzle update call — so updatedAt/updatedBy get stamped automatically (Pitfall 1)"
  - "status is validated against catalogStatusEnum.enumValues (the 3-value catalog_status enum), NOT the practice-area lifecycle enum — Pitfall 5; the two enums live side-by-side in schema.ts and are easy to confuse"
  - "The action layer does NOT re-implement the cross-practice-area rejection — it surfaces insertSignalOfferingLink's existing query-layer guard verbatim (T-29-03-03: single enforcement point, no divergent logic)"
  - "Discriminated-union { ok: false, reason } reasons are deliberately coarse (invalid_input, not_found, action_failed, practice_area_mismatch) — no stack traces or DB error messages leak to the client (T-29-03-05 accept)"

patterns-established:
  - "4-step Server Action shape verbatim from reviews.ts: requireStaffAccess -> zod safeParse -> try/catch write -> revalidatePath on success only"
  - "syncSignalOfferingLinks helper: list existing, diff toAdd/toRemove, loop insert (short-circuit on practice_area_mismatch) then loop delete — reusable for both create and update flows across both signal kinds"
  - "vi.hoisted + vi.mock structure for mocked-db Server Action unit tests, with invocationCallOrder assertions for requireStaffAccess-first ordering (mirrors reviews.test.ts:40-43)"

requirements-completed: [SIG-06, SIG-07, SIG-08, SIG-09]

# Threat model findings
threat-model:
  - "T-29-03-01 (Spoofing): mitigated — requireStaffAccess() is the literal first line of every action, independent of the page's gate"
  - "T-29-03-02 (Tampering, unknown input): mitigated — zod safeParse against companySignalInputSchema/personaSignalInputSchema before any write; status constrained to catalogStatusEnum.enumValues; ids constrained to positive integers"
  - "T-29-03-03 (Tampering, crafted offeringIds): mitigated — insertSignalOfferingLink's existing query-layer guard rejects practice_area_mismatch; the action surfaces it verbatim, no re-implementation"
  - "T-29-03-04 (Repudiation): mitigated — createdBy/updatedBy stamped from requireStaffAccess()'s userId on every insert/update via the named query functions"
  - "T-29-03-05 (Information Disclosure): accepted — coarse reason strings only, no stack traces or internal identifiers leak; internal 3-partner tool, no further hardening needed per project scope"

# Metrics
duration: 8min
completed: 2026-08-05
---

# Plan 29-03: Signals Server Actions CRUD Summary

**Server Actions layer for Signals CRUD + archive — 6 exported actions (create/update/archive × company/persona) following `reviews.ts`'s 4-step shape verbatim, with sequential Linked Offerings sync (no transactions), TDD red-green.**

## Performance

- **Duration:** ~8 min
- **Tasks:** 2 (TDD: RED test commit → GREEN implementation commit)
- **Files modified:** 2 (both created)

## Accomplishments
- 6 exported Server Actions: `createCompanySignalAction`, `updateCompanySignalAction`, `archiveCompanySignalAction`, `createPersonaSignalAction`, `updatePersonaSignalAction`, `archivePersonaSignalAction`
- Every action calls `requireStaffAccess()` first (destructured to `{ userId }`), then zod `safeParse` on unknown input, then try/catch around the write, then `revalidatePath('/signals')` only on success
- Shared `syncSignalOfferingLinks` helper handles both create (insert-all) and update (diff toAdd/toRemove) flows across both signal kinds, surfacing `practice_area_mismatch` verbatim with no rollback
- Archive sets `status: 'retired'` via the named `updateCompanySignal`/`updatePersonaSignal` query functions (never a raw Drizzle update) so `updatedAt`/`updatedBy` get stamped
- 24-case Vitest suite green covering every behavior bullet (call-order, invalid_input rejection before write, link sync, practice_area_mismatch surfacing, not_found, action_failed, revalidate-on-success-only)

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): signals.test.ts** — `3166bb98` (test) — 24 cases, fails on import (module not yet written)
2. **Task 2 (GREEN): signals.ts implementation** — `213a7760` (feat) — all 24 tests pass

## Files Created/Modified
- `src/app/actions/signals.ts` — 6 exported actions + `SignalsActionResult` type + `syncSignalOfferingLinks` internal helper + 2 zod input schemas
- `src/app/actions/signals.test.ts` — 24-case Vitest suite, `vi.hoisted`/`vi.mock` structure mirroring `reviews.test.ts`, `invocationCallOrder` assertions for requireStaffAccess-first ordering

## Acceptance Criteria Results

### Task 1 (RED)
- `npx vitest run src/app/actions/signals.test.ts` FAILS — PASS (import error: module not found, the expected RED state)
- 11+ `it(...)` cases — PASS (24 cases)
- `grep -c "invocationCallOrder"` ≥ 1 — PASS (4 occurrences)

### Task 2 (GREEN)
- `npx vitest run src/app/actions/signals.test.ts` passes, 0 failures — PASS (24/24)
- `npx tsc --noEmit` zero errors in `src/app/actions/signals.ts` — PASS (exit 0)
- `grep -n "db.update(" src/app/actions/signals.ts` no matches — PASS (0) — Pitfall 1
- `grep -n "db.transaction(" src/app/actions/signals.ts` no matches — PASS (0) — Pitfall 2
- `grep -n "practiceAreaStatusEnum" src/app/actions/signals.ts` no matches — PASS (0) — Pitfall 5

### Verification block
- `npx vitest run src/app/actions/signals.test.ts` green — PASS
- `npm test` full suite stays green — PASS (517 passed | 38 skipped, 0 failed across 40 passed | 11 skipped files)
- `npx tsc --noEmit` clean — PASS (exit 0)

## Decisions Made
- **Comment reworded to satisfy literal grep gates** — the Pitfall 1/2/5 explanatory comments originally contained the literal strings `db.update(`, `db.transaction(`, and `practiceAreaStatusEnum`, which the acceptance-criteria greps require to return zero matches. Reworded to describe each pitfall by intent ("raw Drizzle update call", "transaction wrapper", "practice-area lifecycle enum") rather than by the forbidden identifier. The documentation intent is preserved; only the literal strings were removed.
- **`syncSignalOfferingLinks` shared helper** — the plan specified a shared internal helper for both create and update flows; implemented with a single `listLinksForSignal` + diff approach that handles both (create passes `[]` existing links implicitly via the list call returning `[]` for a just-inserted row, update passes the real existing set). This keeps the diff logic in one place rather than duplicated across 4 action bodies.
- **`offeringIds` defaults to `[]` via zod** — `z.array(...).default([])` so a create/update payload omitting `offeringIds` parses to an empty array (no link sync) rather than failing validation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Verification artifact] Comments contained forbidden grep-target literals**
- **Found during:** Task 2 acceptance gate
- **Issue:** The Pitfall 1/2/5 explanatory comments contained the literal strings `db.update(`, `db.transaction(`, and `practiceAreaStatusEnum`, which the acceptance-criteria greps require to return zero matches anywhere in the file.
- **Fix:** Reworded the comments to describe each pitfall by intent rather than by identifier.
- **Files modified:** `src/app/actions/signals.ts`
- **Verification:** All 3 anti-pitfall greps return 0 matches (PASS).
- **Committed in:** `213a7760` (part of GREEN commit)

**Total deviations:** 1 auto-fixed (Rule 1 — verification artifact)
**Impact on plan:** No scope creep — the comments' documentation intent (Pitfalls 1/2/5) is preserved; only the literal grep-target strings were removed.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required. The actions consume already-live Phase 28 query modules and the existing `requireStaffAccess` gate.

## Next Phase Readiness
- The 6 actions are ready for Plan 29-05's `signal-form.tsx` (create/update Sheet form) and Plan 29-06's `archive-signal-dialog.tsx` (archive confirm Dialog) to call inside `useTransition` blocks.
- `SignalsActionResult` is the typed contract between the form components and the action layer; the form surfaces `result.reason` via the existing `errorMessage`-style mapping (per `reject-dialog.tsx`).
- The accepted threat T-29-03-05 (coarse error reasons) means the form's error copy maps a fixed set of reason strings to user-facing messages; no stack traces leak.

---
*Phase: 29-signals-ui-v1-6-queued*
*Completed: 2026-08-05*