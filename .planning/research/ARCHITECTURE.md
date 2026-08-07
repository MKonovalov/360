# Architecture Patterns

**Domain:** Reusable, source-grounded buying-signal agents for Company and Persona subjects  
**Researched:** 2026-08-06  
**Confidence:** HIGH for existing integration points; MEDIUM for the new generalized schema, pending phase-level migration design.

## Recommended Architecture

Build a **durable, provider-agnostic agent-run pipeline**. A template selects a subject kind and an active signal-derived analysis schema; a run is created *before* execution and moves through durable statuses; an executor returns a normalized, source-grounded result; and exactly one run-level proposal is submitted to the existing Reviews surface. Only approving that proposal materializes its candidate-offering aggregation. Raw model output, sources, and findings remain immutable run artifacts.

```text
Company/Persona detail → preview-and-run Server Action
  → authenticate + validate subject/template + snapshot active signal schema
  → create agent_run(status=queued, immutable input/template/schema/model snapshot)
  → enqueue/dispatch in-house research executor
  → executor fetches sources and calls provider-agnostic execution contract
  → persist normalized result + citations + findings + status=completed|failed
  → create ONE review proposal for the completed run
  → /reviews (existing queue) approves or dismisses the run as a whole
  → approved-only aggregation joins approved findings to candidate offerings
  → Company/Persona detail displays approved candidates; history displays all runs
```

The trust boundary is deliberate: **the agent may propose facts and associations, but it may not write live Signals, Offering links, or candidate offerings directly.** The review decision is the only transition that makes a run eligible for downstream aggregation. This preserves the existing Phase 9 fail-closed principle while changing the unit of review from one signal proposal to one completed run.

### Component Boundaries

| Component | Responsibility | Communicates With |
|---|---|---|
| Agent template management | Stores reusable template metadata, subject applicability, instructions/configuration, and lifecycle state. Templates are configuration, not executable code. | Signals query layer; template UI; run starter |
| Runtime signal-schema derivation | Reads only active Company or Persona signal definitions and emits the typed schema/prompt context for a given template/run. Snapshots the derived schema into the run. | `companySignal` / `personaSignal`; run creator; executor |
| Run orchestration | Authenticates staff, validates template/subject pairing, snapshots all inputs, creates queued run, dispatches async work, and exposes status/history. | Clerk; templates; subject queries; executor; run queries |
| Provider-agnostic executor contract | Accepts normalized run input and returns normalized findings, citations, provider/model audit data, and a terminal outcome. It owns no DB or review writes. | Existing in-house web research + `modelFactory`/`runAgent` seam; orchestration |
| Result persistence | Stores immutable run artifacts: normalized result, source records, finding records, error/status timestamps, model chain/used model, trace references. | Executor; review-proposal writer; history/detail queries |
| Run-level review adapter | Creates one review item for a completed run and performs atomic approve/dismiss state transition. Approval is the gate for aggregation; dismissal never mutates candidate offerings. | Existing reviews page/queue; result/run records; aggregation queries |
| Approved-result aggregation | Queries only findings whose parent run has an approved run-level review; resolves their signal-to-offering relationships for Company/Persona candidate-offering UI. | findings; review state; `signalOfferingLink`; offerings |
| UI surfaces | Detail actions (preview/run), run history/status, findings/source viewer, candidate offerings, and Manage > Reviews > Agents template management. | Server Actions; read models; existing `ReviewQueue` |

## Existing Integration Points to Inspect

