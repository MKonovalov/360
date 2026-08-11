<!-- generated-by: gsd-doc-writer -->
# Phase 38: Execution Compatibility & Safe Integration - Context

**Gathered:** 2026-08-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 38 integrates active custom agents into the existing v1.7 analysis
pipeline, but only after server-owned compatibility checks succeed and the
selected immutable agent version plus resolved execution inputs are captured
in an immutable run snapshot. It owns the compatibility and launch-resolution
boundary for VER-03, VAL-02 through VAL-05, RUN-01, and RUN-02. It does not
change the fixed v1.7 templates, the durable executor, the modelFactory or
Firecrawl/provider-agnostic research boundary, the server-owned capability and
policy boundary, whole-run review, confirmed-only candidate projection, or the
no-direct-live-write rule.

The launch flow is intentionally narrow: staff select a Practice Area first,
then choose the fixed v1.7 template or a compatible active custom agent. The
fixed v1.7 template remains the default. A custom agent can be selected only
when its target type and configured Practice Area match the current Company or
Persona launch context. If no custom agent is selected, the existing fixed-
template path remains unchanged.

</domain>

<decisions>
## Implementation Decisions

### Launch Resolution

- **D-38-01:** Practice Area is selected first.
- **D-38-02:** The agent picker then includes the fixed v1.7 template plus matching active custom agents.
- **D-38-03:** The fixed v1.7 template remains the default.
- **D-38-04:** Custom agents are filtered by target type and selected Practice Area.
- **D-38-05:** Multiple active custom agents for the same target type + Practice Area are allowed; staff explicitly chooses one.
- **D-38-06:** If no custom agent is selected, the existing fixed-template path remains unchanged.

### Compatibility and Trust Boundaries

- **D-38-07:** An active custom agent may enter the existing v1.7 pipeline only after compatibility checks reject incompatible target type, Practice Area/signal mismatch, invalid effort, unsupported capability, or policy-invalid structured configuration before an active run is created.
- **D-38-08:** Fixed-template compatibility remains a regression boundary. Both fixed v1.7 templates must continue to use their existing target-scoped launch, evidence, run-history, review, and candidate surfaces.
- **D-38-09:** Custom execution reuses the existing durable executor, modelFactory, and Firecrawl/provider-agnostic contract. Staff-authored configuration cannot select arbitrary providers, tools, or server capabilities, and Exa or another research provider is not added.
- **D-38-10:** Every successful run remains subject to the existing whole-run review contract. Candidate offerings remain confirmed-only, with run/version/finding/source provenance; pending, failed, cancelled, and dismissed output is excluded.
- **D-38-11:** Custom execution never writes live Signals or signal-offering links directly. Review and candidate projection remain read-only/downstream boundaries as defined by v1.7.

### Snapshot Boundary

- **D-38-12:** A compatible launch must snapshot the selected immutable custom-agent version and the server-resolved launch/execution inputs before durable execution. Later custom-agent edits must not change that run, its result, evidence, or review packet.
- **D-38-13:** The discussion resolved launch resolution only. Exact snapshot contents beyond the already-required immutable version and resolved inputs, structured-output integration details, and the final verification boundary remain research/planning discretion or later discussion unless already locked by requirements or prior phase context.

### Claude's Discretion

- Exact query, contract, action, component, and response-shape names for resolving Practice Area-first options and carrying the selected agent into preview and launch.
- Exact compatibility-check decomposition and error taxonomy, provided rejection happens before active-run creation and preserves fail-closed behavior.
- Exact extension of the existing snapshot builder and run-ledger inputs, provided immutable history, server-derived policy, model-chain resolution, bounded execution, and fixed-template behavior remain intact.
- Exact structured-output adapter and verification seams, subject to VAL-05's bounded schema policy and the explicit unresolved status above.
- Exact automated fixture/test partitioning and authenticated verification handoff to Phase 39, without reclassifying prerequisite-gated v1.7 evidence as passed.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and phase scope

