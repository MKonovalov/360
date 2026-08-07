---
phase: 34-whole-run-review-confirmed-candidates
plan: 01
subsystem: analysis-contracts
tags: [typescript, zod, drizzle, vitest, review-identity, confirmed-candidates, fail-closed]

# Dependency graph
requires:
  - phase: 33-grounded-analysis-execution-evidence
    provides: Immutable Phase 33 packet ledger (analysis_run/result/finding/source/link) and grounded evidence contracts
provides:
  - Additive immutable analysis_run_review identity with closed confirmed|dismissed decision enum
  - Closed runtime contracts for reconciliation, whole-run decision, review items, and normalized confirmed candidate evidence
  - Guarded schema metadata/integration test proving legacy and Phase 33 tables remain additive/unchanged
affects: [34-02, 34-03, 34-04, 34-05, 35-01, 35-02]

# Tech tracking
tech-stack:
  added: []
  patterns: [closed DB decision enum, insert-once immutable review table, strict Zod discriminated result unions, server-result actor/time/hash fields, distinct display-status vs historical link-identity]

key-files:
  created:
    - src/lib/analysis/reviewContracts.ts
    - src/lib/analysis/reviewContracts.test.ts
    - src/lib/db/reviewSchema.integration.test.ts
  modified:
    - src/lib/db/schema.ts

key-decisions:
  - "One immutable, packet-bound whole-run decision per analysis run/result: unique analysis_run_id and result_id, closed confirmed|dismissed enum, non-null decided_by/decided_at/packet_hash."
  - "Actor identity, decision timestamp, and packet hash are server-result fields; reconciliation/decision inputs accept only a positive run ID plus the closed decision (T-34-02)."
  - "Candidate eligibility is strong/weak only with persisted source linkage; active display status and historical link identity are distinct fields (D-34-03/D-34-04)."

patterns-established:
  - "Insert-once review identity: unique run and result constraints, FKs to authoritative run/result, packet hash captured from the immutable result."
  - "Closed discriminated-union outcomes: safe failures for invalid_input, missing_packet, not_pending_review, replayed, race_loser, not_found."
  - "Target discriminator (targetType+subjectId) and signal discriminator (signalType+signalId) retained everywhere; bare IDs rejected by strict schemas."
  - "Confirmed-only candidate projection: positive confirmed-run predicate plus strong/weak eligibility and deterministic duplicate ordering without dropping provenance."

requirements-completed: [REV-01, REV-02, REV-03]

# Metrics
duration: ~45m
completed: 2026-08-08
---

# Phase 34 Plan 01: Whole-Run Review Decision Identity & Closed Contracts

**Immutable per-run review identity (confirmed|dismissed with server-attributed actor/time/packet-hash) plus closed Zod contracts that later Phase 34 query/action/UI plans and Phase 35 consume without inventing actor semantics, evidence eligibility, or historical-link behavior.**

## Accomplishments

