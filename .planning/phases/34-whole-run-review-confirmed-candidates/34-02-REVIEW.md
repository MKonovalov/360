# 34-02 Review — Review Boundary & Confirmed-Only Candidate Projection

**Plan:** 34-02-PLAN.md
**Reviewed:** 2026-08-08
**Repo:** workspace/signals

## Verdict

**PASS** — The run satisfies every plan truth, artifact, key-link, and gate assertion. The implementation is additive, contract-complete, and verified by focused pure suites, guarded Neon integration evidence, and TypeScript diagnostics. Four auto-fixed issues and two non-blocking observations are recorded below.

## Run Scope

| Item | Evidence |
|------|----------|
| Plan commits | `e2642e5a` (Task 1 RED), `f9bdfba8` (Task 1 GREEN), `acf917da` (Task 2 RED), `e5e822be` (Task 2 GREEN), `3ce74928` (evidence: concurrent races + packet immutability) |
| Files changed (plan range) | `src/lib/db/queries/analysisReviews.ts`, `analysisReviews.test.ts`, `analysisReviews.integration.test.ts`, `confirmedCandidates.ts`, `confirmedCandidates.test.ts`, `confirmedCandidates.integration.test.ts` — exactly the plan `files_modified` |
| Out-of-scope changes | None (verified `git diff --name-only` across the range) |

## TDD Compliance

The plan requires "Each task must be committed atomically, with a `test(...)` RED commit, then a `feat(...)` GREEN commit."

| Task | RED commit | GREEN commit | Atomic |
|------|-----------|-------------|--------|
| Task 1 (review boundary) | `e2642e5a` test(34-02): add failing review boundary tests (reconcile, decide, list) — only the 3 task-1 files | `f9bdfba8` feat(34-02): implement atomic review boundary queries (reconcile, decide, list) — only the task-1 implementation | PASS |
| Task 2 (confirmed-only projection) | `acf917da` test(34-02): add failing confirmed candidate projection tests (confirmed-only provenance) — only the 3 task-2 files | `e5e822be` feat(34-02): implement confirmed-only provenance candidate projection (listConfirmedCandidateOfferings) — implementation + integration fixture fixes (documented as deviations) | PASS |
| Evidence | — | `3ce74928` test(34-02): add concurrent race and packet immutability integration evidence — 4 additional Neon tests, test-only | PASS |

Each RED commit contains only the failing test; each GREEN commit contains only the implementation. Commit messages follow the `test(...)`/`feat(...)` convention. **PASS.**

## Truths (must_haves)

| Plan truth | Status | Evidence |
|-----------|--------|----------|
| "Every completed run with a visible immutable packet reconciles to one pending-review item, and a missing packet never becomes reviewable." | PASS | `reconcileCompletedRunForReview` packet-required bridge CTE: `completed` + visible packet → one `pending_review` item + one system lifecycle event; replay returns the existing item without another event; Neon missing-packet fixture rejected |
| "Confirm/Dismiss is one Neon-http-safe atomic winner-preserving operation with one decision row and one staff lifecycle event; replay and race losers return the original decision." | PASS | `decideAnalysisRun` single data-modifying CTE (no `db.transaction`): conditionally updates only `pending_review`, inserts the unique immutable `analysis_run_review` row, appends one `staff` event; 3 Promise.all race scenarios (Confirm/Confirm, Dismiss/Dismiss, Confirm/Dismiss) produce exactly one terminal status + one decision row + one winning event; replay/race losers read the stored winner |
| "Candidate reads are read-only positive projections from confirmed runs, persisted source links, and existing polymorphic links, with active offerings by default and preserved provenance identity." | PASS | `listConfirmedCandidateOfferings` pure SELECT: `run.status = 'confirmed'` + `review.decision = 'confirmed'` INNER JOIN, strong/weak persisted finding-source-link evidence, polymorphic `signal_offering_link` join, active offerings by default; read-only before/after row counts byte-identical; zero write imports, no `db.transaction` |
| "All non-confirmed lifecycle statuses, unsupported finding strengths, source-less findings, and expired Persona packets are excluded." | PASS | SQL positive predicate + closed-contract parse rejects (`confirmedCandidateEvidenceSchema` strong/weak only, rejects `no_evidence`/`inconclusive`); integration status matrix covers rejected statuses, `f-unlinked` source-less finding excluded, expired persona packet excluded |

## Artifact Gates

### src/lib/db/queries/analysisReviews.ts — PASS
- Exports `reconcileCompletedRunForReview`, `listRunReviewItems`, `decideAnalysisRun` ✓
- Packet-required `completed → pending_review` bridge; idempotent (replay-safe) ✓
- Review listing returns one item per packet with counts, target-safe snapshot data, provenance summary, current decision state ✓
- Single data-modifying CTE decision; no `db.transaction()` ✓
- Winner-preserving replay/race: stored decision returned for every loser/retry ✓
- No `acceptProposal`, `signal_proposal`, `agent_run`, packet update/delete ✓

