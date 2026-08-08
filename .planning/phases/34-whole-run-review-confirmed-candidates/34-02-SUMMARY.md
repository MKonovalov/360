---
phase: 34-whole-run-review-confirmed-candidates
plan: 02
subsystem: analysis-database
tags: [typescript, drizzle, vitest, neon-http, confirmed-candidates, provenance, retention, fail-closed]

# Dependency graph
requires:
  - phase: 34-whole-run-review-confirmed-candidates (34-01)
    provides: Closed review/candidate contracts (confirmedCandidateEvidenceSchema) and immutable analysis_run_review identity
  - phase: 33-grounded-analysis-execution-evidence
    provides: Immutable packet ledger (analysis_run/result/finding/source/link) and retention-aware visibility rule
provides:
  - DB-authoritative confirmed-only candidate projection: confirmed run + confirmed review identity → result/finding/source/link → polymorphic signal_offering_link → offering
  - Atomic packet-required completed→pending_review reconciliation and winner-preserving Confirm/Dismiss decision queries
  - Neon integration proof for lifecycle statuses, evidence strength/link exclusions, discriminator collisions, offering status, duplicate provenance, and Persona retention
affects: [34-03, 34-04, 34-05, 35-01, 35-02]

# Tech tracking
tech-stack:
  added: []
  patterns: [positive confirmed predicate in SQL, polymorphic join on signal_type::text + snapshotted signal_id, retention-aware packet visibility, deterministic duplicate provenance, read-only candidate SELECT, single data-modifying CTE decisions]

key-files:
  created:
    - src/lib/db/queries/analysisReviews.ts
    - src/lib/db/queries/analysisReviews.test.ts
    - src/lib/db/queries/analysisReviews.integration.test.ts
    - src/lib/db/queries/confirmedCandidates.ts
    - src/lib/db/queries/confirmedCandidates.test.ts
    - src/lib/db/queries/confirmedCandidates.integration.test.ts

key-decisions:
  - "Confirmed-only predicate lives in SQL (status = 'confirmed' AND confirmed review join), never client-side filtering; the contract rejects non-eligible evidence at parse time as a second layer."
  - "Polymorphic join casts both sides to text: signal_offering_link.signal_type is record_type while analysis_run.subject_type is analysis_target_type — two distinct PG enum types."
  - "Confirmed review identity is enforced by the INNER JOIN on analysis_run_review decision = 'confirmed'; candidate rows do not carry decided_by/decided_at because the closed 34-01 contract omits them."
  - "Deterministic duplicate provenance: multiple sources per finding survive as separate evidence rows; normalizeCandidateEvidence orders by run:finding:source without grouping."

patterns-established:
  - "Retention-aware packet visibility: persona candidates require an unexpired analysis_result_retention row, reproduced from getAnalysisPacket and aliased as `result`."
  - "Join on snapshotted signal identity: signal_type::text = subject_type::text AND signal_id = finding.signal_id — never by current signal name, never by numeric id alone."
  - "Read-only projection: listConfirmedCandidateOfferings is a pure SELECT with no write imports and no db.transaction."
  - "Reconciliation is a guarded data-modifying CTE callable from every review read/action boundary; idempotent via UPDATE...WHERE completed and event dedupe."

requirements-completed: [REV-01, REV-02, REV-03, REV-04, REV-05]

# Metrics
duration: 61min
completed: 2026-08-08
---

# Phase 34 Plan 2: Review Boundary and Confirmed-Only Candidate Projection Summary

**Packet-required completed→pending_review reconciliation, atomic winner-preserving Confirm/Dismiss decisions, and a read-only confirmed-only provenance candidate projection joining snapshotted signal identity through polymorphic links to offerings**

## Performance

- **Duration:** 61 min (Task 1 commits 01:04Z–01:32Z, Task 2 commits 01:49Z–02:06Z)
- **Started:** 2026-08-08T01:04:55Z
- **Completed:** 2026-08-08T02:06:02Z
- **Tasks:** 2 (both TDD, RED+GREEN)
- **Files modified:** 6 created (3 per task), 0 schema changes

