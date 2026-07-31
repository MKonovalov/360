---
phase: 09-analytic-agent-observability
plan: 02
subsystem: api
tags: [drizzle, postgres, zod, langfuse, tdd, vitest, neon-http]

# Dependency graph
requires:
  - phase: 09-analytic-agent-observability
    provides: 09-01 agent core (types, prompt, dedup, tools, runAgent raw generateText contract, schema agent_run/signal_proposal/correction, langfuse telemetry helpers)
provides:
  - analyzeCompany orchestration: company+signals load -> runAgent -> evidence appendix derivation -> verdict -> fail-closed gate -> dedup (no DB writes)
  - runs query module: createRun (traceId/traceUrl/usage/evidenceAppendix/hypotheses persist, OBSV-01) + getRunById
  - proposals query module: insertProposals, listPendingProposals (agent_run join for trace linkage), countPendingProposals, idempotent guarded acceptProposal (ONE Accept = ONE Signal, D-09/T-09-07)
  - corrections query module: rejectProposal (zod-validated reason enum + traceId + optional note, Langfuse mirror, OBSV-02/D-14) + getCorrectionsForProposal
affects: [09-03 (server actions / review-queue UI / company-detail badge), future enrichment]

# Tech tracking
tech-stack:
  added: [none - reused existing drizzle-orm, zod, vitest, langfuse]
  patterns: [status-guarded conditional update as exactly-once guard, fire-and-forget telemetry mirror, zod enum validation at trust boundary, query modules with caller-owned error handling]

key-files:
  created:
    - src/lib/agents/analyzeCompany.ts
    - src/lib/agents/analyzeCompany.test.ts
    - src/lib/db/queries/runs.ts
    - src/lib/db/queries/proposals.ts
    - src/lib/db/queries/corrections.ts
    - src/lib/db/queries/runs.test.ts
    - src/lib/db/queries/proposals.test.ts
    - src/lib/db/queries/corrections.test.ts
  modified: [none]

key-decisions:
  - "acceptProposal: no db.transaction() (neon-http has none) — status-guarded conditional update (0 rows => idempotent already_resolved) is the primary exactly-once guard; unique index signal(company_id, signal_type) is the 23505 race backstop mapped to duplicate_signal"
  - "rejectProposal: correction row is the durable source of truth; Langfuse annotation is a fire-and-forget mirror (void + .catch, never blocks or fails an already-committed reject)"
  - "reject reason validated at runtime with zod against the DB enum — invalid reason fails BEFORE any write (input arrives as unknown from a Server Action)"
  - "listPendingProposals LEFT joins agent_run so the queue carries runId/traceId/traceUrl for the review-queue trace link and reject trace lookup (PLAN-CHECKER fixup)"
  - "query modules follow the signals.ts house convention: no try/catch in the module, caller owns error handling; typed result unions ({ok:false, reason}) instead of thrown domain errors"
  - "isUniqueViolation checks both error code 23505 and /duplicate key/i message — neon-http error shape varies by driver version"

patterns-established:
  - "Idempotent guarded write: conditional UPDATE ... WHERE id AND status='pending' -> 0 rows = already_resolved no-op (accept + reject share this)"
  - "Fire-and-forget telemetry mirror: DB row is truth, observability annotation is async and exception-swallowed"
  - "Runtime enum validation at trust boundary: zod.safeParse against correctionReasonEnum.enumValues"

requirements-completed: [ANLZ-01, ANLZ-02, ANLZ-03, ANLZ-04, ANLZ-05, OBSV-01, OBSV-02]

# Metrics
duration: 11min
completed: 2026-07-31
---

# Phase 09 Plan 02: Analysis Orchestration + Durable Proposals Summary

**analyzeCompany orchestration (run -> evidence appendix -> verdict -> fail-closed gate -> dedup) plus durable runs/proposals/corrections query modules with an idempotent guarded Accept (ONE Accept = ONE Signal) and structured Reject with Langfuse mirror**

## Performance

- **Duration:** 11 min
- **Started:** 2026-07-31T23:36:22Z
- **Completed:** 2026-07-31T23:40:44Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- `analyzeCompany` end-to-end orchestration with all five decision points: env gate (`not_configured`), `loadCompanyAndSignals` (distinct `company_not_found` vs `db_error`), `runAgent` integration (raw generateText contract, misconfig mapped to `not_configured`), `deriveEvidenceAppendix` from REAL webSearch tool results (URL-dedupe, model-recited appendix discarded per D-02), `deriveVerdict` (`no_intent`/`emerging`/`active`), fail-closed `validateRunArtifacts` gate (nothing persists on violation), `dedupProposals` post-run (D-11/ANLZ-05). NO DB writes — the caller persists.
- Runs query module: `createRun` persists traceId + traceUrl + usageTokens + evidenceAppendix + hypotheses + companyId (OBSV-01 anchor 09-02-01); `getRunById` returns row or undefined.
- Proposals query module: `insertProposals` bulk queue insert; `listPendingProposals` LEFT joins agent_run carrying traceId/traceUrl/runId/companyName (PLAN-CHECKER fixup); `countPendingProposals` (ANLZ-04 badge); `acceptProposal` — status-guarded conditional update (idempotent `already_resolved` no-op, D-09), exactly ONE signal row typed from the proposal (source = evidenceUrl, note = reasoning, D-10), 23505 race → `duplicate_signal` (T-09-07, ANLZ-02 anchor 09-02-02). No `db.transaction()` anywhere.
- Corrections query module: `rejectProposal` — zod-validated reason enum failing before any write, idempotent status guard, correction row with reason enum + traceId + optional note (OBSV-02 anchor 09-02-03), fire-and-forget Langfuse `mirrorCorrectionAnnotation` (D-14); `getCorrectionsForProposal` for prompt/taxonomy tuning reads.
- Full verification: 198 tests passed | 2 skipped (up from 179 baseline, +19 new), `npx tsc --noEmit` clean, all 4 validation anchors green, zero live API calls in tests (D-16 — stubbed drizzle client + mocked langfuse, only example.com fixture URLs).

