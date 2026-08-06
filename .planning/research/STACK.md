# Technology Stack — v1.7 Agent Constructor & Buying Signal Analysis

**Project:** ArcLumen 360  
**Researched:** 2026-08-06  
**Scope:** Stack decisions only: provider-agnostic agent construction, durable run/result persistence, citations, and review reuse. No external Exa dependency.

## Recommendation

**Reuse the installed AI, research, observability, relational, and auth stack. Add no AI-model, web-search, ORM, or citation package for v1.7.** Build the constructor as application-owned TypeScript contracts over the current `runAgent`/`modelFactory` seams, and persist its templates, runs, findings, citations, and one-run review decision in Neon through Drizzle.

The existing AI SDK contract already supports the needed composition: `generateText` accepts tools plus `Output.object({ schema })`, and structured output is an additional tool-loop step, so the current `stopWhen` budget must reserve a final formatting step. Firecrawl's installed SDK provides the existing source of public-web results, including title and URL; retain the server-derived citation appendix rule rather than accepting model-recited citations. Langfuse remains the trace/cost system; Neon remains the durable product record.

**Important boundary:** a Postgres row makes a run durable, but does not itself execute work after an HTTP response. The current company analysis is a single Vercel Route Handler with a 54-second internal budget below its 60-second `maxDuration`. Therefore v1.7 must either (a) define “asynchronous” as a client-pollable request that remains in the same invocation, retaining the present ceiling, or (b) select and validate a durable job/workflow executor in a dedicated phase before promising detached/retryable processing. Do **not** claim a Server Action, `after()`, or a database status row is a durable background worker.

## Recommended Stack

### Core Framework and AI Execution

| Technology | Current version | Purpose in v1.7 | Why |
|---|---:|---|---|
| Next.js App Router | `16.2.11` | Template management pages, preview/run route, history and findings pages | Already hosts the authenticated product and Route Handlers. Keep server execution in Node, not Edge, because the installed providers, Firecrawl, and telemetry are server-side. |
| `ai` (Vercel AI SDK) | `^7.0.45` (lockfile-resolved source currently uses AI SDK 7) | Provider-neutral execution, tool loop, typed result generation | Existing `runAgent` already uses `generateText`, `tool`, `isStepCount`, `Output.object`, timeouts, retries, and `LanguageModel`. A constructor must depend on this interface, not provider-specific SDKs. |
| `zod` | `^4.4.3` | Template input/result/finding/citation schemas and runtime boundary validation | The application already validates agent output and Server Action input with Zod. Each template should own a versioned Zod result schema; persist a normalized projection, not unchecked model JSON. |
| `@ai-sdk/anthropic`, `@openrouter/ai-sdk-provider`, `@ai-sdk/openai-compatible` | `^4.0.26`, `^3.0.0`, `^3.0.22` | Existing four-provider model catalog and fallback chain | Reuse only through `modelFactory.ts`. It is intentionally the only module importing provider SDKs; new agent templates receive resolved `LanguageModel`s, never API keys or provider clients. |

### Research, Evidence, and Observability

| Technology | Current version | Purpose in v1.7 | Why |
|---|---:|---|---|
| `firecrawl` | `^4.32.0` | Public-web search tool and citation-source material | `webSearchTool` already calls `Firecrawl.search(query, { limit: 5 })` and normalizes results to `{ url, title, snippet }`. Use that tool adapter for both Company and Persona analyses; do not add Exa or another search provider. |
| Langfuse (`@langfuse/client`, `@langfuse/otel`, `@langfuse/vercel-ai-sdk`) | `^5.10.0`, `^5.10.0`, `^5.9.1` | Trace model/tool execution, costs, and human corrections | Existing explicit `initLangfuse()` plus AI SDK telemetry integration is provider-agnostic. Store `traceId`/`traceUrl` on each durable run; product review state remains in Postgres, with Langfuse as observability rather than the queue of record. |
| Server-derived citation appendix | Existing app pattern | Citation retention and validation | `deriveEvidenceAppendix(run.steps)` currently derives evidence from actual tool results before the gate accepts output. Generalize this pattern to normalized `analysis_citation` rows (or an equivalent child relation), preserving URL, title, snippet, retention tag, and the finding linkage. |

### Database and Durable Product State

| Technology | Current version | Purpose in v1.7 | Why |
|---|---:|---|---|
| Neon Postgres + `@neondatabase/serverless` | `^1.1.0` | Durable templates, runs, findings, citations, review decision | This is the app's existing system of record; relational parents/children fit templates → runs → findings → citations → decision much better than an editorial CMS or model-output-only JSON. |
| Drizzle ORM + Drizzle Kit | `^0.45.2`, `^0.31.10` | Typed schema, indexes, transactions, schema push | Existing schema is in `src/lib/db/schema.ts` and `drizzle-kit push` is the project migration path. Add enum-backed run/review status fields, foreign keys, and indexes at the schema layer. Use a transaction for the terminal write of a run plus its normalized children and proposal/review record. |
| Existing `agent_run` / `signal_proposal` / `correction` pattern | Application code | Compatibility bridge to Reviews | Reuse its trace, model-chain, usage, evidence, and human-correction conventions, but do **not** overload it as the new universal schema: `agent_run.company_id` is mandatory and `signal_proposal` encodes one proposal accepted into a live `signal`. Add generic constructor-owned tables/contracts and adapt only the shared review semantics. |

