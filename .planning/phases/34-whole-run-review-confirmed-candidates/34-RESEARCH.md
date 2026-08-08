# Phase 34: Whole-Run Review & Confirmed Candidates - Research

**Researched:** 2026-08-08  
**Domain:** Whole-run review state, immutable decision recording, and confirmed-only candidate projections  
**Confidence:** HIGH for repository seams and scope boundaries; MEDIUM for the new review-row shape and the completed-to-pending-review bridge, which are not yet implemented.

<user_constraints>
## User Constraints

### Locked Decisions

- Preserve Phase 33's immutable packet and source-provenance contract; do not redesign or mutate it. [VERIFIED: user request; `.planning/phases/33-grounded-analysis-execution-evidence/33-CONTEXT.md`]
- Define one whole-run terminal decision, attributed to staff, idempotent under retries and competing attempts. [VERIFIED: user request]
- Confirm and Dismiss must not mutate live Signals or signal-offering links. [VERIFIED: user request; `.planning/REQUIREMENTS.md` REV-03]
- Candidate results are projections from Confirmed runs only and must carry run, finding, and source provenance. [VERIFIED: user request; `.planning/REQUIREMENTS.md` REV-04]
- Pending, failed, cancelled, and dismissed runs are excluded from candidate aggregation. [VERIFIED: user request; `.planning/REQUIREMENTS.md` REV-05]
- Do not add per-finding curation, bulk/scheduled execution, auto-confirmation, live Signal writes, CRM/outreach, new providers, Exa, Phase 35 target-record experiences, or Phase 36 template management/end-to-end verification. [VERIFIED: user request; `.planning/REQUIREMENTS.md:64-75`]
- Phase 33 live provider smoke remains deferred as `policy_or_credentials_unavailable`; downstream work must consume completed packet contracts without treating deferred smoke as approval. [VERIFIED: user request; `33-VERIFICATION.md`]

### Claude's Discretion

- Exact additive review table/query names, review-list shape, candidate projection query shape, and test fixture organization may be selected so long as the locked packet, status, provenance, auth, and no-live-write boundaries remain intact. [VERIFIED: user request]

### Deferred Ideas (OUT OF SCOPE)

- Phase 35 Company/Persona launch, preview, history, result, and target-record candidate experiences. [VERIFIED: `.planning/ROADMAP.md:477-487`]
- Phase 36 template lifecycle management and final end-to-end verification. [VERIFIED: `.planning/ROADMAP.md:489-498`]
- Per-finding approve/dismiss/correct, trusted-template bypass, hypotheses, scoring, outreach, CRM sync, bulk execution, scheduled execution, automatic reruns, and external providers. [VERIFIED: `.planning/REQUIREMENTS.md:49-75`]
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Governing requirement | Research support |
|---|---|---|
| REV-01 | Every successfully completed v1.7 analysis creates exactly one run-level review item in the shared Reviews experience. [VERIFIED: `.planning/REQUIREMENTS.md:36`]| Use the Phase 32/33 `analysis_run` + immutable `analysis_run_result` boundary; add one unique review-item/decision boundary and reuse the existing staff-gated Reviews page seam. |
| REV-02 | A staff reviewer can Confirm or Dismiss the entire run exactly once; the terminal decision is attributable, idempotent, and preserves the review packet. [VERIFIED: `.planning/REQUIREMENTS.md:37`]| Guarded `pending_review → confirmed|dismissed` transition, one unique decision row or equivalent CTE, server-derived Clerk actor, and no packet update/delete path. |
| REV-03 | Confirming or dismissing a run never writes live Signals or signal-offering links. [VERIFIED: `.planning/REQUIREMENTS.md:38`]| Review action must call only review/analysis-run query functions; source-scope tests must reject imports/writes to `signal`, `company_signal`, `persona_signal`, or `signal_offering_link`. |
| REV-04 | Company and Persona candidate-offering views derive only from Confirmed runs through existing signal-offering links and include run/finding/source provenance. [VERIFIED: `.planning/REQUIREMENTS.md:39`]| Read-only aggregation joins confirmed review state → immutable packet/finding/source/link rows → existing polymorphic signal-offering links → active offerings, returning both discriminators and provenance IDs. |
| REV-05 | Pending, failed, cancelled, and dismissed runs can never appear in candidate-offering aggregation. [VERIFIED: `.planning/REQUIREMENTS.md:40`]| Aggregate from `analysis_run.status = 'confirmed'` (and a matching decision row if added); never use packet existence or proposal status as confirmation. |
</phase_requirements>

## Governing Scope: Roadmap Quote

> **Goal:** Staff can make one safe decision for a completed analysis, and only confirmed evidence can influence candidate offerings. [VERIFIED: `.planning/ROADMAP.md:465-468`]
>
> **Requirements:** REV-01, REV-02, REV-03, REV-04, REV-05. [VERIFIED: `.planning/ROADMAP.md:465-468`]
>
> **Success criteria:** (1) Every successfully completed analysis appears exactly once as a run-level packet in the shared Reviews experience. (2) A staff reviewer can Confirm or Dismiss the entire completed run once; repeat or competing attempts preserve the original attributable terminal decision and packet. (3) Either decision leaves live Signals and signal-offering links unchanged. (4) Company and Persona candidate-offering results include run, finding, and source provenance and derive solely from Confirmed runs through existing signal-offering links. (5) Pending, failed, cancelled, and dismissed runs never appear in candidate-offering aggregation. [VERIFIED: `.planning/ROADMAP.md:469-475`]