### src/lib/db/queries/confirmedCandidates.ts — PASS
- Exports `listConfirmedCandidateOfferings` ✓
- Read-only SELECT; no write imports; no `db.transaction` ✓
- Confirmed predicate (`status = 'confirmed'` AND confirmed review INNER JOIN) ✓
- Polymorphic discriminator join: `signal_type::text = subject_type::text AND signal_id = finding.signal_id` ✓
- Retention-aware Persona visibility (unexpired `analysis_result_retention`) ✓
- Deterministic ordering ✓

### src/lib/db/queries/analysisReviews.integration.test.ts — PASS (11/11)
- `TEST_DATABASE_URL`-gated via skip pattern ✓
- Lifecycle statuses, duplicate review items, replay, staff attribution, missing packet ✓
- Concurrent Confirm/Confirm, Dismiss/Dismiss, Confirm/Dismiss races ✓
- Byte-for-byte packet immutability before/after Confirm and Dismiss ✓

### src/lib/db/queries/confirmedCandidates.integration.test.ts — PASS (7/7)
- `TEST_DATABASE_URL`-gated ✓
- Status matrix, evidence strength/link filter, discriminator collision, active/draft/retired display, duplicate provenance, persona retention live/expired, read-only before/after counts ✓

### src/lib/db/queries/analysisReviews.test.ts — PASS (17/17)
- Pure mocked-query tests: reconcile/decide/list boundary semantics, replay, race classification, SQL shape ✓

### src/lib/db/queries/confirmedCandidates.test.ts — PASS (5/5)
- Pure mocked-query tests: SQL shape (read-only, join direction), row mapping into closed contract, non-eligible status rejection, duplicate provenance normalization, historical link identity ✓

## Key Links

| From | To | Pattern | Status |
|------|-----|---------|--------|
| `analysisReviews.ts` | `analysisResults.ts` | `getAnalysisPacket\|analysis_run_result` — retention-aware packet/result existence and read boundary | PASS |
| `analysisReviews.ts` | `analysisRuns.ts` | `analysis_run_event\|pending_review` — guarded lifecycle transition/event semantics | PASS |
| `confirmedCandidates.ts` | `schema.ts` | `signalType.*signalId\|confirmed` — confirmed run → finding/source link → polymorphic signal link → offering join | PASS |

## Verification Evidence

| Command | Result |
|---------|--------|
| `npm test -- src/lib/db/queries/analysisReviews.test.ts` | 17/17 PASS |
| `npm test -- src/lib/db/queries/analysisReviews.integration.test.ts` (guarded `TEST_DATABASE_URL`) | 11/11 PASS |
| `npm test -- src/lib/db/queries/confirmedCandidates.test.ts` | 5/5 PASS |
| `npm test -- src/lib/db/queries/confirmedCandidates.integration.test.ts` (guarded `TEST_DATABASE_URL`) | 7/7 PASS |
| `npx tsc --noEmit` | exit 0 |
| `git diff --name-only` (plan range) | only the 6 plan-listed files |

## Findings & Observations

### Auto-fixed issues (documented in SUMMARY)
1. **Rule 1** — Integration fixtures did not persist finding-source links (`sourceKeys` missing), so the INNER JOIN eliminated every candidate; 6/7 tests failed until `sourceKeys` added to eligible fixtures.
2. **Rule 1** — `no_evidence`/`inconclusive` fixtures carrying `sourceKeys` violated the grounding validator; removed (the SQL `IN ('strong','weak')` filter excludes them anyway).
3. **Rule 1** — Persona fixture retention window expired before the decide timestamp; persisted packet with `now: DECIDED_AT`.
4. **Rule 3** — Different PG enum types on the polymorphic join (`record_type` vs `analysis_target_type`); cast both sides to text in the join predicate.

### Non-blocking observations
1. **Evidence commit consolidation**: `3ce74928` bundles four proofs (3 races + packet immutability) into one commit rather than splitting per protection class; acceptable as a single evidence unit.
2. **RED skipped-import manifestation**: the integration suite initially reported the RED fixture tests as "skipped" (module import of the not-yet-written `confirmedCandidates` threw before tests ran) — an expected TDD RED artifact, not a skip of the gate.

## Gate Checklist Summary

- Every must_have satisfied: **PASS**
- Every artifact gate assertion verified: **PASS** (analysisReviews.ts, confirmedCandidates.ts, 11/11 + 7/7 + 17/17 + 5/5 tests)
- TDD RED→GREEN atomic commits: **PASS**
- No out-of-scope application source changed: **PASS**
- Focused suites + tsc green: **PASS**

---
*Phase: 34-whole-run-review-confirmed-candidates*
*Plan: 02*
*Verdict: PASS*
