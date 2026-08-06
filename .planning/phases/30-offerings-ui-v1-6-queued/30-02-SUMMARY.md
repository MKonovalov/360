---
phase: 30-offerings-ui-v1-6-queued
plan: 02
subsystem: api
tags: [server-actions, zod, nextjs, offerings, practice-area, domain, buyer-role]

# Dependency graph
requires:
  - phase: 30-offerings-ui-v1-6-queued (30-01)
    provides: updatePracticeAreaSortOrder/updateDomainSortOrder reorder helpers + widened insertBuyerRole({ name, description?, createdBy })
provides:
  - Practice Area Server Actions: create/update/archive/delete/reorder (offerings.ts)
  - Domain Server Actions: create/update/delete/reorder — NO archive (offerings.ts)
  - Buyer Role Server Actions: create/update/delete — the single OFR-06 write surface (buyerRoles.ts)
affects: [30-03 offering+trigger actions, 30-04..30-09 offerings UI components, 30-10 route wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server Action 4-step shape (requireStaffAccess-first → zod safeParse → discriminated-union return → revalidatePath on success) applied to a new entity family, verbatim from signals.ts"
    - "Delete-guard pass-through: query-layer has_dependents result returned unmodified, never re-wrapped"
    - "Server-side sortOrder computation — client sortOrder never accepted (zod strips unknown keys)"

key-files:
  created:
    - src/app/actions/offerings.ts
    - src/app/actions/offerings.test.ts
    - src/app/actions/buyerRoles.ts
    - src/app/actions/buyerRoles.test.ts
  modified: []

key-decisions:
  - "Explicit destructure of parsed.data (mirroring signals.ts) instead of a literal ...parsed.data spread — zod v4 strips absent optional keys, and explicit destructure produces deterministic test assertions (status: undefined) identical to signals.test.ts's established pattern"
  - "archivePracticeAreaAction flips status to 'draft' — practiceAreaStatusEnum has only ['active','draft']; no 'retired' string appears anywhere in offerings.ts"
  - "Domain deliberately has NO archive action — no status column; create/update/delete/reorder only"

patterns-established:
  - "OfferingsActionResult / BuyerRolesActionResult are independently declared same-shape unions (no cross-import between the two action files) — mirrors signals.ts's independent SignalsActionResult"
  - "reorderXAction = sequential for-loop calling the named updateXSortOrder helper (no db.transaction — neon-http has none), i-th id gets sortOrder=i"

requirements-completed: [OFR-03, OFR-06, OFR-08]

# Metrics
duration: 4min
completed: 2026-08-06
---

# Phase 30 Plan 02: Practice Area + Domain + Buyer Role Server Actions Summary

**Staff-gated, zod-validated Server Actions layer for Practice Area and Domain CRUD/archive/delete/reorder (offerings.ts, 9 actions) plus the fully independent OFR-06 Buyer Role CRUD write surface (buyerRoles.ts, 3 actions) — a 31-case Vitest suite proving staff-gate-first ordering, server-computed sortOrder, 'draft'-not-'retired' archive, and verbatim has_dependents delete-guard pass-through**

## Performance

- **Duration:** 4 min
- **Started:** 2026-08-06T03:51:10Z
- **Completed:** 2026-08-06T03:55:00Z
- **Tasks:** 2 (both `type="auto"` with `tdd="true"`, executed RED→GREEN)
- **Files modified:** 4 created

## Accomplishments
- `src/app/actions/offerings.ts` — first half of this phase's action layer, mirroring `signals.ts`'s exact 4-step shape (requireStaffAccess-first, zod safeParse, discriminated-union return, revalidatePath('/offerings') on success only). Practice Area: create/update/archive/delete/reorder. Domain: create/update/delete/reorder — **no archive action** (no status column).
- `src/app/actions/buyerRoles.ts` — OFR-06's single write surface (create/update/delete), passing `description` through to 30-01's widened `insertBuyerRole` signature.
- Server-side sortOrder: create actions compute it by counting sibling rows (`listAllPracticeAreas()` / `listDomainsForPracticeArea(practiceAreaId)` scoped to the domain's own area) — a client-supplied `sortOrder` is stripped by zod and proven ignored by test (T-30-02-03).
- Delete-guard integrity (T-30-02-04): `deletePracticeAreaAction`/`deleteDomainAction`/`deleteBuyerRoleAction` return the query-layer's `{ ok: false, reason: 'has_dependents' }` object verbatim — never re-wrapped, never re-implemented.
- Full suite stays green: 551 passed | 37 skipped with only the pre-existing VER-03 live-API failure (`openrouter-only-chain.test.ts`, Phase 22-04, untouched).

## Task Commits

Each task was committed atomically with the TDD gate satisfied (RED test commit strictly precedes GREEN implementation commit):

1. **Task 1 RED: Practice Area + Domain tests** - `59617de7` (test)
2. **Task 1 GREEN: offerings.ts implementation** - `bdeb1bb6` (feat)
3. **Task 2 RED: Buyer Role tests** - `23bcca0c` (test)
4. **Task 2 GREEN: buyerRoles.ts implementation** - `5c90ad8d` (feat)
5. **Acceptance-grep compliance fix** - `f4a3b184` (fix)

**Plan metadata:** (docs: complete plan — final commit, below)

## Files Created/Modified
- `src/app/actions/offerings.ts` — 9 exported actions + `OfferingsActionResult` type; schemas `practiceAreaInputSchema` (name/shortCode/description/status, deliberately no sortOrder) and `domainInputSchema` (practiceAreaId/name, no status)
- `src/app/actions/offerings.test.ts` — 20-case Vitest suite (staff-gate-first, server sortOrder, client-sortOrder ignored, draft archive, has_dependents pass-through, sequential reorder, not_found, invalid_input, action_failed)
- `src/app/actions/buyerRoles.ts` — 3 exported actions + independently-declared `BuyerRolesActionResult`; `buyerRoleInputSchema` (name/description)
- `src/app/actions/buyerRoles.test.ts` — 11-case Vitest suite (description pass-through incl. undefined-absent, has_dependents pass-through, action_failed on all three actions)

## Decisions Made
- **Explicit destructure over literal spread** — plan text suggested `{ ...parsed.data, sortOrder, createdBy: userId }`; implemented with signals.ts's explicit destructuring instead so absent optional keys appear as deterministic `undefined` in test assertions (identical observable behavior; zod v4 strips absent optional keys from parsed output either way).
- **'draft' is the practice-area archive state** — `practiceAreaStatusEnum` has only `['active','draft']`; `archivePracticeAreaAction` flips to `'draft'`. No `'retired'` literal anywhere in offerings.ts (acceptance grep = 0).
- **Domain has no archive action** — its only removal path is the guarded delete, per 30-01's flag and the plan's must-have.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Comment literals tripped acceptance greps**
- **Found during:** Overall verification (Task 1 deliverable check)
- **Issue:** The plan's acceptance criteria require `grep -c "archiveDomainAction"` and `grep -c "retired"` on `offerings.ts` to both return 0. My initial why-comments literally named "archiveDomainAction" and "there is no 'retired' state" — grep counted them (1 each), failing the criteria.
- **Fix:** Reworded the two comment blocks to convey the same schema-driven rationale without the forbidden literals.
- **Files modified:** src/app/actions/offerings.ts
- **Verification:** Both greps return 0; 31/31 targeted tests pass; `npx tsc --noEmit` clean.
- **Committed in:** f4a3b184 (standalone fix commit after GREEN)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor — comment-only change restoring acceptance-grep compliance. No scope creep, no behavior change.

## Issues Encountered
- None beyond the auto-fixed grep violation above. The pre-existing VER-03 live-API failure (`openrouter-only-chain.test.ts`, pending-credit, Phase 22-04) appeared in the full-suite run as documented and was not touched.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- **30-03 (Wave 3)** appends Offering + Trigger actions to the same `offerings.ts` — the file is structured for it (OfferingsActionResult + the file-level comment blocks explicitly note 30-03's append).
- All downstream Sheet forms and hierarchy rows (30-04..30-09) have their write path: every create/update/archive/delete/reorder call they need is exported, staff-gated, zod-validated, and test-proven.
- The `/offerings` route still 404s until 30-10 — expected; `revalidatePath('/offerings')` on a not-yet-created route is harmless.

---
*Phase: 30-offerings-ui-v1-6-queued*
*Completed: 2026-08-06*