| Existing point | Current responsibility | v1.7 integration decision |
|---|---|---|
| `src/lib/agents/analyzeCompany.ts` | Loads a Company and live signal instances, snapshots model settings, runs an agent, derives tool-grounded appendix, validates output, and deduplicates proposals. | Extract the reusable execution-independent parts: model-chain snapshot, artifact gate, evidence derivation, and error classification. Do **not** extend this Company-only function into the new domain model; implement a subject-neutral adapter and retain it as the legacy analytic-agent path until migrated. |
| `src/lib/agents/runAgent.ts` | The existing in-house `ai@7` web-search loop with bounded time, model failover, structured output, and model-used audit. | Keep it behind the new executor contract as the first provider/execution implementation. The new contract must accept a serialized subject/schema/prompt input and return a normalized output—not expose `LanguageModel`, Vercel request details, or Drizzle rows to templates. |
| `src/lib/agents/modelFactory.ts`, model settings/catalog | Provider selection, fallback chain resolution, key gate, and actual model identity. | Reuse unchanged at the executor boundary. Snapshot resolved `model_chain` at run creation and persist `model_used` at completion; provider selection must not become template configuration. |
| `src/lib/db/schema.ts`: `agentRun`, `signalProposal`, `correction` | Company-only, completion-only run audit plus per-proposal reviews/corrections. | Evolve `agent_run` carefully or introduce generalized companion tables. It currently requires `company_id` and lacks status, subject discriminator, template/schema snapshot, and result relationships; it cannot be the sole v1.7 primitive unchanged. Reuse review concepts, not `signalProposal` as the generalized finding model. |
| `src/lib/db/queries/runs.ts` | Inserts a completed analytic run; no state machine. | Replace/extend with `createQueuedRun`, guarded terminal completion/failure, status/history reads, and immutable artifact inserts. Do not overload `createRun` with a partial row that is externally visible as completed. |
| `src/lib/db/queries/proposals.ts` and `corrections.ts` | One `signalProposal` is accepted/rejected; accept immediately writes a live Company `signal`. | Do not route v1.7 through `acceptProposal`: its side effect violates the run-wide human gate and cannot represent Persona subjects/candidate offerings. Create a run-level review adapter with conditional, idempotent decision updates. |
| `src/app/(dashboard)/reviews/page.tsx`, `src/components/reviews/review-queue.tsx` | Existing review list and per-proposal decision UI. | Add a discriminated review item/read model and a run-review card; retain legacy signal-proposal cards. One card represents one complete run, exposes result summary and sources, and produces one approve/dismiss decision. |
| `companySignal`, `personaSignal`, `signalOfferingLink`, `offering` query modules | Active signal taxonomy and manually managed signal-to-offering associations; link insertion guards practice-area compatibility. | Make active signal definitions the sole runtime schema input. Candidate offerings are **read-time, approved-only** resolution through existing links; the agent must not insert or alter links. The polymorphic link discriminator must always be paired with its signal ID. |
| Company/Persona detail explorers and `ExplorerMenu` | Existing Company Analyze entry point and record detail presentation. | Add equivalent Company/Persona preview-and-run actions; show durable history, terminal result/source detail, pending-review state, and approved candidate offerings. Avoid client-side polling as the source of truth; re-fetch server state or use bounded polling only as a presentation mechanism. |
| Langfuse telemetry | Existing trace IDs/URLs and correction annotation mirror. | Continue recording traces as observability references, but store source/finding/result facts in Neon as the product audit source. A trace may be unavailable; its absence must not erase durable review evidence. |

## Data Flow

### 1. Trigger through durable execution

1. A staff member selects an enabled template from a Company or Persona record, previews the derived active-signal schema and subject input, then submits Run.
2. The Server Action calls `requireStaffAccess()`, loads the subject server-side, verifies the template applies to that subject kind, and derives the signal schema from **active** signal definitions only.
3. In one durable creation boundary, persist `agent_run` as `queued` with: subject type/id, template version/snapshot, derived schema snapshot, normalized subject input snapshot, requesting user, resolved model-chain snapshot, and timestamps. Return the run ID immediately.
4. Dispatch the run to the in-house executor. The run worker reads the immutable snapshot rather than live subject/template/signal rows, gathers sources, and invokes the existing web-research/model path through the new contract.
5. Validate the normalized executor result. Persist source rows and finding rows with their source references, then conditionally transition the run to `completed`; on any terminal failure, persist a safe error code/message and transition to `failed`. Never leave an ambiguous in-progress row without a recovery policy.

