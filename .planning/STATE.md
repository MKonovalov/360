---
gsd_state_version: 1.0
milestone: v1.8
milestone_name: Agent Constructor
status: planning
last_updated: "2026-08-09T09:43:15.034Z"
last_activity: 2026-08-09
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-09)

**Core value:** Fast, shared ICP lookup — anyone on the team can pull up a company or persona and see a complete, trustworthy 360 view with buying signals in seconds.
**Current focus:** Phase 37 — Custom Agent Definition, Versioning & Lifecycle

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-08-09 — Milestone v1.8 started

## Performance Metrics

**Velocity:**

- Total plans completed: 131 through v1.6
- Average duration: Not tracked consistently
- Total execution time: Not tracked consistently

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 31-36 | Historical v1.7 | — | — |
| 37-39 | 0 | — | — |

**Recent Trend:**

- v1.6: 25 plans across 3 phases, shipped 2026-08-06
- Trend: Stable

| Phase 33 P2 | ~1h | 3 tasks | 5 files |
| Phase 33 P03 | ~45m | 2 tasks | 5 files |
| Phase 33 P04 | ~1h | 2 tasks | 7 files |
| Phase 33 P05 | ~1h | 3 tasks | 4 files |
| Phase 33 P06 | 25m | 2 tasks | 4 files |
| Phase 34-whole-run-review-confirmed-candidates P01 | 45m | 2 tasks | 4 files |
| Phase 34-whole-run-review-confirmed-candidates P02 | 61m | 2 tasks | 6 files |
| Phase 34-whole-run-review-confirmed-candidates P03 | 17m | 2 tasks | 8 files |
| Phase 34-whole-run-review-confirmed-candidates P04 | ~30m | 2 tasks (automated + UAT) | 3 files + 1 E2E test |
| Phase 36 P01 | 10m | 2 tasks | 5 files |
| Phase 36 P02 | 17m | 2 tasks | 3 files |
| Phase 36 P02 | 17m | 2 tasks | 3 files |
| Phase 36 P3 | 26m | 2 tasks | 5 files |
| Phase 36 P04 | 5m | 2 tasks | 5 files |
| Phase 36 P05 | 7m | 2 tasks | 9 files |
| Phase 36 P06 | 10m | 2 tasks | 8 files |
| Phase 36 P7 | 12m | 2 tasks | 3 files |

## Accumulated Context

### Decisions

