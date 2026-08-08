# Phase 34: Whole-Run Review & Confirmed Candidates — Context

**Gathered:** 2026-08-08
**Status:** ready_for_execution

## Phase boundary

Add an additive, staff-only whole-run review layer over Phase 33's immutable
analysis packets and a read-only confirmed-candidate projection. Preserve the
legacy `/reviews` proposal queue and its Accept/Reject behavior. Phase 34 does
not execute providers, mutate packet rows, write live Signals or
`signal_offering_link` rows, launch target-record experiences, or manage
templates.

## Locked decisions

- **D-34-01:** Phase 34 owns an idempotent, packet-required `completed → pending_review`
  reconciliation bridge. Do not change Phase 33 packet ordering or make packet
  persistence depend on review state.
- **D-34-02:** A run has one whole-run terminal decision, `confirmed` or
  `dismissed`, attributed to the server-derived Clerk staff user. Confirm and
  Dismiss are atomic, one-winner under retries/races, append-only in lifecycle
  history, and preserve the original packet and winner on replay.
- **D-34-03:** Candidate aggregation includes only `strong` and `weak` findings
  that have persisted `analysis_finding_source` links to persisted sources.
  `no_evidence` and `inconclusive` findings are excluded.
- **D-34-04:** Candidate projections join links with both `signal_type` and
  snapshotted `signal_id`; they retain target discriminator, run/result/finding/
  source provenance IDs, packet hash, and historical link identity. They show
  active offerings by default; retired/draft historical identities remain
  represented in provenance rather than being silently reclassified.
- **D-34-05:** The shared Reviews experience is additive: the v1.7 run-level
  section is separate from legacy proposal cards and never calls `agent_run`,
  `signal_proposal`, or legacy proposal Accept.
- **D-34-06:** Persona review and candidate reads use the Phase 33
  retention-aware packet boundary. Expired/tombstoned Persona artifacts are
  not exposed.
- **D-34-07:** No Phase 34 verification may require live provider or Firecrawl
  execution. Use completed packet fixtures; Phase 33 live smoke remains
  `policy_or_credentials_unavailable` and is not approval.

## Explicit implementation choices

- Use an additive `analysis_run_review` identity/decision table with unique
  `analysis_run_id` and `result_id`, immutable decision fields, and captured
  packet hash. The authoritative run status remains `analysis_run.status`.
- Put reconciliation, decision, review-list, and candidate SQL in dedicated
  query modules. Use the proven Neon-http-safe data-modifying CTE pattern; do
  not use interactive `db.transaction()` callbacks.
- Return deterministic normalized candidate evidence rows (or an ordered
  provenance collection) without dropping duplicate finding/source support.
  The query contract is the Phase 35 input; Phase 35 target-record UI is not
  implemented here.
- Add run-level UI to `/reviews` with independently staff-gated Server Actions;
  preserve the existing proposal section and its tests unchanged except for
  additive composition coverage.

## Deferred / out of scope

- Phase 35 target-record launch/history/result/candidate UX.
- Phase 36 template management and final live end-to-end verification.
- Per-finding curation, bulk/scheduled execution, auto-confirmation,
  Signal/Offering writes, CRM/outreach, Exa/new providers, and live provider
  calls.