## Accomplishments
- Reconcile boundary: only `completed` runs with a visible immutable packet promote once to `pending_review`, appending exactly one system-attributed lifecycle event; replays return the existing item without another event; missing packets are excluded.
- Atomic whole-run decisions: one Neon-http-safe data-modifying CTE conditionally updates only `pending_review`, inserts the unique immutable `analysis_run_review` row, appends one staff lifecycle event, and replays/race-losers return the original persisted winner (no `db.transaction`, no packet mutation).
- Confirmed-only candidate projection: SQL positive predicate (`run.status = 'confirmed'` + `review.decision = 'confirmed'` INNER JOIN) with strong/weak + persisted finding-source-link evidence, joined to offerings via `signal_offering_link` on `signal_type::text = subject_type::text AND signal_id = finding.signal_id`.
- Retention-aware Persona visibility: candidate reads reuse the exact packet visibility rule — expired persona packets return no rows; live persona candidates survive.
- Read-only proof: before/after counts of `signal_offering_link`, `offering`, `company_signal`, and `persona_signal` are byte-identical across candidate reads; the candidate module has zero write imports.
- Discriminator safety: equal Company/Persona numeric signal IDs (5301) resolve to their own offerings, never cross-resolved.
- Deterministic duplicate provenance: two sources backing one finding survive as two distinct evidence rows with the same finding identity.

## Task Commits

Each task was committed atomically:

1. **Task 1: Reconcile packet completion and implement atomic whole-run decisions** - `e2642e5a` (test), `f9bdfba8` (feat)
2. **Task 2: Implement the confirmed-only provenance candidate projection** - `acf917da` (test), `e5e822be` (feat, includes integration fixture fixes)
3. **Evidence: concurrent race + packet immutability proof** - `3ce74928` (test) — Promise.all Confirm/Confirm, Dismiss/Dismiss, and Confirm/Dismiss races proving single-winner + winner-preserving classification, plus byte-for-byte Phase 33 packet snapshots before/after Confirm and Dismiss

**Plan metadata:** final docs commits `fd669ed0` (complete plan) and `435ddbfd` (review gate report)

_Note: Both tasks were TDD (test → feat); the evidence commit lands after GREEN as an additional proof layer._

## Files Created/Modified
- `src/lib/db/queries/analysisReviews.ts` - `reconcileCompletedRunForReview`, `decideAnalysisRun`, `listRunReviewItems`; packet-required bridge CTE, one-C'TE decision with winner-preserving replay, review listing with retention-aware visibility
- `src/lib/db/queries/analysisReviews.test.ts` - pure mocked-query tests (17) for reconcile/decide/list boundary semantics, replay, race classification, SQL shape
- `src/lib/db/queries/analysisReviews.integration.test.ts` - guarded Neon tests (11) for lifecycle statuses, concurrent Confirm/Dismiss races (single-winner + winner-preserving classification), replay, byte-for-byte packet immutability, staff attribution, expired persona packets
- `src/lib/db/queries/confirmedCandidates.ts` - `listConfirmedCandidateOfferings`; read-only SELECT with confirmed predicate, strong/weak filter, polymorphic discriminator join, retention visibility, deterministic ordering
- `src/lib/db/queries/confirmedCandidates.test.ts` - pure mocked-query tests (5) for SQL shape (read-only, join direction), row mapping into the closed contract, non-eligible status rejection, duplicate provenance normalization, historical link identity
- `src/lib/db/queries/confirmedCandidates.integration.test.ts` - guarded Neon tests (7) for the status matrix, evidence strength/link filter, discriminator collision, active/draft/retired display, duplicate provenance, persona retention live/expired, read-only before/after counts

## Decisions Made
- Confirmed-only predicate is applied in SQL, not client-side; the contract parse (rejecting `no_evidence` etc.) is a second defensive layer.
- The polymorphic join must cast both enum sides to text because `record_type` and `analysis_target_type` are different PG enum types.
- Candidate rows omit review actor/time: the closed 34-01 contract defines the candidate evidence shape without `decided_by`/`decided_at`; confirmed review identity is enforced structurally by the INNER JOIN.
- Duplicate provenance is preserved as separate rows with deterministic ordering (run:finding:source), never grouped away.
- Fixture findings must declare `sourceKeys` to persist finding-source links; findings without links are correctly excluded by the join (the `f-unlinked` fixture proves it).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Integration fixtures did not persist finding-source links, so no candidates could join**
- **Found during:** Task 2 GREEN verification
- **Issue:** `buildCandidatePacket` only creates `links` for findings with `sourceKeys`; fixture findings without `sourceKeys` produced no `analysis_finding_source` rows, and the INNER JOIN on the link table eliminated every candidate — 6 of 7 integration tests failed.
- **Fix:** Added `sourceKeys: [s-annual-<runId>]` to eligible findings across the status-matrix, strength/filter, offering-status, discriminator, retention, and read-only fixtures.
- **Files modified:** src/lib/db/queries/confirmedCandidates.integration.test.ts
- **Verification:** Integration suite went from 1/7 to 7/7 passing.
- **Committed in:** e5e822be (Task 2 GREEN commit)