## Summary

Phase 34 is an additive read/review/projection layer on top of the completed Phase 33 packet. The packet header is unique by `analysis_run_id`; findings, sources, and finding-source links are normalized, source identity is canonicalized, replay returns the existing packet, and packet contents have no update/delete query path. Phase 34 must consume those rows as immutable evidence, not add review fields to the packet or reinterpret mutable signal names. [VERIFIED: `src/lib/db/schema.ts:658-759`; `src/lib/db/queries/analysisResults.ts:105-239`; `33-02-SUMMARY.md`]

The existing run ledger already contains the review statuses `pending_review`, `confirmed`, and `dismissed`, and its transition query is a single Neon-http-safe guarded CTE that appends one actor/timestamp event. The missing seam is a whole-run review item/decision boundary and a safe bridge from Phase 33's `completed` packet state into `pending_review`. That bridge must be resolved without changing the Phase 33 packet contract. [VERIFIED: `src/lib/analysis/contracts.ts:3-30`; `src/lib/db/queries/analysisRuns.ts:195-279`; `33-VERIFICATION.md`]

**Primary recommendation:** Add one unique, server-owned whole-run review decision boundary keyed by `analysis_run_id` and `result_id`; materialize/reconcile completed packets into `pending_review` exactly once, perform Confirm/Dismiss as one guarded database operation with the Clerk staff actor, and expose a read-only confirmed-only candidate projection that joins immutable packet provenance through the existing polymorphic signal-offering links without writing any live Signal or link row.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Completed-packet eligibility and review-item identity | Database / Storage | API / Backend | `analysis_run` and `analysis_run_result` are product truth; packet uniqueness is already database-enforced. [VERIFIED: Phase 32/33 artifacts] |
| Completed → pending-review reconciliation | API / Backend | Database / Storage | A server-owned boundary must verify packet existence before exposing a review item; the status transition and event must remain DB-guarded. [VERIFIED: `analysisRuns.ts`; [ASSUMED] exact bridge placement |
| Confirm/Dismiss terminal decision | Database / Storage | API / Backend | Competing attempts must converge through a conditional status update, unique decision identity, and append-only actor/timestamp history. [VERIFIED: Phase 32 transition pattern; [ASSUMED] review-row shape |
| Reviews navigation and action authorization | Frontend Server / API | Browser / Client | The `/reviews` page and Server Actions both call `requireStaffAccess()`; client controls are presentation only. [VERIFIED: `src/app/(dashboard)/reviews/page.tsx:13-21`; `src/app/actions/reviews.ts:20-31` |
| Candidate-offering aggregation | Database / Storage | API / Backend | Joins confirmed runs, immutable findings/sources, and existing signal-offering links; aggregation is a projection, not a write workflow. [VERIFIED: schema/query modules; [ASSUMED] final SQL shape |
| Company/Persona target display | API / Backend | Browser / Client | Phase 34 may return target discriminators/IDs and safe display data for shared Reviews, but target-record experiences remain Phase 35. [VERIFIED: roadmap boundaries] |

## Existing Boundary Inventory

### Phase 32/33 authoritative seams

- `analysis_run` stores subject type/id, Practice Area, immutable template/subject/checklist/execution/policy snapshots, lifecycle status, and timestamps. Its partial unique index treats `queued`, `running`, and `pending_review` as active. [VERIFIED: `src/lib/db/schema.ts:590-639`]
- `analysis_run_event` is append-only and records `from_status`, `to_status`, `actor_kind`, `actor_id`, safe reason, attempt, and timestamp. `transitionAnalysisRun()` validates the transition graph and uses a single data-modifying CTE; a loser/replay appends no event. [VERIFIED: `src/lib/db/schema.ts:641-656`; `src/lib/db/queries/analysisRuns.ts:195-279`]
- The status graph is `completed → pending_review → confirmed|dismissed`; `confirmed` and `dismissed` have no outgoing transitions. [VERIFIED: `src/lib/analysis/contracts.ts:19-28`]
- `analysis_run_result` has a unique `analysis_run_id` and `packet_hash`; findings carry snapshot signal identity, sources carry canonical URL/title/retrieval/excerpt/hash, and finding-source rows carry explicit provenance links. [VERIFIED: `src/lib/db/schema.ts:658-759`]
- `getAnalysisPacket(runId)` reads the immutable header and child rows, applying Persona retention visibility. Review reads must use this read boundary rather than query raw packet JSON or mutable catalog rows. [VERIFIED: `src/lib/db/queries/analysisResults.ts:204-239`]
- Phase 33 automated/database gates passed; live provider smoke remains deferred as `policy_or_credentials_unavailable`. This is evidence that packet contracts and tests are complete, not approval for a live provider run. [VERIFIED: `33-VERIFICATION.md:14-24,96-110,194-200`]

### Legacy `agent_run` / `signal_proposal` / Reviews inventory

- `agent_run` is a legacy Company-only run record containing trace/model/evidence metadata; it is not the v1.7 lifecycle and must not be extended for whole-run review. [VERIFIED: `src/lib/db/schema.ts:239-260`; `32-RESEARCH.md:147-149`]
- `signal_proposal` is a per-proposal Company queue row. Its legacy Accept path updates proposal status and then inserts a live `signal`; it is explicitly incompatible with one whole-run decision and must remain untouched. [VERIFIED: `src/lib/db/schema.ts:265-280`; `src/lib/db/queries/proposals.ts:98-137`]
- The current `/reviews` page lists only `listPendingProposals()` and renders `ReviewQueue`; its actions are `acceptProposalAction` and `rejectProposalAction`, both separately staff-gated. Phase 34 should extend the shared Reviews experience additively rather than silently changing proposal semantics. [VERIFIED: `src/app/(dashboard)/reviews/page.tsx:1-41`; `src/components/reviews/review-queue.tsx:49-87`; `src/app/actions/reviews.ts:1-69`]
- The current proposal Accept path is a warning seam: it intentionally writes a live `signal`, while Phase 34 Confirm/Dismiss must never call it or reuse its query. [VERIFIED: `src/lib/db/queries/proposals.ts:107-137`; user constraint]

### Signals, offerings, and links inventory

- `company_signal` and `persona_signal` are separate catalog tables keyed by `practice_area_id`, with `active`, `draft`, and `retired` status; Persona signals also retain `buyer_role_id`. [VERIFIED: `src/lib/db/schema.ts:421-451`]
- `signal_offering_link` is polymorphic: `signal_type` is the existing `record_type` enum and `signal_id` is a bare integer resolved as either Company Signal or Persona Signal; `offering_id` has a real FK. [VERIFIED: `src/lib/db/schema.ts:453-471`]
- `listLinksForSignal()` always filters by both discriminator and ID, preventing Company/Persona ID collisions; `listLinksForOffering()` returns link rows with both fields. [VERIFIED: `src/lib/db/queries/signalOfferingLinks.ts:64-81`]
- Link insertion enforces same-Practice-Area before writing, while deletion is unconditional because links have no dependents. Phase 34 must only read these links. [VERIFIED: `src/lib/db/queries/signalOfferingLinks.ts:18-61,83-87`]
- `offering` has active/draft/retired status and Practice Area/Domain identity; existing active/all query split should be reused for candidate display rules rather than duplicating status semantics. [VERIFIED: `src/lib/db/schema.ts:357-373`; `src/lib/db/queries/offerings.ts:65-83`]

### Company and Persona paths

- Company and Persona records use independent serial integer IDs, so every candidate/review read must retain `targetType` plus `subjectId`; a bare ID is ambiguous. [VERIFIED: `src/lib/db/schema.ts:58-103`; `src/lib/analysis/contracts.ts:115-130`]
- Existing `getCompanyById()` and `getPersonaById()` return the respective row or `undefined`; Phase 34 should not add target-record UI or copy unrestricted Persona fields into review responses. [VERIFIED: `src/lib/db/queries/companies.ts:59-64`; `src/lib/db/queries/personas.ts:103-109`; Phase 35 boundary]

## Proposed Additive Boundary

### Review decision invariant

Use the existing `analysis_run` status as the authoritative terminal decision and add a small immutable decision row only if the planner needs a direct review projection. Recommended shape: `analysis_run_review` with a unique `analysis_run_id`, unique `result_id`, decision enum `confirmed|dismissed`, `decided_by` Clerk user ID, `decided_at`, and the packet hash captured from `analysis_run_result`. The row is insert-once; no update/delete helper is exposed. This recommendation is [ASSUMED] because no review table exists yet.

The critical operation must be one server-side CTE or equally proven Neon-http-safe statement:

1. Require staff at the Server Action boundary and derive `userId`; never accept actor identity from client input. [VERIFIED: `src/app/actions/reviews.ts:20-31`; `CLAUDE.md`]
2. Validate the requested run ID as a positive integer and load the authoritative run/result; require an existing immutable packet and `pending_review` (or the explicitly resolved completed-to-pending-review bridge). [VERIFIED: existing route validation and packet uniqueness; [ASSUMED] action contract]
3. Conditionally update `analysis_run` from `pending_review` to exactly one terminal status.
4. Insert the decision row and append the `analysis_run_event` with `actorKind='staff'`, Clerk `actorId`, and server timestamp in the same atomic boundary.
5. On a retry/competing attempt, return the already persisted terminal decision and original actor/time/packet hash; do not overwrite, append a second decision, or report the loser as successful.

The `analysis_run_result`, `analysis_finding`, `analysis_source`, and `analysis_finding_source` rows remain unchanged in every branch. Confirm and Dismiss are review-state operations, not packet mutations. [VERIFIED: Phase 33 immutable persistence; user constraint]

### Exactly-once review item

The review list should select one row per completed packet by joining `analysis_run` to `analysis_run_result` on `analysis_run_id`, and it should expose run ID, target type/id/display name from the snapshot, template/practice-area summary, packet counts, trace/model/timing metadata, and current review state. It must not group per finding or create proposal rows. [VERIFIED: packet/run schema; Phase 33 contract; [ASSUMED] response fields]

The planner must choose one explicit bridge for the existing `completed` status:

- **Recommended:** a guarded `completed → pending_review` reconciliation step that requires the unique immutable packet and is idempotent; review listing may reconcile only through a server-owned query/action boundary, not a browser-side write. [ASSUMED]
- Do not change Phase 33's packet-before-completion ordering or treat deferred live smoke as a completed-run fixture. [VERIFIED: `33-05-SUMMARY.md`; `33-VERIFICATION.md`]

### Confirmed-only candidate projection

The candidate query should be read-only and use this join direction:

```text
analysis_run (status = confirmed)
  → optional analysis_run_review (decision = confirmed, same run/result)
  → analysis_run_result (same analysis_run_id)
  → analysis_finding (same result/run)
  → analysis_finding_source → analysis_source
  → signal_offering_link (signal_type + signal_id = finding snapshot identity)
  → offering (prefer active offerings for candidate display)
```

Each returned candidate must retain: `targetType`, `subjectId`, `offeringId`, `analysisRunId`, `resultId`/packet hash, `findingId` plus finding row ID, `signalType`/snapshot signal ID, `sourceId`/source row ID, canonical source URL/title/retrieved time/excerpt or an approved safe source projection, and the review actor/time. [VERIFIED: existing schema fields; [ASSUMED] projection contract]

Use the finding's snapshotted `signalId` and the run's target type to select the existing polymorphic link. Never resolve links by current signal name/category, and never join Company/Persona signal tables by numeric ID alone. [VERIFIED: Phase 33 finding identity contract; `signalOfferingLinks.ts:73-80`]

Recommended evidence filter: include only `strong` and `weak` findings with at least one persisted finding-source link; exclude `no_evidence` and `inconclusive` because they are not source-backed candidate evidence. This is [ASSUMED] and needs product confirmation if Confirm is intended to expose all findings regardless of evidence status.

Aggregation must explicitly exclude `queued`, `running`, `completed`, `pending_review`, `failed`, `cancelled`, and `dismissed`; the safest positive rule is `status = 'confirmed'` plus a matching confirmed decision row. Do not use “packet exists”, “review page row exists”, legacy proposal acceptance, or active offering status as substitutes for confirmation. [VERIFIED: roadmap success criteria; status enum; legacy separation]

Duplicate presentation rows should be deterministic. Keep separate provenance rows when distinct findings or sources support the same offering; if the product wants one collapsed offering card, aggregate only at the final projection and retain an ordered provenance array. Do not discard provenance during `GROUP BY`. [ASSUMED]

## Architecture Patterns

### System Architecture Diagram

```text
Phase 33 durable workflow
  └─ analysis_run completed + immutable analysis_run_result packet
       │
       ▼
Phase 34 server-owned review reconciliation
  ├─ verify packet/result exists
  ├─ guarded completed → pending_review (one event)
  └─ shared Reviews read model: one run-level item
       │ staff-only Server Action
       ▼
Atomic decision boundary
  ├─ pending_review → confirmed OR dismissed
  ├─ insert one immutable decision row / preserve existing winner
  └─ append attributable analysis_run_event
       │
       ├─ dismissed → no candidate rows
       └─ confirmed → read-only candidate projection
             ├─ confirmed run/result
             ├─ snapshot-identified findings + persisted source links
             ├─ existing polymorphic signal_offering_link
             └─ offering / target-safe projection
```

### Recommended project structure

```text
src/
├── lib/db/schema.ts                         # additive review decision enum/table only
├── lib/db/queries/analysisReviews.ts        # review item reads, guarded decision/reconciliation
├── lib/db/queries/confirmedCandidates.ts    # read-only confirmed-only offering projection
├── src/app/actions/reviews.ts                # staff-gated whole-run Confirm/Dismiss action
├── src/app/(dashboard)/reviews/page.tsx      # shared Reviews composition, preserve legacy queue
├── src/components/reviews/                   # run-level packet card; legacy proposal components remain separate
└── src/lib/analysis/reviewContracts.ts       # Zod decision/result contracts if needed
```

The exact filenames are recommendations, not existing files. Query modules must remain pure DB access; auth, revalidation, and client-facing error mapping belong at the Server Action/page boundary. [VERIFIED: current query/action conventions; [ASSUMED] new module names]

### Pattern 1: Guarded whole-run decision

**What:** One conditional status transition from `pending_review` and one immutable decision insert, with the actor from `requireStaffAccess()`. [VERIFIED: `analysisRuns.ts`; `reviews.ts`; [ASSUMED] new decision CTE]

**When to use:** Confirm and Dismiss, including browser double-clicks, network retries, two staff tabs, and competing reviewers.

```typescript
// Illustrative contract; align names with the repository schema during planning.
type WholeRunDecision = 'confirmed' | 'dismissed';

interface DecideAnalysisRunInput {
  readonly runId: number;
  readonly decision: WholeRunDecision;
  readonly actorId: string;
}
```

The implementation must not perform “select, then update, then insert” as independent correctness steps under `neon-http`; use the proven single-statement CTE pattern or a newly verified equivalent. [VERIFIED: `32-TRANSACTION-PROBE.md`; `analysisRuns.ts`]

### Pattern 2: Read-only provenance projection

**What:** Join only confirmed runs to immutable result/finding/source rows and existing signal-offering links. Return source and finding identifiers with the candidate offering rather than copying or rewriting evidence. [VERIFIED: schema; user constraint]

**When to use:** Shared Reviews summary and later Phase 35 target-record reads. Phase 34 may establish the query contract but must not build the Phase 35 experiences.

### Anti-patterns to avoid

- **Reuse `acceptProposal()`:** It writes `signal` after accepting a legacy proposal and violates REV-03. [VERIFIED: `proposals.ts:107-137`]
- **Create one review row per finding:** Phase 34 is whole-run only; per-finding curation is REV-06/future scope. [VERIFIED: requirements]
- **Treat completed packet existence as confirmed:** Completion and review decision are separate lifecycle states. [VERIFIED: status graph; roadmap]
- **Mutate packet rows on decision:** Packet/source provenance is immutable; only review state and append-only audit state may change. [VERIFIED: Phase 33 summaries]
- **Join links by signal ID alone:** Company and Persona signal IDs can collide; include `signal_type`. [VERIFIED: `signalOfferingLinks.ts`]
- **Aggregate through legacy `signal_proposal`:** It is Company-only and proposal-scoped, not v1.7 packet truth. [VERIFIED: schema and Phase 32 inventory]
- **Use UI filtering for confirmed-only:** The database query must positively constrain confirmed status; client filtering is not an authorization or correctness boundary. [VERIFIED: security conventions; [ASSUMED] aggregation implementation]

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Exactly-once terminal decision | Client disable flag, in-memory lock, or select-then-update | Guarded `analysis_run` transition + unique decision identity + single CTE | Competing attempts must have one database winner and one attributable event. [VERIFIED: Phase 32 CTE pattern; [ASSUMED] review row] |
| Review packet storage | Copy packet JSON into a mutable review document | Existing immutable `analysis_run_result` and child tables | Phase 33 already owns normalized evidence and replay/hash integrity. [VERIFIED: `analysisResults.ts` and schema] |
| Candidate signal resolution | Create new signals or infer links from names | Existing `signal_offering_link` read path with `signalType + signalId` | Preserves catalog ownership and prevents live Signal mutation. [VERIFIED: schema/query module] |
| Candidate provenance | Flatten to offering IDs only | Join `analysis_finding_source` and `analysis_source`, retaining IDs/metadata | A confirmed candidate must be auditable back to run, finding, and source. [VERIFIED: REV-04] |
| Auth | New roles, route-only gate, or client-trusted actor | Existing `requireStaffAccess()` at page and Server Action boundaries | Existing policy requires direct invocation protection and Clerk actor identity. [VERIFIED: current Reviews code; CLAUDE.md] |
| Neon atomicity | Interactive `db.transaction()` callback | Existing data-modifying CTE pattern, with integration concurrency tests | Installed `neon-http` rejects interactive transactions. [VERIFIED: `32-TRANSACTION-PROBE.md`; `analysisRuns.ts`] |

## Common Pitfalls

### Pitfall 1: No completed-to-pending-review bridge

**What goes wrong:** Phase 33 leaves a valid packet at `completed`, while decision actions accept only `pending_review`; the Reviews list is empty or the planner silently widens the transition graph. [VERIFIED: Phase 33 ordering; status graph]

**How to avoid:** Resolve one explicit guarded reconciliation boundary before implementation. It must require the unique packet, append one event, be safe under replay, and preserve Phase 33's completion semantics. [ASSUMED]

### Pitfall 2: Decision race creates two winners

**What goes wrong:** Two staff attempts both read pending and each appears successful, or one decision overwrites the other's actor/time. [ASSUMED]

**How to avoid:** Conditional status update plus unique decision row in one DB-authoritative operation; return the stored winner for losers. [VERIFIED: transition CTE precedent; [ASSUMED] decision implementation]

### Pitfall 3: Confirm accidentally calls legacy Accept

**What goes wrong:** A whole-run Confirm inserts a live `signal` or changes a `signal_proposal`, violating REV-03 and mixing v1.7 with the legacy Company proposal queue. [VERIFIED: `proposals.ts:107-137`; requirements]

**How to avoid:** Review action imports only new analysis-review query functions; add a static scope audit that rejects live Signal/Offering writes from Phase 34-owned paths. [VERIFIED: Phase 33 scope-audit pattern; [ASSUMED] Phase 34 audit extension]

### Pitfall 4: Candidate query includes unreviewed or dismissed packets

**What goes wrong:** Querying `analysis_run_result` without a positive confirmed predicate exposes completed, pending, failed, cancelled, or dismissed work. [VERIFIED: roadmap success criterion]

**How to avoid:** Positive `analysis_run.status = 'confirmed'` plus decision consistency; add fixtures for every excluded status. [VERIFIED: status contract; [ASSUMED] SQL test]

### Pitfall 5: Provenance is lost during aggregation

**What goes wrong:** Grouping by offering leaves no link back to the source or finding that justified the candidate. [ASSUMED]

**How to avoid:** Return normalized candidate evidence rows first or aggregate into an ordered provenance collection without dropping run/finding/source identity. [ASSUMED]

### Pitfall 6: Mutable catalog data changes historical meaning

**What goes wrong:** Review or aggregation re-resolves a finding by current signal name/category, so later catalog edits change what an old packet appears to mean. [VERIFIED: Phase 33 checklist identity contract]

**How to avoid:** Use snapshot `signalId`, target discriminator, and immutable packet source rows; use current links only as the existing catalog relationship required by REV-04. [VERIFIED: Phase 33 contract; user constraint]

### Pitfall 7: Persona retention is bypassed in Reviews

**What goes wrong:** Review queries read expired Persona packet rows directly, bypassing `getAnalysisPacket()` retention visibility. [VERIFIED: `analysisResults.ts:211-238`]

**How to avoid:** Route packet detail/provenance reads through the retention-aware read boundary or reproduce its server-side retention predicate exactly; never client-filter expired artifacts. [VERIFIED: Phase 33 retention contract]

## Runtime State Inventory

This is an additive review/projection phase, not a rename or data migration. [VERIFIED: phase scope]

| Category | Items found | Action required |
|---|---|---|
| Stored data | Legacy `agent_run`/`signal_proposal`/`correction`; Phase 32 `analysis_run`/events; Phase 33 immutable packet/result/finding/source/link/retention rows. [VERIFIED: schema and Phase 32/33 artifacts] | Add only the review decision boundary if needed; never migrate or repurpose legacy rows or mutate packet rows. |
| Live service config | Existing Clerk, Neon, Workflow, Firecrawl, model, and Langfuse configuration; no new Phase 34 service is required. [VERIFIED: Phase 33 verification and project constraints] | Reuse existing server config; no live provider smoke claim. |
| OS-registered state | None identified. [VERIFIED: Phase 32/33 runtime inventories] | None. |
| Secrets/env vars | Clerk identity, `DATABASE_URL`, provider/Firecrawl/Langfuse keys remain server-only. [VERIFIED: CLAUDE.md; Phase 33 artifacts] | Derive reviewer actor server-side; do not put secrets or raw Persona data in review responses/provenance. |
| Build artifacts/installed packages | Existing Next/Drizzle/Neon/Vitest/Playwright stack; no package addition is required. [VERIFIED: `package.json`; Phase 33 research] | No install or upgrade. |

## Environment Availability

No external dependency beyond the existing repository stack was identified. [VERIFIED: Phase 33 environment audit; no new package/service in this phase]

| Dependency | Required by | Available | Version | Fallback |
|---|---|---:|---|---|
| Node.js | Next/Drizzle/Vitest | ✓ | v22.23.1 | — [VERIFIED: Phase 33 environment audit] |
| npm | tests/build | ✓ | 10.9.8 | — [VERIFIED: Phase 33 environment audit] |
| Neon/Postgres | decision CTE and aggregation integration tests | configured; test URL must be supplied safely | existing `@neondatabase/serverless` 1.1.0 | Unit tests can run without DB; DB/concurrency gate must fail closed if `TEST_DATABASE_URL` is absent. [VERIFIED: `33-VERIFICATION.md:63-78`] |
| Clerk | staff auth | existing project/config | existing integration | Automated action tests mock the gate; live authenticated UAT remains required for final phase verification. [VERIFIED: CLAUDE.md; current actions] |

**Missing dependencies with no fallback:** None identified.  
**Missing dependencies with fallback:** `TEST_DATABASE_URL` is an execution prerequisite for database-backed proof, not a package blocker; do not claim concurrency/atomicity evidence without it. [VERIFIED: Phase 33 verification]

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Vitest with existing database integration conventions; Playwright for authenticated Reviews/reload smoke. [VERIFIED: `package.json`; Phase 33 artifacts] |
| Config | `vitest.config.ts`, `vitest.workflow.config.ts`, `playwright.config.ts`. [VERIFIED: Phase 33 research] |
| Quick run | `npm test -- src/lib/db/queries/analysisReviews.test.ts src/lib/db/queries/confirmedCandidates.test.ts src/app/actions/reviews.test.ts` (planned focused files). [ASSUMED] |
| Database gate | Existing guarded integration pattern using `TEST_DATABASE_URL`; prove atomic decision race and confirmed-only joins. [VERIFIED: Phase 33 verification] |
| Phase gate | Focused unit/action/query tests, guarded Neon integration/concurrency tests, `npx tsc --noEmit`, `npm run build`, scope audit, and authenticated Reviews UAT. [VERIFIED: Phase 33 gate shape; [ASSUMED] Phase 34 additions] |

### Requirements → Evidence/Test Map

| Req ID | Behavior to prove | Test type | Automated evidence/command | File status |
|---|---|---|---|---|
| REV-01 | Each completed packet yields one run-level Review item; duplicate list/reconciliation attempts do not duplicate it. | query + DB integration | `npm test -- src/lib/db/queries/analysisReviews.test.ts`; guarded integration test for unique run/result identity | Wave 0 gap [ASSUMED] |
| REV-02 | Confirm and Dismiss are whole-run, staff-attributed, one-winner under retries/competing attempts; packet hash/content remains unchanged. | pure state + DB concurrency + action | `npm test -- src/lib/db/queries/analysisReviews.test.ts src/app/actions/reviews.test.ts`; `TEST_DATABASE_URL=... npm test -- ...integration.test.ts` | Existing `reviews.test.ts` covers legacy actions only; new cases required. [VERIFIED: file inventory; [ASSUMED] new cases] |
| REV-03 | Review decision changes only review/run audit rows; no live Signal, signal-offering link, or legacy proposal writes. | static scope + DB snapshot | `npm exec tsx -- scripts/phase34-scope-audit.ts` plus before/after integration assertions | Wave 0 gap [ASSUMED] |
| REV-04 | Confirmed Company and Persona projections resolve existing links and return run/finding/source provenance. | query unit + DB integration | `npm test -- src/lib/db/queries/confirmedCandidates.test.ts`; guarded candidate join fixture | Wave 0 gap [ASSUMED] |
| REV-05 | queued/running/completed/pending_review/failed/cancelled/dismissed fixtures are absent; confirmed fixture is present. | DB integration + query contract | `npm test -- src/lib/db/queries/confirmedCandidates.test.ts` | Wave 0 gap [ASSUMED] |

### Required adversarial matrix

- Two concurrent Confirm attempts: exactly one transition/decision wins; both callers observe the same final decision and original actor. [ASSUMED]
- Confirm vs Dismiss race: exactly one terminal decision; loser cannot overwrite or create a second event. [ASSUMED]
- Retry after Confirm/Dismiss: idempotent read of the stored result; no packet or live catalog mutation. [ASSUMED]
- Completed run without packet: excluded/rejected, never promoted to review. [VERIFIED: Phase 33 persistence-before-completion]
- Packet exists but status is failed/cancelled/dismissed: candidate query returns no rows. [VERIFIED: REV-05]
- Company signal ID equals Persona signal ID: discriminator keeps links separate. [VERIFIED: `signalOfferingLinks.ts`]
- Retired/draft offering or signal link: candidate semantics must be explicitly tested; no review decision may change catalog status. [VERIFIED: existing catalog statuses; [ASSUMED] candidate display policy]
- Expired Persona packet: retention-aware read hides it from review/provenance/candidate results. [VERIFIED: Phase 33 retention query]

### Sampling rate and wave/order recommendation

1. **Wave 0 — resolve lifecycle bridge and lock contracts:** Decide how `completed` becomes `pending_review`; define decision enum/result contract, review-item uniqueness, candidate row/provenance contract, evidence-status eligibility, and scope-audit rules. Add pure tests first. [ASSUMED]
2. **Wave 1 — additive schema/query boundary:** Add the smallest review decision identity if needed; implement guarded reconciliation/decision CTEs and read-only review/candidate queries. Prove no packet update/delete and no Signal/Offering writes. [ASSUMED]
3. **Wave 2 — shared Reviews integration:** Add run-level packet cards/Confirm/Dismiss while preserving the legacy proposal queue and its action behavior. Gate page and actions independently with `requireStaffAccess()`. [VERIFIED: existing Reviews pattern; [ASSUMED] UI decomposition]
4. **Wave 3 — automated/database gate:** Run status/decision concurrency, packet immutability, provenance, exclusion, Persona retention, scope audit, typecheck, build, and guarded Neon integration. [ASSUMED]
5. **Wave 4 — authenticated manual UAT:** Verify one run appears once, inspect packet/source provenance, Confirm/Dismiss from two attempts, reload final state, and verify no live Signal/link row changed. Do not perform live provider execution; use completed packet fixtures because Phase 33 smoke is deferred. [VERIFIED: user constraint; [ASSUMED] UAT procedure]

**Per-task sampling:** focused pure/query/action test.  
**Per-wave sampling:** focused tests plus typecheck/build; database waves require `TEST_DATABASE_URL`.  
**Phase gate:** all automated tests and guarded DB evidence green, no Phase 34 scope-audit findings, then authenticated Reviews UAT.

## Security Domain

### Applicable ASVS Categories

| ASVS category | Applies | Standard control |
|---|---|---|
| V2 Authentication | yes | `requireStaffAccess()` first in Reviews page and every Confirm/Dismiss Server Action. [VERIFIED: current Reviews code] |
| V3 Session Management | yes | Use Clerk `userId` only as server-derived actor; do not pass sessions/cookies into queries, packets, candidate rows, or telemetry. [VERIFIED: CLAUDE.md; Phase 31/33 contracts] |
| V4 Access Control | yes | Query modules remain auth-free; action/page boundaries enforce staff access; candidate reads use server-side confirmed predicates. [VERIFIED: project conventions; [ASSUMED] candidate endpoint] |
| V5 Input Validation | yes | Positive run IDs and closed `confirmed|dismissed` decisions validated with Zod; all status/identity checks are server-side. [VERIFIED: existing route/action pattern; [ASSUMED] new schema] |
| V6 Cryptography | no new primitive | Reuse packet content hash for integrity; do not invent encryption or token handling. [VERIFIED: Phase 33 packet contract] |

### Known threat patterns

| Pattern | STRIDE | Mitigation |
|---|---|---|
| Double-click/concurrent reviewer race | Tampering | Conditional status transition, unique decision identity, atomic CTE, winner-preserving replay response. [ASSUMED] |
| Unauthorized direct Server Action call | Elevation | `requireStaffAccess()` before parsing or DB work. [VERIFIED: current actions] |
| Candidate leakage from non-confirmed packet | Information disclosure | Positive confirmed-only DB predicate and exclusion matrix. [VERIFIED: REV-05] |
| Review action writes live catalog | Tampering | Separate query module, static scope audit, before/after DB assertions; never import legacy `acceptProposal`. [VERIFIED: legacy path; user constraint] |
| Provenance forgery | Tampering / information disclosure | Source rows and finding-source links are server-persisted Phase 33 artifacts; candidate query never accepts source IDs from client. [VERIFIED: Phase 33 contract; [ASSUMED] endpoint design] |
| Expired Persona evidence | Information disclosure | Reuse retention-aware packet read and expiry/tombstone predicates. [VERIFIED: `analysisResults.ts:211-251`]

## Explicit Scope Fence

In scope: run-level Review listing for completed packet rows, one staff-attributed Confirm/Dismiss decision, idempotent/replay-safe terminal state, additive review query/schema boundary, immutable packet inspection/provenance reads, confirmed-only Company/Persona candidate-offering projection via existing links, and automated/DB/auth verification of these invariants. [VERIFIED: roadmap, requirements, user request]

Out of scope: modifying Phase 33 packet/result/finding/source/link schemas except additive references needed for review, executing providers or Firecrawl, changing model/policy contracts, writing Signals or signal-offering links, legacy proposal migration, per-finding review, bulk/scheduled execution, auto-confirmation, CRM/outreach, target-record UX, template management, and final end-to-end verification. [VERIFIED: user request; `.planning/REQUIREMENTS.md:49-75`; Phase 33 verification]

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | Add a unique `analysis_run_review` row keyed by run/result rather than relying only on `analysis_run_event`. | Proposed Additive Boundary | Planner may overbuild schema or miss a required direct review-item uniqueness guarantee. |
| A2 | Reconcile `completed → pending_review` in Phase 34 rather than changing Phase 33's completion transition. | Proposed Additive Boundary | Without a bridge, actions cannot use the existing locked transition graph; changing Phase 33 would violate the completed packet handoff. |
| A3 | Candidate evidence should include strong/weak findings with source links and exclude no_evidence/inconclusive. | Candidate projection | Product may intend Confirm to expose every finding; aggregation semantics would change. |
| A4 | A collapsed offering result should retain an ordered provenance array rather than discard duplicate evidence rows. | Candidate projection | UI/query contract may prefer flat rows or a separate provenance endpoint. |
| A5 | A shared Reviews page can add a run-level section while preserving the legacy proposal queue. | Existing boundary inventory | Product may require a separate v1.7 review route, changing navigation/UI planning. |
| A6 | Active offerings are the default candidate display filter while historical links remain readable. | Candidate projection | Product may require retired offerings to remain visible for historical provenance. |

## Open Questions (RESOLVED)

1. **How is a Phase 33 `completed` run promoted to `pending_review`?** **RESOLVED:** Phase 34 owns an idempotent, packet-required `completed → pending_review` reconciliation bridge. Phase 33's packet persistence ordering and transition graph are unchanged. [D-34-01; VERIFIED: status graph and Phase 33 gate]
2. **Does Confirmed candidate aggregation include only `strong`/`weak` evidence-backed findings, or every finding in a confirmed packet?** **RESOLVED:** Include only `strong` and `weak` findings with persisted `analysis_finding_source` links to persisted sources; exclude `no_evidence` and `inconclusive`. [D-34-03]
3. **Should retired offerings remain in candidate projections as historical candidates, or should the view show only currently active offerings?** **RESOLVED:** Display active offerings by default while retaining retired/draft historical link identity and provenance; do not silently reclassify historical identities. [D-34-04]

## Sources

### Primary (HIGH confidence)

- `.planning/ROADMAP.md:126-137,465-498` — milestone goal, Phase 34 goal/dependencies/requirements/success criteria, and Phase 35/36 fences. [VERIFIED: planning file]
- `.planning/REQUIREMENTS.md:34-47,49-75` — REV-01..05 and future/out-of-scope review boundaries. [VERIFIED: planning file]
- `.planning/phases/33-grounded-analysis-execution-evidence/33-CONTEXT.md` — immutable packet, no live writes, policy and execution boundaries. [VERIFIED: planning file]
- `.planning/phases/33-grounded-analysis-execution-evidence/33-VERIFICATION.md` — automated/database pass and explicitly deferred live smoke. [VERIFIED: planning file]
- `.planning/phases/32-template-snapshot-run-ledger/32-RESEARCH.md` and `32-CONTEXT.md` — status graph, CTE atomicity, additive legacy compatibility, and auth/query patterns. [VERIFIED: planning files]
- `src/lib/db/schema.ts` — legacy rows, signal/offering catalog, analysis-run lifecycle, immutable packet tables, and provenance relations. [VERIFIED: codebase]
- `src/lib/db/queries/analysisRuns.ts`, `analysisResults.ts`, `signalOfferingLinks.ts`, `offerings.ts` — guarded lifecycle, packet read/write, polymorphic links, and offering query seams. [VERIFIED: codebase]
- `src/app/(dashboard)/reviews/page.tsx`, `src/app/actions/reviews.ts`, `src/components/reviews/review-queue.tsx` — current shared Reviews page/action/UI/auth behavior. [VERIFIED: codebase]
- `src/lib/analysis/contracts.ts` — exact analysis statuses and transition graph. [VERIFIED: codebase]
- `CLAUDE.md` — project constraints, auth, strict TypeScript, additive boundaries, and server-only values. [VERIFIED: project instructions]

### Secondary (MEDIUM confidence)

- None required. The phase-specific architectural facts are covered by repository artifacts and current source.

### Tertiary (LOW confidence)

- None. Unimplemented review-table/projection choices are explicitly marked `[ASSUMED]` rather than presented as ecosystem facts.

## Package Legitimacy Audit

No package installation or new dependency is recommended for Phase 34. Existing Drizzle/Neon/Vitest/Playwright/Next.js dependencies are sufficient. [VERIFIED: package manifests and Phase 33 research]

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — no new stack; existing DB/query/auth/test seams are verified in source and Phase 33 gates.
- Architecture: **HIGH** for immutable packet consumption, auth boundaries, no-live-write rule, and confirmed-only positive filtering; **MEDIUM** for the new review-row and completed-to-pending-review bridge.
- Pitfalls: **HIGH** for legacy/live-write, status, discriminator, retention, and packet immutability hazards; **MEDIUM** for final candidate grouping/display semantics.

**Research date:** 2026-08-08  
**Valid until:** 2026-08-22, or until Phase 33/34 status/schema contracts change.