- `.planning/REQUIREMENTS.md` — VER-03, VAL-02 through VAL-05, RUN-01, RUN-02; fixed-template compatibility, server-owned capabilities, review, confirmed-only, and out-of-scope constraints
- `.planning/ROADMAP.md` — Phase 38 goal, dependencies, requirements, and success criteria
- `.planning/STATE.md` — accumulated v1.7 durability, snapshot, evidence, review, candidate, fixed-template, and Phase 37 custom-agent decisions; unresolved TEST_DATABASE_URL evidence must not be silently reclassified
- `.planning/PROJECT.md` — v1.8 milestone boundary, locked execution direction, and explicit deferred capabilities

### Inherited phase decisions

- `.planning/phases/37-custom-agent-definition-versioning-lifecycle/37-CONTEXT.md` — custom identity, immutable versions, lifecycle, server-owned capabilities, bounded output policy, and `/agents` management boundary
- `.planning/phases/36-agent-management-end-to-end-verification/36-CONTEXT.md` — fixed-template compatibility baseline, authenticated verification strategy, deterministic executor seam, and no-live-write/adversarial boundaries
- `.planning/phases/35-company-persona-analysis-experiences/35-CONTEXT.md` — Practice Area-first target launch experience, existing launcher/preview patterns, durable history, result/source display, and fixed target-scoped templates
- `.planning/phases/34-whole-run-review-confirmed-candidates/34-CONTEXT.md` — one whole-run Confirm/Dismiss decision, packet-bound identity, confirmed-only candidate projection, immutable provenance, and no Signal/Offering writes

### Existing execution and data contracts

- `src/components/analysis/analysis-run-launcher.tsx` — current target-scoped launcher, option loading, template/practice-area state, POST launch payload, and status handoff; implementation input, not a locked design for the final custom picker
- `src/app/api/analysis-options/route.ts` — staff-gated fixed-template and Practice Area options endpoint; likely option-resolution seam to extend or compose
- `src/app/api/analysis-runs/route.ts` — staff-gated launch validation, subject/template/practice-area resolution, model-chain resolution, snapshot construction, duplicate-run creation, and durable dispatch
- `src/lib/analysis/subjects.ts` — target type, subject, active Practice Area, and current active template-version resolution helpers
- `src/lib/analysis/customAgentContracts.ts` — custom-agent input, bounded output-schema, effort, and capability-selection contracts/policy
- `src/lib/analysis/capabilityPresets.ts` — server-approved `none` and `web-research` capability presets and compatibility validation
- `src/lib/db/queries/analysisTemplates.ts` — fixed-template reads and shared template/version query boundary
- `src/lib/db/queries/customAgents.ts` — custom-agent identity, target type, Practice Area, active/retired state, latest version, and immutable history reads/writes
- `src/lib/db/queries/analysisRuns.ts` — immutable snapshot persistence, duplicate active-run protection, and append-only run-event transitions
- `src/lib/analysis/snapshots.ts` — existing snapshot construction and validation seam
- `src/lib/analysis/contracts.ts` — analysis target, effort, run, snapshot, budget, and policy contract definitions
- `src/lib/analysis/execution.ts` — durable grounded execution adapter, model-chain injection seam, bounded tools/time, structured output parsing, safe failure mapping, and trace boundary
- `src/lib/analysis/groundedContracts.ts` — source-grounded execution input/output, finding, evidence, and fail-closed safety contracts
- `src/lib/analysis/evidence.ts` — Firecrawl provenance, canonical URL, excerpt, content-hash, unsafe-content, and duplicate-evidence normalization
- `src/lib/agents/modelFactory.ts` — provider/model instantiation boundary; custom agents must not bypass it or introduce arbitrary provider selection
- `src/workflows/analysisRun.ts` — existing durable executor/workflow integration point

</canonical_refs>

<code_context>
## Existing Code Insights

The following are reusable implementation inputs for research and planning,
not additional locked decisions.

### Reusable Assets