**2. [Rule 1 - Bug] no_evidence/inconclusive findings with source links violate the grounding validator**
- **Found during:** Task 2 GREEN verification
- **Issue:** After fix 1, `f-no-evidence` and `f-inconclusive` fixtures carried `sourceKeys`, and the grounding validator rejected the packet with `no_evidence_must_not_have_support`.
- **Fix:** Removed `sourceKeys` from those two findings (the SQL `IN ('strong','weak')` filter excludes them anyway; they only need to exist with persisted evidence absent).
- **Files modified:** src/lib/db/queries/confirmedCandidates.integration.test.ts
- **Verification:** Integration suite 7/7 passing.
- **Committed in:** e5e822be (Task 2 GREEN commit)

**3. [Rule 1 - Bug] Persona fixture retention window expired before the decide timestamp**
- **Found during:** Task 2 GREEN verification
- **Issue:** The discriminator-collision test's persona run persisted its packet at the default real-time `now`, but `confirmRun` decides at `DECIDED_AT` (10:00Z); the 60s persona retention expired long before the decide, so decide failed with `missing_packet`.
- **Fix:** Persisted the persona packet with `now: DECIDED_AT` so the retention window covers both the decide and the default-now query.
- **Files modified:** src/lib/db/queries/confirmedCandidates.integration.test.ts
- **Verification:** Discriminator-collision test passes 7/7 suite.
- **Committed in:** e5e822be (Task 2 GREEN commit)

**4. [Rule 3 - Blocking] Different PG enum types on the polymorphic join**
- **Found during:** Task 2 implementation
- **Issue:** `signal_offering_link.signal_type` uses PG enum `record_type` while `analysis_run.subject_type` uses `analysis_target_type`; joining them directly would fail with a type mismatch.
- **Fix:** Cast both sides to text in the join predicate (`link.signal_type::text = run.subject_type::text`), documented in the query comment.
- **Files modified:** src/lib/db/queries/confirmedCandidates.ts
- **Verification:** Pure SQL-shape test asserts `signal_type`/`signal_id` presence; Neon integration proves the join resolves correctly across 7 scenarios.
- **Committed in:** e5e822be (Task 2 GREEN commit)

---

**Total deviations:** 4 auto-fixed (3 Rule 1 bugs in test fixtures, 1 Rule 3 blocking type mismatch)
**Impact on plan:** All auto-fixes were necessary for correctness of the fixtures/query. No scope creep, no architectural changes.

## Issues Encountered
- The integration suite initially reported the RED fixture tests as "skipped" rather than failing (the setup's module import of the not-yet-written `confirmedCandidates` threw before tests ran). This is an expected TDD RED manifestation — the module simply did not exist — and both suites failed on the import in the pure-test run.
- Neon integration runtime is ~20s for the candidate suite due to per-test catalog + run fixture creation; acceptable for the phase's proof requirements.

## User Setup Required

None - no external service configuration required. Integration suites run when `TEST_DATABASE_URL` is present in the environment (sourced from `.env.local`).

## Next Phase Readiness
- Phase 34-03 (confirmed-candidate management/collapse surface) can consume `listConfirmedCandidateOfferings` with a stable, closed contract and deterministic ordering.
- Phase 34-04 (scope/static audit) can rely on the verified read-only candidate module (no write imports) and the single-CTE decision boundary.
- Phases 35-01/35-02 (Company/Persona experiences) can render candidate evidence with display-status vs historical link-identity already separated.
- Blockers/concerns: none — REV-01..05 evidence is complete in this plan.

---
*Phase: 34-whole-run-review-confirmed-candidates*
*Completed: 2026-08-08*

## Self-Check: PASSED

- All 6 task files + SUMMARY exist: confirmedCandidates.ts/.test.ts/.integration.test.ts, analysisReviews.ts/.test.ts/.integration.test.ts, 34-02-SUMMARY.md
- All 5 task commits exist in git history: e2642e5a (Task 1 RED), f9bdfba8 (Task 1 GREEN), acf917da (Task 2 RED), e5e822be (Task 2 GREEN), 3ce74928 (evidence: concurrent races + packet immutability)
- All 40 tests pass against TEST_DATABASE_URL (11 review integration + 17 review pure + 7 candidate integration + 5 candidate pure); tsc clean
