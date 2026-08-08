# Phase 34 Implementation Patterns

## Ownership and waves

| Wave | Plan | Exclusive concern | Primary files |
|---|---|---|---|
| 0 | 34-01 | Review identity/schema, closed contracts, and pure invariants | `src/lib/db/schema.ts`, `src/lib/analysis/reviewContracts.ts`, contract/schema tests |
| 1 | 34-02 | Packet-required reconciliation, atomic decisions, review reads, and candidate projection | `src/lib/db/queries/analysisReviews.ts`, `src/lib/db/queries/confirmedCandidates.ts`, query/integration tests |
| 2 | 34-03 | Additive shared Reviews UI and staff-gated whole-run actions | `src/app/actions/reviews.ts`, `src/app/(dashboard)/reviews/page.tsx`, `src/components/reviews/run-review-*` |
| 3 | 34-04 | Scope audit, full automated gate, authenticated fixture UAT, and validation ledger | `scripts/phase34-scope-audit.ts`, its test, `34-VALIDATION.md` |

No same-wave plan modifies the same application file. Plan 34-03 may modify
the existing Reviews action/page only after Plan 34-02 exports its query
contracts. Legacy proposal query/action/components remain separate and are
not refactored into the v1.7 path.

## Required boundaries

- `analysis_run_result`, `analysis_finding`, `analysis_source`, and
  `analysis_finding_source` are immutable Phase 33 evidence. Review reads use
  `getAnalysisPacket()` or reproduce its exact retention predicate; no packet
  update/delete helper is introduced.
- Reconciliation requires a unique packet and guarded `completed` status. It
  may append one `completed → pending_review` event and must return the
  authoritative existing state on replay.
- Confirm/Dismiss accepts only a positive run ID and closed decision enum. The
  Server Action calls `requireStaffAccess()` first and passes its returned
  `userId`; the client never supplies actor identity.
- The decision CTE must atomically condition status, insert the unique decision
  identity, and append one staff lifecycle event. Losers receive the persisted
  winner; they never overwrite it or append another event.
- Candidate SQL starts with positive `analysis_run.status = 'confirmed'` and a
  matching confirmed decision, then joins immutable packet provenance and
  `signal_offering_link` on `signal_type + signal_id`. It never creates a
  Signal, Persona/Company Signal, Offering, or link.
- Active offerings are the default display result. Historical retired/draft
  link identity is retained as provenance metadata, while those offerings are
  not returned as active candidate display rows unless the query contract
  explicitly marks them historical.
- Candidate evidence is positive-only: `strong`/`weak` plus at least one
  persisted source link. Every excluded lifecycle status and Persona retention
  case is a fixture.
- Phase 34 tests use mocked Clerk and deterministic packet fixtures for unit
  behavior, `TEST_DATABASE_URL` for Neon concurrency/integration evidence, and
  authenticated Playwright UAT against seeded packet rows. No provider call is
  a prerequisite.