- `AnalysisRunLauncher` already handles authenticated target-scoped option loading, default selection, positive-ID parsing, POST submission, abort/race handling, and `AnalysisRunStatus` handoff. Its current state has separate template and Practice Area selectors; the locked Phase 38 resolution requires Practice Area to precede the agent picker.
- `GET /api/analysis-options` already gate-checks staff and returns active fixed templates plus active Practice Areas. It is the natural existing options seam to extend or compose with active custom-agent projections.
- `POST /api/analysis-runs` already performs gate-first parsing, current/active template resolution, subject compatibility, active Practice Area resolution, active-checklist derivation, model-chain resolution, snapshot building, duplicate-run rejection, and durable dispatch.
- `src/lib/db/queries/customAgents.ts` already returns custom agents grouped by immutable identity with target type, Practice Area, status, latest version, and read-only history. This supports filtering and explicit staff choice without changing historical versions.
- `src/lib/analysis/customAgentContracts.ts` and `src/lib/analysis/capabilityPresets.ts` already provide bounded custom fields, optional shallow structured output, supported effort validation, and server-approved capability IDs. Runtime capability/tool resolution remains server-owned.
- `src/lib/db/queries/analysisRuns.ts` persists template, subject, checklist, execution, and policy snapshots in one run creation boundary and maps unique conflicts to `active_run_exists`.
- `GroundedExecutionAdapter` in `src/lib/analysis/execution.ts` already accepts snapshotted checklist/policy/model inputs, instantiates the resolved chain through injected dependencies, limits tools and execution, parses structured output, normalizes tool results, and returns safe failure reasons.
- `src/lib/analysis/evidence.ts` and the Phase 34 review/candidate query seams preserve Firecrawl provenance, source identity, whole-run decision semantics, and confirmed-only downstream projection.

### Established Patterns

- Staff authorization is server-derived via `requireStaffAccess()` before launch reads or writes; actor identity is never accepted from the client.
- Immutable template versions and run snapshots are the reproducibility boundary. Mutable current custom-agent state affects future launches only.
- Neon HTTP persistence uses guarded SQL/data-modifying CTE patterns rather than interactive transaction callbacks.
- Durable execution is bounded by the existing run budget, model chain, tool policy, recovery, terminal status, and safe-error audit behavior.
- Evidence is source-grounded and fail-closed: Firecrawl provenance, canonical public HTTPS identity, content/excerpt support, and duplicate/unsafe rejection remain required.
- Review is one whole-run decision in the shared Reviews experience; per-finding curation, auto-confirmation, and direct live writes are not substitutes.

### Integration Points

- Practice Area-first launch resolution must connect the Phase 35 Company/Persona launch UI to fixed-template and matching active-custom-agent options.
- The selected agent/version must flow through preview and launch into the existing subject resolver, checklist resolver, model-chain resolver, snapshot builder, `createAnalysisRun`, and durable workflow.
- Custom run results must continue through the Phase 33 grounded packet/evidence path and Phase 34 whole-run review/candidate projection without parallel semantics.
- Fixed-template options and launch payloads need backward-compatible coverage so omitting a custom selection produces the existing fixed-template behavior.
- Phase 39 owns the broad adversarial, review-boundary, authenticated custom-agent E2E, and no-live-write verification gate; Phase 38 should leave deterministic seams for that proof.

</code_context>

<specifics>
## Specific Ideas

- Keep `/agents` as the canonical management surface and do not introduce `/reviews/agents`.
- Make the fixed v1.7 template visibly the default after Practice Area selection, while exposing compatible custom agents as explicit alternatives rather than silently choosing among them.
- Preserve the two independent target contracts: Company launches resolve Company-compatible agents and Persona launches resolve Persona-compatible agents.
- Treat compatibility failures as pre-run safety outcomes, not active-run failures; no active run should exist when launch resolution is rejected.

</specifics>

<deferred>
## Deferred Ideas

- Exact snapshot field expansion, structured-output runtime integration, and verification-boundary details are unresolved and remain for research/planning discretion or later discussion; do not document them as decided.
- Bulk, scheduled, automatic, or arbitrary custom-agent execution remains outside this phase and v1.8.
- New providers, Exa, arbitrary tools/data sources, per-finding curation, auto-confirmation, direct Signal/Offering writes, outreach/CRM, Hypotheses, and Persona Discovery remain outside scope.

</deferred>

---

*Phase: 38-execution-compatibility-safe-integration*
*Context gathered: 2026-08-11*