### 2. Result to one review decision

1. Only a successfully completed, validation-passing run can create one `review_proposal`/review item keyed uniquely by `run_id`.
2. The review card exposes the complete finding set, citations, template/schema snapshots, and model/trace audit—not an editable subset that can accidentally approve only favorable findings.
3. Approve or dismiss is a conditional update from `pending` only. Approval records reviewer ID/time; dismissal records reviewer ID/time and optional structured rationale. Repeated submissions are idempotent/no-op.
4. No completion or pending-review state is a valid input to candidate-offering aggregation.

### 3. Approved aggregation to subject views

1. Candidate-offering queries start from run findings whose run review is `approved`.
2. For each finding’s derived signal identity, resolve existing `signal_offering_link` using both `signal_type` and `signal_id`; join offering metadata and deduplicate offerings per subject/run as appropriate for the UI.
3. Return evidence provenance (run, finding, source/citation, review timestamp) with every candidate offering. The Company/Persona detail can therefore explain *why* an offering appears.
4. A dismissed run, failed run, stale run, or finding without a valid active signal/link yields no candidate offering. This is a query-level fail-closed invariant, not merely a hidden UI button.

## Schema and Query Changes

### Recommended normalized primitives

Use generalized tables rather than JSON-only result blobs. Keep JSON snapshots for replay/audit, but normalize entities the UI and aggregation must query.

| Primitive | Essential fields / invariants | Purpose |
|---|---|---|
| `agent_template` | id, name, subject_type (`company`/`persona`), status, instructions/config JSON, version, created/updated audit | Reusable constructor configuration. Enforce subject discriminator and soft-disable rather than deleting templates referenced by runs. |
| `agent_run` (generalized) | id, template_id, template_version/snapshot, subject_type, subject_id, status (`queued`,`running`,`completed`,`failed`,`cancelled`), input/schema snapshots, requested_by, model_chain, model_used, trace refs, started/completed timestamps, error code/message | Durable lifecycle and replayable audit record. The existing required `company_id` must be migrated away or made nullable only with a safe backfill/constraint plan. |
| `agent_result` | run_id unique, normalized summary/verdict JSON, validation version, created_at | One immutable completed-result envelope. Optional if fields live on run, but separate table avoids mutation of lifecycle rows. |
| `agent_source` | result/run FK, canonical URL, title/publisher, excerpt, retrieved_at, content hash/locator | Source-grounded audit; citations must reference a persisted source row, not arbitrary model text. |
| `agent_finding` | result/run FK, signal_type, signal_id (or stable signal key), conclusion/strength/confidence, rationale, source references, ordinal | Queryable proposed buying-signal finding. Validate signal identity against the run’s schema snapshot and active taxonomy at execution time. |
| run review/proposal extension | `run_id` unique, status (`pending`,`approved`,`dismissed`), reviewer audit, decision rationale | One existing-model-compatible review record per run. Prefer a new discriminated review table/read model or add a safe `kind`/`run_id` extension; do not distort `signal_proposal`’s Company-specific fields. |

Required indexes: `(subject_type, subject_id, created_at desc)` for history; `(status, created_at)` for recovery/queue work; unique review `run_id`; findings by `(run_id, signal_type, signal_id)`; and review-approved aggregation join indexes. Use foreign keys where a fixed table is known (template/run/result/source) but retain the existing explicit discriminator + ID discipline for polymorphic Company/Persona and Company/Persona-signal references.

### Query contracts

- **Derive schema:** `listActiveCompanySignals...` / `listActivePersonaSignals...`-style queries must produce deterministic ordered definitions; never ask the model to invent the signal taxonomy.
- **Create/claim/complete run:** lifecycle queries must condition on expected state to avoid two workers completing the same run. A worker claim must be lease/recovery-aware if execution is off-request.
- **Review decision:** a single guarded decision function owns the transition and writes reviewer audit. It must not call any live Signal or `signalOfferingLink` write function.
- **Candidate offerings:** expose one query named to encode the security invariant (for example, `listApprovedCandidateOfferingsForSubject`), not a generic findings-to-offerings join that callers can use without the approved predicate.