### Supporting Runtime Contracts (No New Package)

| Contract | Existing seam | v1.7 use |
|---|---|---|
| Provider-neutral executor | `src/lib/agents/modelFactory.ts` → `instantiateChain()` | Constructor passes a resolved model chain into a generic executor; provider identity/fallback behavior stays unchanged. |
| Current agent loop | `src/lib/agents/runAgent.ts` | Extract/generalize the company-specific prompt/schema/tool bundle into a template execution contract. Preserve its timeout/fallback constraints until a durable executor is selected. |
| Company loading + active signals | `src/lib/agents/analyzeCompany.ts`, Signals data model | Derive the Company and Persona signal schemas from active Signal records at run start; persist the signal-schema/version snapshot on the run so later Signal edits do not reinterpret history. |
| Auth | `requireStaffAccess()` | Gate template management, run creation, history, and whole-run approval/dismissal independently on every page, Route Handler, and Server Action. |
| Existing reviews | `src/app/actions/reviews.ts`, `signal_proposal`, `correction` | Reuse status-guarded/idempotent resolution and structured correction concepts; introduce a run-level decision action instead of looping existing per-signal Accept/Reject actions. |

## Exact Integration Seams

### Existing seams to reuse

1. **`src/lib/agents/modelFactory.ts`** — the only provider-SDK import boundary. New constructor code calls `instantiateChain(modelChain)`; it must not create Anthropic/OpenRouter/Nous/OpenCode clients.
2. **`src/lib/agents/runAgent.ts`** — existing AI SDK tool-loop, structured-output, 54-second budget, fallback, and `modelUsed`/`modelChain` audit seam. Generalize its input/output dependencies, not its provider logic.
3. **`src/lib/agents/tools.ts` → `webSearchTool`** — the sole public-web capability. Its Firecrawl results are the evidence source.
4. **`src/lib/agents/analyzeCompany.ts`** — exemplifies model-chain snapshot-at-entry, server-derived evidence, output gate, and current active-signal load. Split its company-specific assembly from the generic reusable execution path.
5. **`src/lib/telemetry/langfuse.ts`** — existing explicit initialization, trace URL lookup, and correction annotation mirror.
6. **`src/lib/db/schema.ts` + `src/lib/db/queries/runs.ts`** — Neon/Drizzle persistence and the existing model/trace/usage audit fields.
7. **`src/lib/db/schema.ts` → `signalProposal` / `correction`; `src/app/actions/reviews.ts`** — existing review state, idempotent resolution, correction reason, and `revalidatePath` patterns to adapt at run granularity.
8. **`src/lib/auth/requireStaffAccess.ts`** — authorization boundary for all state-changing constructor endpoints.

### Proposed seams to add

| Proposed seam | Responsibility | Must connect to |
|---|---|---|
| `src/lib/agents/constructor/contracts.ts` | Versioned `AgentTemplate`, target input, normalized result/finding/citation, and review-decision Zod contracts | `runAgent` adapter; template registry; Drizzle persistence |
| `src/lib/agents/constructor/registry.ts` | Named built-in Company/Persona Buying Signal templates and their active-Signal-derived schema builder | Signals query layer; prompt builder; contract version snapshot |
| `src/lib/agents/constructor/execute.ts` | Generic orchestration: load target/signals, resolve model chain once, call current AI SDK loop/tools, derive citations, validate normalized result | `modelFactory`, `webSearchTool`, Langfuse, per-template contracts |
| `src/lib/db/schema.ts` additions plus `src/lib/db/queries/agentConstructor.ts` | `agent_template`, `agent_analysis_run`, `agent_analysis_finding`, `agent_analysis_citation`, and a one-decision-per-run review record; status + terminal timestamps + indexes | Neon/Drizzle; run/history/review UI |
| `src/app/api/agent-runs/[id]/*` or equivalent Route Handler boundary | Create/status/result endpoints used by preview-and-run and polling | `requireStaffAccess`, executor selection, persistence queries |
| `src/app/actions/agent-reviews.ts` | Atomic approve/dismiss of one completed run, including structured correction/reason if dismissed | Generic run review tables; existing correction/Langfuse conventions |

## Persisted-Async Execution Decision

| Requirement interpretation | Stack outcome | Roadmap decision |
|---|---|---|
| UI starts a run and polls while the original Route Handler executes (bounded to the current 54s loop / Vercel 60s route cap) | **No dependency addition.** Persist `queued` then `running`/terminal state in Neon, but the request remains the worker. | Viable only if v1.7 explicitly accepts no detached retries and run duration stays under the existing cap. |
| Run must survive client disconnects, retry after function failure, or exceed one Vercel invocation | **A durable execution platform is required; none exists in this repository.** | Research/select the Vercel-supported durable-workflow/job mechanism (or an approved queue worker) before implementation. Do not simulate it with `after()`, an in-process promise, or DB polling. |

