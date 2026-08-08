# Phase 33: Grounded Analysis Execution & Evidence — Context

**Gathered:** 2026-08-07  
**Status:** deferred

## Phase boundary

Replace only the Phase 32 no-op completion branch with bounded, durable,
source-grounded execution. A claimed run reloads its immutable Phase 32
snapshots, uses the existing `modelFactory`/`instantiateChain` and Firecrawl
`webSearchTool` seams, validates a server-owned packet, persists immutable
result/finding/source/link rows, and transitions the database ledger to
`completed` only after persistence succeeds.

Phase 33 does not add review decisions, candidate writes, UI, template
management, bulk/scheduled execution, live Signal/Offering writes, or
chain-of-thought storage.

## Locked decisions

- **D-33-01:** The only model/provider boundary is the existing
  `modelFactory`/`instantiateChain` path. The only research tool is the existing
  Firecrawl-backed `webSearchTool`. Exa and every new provider/SDK are forbidden.
- **D-33-02:** Workflow input remains the scalar `applicationRunId: number`.
  Workflow metadata is diagnostic only; `analysis_run` and its append-only
  events remain product truth.
- **D-33-03:** Phase 32 snapshots are immutable replay inputs. Execution must
  reload them from the database and must not read mutable settings or current
  signal names to reinterpret a run.
- **D-33-04:** Result persistence is additive and immutable. Do not reuse or
  migrate `agent_run`, `signal_proposal`, Reviews, or live Signal/Offering
  tables. Packet persistence must be Neon-http-safe and atomic; do not use the
  unsupported interactive `db.transaction` callback.
- **D-33-05:** Evidence is server-derived from actual Firecrawl results. Exact
  canonical source identity, bounded retrieved content/excerpt, content hash,
  finding linkage, and closed validation rules are required. Unsafe,
  unsupported, malformed, unlinked, or unsupported citations fail closed.
  Deterministic canonical duplicates collapse to the first source; duplicate
  finding-source links are rejected and never persisted.
- **D-33-06:** Persona execution fails closed unless an explicitly approved
  policy version supplies minimum input fields, redaction rules, classifications,
  and retention duration. No planner or executor may invent policy values.
- **D-33-07:** Raw audit output means a redacted, allowlisted structured attempt
  record only. Raw prompts, unrestricted outputs/web content, credentials,
  Clerk/session values, database URLs, full Persona rows, PII, and private
  reasoning are never persisted or sent to telemetry.

## Blocking product decisions

The execution plan contains a blocking decision checkpoint before real execution
is enabled. The approver must explicitly record:

1. Phase 33 policy version and limits for attempts, Firecrawl/tool calls,
   execution wall time, source count/bytes/excerpt size, and spend.
2. Whether Persona execution is enabled; if enabled, the exact allowlisted
   fields, redaction/classification policy, retention duration, and policy
   version.
3. Whether bounded excerpts plus content hashes are the complete stored source
   artifact, and the allowlisted raw-audit fields/visibility.

Until these values are approved, contracts may be built and tested, but the
execution policy validator must reject real Company/Persona execution with a
safe policy-unavailable reason; no silent defaults are permitted.

## Policy Decision Record

```yaml
status: deferred
policyVersion: null
executionEnabled: false
personaExecutionEnabled: false
approvedBy: null
approvedAt: null
limits: null
personaPolicy: null
retention: null
evidenceStorage: bounded_excerpt_and_content_hash
auditVisibility: allowlisted_safe_metadata_only
deferredReason: awaiting_named_product_cost_privacy_approval
```

This record is intentionally an explicit fail-closed state, not an approved
policy. A human checkpoint may replace it with a complete `status: approved`
record only when every required field is populated.

## Inherited implementation seams

- Phase 31 proved the Vercel Workflow executor and scalar, database-authoritative
  lifecycle.
- Phase 32 provides `analysis_run`, immutable template/subject/checklist/
  execution/policy snapshots, guarded transitions, and the no-op handoff.
- Neon HTTP persistence must use the already-proven single-statement CTE or an
  equally proven atomic mechanism; independent inserts are prohibited.

## Phase 33 policy handoff

The Phase 32 no-op policy remains valid for existing no-op fixtures and already
created runs. Phase 33 adds a separate versioned policy snapshot constructor at
the Phase 32 run-creation boundary. It never mutates an existing snapshot or
changes a replay's interpretation. A new run receives either:

- an explicitly approved `phase33_grounded` policy snapshot with execution
  enabled; or
- an explicit `phase33_policy_deferred` snapshot with execution disabled and a
  safe `policy_unavailable` reason.

No exact limits or Persona values are invented in this artifact.

## Checkpoint Decision — 2026-08-07

The blocking product/privacy decision was reached with no explicit named
approver or complete policy values available. The executor must continue only
with contract-only, fail-closed work; it must not enable model or Firecrawl
execution and must not retain Persona artifacts.

```yaml
status: deferred
policyVersion: null
executionEnabled: false
personaExecutionEnabled: false
approvedBy: null
approvedAt: null
limits: null
personaPolicy: null
retention: null
evidenceStorage: bounded_excerpt_and_content_hash
auditVisibility: allowlisted_safe_metadata_only
deferredReason: awaiting_named_product_cost_privacy_approval
```

## Open Questions (RESOLVED)

1. **Policy values:** **Disposition — blocking human decision.** The policy
   record uses `status: deferred`, `executionEnabled: false`, and null approval
   values until a named product/cost/privacy approver records a complete
   versioned policy. The executor remains fail closed; approval is not implied
   by the plan.
2. **Persona retention/classification:** **Disposition — fail closed pending
   approval.** No Persona packet, source, audit, or telemetry is retained when
   policy is absent. If approved, every Persona artifact carries the approved
   policy version/classification and expiry, and a server-side retention query
   path hides/ tombstones expired artifacts. The duration and allowed fields are
   human-supplied, never planner defaults.
3. **Evidence storage:** **Disposition — bounded excerpts plus content hash.**
   Persist canonical navigable URL, title, retrieval time, bounded supporting
   excerpt, content hash, and classification. Full retrieved documents are not
   persisted unless a later explicit decision changes this boundary.
4. **Citation tolerance:** **Disposition — strict v1.7 identity.** A finding
   citation must resolve to an exact canonical URL/content hash from the
   server-derived search/retrieval set. Legacy AIRS suffix/parent matching stays
   isolated and is not reused for Phase 33.
5. **Audit visibility:** **Disposition — allowlisted safe audit only.** Store
   structured attempt/model/tool/timing/count/trace metadata and safe reason
   codes; do not store raw prompts, unrestricted outputs, raw web content,
   credentials, PII, or private reasoning. Staff visibility is limited to the
   later packet read model, not hidden model reasoning.