## UI and Route Boundaries

| Surface | Required state / behavior |
|---|---|
| Company and Persona detail | Template picker; preview of frozen subject/schema scope; Start Run; history with queued/running/completed/failed/review state; findings and sources; only approved candidate offerings. |
| Run detail | Immutable audit timeline: request, template/schema/model snapshots, execution status, result/failure, sources, findings, review decision. It is the canonical deep link from history and Reviews. |
| Reviews | Mixed, discriminated queue: legacy per-signal proposals plus v1.7 one-run review cards. Each run card has exactly Approve/Dismiss; it cannot expose per-finding accept as a substitute. |
| Manage > Reviews > Agents | Templates only: create/edit/enable/disable and subject applicability. No provider secret/model SDK wiring; settings remain the user model configuration surface. |
| Async status | Start returns a run ID and renders durable server state. Polling/revalidation may improve responsiveness, but page reload and another user’s session must see the same state. |

## Patterns to Follow

### Pattern 1: Snapshot then execute
**What:** Persist template version, active-signal schema, subject input, and resolved model chain before async work begins.  
**When:** Every run, including retries.  
**Why:** Existing `analyzeCompany` already snapshots model settings at entry to prevent mid-run changes. v1.7 must extend that audit guarantee to template and taxonomy changes.

### Pattern 2: Provider-agnostic port, provider-specific adapter
**What:** Define an app-owned executor input/output contract; put `runAgent`, Firecrawl tools, `modelFactory`, AI SDK types, and provider failures behind its adapter.  
**When:** Running the first GBS templates and any later execution provider.  
**Why:** Templates and persistence should operate on stable domain structures, while v1.3–v1.5’s model-chain/failover capability remains reusable without leaking provider SDK types.

### Pattern 3: Approval-gated read model
**What:** Candidate offering UI reads only from approved run reviews via a dedicated query.  
**When:** Every Company/Persona offering candidate query.  
**Why:** This enforces the human-review requirement below the UI layer and makes audit provenance available naturally.

### Pattern 4: Terminal state machine with recovery
**What:** `queued → running → completed|failed|cancelled`, with conditional transitions, timestamps, and an explicit stale-run recovery/expiry policy.  
**When:** All dispatch paths.  
**Why:** The current route-driven analytic agent completes during the request and has no durable status. A new async model otherwise risks permanent `running` rows after a Vercel timeout/crash.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Reusing `signalProposal` as the v1.7 finding table
**Why bad:** It is Company-only, represents a live-signal write candidate, and its `acceptProposal` side effect immediately inserts into `signal`. It cannot express a Persona analysis, many findings reviewed as one decision, or approved-only offering aggregation.  
**Instead:** Keep legacy signal proposals intact; add generalized run/finding/source primitives and a run-level review adapter.

### Anti-Pattern 2: Deriving candidate offerings from every completed run
**Why bad:** A completed model output is not an approved business finding. Filtering only in React makes hidden/alternate clients able to bypass the policy.  
**Instead:** Require approved review status inside the query contract and return provenance.

### Anti-Pattern 3: Persisting only raw model JSON or Langfuse trace URLs
**Why bad:** Result views, review cards, source provenance, and offering aggregation need stable relational queries. External trace retention/access is not the product audit source.  
**Instead:** Normalize run/result/source/finding records; retain raw payload/trace reference as supplementary audit data.

