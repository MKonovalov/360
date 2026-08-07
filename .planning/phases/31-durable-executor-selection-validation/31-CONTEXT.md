# Phase 31: Durable Executor Selection & Validation - Context

**Gathered:** 2026-08-06
**Status:** Ready for planning

## Phase Boundary

Select and prove the durable executor for future analysis runs. This phase establishes Vercel Workflow DevKit as the background execution mechanism and proves safe claim, retry, recovery, and audit behavior with a synthetic lifecycle job. It does not add real buying-signal analysis, Company/Persona UI, reviews, or candidate offerings.

## Implementation Decisions

### Execution Platform
- **D-31-01:** Select Vercel Workflow DevKit as the Vercel-compatible durable executor; do not introduce an external queue or custom worker.
- **D-31-02:** Use a thin `"use workflow"` orchestrator with Node-accessible `"use step"` units for claim, synthetic work, and persistence. Do not adopt `DurableAgent` or move the existing AI SDK loop into the workflow sandbox.
- **D-31-03:** The start boundary creates the application run record first, starts the workflow, persists its workflow run ID, and returns the application run ID immediately.
- **D-31-04:** A dispatch failure marks the queued application run failed with an auditable reason; staff later start a new run rather than waiting on an indefinite queue.

### Retry and Recovery
- **D-31-05:** Automatically retry only transient workflow steps, never silently rerun a completed research attempt.
- **D-31-06:** Limit retryable infrastructure steps to one retry (two total attempts).
- **D-31-07:** Recover an interrupted claim once; if it cannot safely resume, transition the run to a terminal failed state.
- **D-31-08:** A staff retry always creates a new immutable application run with new snapshots; terminal runs are never reset or overwritten.

### Proof Standard
- **D-31-09:** Validate the durable executor in a Vercel preview and follow it with a safe production smoke check.
- **D-31-10:** Use a synthetic, deterministic lifecycle proof job; do not spend AI or web-research credits or introduce Phase 33 analysis behavior.
- **D-31-11:** Force one controlled, test-only step failure to demonstrate bounded retry/recovery and terminal audit history.
- **D-31-12:** Release the gate only with both automated workflow/integration coverage and a live Vercel start → reload/navigate-away → terminal-status check.

### Run Identity and Status
- **D-31-13:** Persist both IDs: the application run ID is product-facing and the Workflow DevKit run ID is executor metadata for diagnostics and recovery.
- **D-31-14:** The application database is the authoritative lifecycle source for future history and review surfaces; Vercel workflow state is diagnostic metadata only.
- **D-31-15:** Pass only the application run ID into the workflow. Every step reloads immutable state and uses guarded lifecycle transitions.
- **D-31-16:** If workflow metadata and application state disagree, preserve the guarded application state, record diagnostic metadata, and reconcile once or fail safely; never overwrite application state from the executor.

### Claude's Discretion
- Choose current Workflow DevKit APIs, package versions, schema/query names, and exact test harness structure after verifying installed and official documentation.
- Keep Phase 31's synthetic run model additive and isolated so it does not distort the legacy `agent_run`/proposal data model before Phase 32's inventory and migration design.

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone Contract
- `.planning/ROADMAP.md` §Phase 31 — phase goal, RUN-03 ownership, success criteria, and hard gate before detached execution is promised.
- `.planning/REQUIREMENTS.md` §Durable Analysis Execution — RUN-03 requires an independently claimable, recoverable, safely failing Vercel-compatible executor.
- `.planning/PROJECT.md` §Current Milestone and §Milestone Context — locked in-house modelFactory + Firecrawl direction, whole-run review posture, and excluded scope.

### Research
- `.planning/research/SUMMARY.md` §Phase 1 and §Gaps to Address — durable executor is the only material stack uncertainty; never treat database persistence, `after()`, or an in-process promise as a worker.
- `.planning/research/STACK.md` §Persisted-Async Execution Decision — current agent is request-bound and a durable platform is mandatory for detached/retryable runs.
- `.planning/research/ARCHITECTURE.md` §Data Flow and §Anti-Pattern 4 — persist/claim/complete lifecycle boundary and the ban on long-running work in the preview/run request.
- `.planning/research/PITFALLS.md` §Critical Pitfalls 1 and 5 — durable lifecycle audit, bounded retries, idempotency, and cost controls.

### External Documentation
- Vercel Workflow DevKit official documentation — selected platform; verify current `workflow/api` start, `"use workflow"`, `"use step"`, retry, and integration-test APIs during planning. No external specification is stored in this repository.

## Existing Code Insights

### Reusable Assets
- `src/lib/agents/runAgent.ts`: existing AI SDK tool loop, model fallback, bounded timeout, and actual-model audit seam. Phase 31 must not move it into a workflow sandbox; Phase 33 may later invoke it from a Node step through a provider-agnostic adapter.
- `src/lib/agents/analyzeCompany.ts`: snapshots the model chain at entry, validates artifacts, and returns structured failures; this demonstrates the required snapshot/fail-loud boundaries but remains request-bound.
- `src/components/agents/analyze-run-status.tsx`: existing client status behavior shows the old request-bound UX and should not be reused as the source of durable truth.

### Established Patterns
- `modelFactory.ts` remains the only provider-SDK boundary. Workflow steps must reuse it indirectly and never instantiate provider clients.
- Server-derived evidence and fail-closed validation are existing agent invariants; synthetic Phase 31 work must not add an AI or write capability.
- Application lifecycle must be query-layer guarded and database-authoritative; status polling or executor metadata is presentation/diagnostic only.

### Integration Points
- Add the selected workflow start boundary beside the future staff-gated run creation path, returning the database run ID and persisting the Workflow DevKit run ID.
- Add a narrowly scoped synthetic run ledger/claim/reconcile path for the Phase 31 proof without mutating legacy Company-only analytic-agent history.
- Add automated workflow integration coverage and deployed Vercel preview/production smoke evidence before Phase 32 begins.

## Specific Ideas

- The proof is deliberately synthetic and deterministic: it exercises queueing, claim, controlled failure, one retry, recovery, terminal persistence, and reload-safe visibility without using prospect data, AI models, or Firecrawl credits.

## Deferred Ideas

None — discussion stayed within phase scope.

---

*Phase: 31-Durable Executor Selection & Validation*
*Context gathered: 2026-08-06*