## Task Commits

Each task was committed atomically (TDD: test → feat per task):

1. **Task 1: analyzeCompany orchestration** — `833f5a1b` (test, RED) + `117eb8d1` (feat, GREEN)
2. **Task 2: runs + proposals query modules** — `5f09fe84` (test, RED) + `5a2c33d7` (feat, GREEN)
3. **Task 3: corrections query module** — `81ba5516` (test, RED) + `ec0c9395` (feat, GREEN)

## Files Created/Modified
- `src/lib/agents/analyzeCompany.ts` - Orchestration: load → runAgent → appendix → verdict → fail-closed gate → dedup
- `src/lib/agents/analyzeCompany.test.ts` - 5 tests (all decision points, D-16 mocked)
- `src/lib/db/queries/runs.ts` - createRun (trace linkage persist, OBSV-01) + getRunById
- `src/lib/db/queries/proposals.ts` - insertProposals / listPendingProposals (run join) / countPendingProposals / guarded idempotent acceptProposal
- `src/lib/db/queries/corrections.ts` - rejectProposal (zod reason + traceId + note + Langfuse mirror) / getCorrectionsForProposal
- `src/lib/db/queries/runs.test.ts` - 3 tests (traceId/usage/appendix persist, getById)
- `src/lib/db/queries/proposals.test.ts` - 6 tests (bulk insert, guarded accept, idempotency, 23505 race, join, count)
- `src/lib/db/queries/corrections.test.ts` - 5 tests (reject row, mirror args, invalid reason pre-write, idempotency, list)

## Decisions Made
- No `db.transaction()` (neon-http has none): status-guarded conditional update is the primary exactly-once guard; unique index is the race backstop (D-09/T-09-07).
- Correction row = durable truth; Langfuse annotation = fire-and-forget mirror that can never fail the reject (D-14).
- Reject reason zod-validated against the DB enum at runtime, failing before any write.
- `listPendingProposals` joins agent_run per the PLAN-CHECKER fixup (trace linkage for queue UI + reject trace lookup).
- Query modules keep the house convention: caller owns error handling; typed `{ ok: false, reason }` result unions, not thrown domain errors.
- `isUniqueViolation` checks code 23505 AND `/duplicate key/i` message — neon-http error shape varies by driver version.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test fixtures widened to `string`, breaking strict enum types (TS2322)**
- **Found during:** Task 2 (proposals query module GREEN verification)
- **Issue:** `npx tsc --noEmit` failed after GREEN: the `costProposal`/`gbsProposal` fixtures in `proposals.test.ts` were plain object literals, so `insertProposals(runId, companyId, [costProposal, gbsProposal])` widened `signalType`/`strength`/etc. to `string`, violating the `ProposalSignal` enum types.
- **Fix:** Annotated both fixtures `const costProposal: ProposalSignal = {...}` / `const gbsProposal: ProposalSignal = {...}` with the type imported from `@/lib/agents/types`. Runtime behavior unchanged (tests already passed) — purely a type-level fix.
- **Files modified:** `src/lib/db/queries/proposals.test.ts`
- **Verification:** `npx tsc --noEmit` clean; `npx vitest run` 9/9 on runs+proposals; full suite 198 passed | 2 skipped.
- **Committed in:** `5a2c33d7` (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for strict TypeScript compliance under the project's `astro/tsconfigs/strict` lineage. No scope creep — one-line type annotation in test fixtures.

## Issues Encountered
- None beyond the deviation above. GREEN verification surfaced the tsc failure immediately, before the atomic commit.

## User Setup Required
None - no external service configuration required (all tests stubbed per D-16; no live Langfuse/anthropic/firecrawl calls in this plan).

## Next Phase Readiness
- All four validation anchors green (09-01-03, 09-02-01, 09-02-02, 09-02-03) — 09-03 can build the Server Actions / review-queue UI / company-detail badge directly on `listPendingProposals`, `acceptProposal`, `rejectProposal`, `countPendingProposals`, and `analyzeCompany`.
- The accept/reject write paths deliberately have NO server-route protection yet — 09-03 must gate them behind Clerk session + staff check before exposing to the browser.
- `analyzeCompany` intentionally does not persist; 09-03's Server Action must call `createRun` + `insertProposals` after the orchestration returns.

## Self-Check: PASSED

All 8 files verified present on disk; all 7 commits (833f5a1b, 117eb8d1, 5f09fe84, 5a2c33d7, 81ba5516, ec0c9395, a9102784) verified in git log.

---
*Phase: 09-analytic-agent-observability*
*Completed: 2026-07-31*