### Anti-Pattern 4: Long-running work inside the preview/run request
**Why bad:** Existing `runAgent` intentionally budgets 54 seconds beneath Vercel’s 60-second route limit. General agents with durable statuses require execution that survives response lifecycle and can be retried/recovered.  
**Instead:** Persist first, then dispatch through the in-house async mechanism; phase-specific research must confirm the available Vercel-compatible worker/queue facility and its delivery semantics.

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---|---|---|---|
| Run dispatch | In-process/managed async dispatch with status polling may suffice if reliable. | Queue with leases, retries, and concurrency control. | Partitioned worker fleet, rate limits per tenant/provider, and event-driven status delivery. |
| Sources/findings | Normalized rows and subject-history indexes. | Deduplicated source canonicalization/content hashes; retention policy. | Object storage for large captures plus searchable metadata. |
| Candidate offerings | Approved-only joins with targeted indexes. | Materialized/read-model cache invalidated on review decisions. | Event-built projection per subject with provenance graph. |
| Audit/observability | Neon rows + Langfuse links. | Immutable event/audit stream and retention policies. | Warehouse/analytics export and access-controlled evidence storage. |

## Dependency-Respecting Build Sequence

1. **Generalized durable model and lifecycle** — design/migrate templates, subject-neutral runs, results, sources, findings, and one-per-run review state; add status/recovery query contracts. This must precede UI and executor work because it fixes the audit boundary.
2. **Runtime schema derivation and executor contract** — derive deterministic Company/Persona signal schemas, define input/output validators, then adapt the existing in-house `runAgent`/model-factory/web-search path. Test source-to-finding validation before dispatching real runs.
3. **Async orchestration and completion gate** — preview/create/dispatch/claim/complete/fail path, immutable snapshots, source/result persistence, and automatic creation of exactly one pending run review. Research the production queue/worker choice here.
4. **Review integration and approved-only aggregation** — extend Reviews with a run-level decision, implement guarded decision actions, then introduce the dedicated approved candidate-offering query. Prove dismissed/pending/failed runs never appear as candidates.
5. **Company and Persona user flows** — wire preview/run, history/status, result/source views, and confirmed candidate-offering panels for both subject kinds using the shared contracts.
6. **Manage > Reviews > Agents and verification** — template lifecycle UI plus end-to-end tests: Company/Persona execution, crash/retry recovery, one-review uniqueness/idempotency, source provenance, and the negative policy test that unapproved findings cannot affect candidates.

**Ordering rationale:** Phase 1 establishes durable IDs and legal state transitions; Phase 2 makes the agent input/output trustworthy and portable; Phase 3 can then execute asynchronously without inventing state ad hoc; Phase 4 establishes the business safety gate before any candidate UI; Phase 5 becomes straightforward composition; Phase 6 verifies the full audit and policy boundary.

## Sources

- **HIGH — existing code:** `src/lib/agents/analyzeCompany.ts` (snapshot, validation, evidence, dedup flow); `src/lib/agents/runAgent.ts` (in-house web research, provider failover, 54s execution budget).
- **HIGH — existing code:** `src/lib/db/schema.ts` (`agent_run`, `signal_proposal`, `correction` constraints); `src/lib/db/queries/runs.ts`, `proposals.ts`, and `corrections.ts` (current write/review semantics).
- **HIGH — existing code:** `src/lib/db/queries/signalOfferingLinks.ts`, `companySignals.ts`, and `src/app/actions/signals.ts` (active taxonomy and polymorphic offering-link invariant).
- **HIGH — project record:** `.planning/PROJECT.md` v1.7 goal/locked direction and Phase 9/19–25 architecture decisions.

## Research Flags

- Confirm and design the actual Vercel-compatible async execution/queue mechanism before Phase 3; this is the main remaining architectural uncertainty.
- Decide whether `agent_run` is migrated in place or superseded by a generalized table after inspecting live data/migrations. Preserve existing analytic-agent history and foreign keys either way.
- Define exact stable signal identity for findings (numeric signal row vs. snapshot key) and archival semantics when a signal is retired after a run completes.
- Confirm whether review schema can be safely generalized with a discriminator or should use a companion run-review table; do not contaminate legacy `signalProposal` acceptance semantics.