- **Roadmap (v1.7):** Six dependency-ordered phases start at Phase 31: executor proof → immutable template/run ledger → grounded execution/evidence → whole-run review and confirmed-only candidates → Company/Persona experiences → management and end-to-end verification. All 25 approved requirements map exactly once.
- **Durability gate:** Phase 31 must select and prove a Vercel-compatible executor can independently claim, complete, recover, or safely fail runs before Phase 33 promises detached asynchronous execution.
- **Locked stack:** Reuse in-house modelFactory and Firecrawl behind a provider-agnostic contract; do not add Exa.
- **Locked review/scope:** A whole completed run receives one Confirm/Dismiss decision; no Persona Discovery, bulk/scheduled analysis, per-finding curation, auto-confirmation, Hypotheses, outreach, or CRM.
- [Phase 33]: Packet header is unique by analysis_run_id; replay returns the existing row and conflicting packet hashes fail closed.
- [Phase 33]: Neon-http packet persistence uses one data-modifying CTE; interactive db.transaction callbacks remain unsupported.
- [Phase 33]: Persona retention uses a mutable tombstone relation for visibility while immutable packet contents have no update/delete path.
- [Phase 33]: Evidence sources require explicit Firecrawl provenance and bounded public-web content before normalization.
- [Phase 33]: Finding identity and buyer-role data are copied only from immutable checklist snapshots; citations require exact canonical URL/content-hash support.
- [Phase 33]: Execution resolves only the validated snapshot modelChain through instantiateChain; mutable Settings and provider branches remain outside the adapter.
- [Phase 33]: Page retrieval is not a model tool; it requires canonical URL membership in a server-owned opaque search-result set and revalidates public HTTPS identity.
- [Phase 33]: Database-authoritative packet persistence precedes completion; deferred policy remains fail closed and telemetry is allowlisted best effort.
- [Phase 33]: Every durable packet step reloads the scalar run ID rather than trusting Workflow metadata.
- [Phase 33]: Final database evidence remains blocked until TEST_DATABASE_URL is supplied; persistence and Workflow integration are not claimed as passed.
- [Phase 33]: Live provider smoke is deferred with reason policy_or_credentials_unavailable while policy remains deferred and execution-disabled.
- [Phase 32]: Final gate passed against TEST_DATABASE_URL; the seed and ledger integration files require serial Vitest execution to preserve exact-two fixture assertions.
- [Phase 32]: The analysis-run create route and Workflow preserve the phase32_noop policy and do not invoke Phase 33 grounded execution during the constructor/no-op gate.
- [Phase 34-whole-run-review-confirmed-candidates]: One immutable, packet-bound whole-run decision per analysis run/result: unique analysis_run_id and result_id, closed confirmed|dismissed enum, non-null decided_by/decided_at/packet_hash.
- [Phase 34-whole-run-review-confirmed-candidates]: Actor identity, decision timestamp, and packet hash are server-result fields; reconciliation/decision inputs accept only a positive run ID plus the closed decision (T-34-02).
- [Phase 34-whole-run-review-confirmed-candidates]: Candidate eligibility is strong/weak only with persisted source linkage; active display status and historical link identity are distinct fields (D-34-03/D-34-04).
- [Phase 34-whole-run-review-confirmed-candidates]: Confirmed-only predicate lives in SQL (status = 'confirmed' AND confirmed review join), never client-side filtering; the contract rejects non-eligible evidence at parse time as a second layer.
- [Phase 34-whole-run-review-confirmed-candidates]: Polymorphic join casts both sides to text: signal_offering_link.signal_type is record_type while analysis_run.subject_type is analysis_target_type — two distinct PG enum types.
- [Phase 34-whole-run-review-confirmed-candidates]: Confirmed review identity is enforced by the INNER JOIN on analysis_run_review decision = 'confirmed'; candidate rows do not carry decided_by/decided_at because the closed 34-01 contract omits them.
- [Phase 34-whole-run-review-confirmed-candidates]: Deterministic duplicate provenance: multiple sources per finding survive as separate evidence rows; normalizeCandidateEvidence orders by run:finding:source without grouping.
- [Phase ?]: Fixed template management input remains limited to the seeded Company and Persona keys.
- [Phase ?]: Neon-safe append conflicts are classified without mutating immutable history.
- [Phase ?]: Lifecycle changes update only analysis_template and preserve versions and run snapshots.
- [Phase ?]: Template management revalidates only /agents because management changes do not rewrite historical runs or live catalog data.
- [Phase ?]: Unexpected template query failures return action_failed while concurrent immutable-version conflicts remain safe reloadable outcomes.
- [Phase 36]: The public management route is /agents and the UI allowlists the two canonical fixed template keys.
- [Phase 36]: Only current instruction and defaultEffort are submitted for content saves; lifecycle submits only the fixed key and next status.
- [Phase 36]: Historical versions remain read-only while lifecycle changes preserve the current version.
- [Phase 36]: Agents is the first Manage item and links only to the canonical exact leaf route /agents. — Keeps the public route and placement aligned with D-36-07.
- [Phase 36]: Authenticated route/sidebar E2E uses the real app and existing Clerk storage state without mocking app HTML. — Preserves real route wiring evidence while keeping database fixture prerequisites separate.
- [Phase 36]: Deterministic Phase 36 verification uses the existing executor injection seam.
- [Phase 36]: TEST_DATABASE_URL absence blocks Neon/Workflow evidence and is recorded as blocked, not passed.
- [Phase 36]: Fixture mode requires PHASE36_FIXTURE_ONLY=1 plus a marked application URL that normalizes to the same disposable database identity as TEST_DATABASE_URL.
- [Phase 36]: Authenticated browser evidence passed 5/5 originally in 31.2s and again after ship-review remediation in 36.9s with guarded disposable fixtures; the independent database/Workflow matrix remains prerequisite-gated.
- [Phase 36]: Final evidence distinguishes passing deterministic/unit/build/scope gates from blocked Neon, Workflow, and authenticated browser prerequisites.
- [Phase 36]: Optional provider/Firecrawl smoke remains non-gating and is recorded not_run with policy_or_credentials_unavailable.
- **v1.8 scope:** `/agents` is the canonical custom-agent management route; `/reviews/agents` is explicitly excluded.
- **v1.8 compatibility:** The two v1.7 fixed Company/Persona templates remain unchanged and backward-compatible; custom agents enter the same durable, source-grounded, whole-run review, and confirmed-only candidate pipeline.
- **v1.8 constructor policy:** Editable fields are name/description, target type, Practice Area, instruction, supported/default effort, and lifecycle; behavior instructions remain separate from bounded structured-output configuration.
- **v1.8 research boundary:** Exa Agent/Connect documentation informs constructor shape and guardrails, but Exa and other new providers remain out of scope; capabilities stay server-owned.
- **v1.8 history:** Custom saves append immutable versions; historical versions and prior runs remain read-only and lifecycle changes do not mutate snapshots.

### Pending Todos

None.

### Blockers/Concerns

- v1.7 Phase 36's separate Neon/Workflow matrix remains a historical partial verification item because `TEST_DATABASE_URL` was unavailable; v1.8 must not silently reclassify it.
- Phase 37 must define custom-agent identity/ownership, schema boundaries, and additive migration details without changing the fixed-template keys.
- Phase 38 must preserve the v1.7 durable executor, evidence, review, and confirmed-only candidate boundaries for custom agents.
- Phase 39 must prove adversarial fail-closed behavior and no-live-write invariants with deterministic fixtures plus authenticated `/agents`, Company, and Persona E2E.
- Phase 31 executor selection and deployed proof are complete; detached execution may now proceed through the planned ledger gates.
- Phase 32 planning must inventory legacy `agent_run`/proposal/review relations before selecting additive migration details.
- Persona enablement needs explicit privacy, redaction, classification, and retention policy values before Phase 33 implementation.
- Phase 32's original parallel seed/ledger command exposed a shared disposable-database fixture race; validation now serializes those two files without weakening assertions.
- TEST_DATABASE_URL is missing; 36-05 database and Workflow evidence remains blocked.

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Persona knowledge | Real Arcpedia match for a Persona seed record | Open | v1.0 |
| Live provider proof | Credited NousResearch/OpenCode end-to-end run evidence | Open | v1.5 |

## Session Continuity

Last session: 2026-08-09T09:43:15Z
Stopped at: v1.8 milestone definition after research-first approval
Next: Discuss and plan Phase 37 — Custom Agent Definition, Versioning & Lifecycle
Resume file: None