- Added the smallest additive `analysis_run_review` table and closed `analysis_review_decision` enum (`confirmed`|`dismissed`) to the Drizzle schema, with unique `analysis_run_id` and `result_id` identities, run/result foreign keys, non-null server-attributed `decided_by`/`decided_at`, captured `packet_hash`, and creation metadata — no update/delete helpers, no mutable packet columns.
- Preserved the `analysis_run` status enum/transition graph, all Phase 33 packet tables, and the legacy `agent_run`/proposal relations byte-for-byte (proven by the metadata test's additive-only assertion).
- Added a guarded schema metadata/integration test (skips without `TEST_DATABASE_URL`) checking table shape, closed enum values, both uniqueness constraints, FKs, and additive preservation.
- Locked closed contracts in `reviewContracts.ts`: whole-run decision enum, strict decide/reconcile inputs (positive run ID + closed decision only), server-result outcome unions (with `replayed` flag and safe failure reasons), run-level review items retaining `targetType`+`subjectId`, and normalized confirmed candidate evidence requiring target/signal discriminators, run/finding/source IDs, packet hash, strong/weak-only eligibility, and distinct display status vs historical link identity.
- Added explicit predicates/constants: `isEligibleCandidateEvidence`, `isConfirmedRunStatus` (REV-05), `isActiveCandidateDisplay`, `CANDIDATE_ELIGIBLE_EVIDENCE_STATUSES`, and `normalizeCandidateEvidence` for deterministic duplicate ordering without dropping provenance.
- No Signal/Offering mutation inputs, legacy proposal IDs, live provider fields, or Phase 35 target-record UI fields were introduced; no package installs or provider/write calls.

## Verification Evidence

- `npm test -- src/lib/db/reviewSchema.integration.test.ts` — **passed, 4/4** against the guarded `TEST_DATABASE_URL` (command-scoped `DATABASE_URL` override per the 33-VERIFICATION pattern; URL never printed).
- `npm test -- src/lib/analysis/reviewContracts.test.ts` — **passed, 14/14**.
- `npx tsc --noEmit` — **passed, exit 0**.
- `git diff --name-only 0aede003..5265bbc8` — **only the four plan-listed files changed** (`schema.ts`, `reviewContracts.ts`, `reviewContracts.test.ts`, `reviewSchema.integration.test.ts`).
- LSP diagnostics unavailable (TypeScript server not installed, previously declined); compiler diagnostics passed instead.
- TDD gate: Task 1 `test(16abc82c)` → `feat(631ff7b3)`; Task 2 `test(abe476b8)` → `feat(5265bbc8)` — RED/GREEN pairs present for both tasks.

## Decisions Made

- Review identity is insert-once and immutable; the authoritative lifecycle stays on `analysis_run.status` with the decision recorded separately.
- Decision/actor/time/hash are never client input — the strict input shapes reject packet mutation fields and client-supplied identities.
- `not_pending_review`, `replayed`, and `race_loser` are explicit safe outcomes so a retried Confirm/Dismiss is idempotent (replayed flag) rather than a silent failure.
- Confirmed-candidate provenance keeps historical link identity separate from active display status so retired/draft links remain represented instead of being reclassified.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `reviewItemSchema` required decision fields absent on pending items**
- **Found during:** Task 2 (contracts)
- **Issue:** Initial strict shape marked `decidedBy`/`decidedAt`/`decision` as required-nullable; a pending review item without a terminal decision failed to parse.
- **Fix:** Made the three decision-state fields `.nullable().optional()` so a pending item parses and a decided item carries its server fields.
- **Files modified:** `src/lib/analysis/reviewContracts.ts`
- **Verification:** Contract suite re-run, 14/14; tsc clean.

**2. [Rule 1 - Bug] Literal-typed test fixture failed tsc strictness**
- **Found during:** Task 2 verification
- **Issue:** The duplicate-evidence fixture inferred `evidenceStatus` as `string`, incompatible with the `'strong'|'weak'` union under strict typing.
- **Fix:** Added `as const` to the duplicate fixture in the test.
- **Files modified:** `src/lib/analysis/reviewContracts.test.ts`
- **Verification:** tsc exit 0; contract suite 14/14.

---

**Total deviations:** 2 auto-fixed (Rule 1 - Bug, Rule 1 - Bug)
**Impact on plan:** Both fixes were necessary for correct pending-item parsing and strict typing. No scope creep.

## Issues Encountered

- Git `status` output in this environment is noisy (unrelated pre-existing staged/deleted historical planning files and cross-worktree phantom entries). All plan commits were staged individually with explicit pathspecs, so the unrelated changes were never touched. Plan-scope verification used `git diff --name-only 0aede003..5265bbc8` instead of `git status`.
- ESLint reports `import/first` at 1:1 on BOM-prefixed files; this reproduces identically on untouched committed files (e.g. `groundedContracts.ts`) and is a pre-existing repo-wide config artifact, not introduced by this plan. No `as any`/`@ts-ignore` was added.

## Known Stubs

None. Contracts are decision-complete; review actions, queries, and UI wiring land in 34-02/34-03/34-04.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: review-decision-boundary | `src/lib/analysis/reviewContracts.ts` | Confirm/Dismiss inputs cross a trust boundary; only positive run ID + closed decision are accepted, and actor/time/hash are server-result fields (T-34-02). |
| threat_flag: candidate-provenance | `src/lib/analysis/reviewContracts.ts` | Confirmed candidate rows require target/signal discriminators and source IDs and exclude private reasoning/provider fields (T-34-03). |
| threat_flag: immutable-review-schema | `src/lib/db/schema.ts` | `analysis_run_review` enforces unique run/result identities and closed decision enum; no mutation columns exist (T-34-01). |

## Self-Check: PASSED

- `src/lib/db/schema.ts`, `src/lib/analysis/reviewContracts.ts`, `src/lib/analysis/reviewContracts.test.ts`, `src/lib/db/reviewSchema.integration.test.ts` all exist.
- Commits `16abc82c`, `631ff7b3`, `abe476b8`, `5265bbc8` verified in `git log`.
- Focused tests (4/4 + 14/14) and `npx tsc --noEmit` (exit 0) passed.
- No application source outside the plan's listed files changed.

---
*Phase: 34-whole-run-review-confirmed-candidates*
*Plan: 01*
*Completed: 2026-08-08*
