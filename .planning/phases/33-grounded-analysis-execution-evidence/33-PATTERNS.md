# Phase 33 Implementation Patterns

## Ownership and wave rules

| Wave | Plan | Exclusive concern | Primary files |
|---|---|---|---|
| 0 | 33-01 | Policy, strict contracts, and run-creation snapshot handoff | `src/lib/analysis/groundedContracts.ts`, `src/lib/analysis/personaPolicy.ts`, `src/lib/analysis/snapshots.ts`, analysis-run creation boundary, contract tests |
| 1 | 33-02 | Additive immutable packet persistence; Persona retention tombstone/query path | `src/lib/db/schema.ts`, `src/lib/db/queries/analysisResults.ts`, persistence/retention tests |
| 1 | 33-03 | Evidence normalization and packet validation | `src/lib/analysis/evidence.ts`, `src/lib/analysis/results.ts`, validation tests |
| 2 | 33-04 | Provider-neutral AI/Firecrawl adapter and typed page retrieval | `src/lib/analysis/execution.ts`, `src/lib/analysis/evidenceRetrieval.ts`, existing agent seam files, adapter tests |
| 3 | 33-05 | Durable workflow and safe telemetry | `src/workflows/analysisRun.ts`, `src/lib/telemetry/langfuse.ts`, workflow tests |
| 4 | 33-06 | Phase gate, concrete scope audit, and approved live smoke | `scripts/phase33-scope-audit.ts`, `33-VALIDATION.md`, scoped verification evidence |

No same-wave plan may modify the same source file. Later plans consume the
named contracts from earlier plans; they do not re-interpret them.

## Required boundaries

- Adapter returns validated in-memory data and never receives a DB handle or
  mutation callback.
- Persistence query modules own DB access only; they do not authenticate,
  instantiate providers, call Firecrawl, or decide UI behavior.
- Workflow steps receive scalar IDs or small serializable safe values only and
  reload authoritative rows inside steps.
- Sources are created only from actual Firecrawl output. Model-recited URLs,
  snippets, and citations can select among server-derived sources but can never
  create one. Canonical duplicate discovery keeps one source; duplicate
  finding-source links are rejected.
- Page retrieval is a typed server operation restricted to URLs in the
  server-owned Firecrawl search-result set. It is not a model tool and cannot
  retrieve arbitrary model-provided URLs.
- `running → completed` is reachable only after atomic packet persistence;
  safe failures persist only allowlisted failure audit through the Phase 32
  lifecycle path.
- No Phase 34 review/candidate writes, Phase 35 UI, Phase 36 template writes,
  legacy-table writes, or direct live Signal/Offering mutations.
- Persona packet/source/telemetry retention is absent when policy is deferred;
  approved Persona artifacts carry expiry and are hidden/tombstoned by a
  server-side query path.
