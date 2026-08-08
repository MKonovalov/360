# Phase 33: Grounded Analysis Execution & Evidence - Research

**Researched:** 2026-08-07  
**Domain:** Durable Workflow execution, Vercel AI SDK structured output, Firecrawl evidence acquisition, Drizzle/Neon immutable result persistence, and Langfuse telemetry  
**Confidence:** HIGH for existing seams and phase boundaries; MEDIUM for the new result/evidence table decomposition and Persona policy because those decisions are not yet present in the repository.

<user_constraints>
## User Constraints

- A durable run produces a safe, source-grounded, immutable analysis packet using the locked in-house AI and Firecrawl stack. [VERIFIED: user request]
- Phase 31 selected/proved the durable executor; Phase 32 establishes immutable templates, snapshots, run ledger, APIs, and a no-op scalar handoff. [VERIFIED: user request]
- v1.7 is locked to the existing in-house `modelFactory` plus Firecrawl behind a provider-agnostic contract; Exa is explicitly forbidden. [VERIFIED: user request]
- The application database is product truth; Workflow IDs/status are diagnostic only. [VERIFIED: user request]
- Whole-run review belongs to Phase 34; Company/Persona preview/history/result UX belongs to Phase 35; template management and final verification belong to Phase 36. [VERIFIED: user request]
- Persona privacy/redaction/classification/retention must be explicit and fail closed before enabling Persona execution. [VERIFIED: user request]
- Do not add providers, Exa, bulk/scheduled execution, review behavior, candidate aggregation, template management, or polished UI. [VERIFIED: user request]
- Do not treat Workflow metadata as product truth, allow direct agent writes, persist credentials/private chain-of-thought, or claim a live provider run without verification. [VERIFIED: user request]
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research support |
|---|---|---|
| RUN-04 | Durable execution uses existing modelFactory and Firecrawl through a provider-agnostic contract, without Exa. | Existing `modelFactory`/`runAgent`/`webSearchTool` seams and adapter boundary below. |
| EVD-01 | Completed runs store immutable normalized narrative, findings, raw audit output, model/trace provenance, and timing. | Additive run-result packet and normalized child rows, inserted only after validation and never updated. |
| EVD-02 | Findings map to snapshotted signal identity and expose evidence status/confidence. | Finding schema must FK/identify checklist snapshot item and use a closed status/confidence enum. |
| EVD-03 | Material findings reference persisted navigable sources with title, canonical URL, retrieved time, and excerpt. | Source normalization and finding-source linkage are mandatory before completion. |
| EVD-04 | Unsupported, unsafe, duplicate, or unlinked evidence is rejected. | Server-derived evidence, canonical URL/content validation, prompt-injection isolation, dedupe, and citation gate. |
| EVD-05 | Persona data follows minimum-data, redaction, classification, and retention policy. | Fail-closed Persona policy and server-side source/telemetry classification below. |
</phase_requirements>

## Summary

Phase 33 should replace the Phase 32 no-op completion branch with a thin durable workflow that reloads the immutable `analysis_run` snapshots, claims the run with the existing guarded transition query, executes a provider-agnostic analysis adapter, validates a server-derived evidence packet, and persists the packet through a database-authoritative persistence step. The workflow should receive only the scalar application run ID, just as Phase 31/32 do; the execution step reloads snapshots and constructs the model/tool dependencies. [VERIFIED: `src/workflows/analysisRun.ts:25-32,33-73`; `src/lib/db/queries/analysisRuns.ts:112-277`; `.planning/phases/31-durable-executor-selection-validation/31-RESEARCH.md:164-199`]

The existing AI path already has the correct provider boundary: `modelFactory` maps catalog IDs to `LanguageModel` instances, `runAgent` invokes AI SDK `generateText` with structured output and the only registered `webSearch` tool, and `analyzeCompany` derives citations from actual tool results before applying a fail-closed AIRS gate. Phase 33 should reuse these seams behind a new subject-neutral adapter rather than selecting providers again or importing any Exa SDK. [VERIFIED: `src/lib/agents/modelFactory.ts:108-167`; `src/lib/agents/runAgent.ts:39-114`; `src/lib/agents/tools.ts:1-43`; `src/lib/agents/analyzeCompany.ts:198-225`; `src/lib/validation/validateReport.ts:19-27`]

The current evidence appendix is not sufficient as the v1.7 product packet: it accepts URL/title/snippet triples, deduplicates exact URL strings, classifies hosts, and permits model citations that resolve to an appendix entry, but it does not canonicalize safely, retrieve durable page content, reject unsafe schemes/unsupported hosts, link a finding to a specific snapshotted signal item, or persist immutable source/result rows. Phase 33 must add those controls without weakening the existing fail-closed behavior. [VERIFIED: `src/lib/agents/analyzeCompany.ts:198-249`; `src/lib/agents/types.ts:16-55`; `src/lib/validation/airsRules.ts:42-73`]