This is the only material stack uncertainty for v1.7. It is an execution-infrastructure decision, not an AI SDK or web-search decision.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|---|---|---|---|
| Web research | Existing Firecrawl tool | Exa | Explicitly excluded by milestone direction; Firecrawl is already installed, keyed, normalized, observable, and citation-gated. |
| AI abstraction | Existing AI SDK 7 + `modelFactory` | Direct provider calls per template | Would bypass four-provider fallback, model preference, billing/rate-limit behavior, audit fields, and the single SDK-import boundary. |
| Durable data | Neon + Drizzle normalized relations | Store raw result only in Langfuse or JSONB | Langfuse is observability, not product state; raw JSON alone prevents target/finding/citation/history queries and safe review semantics. JSONB remains appropriate for immutable raw output/evidence snapshots alongside normalized rows. |
| Review model | New run-level adapter over existing review conventions | Reuse `signal_proposal` as-is | It is Company-only and maps each proposal to a live Signal. v1.7 needs Company **and** Persona findings plus a single whole-run decision. |
| Async implementation | Make infrastructure choice explicit | Fire-and-forget promises, Server Actions, `after()` | They do not provide durable completion/retry semantics in a serverless invocation. |

## Explicit Exclusions

- **No Exa SDK/API/dependency** — v1.7 uses the installed Firecrawl web-search tool only.
- **No new LLM provider SDK** — the four-provider registry and `modelFactory` remain the provider boundary.
- **No LangChain, LlamaIndex, or agent-framework layer** — AI SDK 7 already supplies the required tool loop and structured output; an extra framework would duplicate state/telemetry and obscure the provider seam.
- **No vector database/RAG stack** — this milestone analyzes a target against active relational Signals and live web sources; it does not retrieve an unbounded document corpus.
- **No CMS or Sanity reintroduction** — templates/results are relational operational data.
- **No external async queue selected by assumption** — a durable executor is a phase-specific research/approval gate if detached execution is required.

## Installation

```bash
# v1.7 recommended AI/research/data stack addition
# No package installation required.

# Existing verification commands after schema and contract changes
npm test
npm run build
npm run db:push
```

If the roadmap chooses true detached durable execution, its package/platform configuration is deliberately **not** specified here until that platform is approved and its current Vercel compatibility is verified.

## Sources

- Repository `package.json` — installed versions: Next `16.2.11`, `ai` `^7.0.45`, Firecrawl `^4.32.0`, Drizzle `^0.45.2`, Langfuse `5.10.x`, provider SDKs, Zod `^4.4.3`. **HIGH** (read 2026-08-06)
- Repository `src/lib/agents/runAgent.ts`, `analyzeCompany.ts`, `tools.ts`, `modelFactory.ts`, `types.ts` — current AI/tool/fallback/evidence seams. **HIGH**
- Repository `src/lib/db/schema.ts`, `src/lib/db/queries/runs.ts`, `src/app/actions/reviews.ts`, `src/lib/telemetry/langfuse.ts`, `src/lib/env.ts`, `next.config.ts`. **HIGH**
- Vercel AI SDK docs: [structured output with tools](https://github.com/vercel/ai/blob/main/content/docs/03-ai-sdk-core/10-generating-structured-data.mdx), [tool calling plus structured outputs](https://github.com/vercel/ai/blob/main/content/docs/09-troubleshooting/14-tool-calling-with-structured-outputs.mdx), and current `generateText` retry/timeout implementation. `Output.object`, tools, and `stopWhen` are supported; structured output adds a tool-loop step. **HIGH** (Context7, 2026-08-06)
- Firecrawl docs: [Node.js search quickstart](https://github.com/firecrawl/firecrawl-docs/blob/main/quickstarts/nodejs.mdx) and [v2 Search API schema](https://github.com/firecrawl/firecrawl-docs/blob/main/api-reference/v2-openapi.json). `search(query, { limit })` returns web results with title/URL; source fields support the existing normalizer. **HIGH** (Context7, 2026-08-06)
- Drizzle docs: [indexes and constraints](https://github.com/drizzle-team/drizzle-orm-docs/blob/main/src/content/docs/pg/indexes-constraints.mdx) and [Postgres relations/index examples](https://github.com/drizzle-team/drizzle-orm-docs/blob/main/src/content/docs/pg/relations.mdx). Typed enum, FK, JSONB, timestamp, and index declarations are supported. **HIGH** (Context7, 2026-08-06)
- Vercel docs: [function maxDuration](https://vercel.com/docs/functions/configuring-functions/duration). Route-level execution duration is configured with a named `maxDuration` export; current code reserves 54 seconds under an existing 60-second route cap. **HIGH** for route-duration fact; **MEDIUM** for a v1.7 durable-executor selection because no specific platform was approved in scope.