**Primary recommendation:** Build one `executeGroundedAnalysis(applicationRunId)` adapter over the existing modelFactory + Firecrawl tool contract; validate a server-owned normalized packet; persist one immutable run-result header plus normalized findings, sources, and finding-source links in a single database-authoritative write; transition `running → completed` only after that write succeeds.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Durable claim, retry, timeout, and terminal lifecycle | Database / Storage | API / Backend | Guarded `analysis_run` transitions and append-only events are the product truth; Workflow status is diagnostic. [VERIFIED: `src/lib/db/queries/analysisRuns.ts:195-277`; Phase 31 locked decisions] |
| Snapshot reload and subject/policy resolution | API / Backend | Database / Storage | The step receives only an application ID and reloads immutable JSON snapshots; no browser or mutable request state crosses the workflow boundary. [VERIFIED: `src/workflows/analysisRun.ts:25-32,75-80`; `src/lib/analysis/contracts.ts:158-191`] |
| Model/provider execution | API / Backend | Vercel platform | The adapter resolves the snapshotted model IDs through `instantiateChain`; provider selection remains catalog/modelFactory responsibility. [VERIFIED: `src/lib/agents/modelFactory.ts:108-157`; `src/lib/agents/modelConfig.ts:111-121`] |
| Web research and source acquisition | API / Backend | External Firecrawl service | The only agent tool should remain Firecrawl-backed, bounded, and capability-limited. [VERIFIED: `src/lib/agents/tools.ts:19-43`; [CITED: https://github.com/firecrawl/firecrawl-docs/blob/main/agent-source-of-truth/node.mdx]] |
| Evidence normalization and validation | API / Backend | Database / Storage | Untrusted model/tool output must become a typed server-owned packet before any product write. [CITED: https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data; VERIFIED: `src/lib/validation/validateReport.ts:1-27`] |
| Immutable analysis packet | Database / Storage | API / Backend | Normalized rows are durable product artifacts consumed by Phase 34/35; agent code must never write them directly. [VERIFIED: Phase 32 snapshot contract; `src/app/api/companies/[id]/analyze/route.ts:102-153`] |
| Trace/timing audit | API / Backend | Langfuse platform | The database stores safe trace/model/timing metadata; Langfuse remains an observability mirror and must not become product truth. [VERIFIED: `src/lib/telemetry/langfuse.ts:35-72`; `src/app/api/companies/[id]/analyze/route.ts:98-100`] |

## Phase 32 Handoff and Immutable Contract

### Proven handoff

| Handoff item | Current contract | Phase 33 action |
|---|---|---|
| Workflow input | `applicationRunId: number` only | Preserve scalar boundary; do not pass rows, DB clients, Clerk sessions, models, or tool clients. [VERIFIED: `src/workflows/analysisRun.ts:25-36`; Phase 31 serialization decision] |
| Current no-op | `queued → running → completed` through `completeNoOpRun()` | Replace only the completed branch with execution + validated persistence; retain guarded failure/cancel paths. [VERIFIED: `src/workflows/analysisRun.ts:38-69,94-130`] |
| Claim | `transitionAnalysisRun({ queued, running, workflow actor, attempt: 1 })` | Reuse as the sole claim; execution must reload after claim. [VERIFIED: `src/workflows/analysisRun.ts:82-91`] |
| Product status | `analysis_run.status` and events | On success persist packet first, then transition to `completed`; on safe failure persist bounded reason/audit and transition to `failed`. [VERIFIED: `src/lib/db/queries/analysisRuns.ts:195-277`] |
| Workflow metadata | Not present in the Phase 32 product run row; executor state is diagnostic by inherited decision | Never use Workflow status to mark a packet completed. [VERIFIED: user request; Phase 31 decisions] |

### Snapshot inventory

Phase 32 validates strict, versioned snapshots. `templateSnapshot` contains target/version/instruction/effort; `subjectSnapshot` contains only `{ type, id, displayName }`; `checklistSnapshot` contains active signal IDs, names, categories, descriptions, and optional Persona `buyerRoleId`; `executionSnapshot` contains effort, resolved model IDs, future budget, and policy; scalar IDs are duplicated for indexing. [VERIFIED: `src/lib/analysis/contracts.ts:107-170`; `src/lib/analysis/snapshots.ts:36-68`; `.planning/phases/32-template-snapshot-run-ledger/32-RESEARCH.md:252-265`]

The Phase 32 policy is currently a literal no-op policy (`networkAccess: false`, `writesAllowed: false`, one effective attempt, zero tools, five seconds, zero spend). Phase 33 must introduce a versioned execution policy for real model/Firecrawl work through the same snapshot mechanism, not mutate existing snapshots in place. The new policy needs explicit maximum attempts, tool calls, wall time, spend, URL/source counts, excerpt sizes, and whether Persona execution is enabled. [VERIFIED: `src/lib/analysis/contracts.ts:58-74,127-155`; `src/lib/analysis/snapshots.ts:43-55`; [ASSUMED] exact Phase 33 policy values require product/cost approval]

## Standard Stack

### Core

| Library | Version | Purpose | Why standard |
|---|---:|---|---|
| `workflow` | `4.8.0` pinned in repository | Durable orchestration and isolated Node-capable steps | Phase 31 selected/proved it; the current installed package is the existing durable boundary. [VERIFIED: `package.json`; Phase 31 research] |
| `ai` | `7.0.45` declared / AI SDK 7 API | Provider-neutral `generateText`, tools, structured output, timeout, and telemetry | Existing `runAgent` uses this exact contract; official docs confirm `generateText` + tools + `Output.object`. [VERIFIED: `package.json`; `src/lib/agents/runAgent.ts:1-5,69-84`; [CITED: https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data]] |
| `firecrawl` | `4.32.0` registry current on research date; repository declaration should remain authoritative | Public-web search/scrape source acquisition | Existing `webSearchTool` uses its `Firecrawl.search()` API and maps `res.web` to safe triples. [VERIFIED: `src/lib/agents/tools.ts:3-41`; [VERIFIED: npm registry]; [CITED: https://github.com/firecrawl/firecrawl-docs/blob/main/agent-source-of-truth/node.mdx]] |
| `drizzle-orm` + `@neondatabase/serverless` | `0.45.2` / `1.1.0` | Neon/Postgres schema and immutable packet persistence | Existing DB client is `drizzle-orm/neon-http`; Drizzle documents HTTP as appropriate for single non-interactive requests and WebSockets for interactive transactions. [VERIFIED: `src/lib/db/index.ts:1-7`; [VERIFIED: npm registry]; [CITED: https://orm.drizzle.team/docs/connect-neon]] |
| `zod` | existing repository version | Runtime validation of model output, tool output, source URLs, packet invariants, and policy | Existing snapshot and AIRS contracts already use strict Zod schemas. [VERIFIED: `src/lib/analysis/contracts.ts:79-191`; `src/lib/agents/types.ts:1-55`] |

### Supporting

| Library | Version | Purpose | When to use |
|---|---:|---|---|
| `@langfuse/client` | `5.10.0` registry current; repository declaration `^5.10.0` | Safe trace URL lookup and external trace metadata | Store only trace ID/URL and safe aggregate metadata; never raw Persona content or private reasoning. [VERIFIED: `package.json`; `src/lib/telemetry/langfuse.ts:23-32,66-72`; [VERIFIED: npm registry]] |
| `@langfuse/otel` / `@langfuse/vercel-ai-sdk` | `5.10.0` registry current; repository declarations present | AI SDK 7 OpenTelemetry export to Langfuse | Reuse the existing singleton bootstrap; do not create a second telemetry registration path. [VERIFIED: `src/lib/telemetry/langfuse.ts:1-5,35-63`; [CITED: https://langfuse.com/integrations/frameworks/vercel-ai-sdk]] |
| `@workflow/vitest` | `4.0.16` existing dev dependency | Durable workflow integration tests | Test claim/retry/failure/persistence sequencing without live provider spend. [VERIFIED: `package.json`; Phase 31 research] |
| `vitest` / Playwright | existing versions | Pure contract, DB integration, workflow, and reload smoke tests | Use focused unit/integration tests plus safe mocked-provider E2E; live provider verification requires explicit human approval. [VERIFIED: `package.json`; Phase 32 plan 32-05:80-102] |

**Installation:** No new package is recommended. All required packages already exist in the repository. [VERIFIED: `package.json`]

## Package Legitimacy Audit

The required legitimacy gate was run with `slopcheck` on 2026-08-07 using npm ecosystem checks. All eight checked packages received `[OK]`; `@langfuse/vercel-ai-sdk` was flagged by the tool as relatively new/name-shaped but still received `[OK]`, so it remains approved only because it is already in the repository and is documented by Langfuse's official integration page. The command installed into the local working environment, not the repository; package manifests were restored to their pre-check declarations. [VERIFIED: slopcheck command output; `package.json`]

| Package | Registry | Registry version checked | Source repo | slopcheck | Disposition |
|---|---|---:|---|---|---|
| `ai` | npm | 7.0.56 latest; repo 7.0.45 | github.com/vercel/ai | [OK] | Approved; do not upgrade during Phase 33 |
| `firecrawl` | npm | 4.32.0 | github.com/firecrawl/firecrawl | [OK] | Approved; use existing declaration |
| `@langfuse/client` | npm | 5.10.0 | github.com/langfuse/langfuse-js | [OK] | Approved |
| `@langfuse/otel` | npm | 5.10.0 | github.com/langfuse/langfuse-js | [OK] | Approved |
| `@langfuse/vercel-ai-sdk` | npm | 5.10.0 | github.com/langfuse/langfuse-js | [OK] | Approved with freshness caution |
| `drizzle-orm` | npm | 0.45.2 | github.com/drizzle-team/drizzle-orm | [OK] | Approved |
| `@neondatabase/serverless` | npm | 1.1.0 | github.com/neondatabase/serverless | [OK] | Approved |
| `workflow` | npm | 4.8.1 latest; repo pinned 4.8.0 | github.com/vercel/workflow | [OK] | Keep repository pin; do not upgrade opportunistically |

No new package is needed, no package was removed, and no postinstall script was observed in the checked package metadata. [VERIFIED: npm registry queries; slopcheck output]

## Architecture Patterns

### System Architecture Diagram

```text
Phase 32 create boundary
  └─ analysis_run (immutable snapshots, queued)
       │ scalar applicationRunId only
       ▼
Vercel Workflow: analysisRun(applicationRunId)
  ├─ claim step: queued → running (guarded DB transition)
  ├─ load step: reload snapshots + safe subject/policy
  ├─ execution step: provider-neutral adapter
  │    ├─ modelFactory.instantiateChain(snapshot.modelIds)
  │    ├─ AI SDK generateText + strict structured output
  │    └─ Firecrawl-only bounded research tool
  ├─ validation step: normalize URLs/content/findings and reject unsafe/unlinked data
  ├─ persistence step: one immutable packet + normalized rows, DB-authoritative
  └─ terminal step: packet success → completed; any safe failure → failed + reason/event
       │
       ▼
Application database
  ├─ analysis_run_result (one immutable packet header per completed run)
  ├─ analysis_finding (one row per snapshotted checklist signal)
  ├─ analysis_source (canonical source metadata/content excerpt)
  └─ analysis_finding_source (many-to-many provenance links)
       │
       └─ Phase 34 review / Phase 35 inspection consume only completed packets
```

### Recommended Project Structure

```text
src/
├── lib/analysis/execution.ts       # subject-neutral adapter contract and orchestration
├── lib/analysis/evidence.ts        # URL/content normalization, classification, dedupe, citation links
├── lib/analysis/personaPolicy.ts   # fail-closed minimum-data/redaction/retention policy
├── lib/analysis/results.ts          # packet Zod schemas and immutable result persistence boundary
├── lib/db/schema.ts                # additive result/finding/source/link tables only
├── lib/db/queries/analysisResults.ts # DB-only insert/read helpers; no auth or provider calls
├── lib/agents/runAgent.ts          # existing AI SDK loop seam; preserve provider selection
├── lib/agents/modelFactory.ts      # existing only SDK/provider-instantiation module
├── lib/agents/tools.ts             # existing Firecrawl tool, hardened behind a safe tool contract
├── lib/telemetry/langfuse.ts       # existing trace bootstrap and trace URL lookup
└── workflows/analysisRun.ts        # replace Phase 32 no-op branch with Phase 33 step sequence
```

### Pattern 1: Provider-agnostic execution adapter

**What:** Define a contract that accepts a validated immutable execution input and returns a pure, unpersisted `RawAnalysisAttempt`. The adapter owns neither provider selection nor DB writes. It receives a resolved `LanguageModel[]` from `instantiateChain(snapshot.execution.resolvedModelChain)` and a fixed tool map containing only the hardened Firecrawl search tool. [VERIFIED: `src/lib/agents/modelFactory.ts:154-157`; `src/lib/agents/runAgent.ts:52-84`; `src/lib/agents/analyzeCompany.ts:21-23`]

**When to use:** Every Company and Persona run. The subject adapter may produce a safe subject prompt/input, but it must not add a provider branch, read settings mid-run, or accept client model controls. [VERIFIED: `src/lib/agents/analyzeCompany.ts:83-112`; `.planning/REQUIREMENTS.md:64-75`]

```typescript
interface GroundedExecutionAdapter {
  execute(input: GroundedExecutionInput): Promise<RawAnalysisAttempt>;
}

interface GroundedExecutionInput {
  readonly runId: number;
  readonly snapshot: ReadonlyAnalysisSnapshot;
  readonly models: readonly LanguageModel[];
}
```

The exact names are implementation choices; the boundary is the recommendation. The adapter returns data, never a DB handle or mutation callback. [ASSUMED]

### Pattern 2: Server-derived evidence, not model-recited evidence

The existing `deriveEvidenceAppendix(run.steps)` pattern is correct in principle: inspect only actual `webSearch` tool results, ignore model-recited appendix data, deduplicate, then validate every citation against the server-derived set. Extend it to retain Firecrawl retrieval metadata/content hash, canonical URL, retrieved timestamp, source classification, and a bounded excerpt selected from retrieved content. [VERIFIED: `src/lib/agents/analyzeCompany.ts:198-225`; `src/lib/agents/types.ts:28-55`; `src/lib/validation/airsRules.ts:42-73`]

### Pattern 3: Finding identity is the snapshot checklist item

Each normalized finding should carry `signalId`, `signalName`, `signalCategory`, and for Persona `buyerRoleId`, copied from the matching `checklistSnapshot.items[]`. The validator must reject any finding whose signal identity is absent from the run snapshot, rather than matching by mutable current catalog name/category. Empty checklist items remain valid and should produce a completed packet with no findings only if the narrative explicitly reports no applicable signals. [VERIFIED: `src/lib/analysis/contracts.ts:133-146`; `.planning/phases/32-template-snapshot-run-ledger/32-RESEARCH.md:62-65`; [ASSUMED] exact empty-checklist narrative wording]

### Pattern 4: Persist before completion and never update packet rows

Use an immutable `analysis_run_result` row with a unique `analysis_run_id`; normalized finding/source/link rows reference that result/run. The persistence boundary validates the complete packet, inserts all rows, and only then asks the ledger to transition `running → completed`. A retry must detect the existing immutable result and return the authoritative packet or fail safely; it must never overwrite it. [VERIFIED: Phase 31 idempotency decision; `src/lib/db/queries/analysisRuns.ts:215-277`; [CITED: https://orm.drizzle.team/docs/connect-neon]]

Because the installed client is `neon-http`, do not assume an interactive callback transaction. Prefer one data-modifying SQL CTE statement for the packet header, normalized children, and links, or prove an approved Neon transaction mechanism before implementation. Independent inserts create partial packets. [VERIFIED: `src/lib/db/index.ts:1-7`; `.planning/phases/32-template-snapshot-run-ledger/32-RESEARCH.md:313-317`; [CITED: https://orm.drizzle.team/docs/connect-neon]]

### Recommended normalized persistence shape

| Table/field | Required content | Immutability and validation |
|---|---|---|
| `analysis_run_result` | `analysisRunId` unique, schema version, narrative, safe raw audit JSON, model used/chain, fallback flag, trace ID/URL, started/completed timestamps, duration, counts, packet hash | Insert once; no update/delete helper; raw audit allowlist excludes secrets, prompts containing Persona PII, and chain-of-thought. [ASSUMED] |
| `analysis_finding` | result/run ID, snapshot `signalId` plus copied safe identity, status `strong/weak/no_evidence/inconclusive`, confidence, normalized claim, bounded reasoning summary, detected/observed time | Must match exactly one checklist item; no finding may be attached only by name. [ASSUMED] |
| `analysis_source` | canonical URL, title, retrieved timestamp, bounded supporting excerpt, content hash, source classification, retrieval provider/version | Unique by run + canonical URL/content hash; store only validated supported sources. [ASSUMED] |
| `analysis_finding_source` | finding ID, source ID, excerpt/locator if needed, support role, ordering | Unique finding/source pair; every material finding requires at least one link; `no_evidence` must have none. [ASSUMED] |

Keep the run ledger's immutable intent snapshots unchanged. Do not put the entire packet into `analysis_run` if normalized child rows are needed by Phase 34/35; a small result summary or packet hash may be duplicated for status reads. [ASSUMED]

### Anti-Patterns to Avoid

- **Reusing `agent_run`/`signal_proposal`:** These are legacy Company-only/per-proposal structures and Phase 34 owns the new whole-run review boundary. [VERIFIED: `src/lib/db/schema.ts:239-280`; `.planning/phases/32-template-snapshot-run-ledger/32-CONTEXT.md:70-87`]
- **Passing a loaded row/model/tool client into Workflow:** Workflow arguments cross a serialization boundary; pass only the scalar run ID. [VERIFIED: `src/workflows/analysisRun.ts:25-36`; Phase 31 serialization decision]
- **Trusting model-provided URLs or snippets:** Model output is untrusted and can cite an unsearched URL; use server-derived tool results plus URL/content validation. [VERIFIED: `src/lib/validation/airsRules.ts:42-73`]
- **Letting retrieved web text become instructions:** Treat Firecrawl content as data inside a delimited evidence field; never interpolate it as executable system/developer instructions or tool policy. [ASSUMED]
- **Marking `completed` before persistence:** A completed ledger row without a durable packet is unrecoverable product truth. [ASSUMED]
- **Writing live Signals, proposals, Reviews, candidate links, or settings from the agent:** Phase 33 produces an immutable packet only; later phases own review/activation. [VERIFIED: `.planning/REQUIREMENTS.md:64-75`; `.planning/ROADMAP.md:446-478`]

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Provider selection | New provider switch or Exa branch | `resolveModelChain()` → `instantiateChain()` → existing catalog/modelFactory | Existing four-provider routing, failover, and key gates are already proven and must remain the sole selection boundary. [VERIFIED: `src/lib/agents/modelConfig.ts:111-121`; `src/lib/agents/modelFactory.ts:108-157`] |
| Durable orchestration | Promise/background request/custom worker | Existing Workflow `analysisRun` + `use step` functions | Phase 31 selected and proved this executor. [VERIFIED: Phase 31 research and `src/workflows/analysisRun.ts:33-80`; [CITED: https://workflow-sdk.dev/docs/getting-started/next]] |
| Structured output validation | Regex/JSON.parse-only acceptance | AI SDK `Output.object` plus Zod packet schemas | AI SDK validates structured output and raises on invalid generation. [CITED: https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data] |
| Web search | Direct fetch/search provider | Existing Firecrawl tool contract | Keeps one bounded research service and excludes Exa. [VERIFIED: `src/lib/agents/tools.ts:19-43`] |
| Evidence citation resolution | URL-only proof or string matching | Canonical source table + finding-source links + content hash | A URL without retrieved supporting content is not evidence and cannot support immutable provenance. [ASSUMED] |
| Transactional packet write | Separate inserts or in-memory lock | Neon-compatible single statement/CTE, after an explicit atomicity probe | `neon-http` does not provide the interactive transaction API used by many examples. [VERIFIED: Phase 32 runtime probe; [CITED: https://orm.drizzle.team/docs/connect-neon]] |
| Telemetry | New trace system or raw logging | Existing Langfuse OTel singleton, safe allowlisted metadata, trace URL lookup | Existing integration already handles AI SDK 7 and serverless trace lookup. [VERIFIED: `src/lib/telemetry/langfuse.ts:35-72`; [CITED: https://langfuse.com/integrations/frameworks/vercel-ai-sdk]] |

## Safe Source Handling and Evidence Rules

### Canonical URL validation

Implement a single server-only normalizer used for search results, scrape requests, finding citations, dedupe, and persistence. It should accept only `https:` URLs; reject credentials, fragments, unsupported schemes, localhost/private-network targets, empty hosts, malformed URLs, and URLs over a bounded length. Normalize hostname case, default ports, dot segments, and trailing slash; preserve meaningful path/query only when the policy explicitly allows it. Store the normalized URL and original navigable URL only if they resolve to the same approved origin/path. [ASSUMED]

The current `normalizeUrl` strips scheme and query/fragment and allows parent/child prefix matching, which is too permissive for persisted evidence. Retain exact canonical equality for source identity; if citation suffix tolerance is needed for legacy behavior, resolve it to a fetched document/content hash and never create a new source from a citation alone. [VERIFIED: `src/lib/validation/airsRules.ts:51-69`; [ASSUMED] stricter Phase 33 policy]

### Firecrawl/tool controls

The tool currently accepts an unconstrained query string and asks Firecrawl for at most five search results (`src/lib/agents/tools.ts:24-40`). Phase 33 should retain the one-tool boundary and add server-side controls: validate query length and subject-derived inputs, cap tool calls with the snapshotted budget, cap returned sources/excerpt bytes, use explicit timeout, reject malformed/unsupported result shapes, and never expose raw Firecrawl errors to the packet/UI. Official Firecrawl docs confirm search supports a query, limit, optional sources/categories, invalid-URL handling, timeout, and scrape options; use only the smallest required subset. [VERIFIED: `src/lib/agents/tools.ts:24-40`; [CITED: https://github.com/firecrawl/firecrawl-docs/blob/main/agent-source-of-truth/node.mdx]]

Do not allow the model to call arbitrary scrape URLs in this phase. Search
discovery and page retrieval are separate typed server operations: retrieval
accepts only a URL present in the server-owned Firecrawl search-result set,
re-validates it as HTTPS/public, calls the existing Firecrawl client with a
bounded `formats: ['markdown']` request and timeout, and returns a typed page
result capped by policy for bytes and excerpt length. The model sees the fixed
`webSearchTool` only; retrieval is invoked by the server after discovery, not
exposed as a model-controlled tool. [RESOLVED: Context7 `/firecrawl/firecrawl-docs`,
search-with-content-scraping and ScrapeResponse/OpenAPI timeout documentation]

### Prompt-injection resistance

Retrieved title, snippet, markdown, and HTML are untrusted data. Delimit them as quoted evidence, instruct the model that source content is never an instruction, and reject any model/tool output that attempts to invoke a tool outside the fixed map, alter policy, write data, reveal secrets, or treat page instructions as authority. The persistence validator must inspect only typed output and must not persist hidden chain-of-thought. [ASSUMED]

### Evidence acceptance matrix

| Condition | Decision | Safe reason |
|---|---|---|
| Malformed URL, non-HTTPS, private/local target, unsupported host/content | Reject source and dependent finding | `unsupported_source` |
| Source appears twice after canonicalization or content hash | Keep the first canonical source; reject only a duplicate finding-source link | `duplicate_source_link` |
| Finding signal ID not in `checklistSnapshot.items` | Reject whole packet; do not downgrade silently | `unlinked_finding` |
| Citation URL not present in server-derived fetched source set | Reject whole packet | `unresolved_citation` |
| Material finding has no source link | Set only `no_evidence`/`inconclusive` when the schema permits; never call it strong/weak evidence | `missing_support` |
| Excerpt absent, over limit, or not contained/located in retrieved content | Reject source/link | `invalid_excerpt` |
| Prompt injection or tool-policy violation | Fail the attempt; persist safe terminal audit, no packet | `unsafe_research_content` |

The final persistence gate should be all-or-nothing: no partial evidence rows, no “warning but accept” path. This follows the existing AIRS gate's reject-on-any-violation behavior. [VERIFIED: `src/lib/validation/validateReport.ts:1-27`]

## Persona Privacy, Classification, and Retention

### Current exposure

The `persona` table currently stores `name`, `title`, `seniority`, nullable `email`, `linkedinUrl`, field provenance, version, and enrichment time. `getPersonaById()` returns the full row. Phase 32's `subjectSnapshot` intentionally stores only type/id/displayName, so Phase 33 must not silently copy the full Persona row into prompts, snapshots, raw audit output, source excerpts, or telemetry. [VERIFIED: `src/lib/db/schema.ts:88-103`; `src/lib/db/queries/personas.ts:103-109`; `src/lib/analysis/contracts.ts:107-110`]

### Fail-closed policy recommendation

Until product/legal approval records explicit values, Persona execution should be disabled at the execution-policy gate. A missing policy version, classification decision, retention duration, or redaction configuration must fail before model/Firecrawl calls with a safe `persona_policy_unavailable` reason. This is a required product decision, not a value to invent in code. [VERIFIED: user request; [ASSUMED] exact approval workflow]

If approved, use an allowlist rather than a denylist:

- **Minimum input:** Persona ID, display name, title/seniority only when approved, and a safe current-company display name/ID from the existing role relation; never email, LinkedIn URL, contact details, enrichment payloads, or arbitrary notes by default. [ASSUMED]
- **Redaction:** redact email-like strings, phone numbers, personal URLs, direct identifiers, access tokens, and secrets before prompt construction, telemetry, source excerpts, and raw audit persistence. Preserve only the minimum entity identity needed to answer the snapshotted checklist. [ASSUMED]
- **Classification:** classify input/output/source/telemetry fields server-side as `public_biz`, `personal_data`, or `restricted`; reject restricted content and do not persist personal-data source content unless policy explicitly allows it. The existing host classifier is a starting signal, not a complete PII detector. [VERIFIED: `src/lib/agents/analyzeCompany.ts:227-249`; [ASSUMED] classification extension]
- **Retention:** store policy version, classification, and approved expiry on every Persona packet/source; enforce expiry through a server-side retention query/tombstone path, never by UI convention. Until a duration is approved, retain no Persona packet/source/telemetry and expose only a safe policy-unavailable audit. [RESOLVED: fail-closed no-retention plus server-side expiry path]
- **Telemetry:** send run ID, target kind, safe model ID, provider category, timing, tool-call count, result counts, trace ID, and policy version; exclude names, emails, URLs containing personal paths, raw prompts, raw outputs, excerpts, and private reasoning unless explicitly redacted/approved. [VERIFIED: `src/lib/telemetry/langfuse.ts:45-63`; [CITED: https://langfuse.com/integrations/frameworks/vercel-ai-sdk]; [ASSUMED] field allowlist]

## Common Pitfalls

### Pitfall 1: Phase 32 policy is left as no-op

**What goes wrong:** Real execution is silently run with `networkAccess: false`, zero tools, five seconds, or zero spend. [VERIFIED: `src/lib/analysis/contracts.ts:58-74,127-155`]  
**How to avoid:** Add a versioned Phase 33 policy snapshot with approved bounded limits; reject missing/invalid policy before execution. [ASSUMED]  
**Warning signs:** Firecrawl is never called, a run completes in the Phase 32 five-second window, or the persisted policy still says `phase32_noop`. [VERIFIED: `src/workflows/analysisRun.ts:49-60`; [ASSUMED]]

### Pitfall 2: Completion precedes immutable persistence

**What goes wrong:** A run is `completed` but no durable packet exists, or a retry creates a second packet. [ASSUMED]  
**How to avoid:** Persist once with a unique run key, then transition; treat an existing immutable packet as authoritative on replay. [VERIFIED: Phase 31 idempotency decision; [ASSUMED] result schema]

### Pitfall 3: Citation gate accepts URL-only or parent-page evidence

**What goes wrong:** A model cites a syntactically valid URL that was not fetched, or a parent URL resolves through permissive prefix matching. [VERIFIED: `src/lib/validation/airsRules.ts:42-69`; [ASSUMED] threat impact]  
**How to avoid:** Only server-derived fetched sources can be cited; require canonical exact source identity and excerpt/content-hash support. [ASSUMED]

### Pitfall 4: Finding identity follows mutable signal names

**What goes wrong:** A later catalog edit makes an old result appear attached to a different signal. [VERIFIED: Phase 32 immutable checklist contract; [ASSUMED] impact]  
**How to avoid:** Store and validate the snapshotted numeric signal ID plus copied snapshot identity; never re-resolve by name during execution or review. [VERIFIED: `src/lib/analysis/contracts.ts:133-146`; [ASSUMED] persistence design]

### Pitfall 5: Firecrawl content injects instructions or causes unbounded spend

**What goes wrong:** A page tells the model to ignore policy, call arbitrary tools, reveal secrets, or causes repeated searches/scrapes. [ASSUMED]  
**How to avoid:** Delimit content as untrusted data, fixed tool map, max tool calls/results/bytes/time/spend, and fail closed on policy violations. [VERIFIED: `src/lib/agents/runAgent.ts:60-84`; [CITED: https://github.com/firecrawl/firecrawl-docs/blob/main/developer-guides/cookbooks/ai-research-assistant-cookbook.mdx]]

### Pitfall 6: Persona data leaks through telemetry or raw audit JSON

**What goes wrong:** Full Persona rows, emails, LinkedIn URLs, excerpts, prompts, or model reasoning are copied into Langfuse or packet JSON. [VERIFIED: `src/lib/db/schema.ts:88-103`; [ASSUMED] leak path]  
**How to avoid:** Fail-closed policy, input/output redaction before model and telemetry calls, safe metadata allowlist, and no chain-of-thought persistence. [VERIFIED: `.planning/REQUIREMENTS.md:71-75`; [ASSUMED] implementation details]

### Pitfall 7: Provider selection is redesigned in the execution phase

**What goes wrong:** A new provider branch, settings read, or Exa integration diverges from the existing four-provider chain and audit identity. [VERIFIED: `src/lib/agents/modelConfig.ts:111-121`; `.planning/REQUIREMENTS.md:72-75`]  
**How to avoid:** Resolve the chain from the Phase 32 snapshot and call `instantiateChain`; record actual `modelUsed` and resolved chain, but never expose provider controls in this phase. [VERIFIED: `src/lib/agents/analyzeCompany.ts:83-112,162-165`]

## Code Examples

### Existing scalar workflow boundary

```typescript
// Source: src/workflows/analysisRun.ts:33-36
export async function analysisRun(applicationRunId: number) {
  'use workflow';
  const current = await loadRun(applicationRunId);
  // Phase 33 inserts real execution after the guarded claim.
}
```

### Existing provider-neutral model/tool loop

```typescript
// Source: src/lib/agents/runAgent.ts:69-84
const result = await generateText({
  model: models[i],
  tools: { webSearch: webSearchTool },
  prompt: buildAnalyzePrompt(company, liveSignals),
  stopWhen: isStepCount(12),
  output: Output.object({ schema: outputSchema }),
  timeout: { totalMs },
});
```

AI SDK documentation confirms that structured output generation is part of the multi-step tool loop and must be included in the `stopWhen` budget. [CITED: https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data; [VERIFIED: `src/lib/agents/runAgent.ts:69-84`]]

### Existing fail-closed citation derivation

```typescript
// Source: src/lib/agents/analyzeCompany.ts:201-224
for (const result of step.toolResults ?? []) {
  if (result.toolName !== 'webSearch') continue;
  // Only actual tool output becomes the server-derived appendix.
}
```

Phase 33 should preserve this trust direction and extend the output to canonical persisted sources. [VERIFIED: `src/lib/agents/analyzeCompany.ts:198-225`]

## Recommended Implementation Ordering

1. **Wave 0 — policy, contracts, and snapshot handoff:** Lock the deferred/approved Phase 33 policy record, add the versioned policy snapshot constructor at run creation, preserve `phase32_noop`, define packet/finding/source/link schemas, and add Persona fail-closed tests. [VERIFIED: Phase 32 contract pattern; RESOLVED: explicit human decision record]
2. **Wave 1 — additive persistence and evidence normalization:** Add immutable result/finding/source/link and retention-tombstone/query structures; prove single-statement/CTE atomicity, replay behavior, and retention enforcement. In parallel implement canonical URL/content validation, deterministic source dedupe, duplicate-link rejection, excerpt anchoring, finding-to-checklist mapping, and fail-closed packet validation. [VERIFIED: Phase 32 transaction finding; RESOLVED: duplicate semantics]
3. **Wave 2 — provider/tool adapter and typed retrieval:** Reuse `instantiateChain`, existing `runAgent` structured-output path, and Firecrawl-only search. Add server-only typed page retrieval restricted to the search-result set; adapt Company and approved Persona inputs without exposing scrape as a model tool. [VERIFIED: existing seams; RESOLVED: Firecrawl typed retrieval boundary]
4. **Wave 3 — durable workflow and telemetry:** Replace the no-op branch with claim → reload → execute → validate → persist → complete. Bound execution from the versioned policy snapshot, enforce safe failure/replay, and add allowlisted best-effort Langfuse metadata. [VERIFIED: `src/workflows/analysisRun.ts:33-73`; `src/lib/db/queries/analysisRuns.ts:195-277`]
5. **Wave 4 — scope verification:** Run the concrete source-scope audit, focused unit/DB/workflow/build gates, and the approved/deferred live smoke checkpoint. Prove no Exa, direct agent DB writes, Phase 34 review/candidate writes, bulk/scheduled paths, Phase 35 UI, Phase 36 management, or chain-of-thought. [VERIFIED: user constraints; `.planning/REQUIREMENTS.md:64-75`; `.planning/ROADMAP.md:446-478`]

## Runtime State Inventory

This is an additive execution/persistence phase, not a rename or migration of existing runtime records. [VERIFIED: phase scope]

| Category | Items found | Action required |
|---|---|---|
| Stored data | Phase 32 `analysis_run`/events and legacy `agent_run`/proposal data exist; Phase 32 rows contain immutable intent snapshots but no result packet tables. [VERIFIED: `src/lib/db/schema.ts:573-636`; `src/lib/db/schema.ts:243-280`] | Add result tables; do not migrate or repurpose legacy records. |
| Live service config | Existing Workflow, Firecrawl, model-provider, and Langfuse configuration is environment/service-backed; no Phase 33-specific live config was verified. [VERIFIED: `src/lib/agents/tools.ts:11-16`; `src/lib/telemetry/langfuse.ts:23-32`; [ASSUMED] deployment state] | Reuse existing config; require human-approved live smoke before claiming provider execution. |
| OS-registered state | None identified for this application phase. [VERIFIED: repository/environment inspection] | None. |
| Secrets/env vars | `DATABASE_URL`, provider keys, `FIRECRAWL_API_KEY`, Langfuse keys, and Clerk values are server-only configuration. [VERIFIED: `src/lib/env.ts`; `src/lib/agents/tools.ts:11-16`; `src/lib/telemetry/langfuse.ts:23-31`] | Never copy values into snapshots, packets, telemetry, tests, or research. |
| Build artifacts/installed packages | Existing packages and Workflow generated test artifacts are present; no new dependency is required. [VERIFIED: `package.json`; local environment] | Keep package versions pinned/as declared; no opportunistic upgrade. |

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---:|---|---|
| Node.js | Next, Workflow, AI SDK, Langfuse | ✓ | v22.23.1 | — [VERIFIED: local command] |
| npm | package/test scripts | ✓ | 10.9.8 | — [VERIFIED: local command] |
| Workflow DevKit | durable executor | ✓ | repository `4.8.0` | — [VERIFIED: `package.json`] |
| Firecrawl SDK | source retrieval | ✓ | repository declaration; npm latest 4.32.0 | Human-approved live key required for real calls. [VERIFIED: `package.json`; npm registry] |
| Langfuse packages | trace export/URL | ✓ | repository declarations; npm latest 5.10.0 | No-op when keys absent; product packet still persists safe trace-null metadata. [VERIFIED: `src/lib/telemetry/langfuse.ts:23-41`] |
| Neon/Postgres | durable result writes | configured in project; credential not inspected | `@neondatabase/serverless` 1.1.0 | Existing focused DB integration path; no `psql` required. [VERIFIED: `src/lib/db/index.ts`; npm registry; local command] |
| `psql` | optional direct DB inspection | ✗ | — | Use Drizzle/Neon integration tests. [VERIFIED: local command] |

**Missing dependencies with no fallback:** None identified.  
**Missing dependencies with fallback:** `psql` is absent but not required. Live provider credentials are intentionally not verified or printed; a human-approved live smoke is required before any claim of live execution. [VERIFIED: user constraint; local command]

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Vitest plus `@workflow/vitest`; existing Playwright for authenticated/reload smoke. [VERIFIED: `package.json`] |
| Config file | `vitest.config.ts`, `vitest.workflow.config.ts`, `playwright.config.ts`. [VERIFIED: repository files] |
| Quick run command | `npm test -- src/lib/analysis/groundedContracts.test.ts src/lib/analysis/personaPolicy.test.ts src/lib/analysis/contracts.test.ts src/lib/analysis/snapshots.test.ts` (Wave 0 contracts/handoff). [RESOLVED] |
| Workflow command | `npm run test:workflow` with `TEST_DATABASE_URL`; no provider spend in automated tests. [VERIFIED: `package.json`; Phase 32 plan 32-05:101] |
| Full phase gate | Focused unit/DB/workflow tests, `npx tsc --noEmit`, `npm run build`, then authenticated reload smoke; live provider smoke only at an explicit human checkpoint. [VERIFIED: Phase 31/32 gates; [ASSUMED] Phase 33 additions] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test type | Automated command | File exists? |
|---|---|---|---|---|
| RUN-04 | Adapter uses snapshotted chain, existing modelFactory, Firecrawl tool contract, and no Exa imports. | unit + static boundary | `npm test -- src/lib/analysis/execution.test.ts src/lib/analysis/evidenceRetrieval.test.ts` | Planned Wave 2 |
| RUN-04 | Workflow receives only scalar ID and runs after navigation independent of caller. | workflow integration | `npm run test:workflow` | Existing workflow suite; extend in Phase 33 |
| EVD-01 | Valid completed packet has immutable narrative, findings, raw safe audit, model/trace/timing. | schema + DB integration | `npm test -- src/lib/analysis/results.test.ts src/lib/db/queries/analysisResults.test.ts` | Planned Wave 1 |
| EVD-02 | Finding must match checklist snapshot and use closed evidence status/confidence. | pure contract | `npm test -- src/lib/analysis/evidence.test.ts` | Planned Wave 1 |
| EVD-03 | Material finding has persisted exact canonical source, title, retrieved time, bounded excerpt, and link. | unit + DB integration | `npm test -- src/lib/analysis/evidence.test.ts src/lib/analysis/evidenceRetrieval.test.ts src/lib/db/queries/analysisResults.integration.test.ts` | Planned Waves 1-2 |
| EVD-04 | Unsafe/unsupported/duplicate/unlinked/missing-support/injection evidence rejects the packet; canonical duplicate source discovery keeps one source and duplicate links reject. | adversarial unit | `npm test -- src/lib/analysis/evidence.test.ts` | Planned Wave 1 |
| EVD-05 | Persona missing policy fails closed; approved input is minimized/redacted/classified and telemetry/retention are safe. | policy + retention + redaction tests | `npm test -- src/lib/analysis/personaPolicy.test.ts src/lib/db/queries/analysisResults.test.ts src/lib/telemetry/langfuse.test.ts` | Planned Waves 0-3 |

### Sampling Rate

- **Per task:** focused pure contract/evidence test; no live provider call. [ASSUMED]
- **Per wave:** focused DB/workflow suite plus `npx tsc --noEmit`. [VERIFIED: Phase 31/32 validation patterns]
- **Phase gate:** all focused tests, DB atomicity/replay tests, `npm run test:workflow`, build, source-scope audit, and approved authenticated reload smoke. [ASSUMED]

### Planning gaps resolved

- [x] Versioned policy snapshot handoff with explicit approved/deferred record.
- [x] Packet/finding/source/link schemas, immutable persistence, and retention path.
- [x] Canonical URL/content validator, typed Firecrawl retrieval, and adversarial evidence tests.
- [x] Subject-neutral adapter seam with mocked model/Firecrawl fixtures.
- [x] Workflow persistence ordering, replay, timeout, failed validation, and no-direct-write tests.
- [x] Safe Langfuse metadata/redaction tests without real credentials.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard control |
|---|---|---|
| V2 Authentication | yes | Existing authenticated launch/status boundaries use `requireStaffAccess()`; Workflow steps trust only server-created run IDs. [VERIFIED: `src/app/api/analysis-runs/[id]/route.ts:16-30`; Phase 31 decisions] |
| V3 Session Management | yes | Do not pass Clerk/session values into Workflow args, model prompts, snapshots, packets, or telemetry. [VERIFIED: user constraints; Phase 31 decisions] |
| V4 Access Control | yes | Agent has no direct write capability; only server persistence step can write a run packet, and later review/activation remain separate phases. [VERIFIED: `.planning/REQUIREMENTS.md:71-75`; [ASSUMED] enforcement implementation] |
| V5 Input Validation | yes | Zod strict schemas for snapshots, model output, tool output, URL/content, finding identity, policy, and Persona redaction. [VERIFIED: existing Zod pattern; [ASSUMED] new schemas] |
| V6 Cryptography | no new primitive | Use content hashes only for dedupe/integrity; do not invent encryption or token handling in this phase. [ASSUMED] |

### Known Threat Patterns for Workflow + AI SDK + Firecrawl

| Pattern | STRIDE | Standard mitigation |
|---|---|---|
| Prompt injection in retrieved page | Tampering / Elevation | Treat retrieved content as untrusted data, delimit it, fixed tool map, reject policy/tool violations. [ASSUMED] |
| SSRF/private URL retrieval | Information disclosure | HTTPS-only canonical validator, reject credentials/private/local hosts, only retrieve server-approved Firecrawl results. [ASSUMED] |
| Hallucinated citation | Information disclosure | Server-derived source set, exact canonical link, excerpt/content hash, fail-closed unresolved citation. [VERIFIED: `src/lib/validation/airsRules.ts:42-73`; [ASSUMED] extension] |
| Duplicate/replayed workflow step | Tampering | Unique run result, guarded status transitions, idempotent persistence, no overwrite/delete helpers. [VERIFIED: Phase 31 idempotency; `src/lib/db/queries/analysisRuns.ts:215-277`] |
| Cost/tool abuse | Denial of service | Snapshotted bounded attempts/tool calls/time/spend/source count and Firecrawl result limits. [VERIFIED: `src/lib/agents/runAgent.ts:60-84`; [CITED: https://github.com/firecrawl/firecrawl-docs/blob/main/developer-guides/cookbooks/ai-research-assistant-cookbook.mdx]] |
| Persona PII leakage | Information disclosure | Fail-closed policy, minimum-data input, redaction before prompt/telemetry, classification and retention fields. [VERIFIED: user constraint; [ASSUMED] implementation details] |
| Direct agent write | Tampering | Adapter returns data only; persistence is a separate authenticated/server-owned step after validation. [VERIFIED: existing `analyzeCompany` no-write seam `src/lib/agents/analyzeCompany.ts:21-23`; [ASSUMED] Phase 33 decomposition] |

## Scope Fence

In scope: replacing the Phase 32 no-op branch with bounded real execution; reusing existing modelFactory, runAgent/AI SDK, Firecrawl, Langfuse, and Workflow seams; normalized immutable packet persistence; evidence validation/linking; safe failure audit; Persona policy gate. [VERIFIED: user request; `.planning/ROADMAP.md:434-444`]

Out of scope: Exa or any new provider; provider/model controls; bulk/scheduled/automatic runs; candidate aggregation; review creation or Confirm/Dismiss; live Signal/Offering writes; template editing; Phase 35 preview/history/result UI; chain-of-thought display; legacy `agent_run` migration. [VERIFIED: user request; `.planning/REQUIREMENTS.md:64-75`; `.planning/ROADMAP.md:446-478`]

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | A versioned Phase 33 policy handoff is required; exact limits remain human-approved or deferred. | Snapshot handoff | Implementation cannot safely enable network/tool execution without product/cost approval. |
| A2 | Four additive normalized tables are preferable to one packet JSONB blob. | Persistence shape | Phase 34/35 query needs may require a different normalized boundary. |
| A3 | Exact canonical URL equality plus content hash is required for v1.7 evidence identity; duplicate canonical sources keep one identity. | Evidence rules | Duplicate finding-source links must remain rejected even when source discovery dedupes. |
| A4 | Persona execution and retention are disabled when policy approval is absent, including missing retention duration. | Persona policy | Human approval may later enable the explicit expiry/tombstone path. |
| A5 | Existing `runAgent` can be generalized or wrapped for Persona without changing provider selection. | Adapter | A separate subject prompt contract may be needed while preserving the same model/tool seam. |
| A6 | Packet writes can be made atomic with a Neon HTTP-compatible single statement/CTE. | Persistence ordering | A failed atomicity probe blocks implementation; do not use independent inserts. |
| A7 | Raw audit output means a redacted, allowlisted structured attempt record, not private chain-of-thought or unrestricted prompt/output text. | EVD-01 | Exact allowlist is represented in the approved/deferred policy record. |

## Open Questions (RESOLVED)

1. **Exact Phase 33 execution policy:** **Disposition — blocking human
   decision.** The Phase 32 `phase32_noop` snapshot remains unchanged. Phase 33
   adds a separate versioned policy constructor at run creation. Until a named
   approver supplies all limits, new Phase 33 snapshots are
   `phase33_policy_deferred` with `executionEnabled: false`; no limits are
   invented from the research-only future budget.
2. **Persona retention/classification:** **Disposition — fail closed pending
   approval.** Missing version, allowlist, redaction/classification, or duration
   prevents Persona provider/tool calls and retains no Persona packet/source/
   telemetry. Approved artifacts carry expiry and are hidden/tombstoned by a
   server-side retention path.
3. **Evidence storage:** **Disposition — bounded excerpt plus content hash.**
   Persist canonical URL/title/retrieval time/bounded excerpt/content hash and
   classification; do not persist full retrieved documents.
4. **Citation tolerance:** **Disposition — strict v1.7 exact identity.** A
   citation resolves only to an exact canonical URL/content hash in the
   server-owned search/retrieval set. Legacy AIRS suffix/parent tolerance stays
   isolated.
5. **Audit visibility:** **Disposition — allowlisted safe metadata only.**
   Store structured model/tool/timing/count/trace data and safe reasons; never
   raw prompts, unrestricted output/web content, credentials, PII, or private
   reasoning.
6. **Duplicate source semantics:** **Disposition — deterministic canonical
   dedupe.** Multiple Firecrawl results with the same canonical URL/content hash
   keep the first source identity. A repeated finding-source pair is rejected;
   it is never silently persisted twice. This is not a whole-packet rejection
   for duplicate source discovery alone.

## Sources

### Primary (HIGH confidence)

- `.planning/REQUIREMENTS.md:17-32,64-75` — RUN-04/EVD requirements and explicit no-Exa/no-write/chain-of-thought boundaries. [VERIFIED: planning file]
- `.planning/ROADMAP.md:126-137,434-444,446-478` — Phase 31-36 dependency and scope boundaries. [VERIFIED: planning file]
- `.planning/phases/31-durable-executor-selection-validation/31-RESEARCH.md` — Workflow scalar boundary, retries, idempotency, and DB-authoritative lifecycle. [VERIFIED: planning artifact]
- `.planning/phases/32-template-snapshot-run-ledger/32-RESEARCH.md` — immutable snapshots, Neon HTTP transaction limitation, ledger contract, and Phase 33 handoff. [VERIFIED: planning artifact]
- `src/workflows/analysisRun.ts:25-183` — current Phase 32 no-op workflow and exact replacement seam. [VERIFIED: codegraph]
- `src/lib/db/queries/analysisRuns.ts:36-277` — guarded run/event persistence and replay semantics. [VERIFIED: codegraph]
- `src/lib/analysis/contracts.ts:76-207` and `src/lib/analysis/snapshots.ts:14-68` — strict snapshot schemas and no-op policy. [VERIFIED: codegraph]
- `src/lib/agents/modelFactory.ts:108-167`, `src/lib/agents/runAgent.ts:39-114`, `src/lib/agents/tools.ts:1-43` — provider/model/tool seams. [VERIFIED: codegraph]
- `src/lib/agents/analyzeCompany.ts:21-23,70-167,198-249` — no-write AI orchestration, server-derived evidence, classification, model/chain audit. [VERIFIED: codegraph]
- `src/lib/validation/validateReport.ts:1-27` and `src/lib/validation/airsRules.ts:42-125` — existing fail-closed evidence gate. [VERIFIED: codegraph]
- `src/lib/telemetry/langfuse.ts:1-93` — existing Langfuse singleton, AI SDK 7 OTel registration, trace URL lookup, and best-effort behavior. [VERIFIED: codegraph]
- `src/lib/db/schema.ts:88-103,239-292,573-636` — Persona fields, legacy agent records, and Phase 32 ledger. [VERIFIED: codegraph]

### Official documentation (HIGH/MEDIUM)

- [Workflow DevKit Next.js guide](https://workflow-sdk.dev/docs/getting-started/next) — `withWorkflow`, workflow/step boundary, and start behavior. [CITED: official docs]
- [AI SDK structured output](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data) — `generateText`, tools, `Output.object`, and step budgeting. [CITED: official docs]
- [Firecrawl Node API source-of-truth](https://github.com/firecrawl/firecrawl-docs/blob/main/agent-source-of-truth/node.mdx) — `search()` inputs, result collections, limits, invalid URL handling, timeout, and scrape options. [CITED: official docs]
- [Firecrawl AI research assistant cookbook](https://github.com/firecrawl/firecrawl-docs/blob/main/developer-guides/cookbooks/ai-research-assistant-cookbook.mdx) — bounded tool-loop/cost guidance. [CITED: official docs]
- [Drizzle Neon connection](https://orm.drizzle.team/docs/connect-neon) — `neon-http` versus WebSocket/session transaction behavior. [CITED: official docs]
- [Langfuse Vercel AI SDK integration](https://langfuse.com/integrations/frameworks/vercel-ai-sdk) — AI SDK 7 callback telemetry, OTel processor, metadata selection, and serverless flushing. [CITED: official docs]
- Context7 `/vercel/workflow-examples`, `/websites/ai-sdk_dev`, `/firecrawl/firecrawl-docs` — current API examples used to cross-check Workflow, structured output/tool loops, and Firecrawl search behavior. [VERIFIED: Context7]

### Registry/environment evidence (HIGH)

- npm registry checks on 2026-08-07 for `ai`, `firecrawl`, Langfuse packages, Drizzle, Neon, and Workflow versions/repositories. [VERIFIED: npm registry]
- `slopcheck install --ecosystem npm ...` on 2026-08-07 — eight packages `[OK]`; no recommended package was removed. [VERIFIED: slopcheck]
- Local availability checks: Node `v22.23.1`, npm `10.9.8`, no `psql` in PATH. [VERIFIED: local command]

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — existing declarations/seams plus current official docs and registry checks. [VERIFIED: package.json; official docs]
- Architecture/handoff: **HIGH** — exact Phase 31/32 workflow, snapshot, and DB lines were inspected. [VERIFIED: codegraph; planning artifacts]
- Evidence normalization/persistence shape: **MEDIUM** — existing evidence gate strongly constrains the design, but new result tables and exact URL/content policy are not yet implemented. [VERIFIED: existing code; [ASSUMED] new design]
- Persona policy: **LOW/MEDIUM** — existing fields and current host classification are known, but product/legal retention and allowed data flows require approval. [VERIFIED: codebase; [ASSUMED] policy proposal]
- Security pitfalls: **MEDIUM** — existing fail-closed patterns and official tool controls are verified; prompt injection/SSRF policy details remain implementation decisions. [VERIFIED: existing code/docs; [ASSUMED] controls]

**Research date:** 2026-08-07  
**Valid until:** 2026-08-14 for Workflow/AI SDK/Firecrawl/Langfuse APIs; 2026-08-28 for stable DB and phase-boundary findings.
