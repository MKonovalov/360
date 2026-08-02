# Langfuse Observability — Research Addendum

**Domain:** LLM observability for the Analytic Agent (v1.1) — cost tracking, reasoning/tool-call tracing, and post-hoc human-feedback scoring
**Researched:** 2026-07-29
**Confidence:** HIGH (Context7 `/langfuse/langfuse-js` + `/langfuse/langfuse-docs`, official langfuse.com docs, npm registry version/peerDep data, cross-checked against a dedicated 2026-06-26 changelog for AI SDK v7 support) for package names, versions, and the core tracing/scoring API shape. MEDIUM for the exact automatic-cost-tracking behavior on tool calls specifically (official docs don't spell this out; reasoned from how AI SDK's OTel spans map to Langfuse "generation" vs "span"/"tool call" observation types) — flagged explicitly below, not asserted as fact.

> This file supersedes nothing — it's a net-new addendum to `.planning/research/STACK.md` and `.planning/research/ARCHITECTURE.md`, which already established the Analytic Agent's shape (`ai@7.0.41` + `@ai-sdk/openai@4.0.23`, `openai.tools.webSearch()` + a custom no-`execute` `proposeSignal` Zod tool, single `generateText` call with `stopWhen`, first Route Handler in the repo at `src/app/api/companies/[id]/analyze/route.ts`, `signalProposal` review-queue table). This file adds Langfuse on top of that exact shape.

## Is there a first-party AI SDK integration?

**Yes — official, current, and built specifically for AI SDK v7's new telemetry system.** Langfuse published a dedicated AI SDK 7 integration on 2026-06-26 (`@langfuse/vercel-ai-sdk@5.9.0`+). It is **not** middleware wrapping the model, and it is **not** manual span-by-span instrumentation you write yourself — it's an OpenTelemetry-based integration:

- AI SDK v7 replaced the old per-call `experimental_telemetry` flag with a **callback-based telemetry system**: you call `registerTelemetry(...)` once at startup with an integration object, and every subsequent `generateText`/`streamText`/tool-call span AI SDK emits gets routed through it.
- Langfuse ships `LangfuseVercelAiSdkIntegration` (from `@langfuse/vercel-ai-sdk`) as that integration object. It converts AI SDK's OpenTelemetry spans into Langfuse's trace/observation model.
- A separate `LangfuseSpanProcessor` (from `@langfuse/otel`) does the actual export of those OTel spans to Langfuse's ingestion API. You register it on a standard `@opentelemetry/sdk-node` `NodeSDK` instance.
- This means Langfuse tracing is **additive, not invasive** — nothing changes in the `generateText({ model, tools, stopWhen })` call itself beyond an optional `telemetry: { functionId }` field. The agent code from STACK.md/ARCHITECTURE.md needs no restructuring.

**Important version-gating fact:** this v7-native package is recent (changelog dated 2026-06-26). If AI SDK v6 or earlier were ever installed instead, the integration path is different (`experimental_telemetry: { isEnabled: true }` per-call, no `registerTelemetry`). Since this project is pinned to `ai@^7.0.41` per STACK.md, use the v7-native path below — do not follow older Langfuse+AI-SDK tutorials/blog posts that predate this (most web content about "Langfuse + Vercel AI SDK" still shows the pre-v7 `experimental_telemetry` pattern; verify any tutorial mentions `registerTelemetry` before trusting it).

## Exact packages and versions

| Package | Version (npm, checked 2026-07-29) | Purpose |
|---|---|---|
| `@langfuse/vercel-ai-sdk` | `5.9.1` | The AI SDK v7 telemetry integration (`LangfuseVercelAiSdkIntegration`). **Peer dep: `ai": ">=7.0.0 <8"`** — matches this project's `ai@^7.0.41` exactly. **`engines: node >=22`** — matches this project's Node 22.x pin exactly (no conflict, unlike the old Astro/Node 20 pin this repo already retired). |
| `@langfuse/otel` | `5.9.1` | `LangfuseSpanProcessor` — the OTel span exporter that actually talks to Langfuse's API. |
| `@langfuse/tracing` | `5.9.1` | Low-level tracing helpers: `propagateAttributes`, `createTraceId`, `getActiveTraceId`, `startObservation`. Needed for the trace-ID-linkage pattern below. |
| `@langfuse/client` | `5.9.1` | `LangfuseClient` — the REST client used for **scoring** (attaching human-feedback scores to a trace after the fact). This is the package the human-correction feature needs. |
| `@opentelemetry/sdk-node` | `0.221.0` | Standard OTel Node SDK, hosts the `LangfuseSpanProcessor`. `engines: node ^18.19.0 \|\| >=20.6.0` — compatible. |

All four `@langfuse/*` packages are version-locked together at `5.9.1` (same release train) — install them as a set, don't mix majors.

```bash
npm install @langfuse/vercel-ai-sdk@^5.9.1 @langfuse/otel@^5.9.1 @langfuse/tracing@^5.9.1 @langfuse/client@^5.9.1 @opentelemetry/sdk-node@^0.221.0
```

Do **not** additionally install `@vercel/otel` unless you specifically want Vercel's own OTel pipeline too — mixing `@vercel/otel`'s `registerOTel()` with a raw `NodeSDK` in the same `instrumentation.ts` is a documented footgun (double-registered tracer providers). This repo has no existing OTel/`@vercel/otel` usage today (confirmed — not in `package.json`), so the plain `NodeSDK` + `LangfuseSpanProcessor` path is the simpler, conflict-free choice here.

## Self-hosted vs Langfuse Cloud — recommendation: **Langfuse Cloud, free Hobby tier**

For a small internal tool triggered manually by staff clicking "Analyze" on one company at a time (not a high-volume production pipeline), self-hosting is not worth it:

- **Langfuse Cloud Hobby tier is free**: 50,000 "units" (1 unit = 1 trace, 1 observation, or 1 score ingested) per month, 30-day retention, 2 seats. A single Analyze run — one agent trace with a handful of tool-call/generation observations, plus later one score for the human correction — costs on the order of 5-15 units. Even daily usage across a small team stays orders of magnitude under 50K/month.
- **Self-hosting Langfuse v3 requires ClickHouse + Redis + Postgres + S3-compatible blob storage** (Langfuse's own infra stack) — a genuinely non-trivial ops surface (per Langfuse's self-hosting deployment guide and multiple 2026 pricing/architecture write-ups) for a project whose entire existing infra is "Vercel + Neon Postgres + Clerk," with **zero background workers/queues by explicit architectural constraint** (CLAUDE.md: "No background workers, queues, or long-running processes"). Standing up a ClickHouse cluster to self-host an observability tool contradicts that constraint's spirit for a feature this low-volume.
- Data sensitivity is not a blocker here: proposal reasoning/web-search traces reference public company news, not customer PII.

**Recommendation: Langfuse Cloud, EU or US region** (pick based on ArcLumen's data residency preference — no stated requirement in PROJECT.md, so either is fine; US region (`https://us.cloud.langfuse.com`) is the more common default for US-based teams).

### Env vars (add to `src/lib/env.ts`, same optional/degrade pattern as `APOLLO_API_KEY`/`OPENAI_API_KEY`)

```ts
LANGFUSE_SECRET_KEY: z.string().optional(),   // "sk-lf-..."
LANGFUSE_PUBLIC_KEY: z.string().optional(),   // "pk-lf-..."
LANGFUSE_BASE_URL: z.string().optional(),     // "https://us.cloud.langfuse.com" (or eu/jp/hipaa region)
```
Keep these optional/fail-open, not fail-fast — same reasoning STACK.md already applied to `APOLLO_API_KEY`/`OPENAI_API_KEY`: the Analyze feature is user-triggered, not core-path, and a missing Langfuse key should degrade to "agent runs without tracing," not break the build or the route. `LANGFUSE_HOST` is the old/deprecated env var name still accepted for backward compatibility — use `LANGFUSE_BASE_URL`, the current name.

## Integration pattern — concrete, for this codebase's exact shape

### 1. `instrumentation.ts` (new file, project root — Next.js's built-in instrumentation hook, stable since Next 15, no experimental flag needed on this project's Next 16.2.11)

```ts
// instrumentation.ts
import { registerTelemetry } from 'ai';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { LangfuseVercelAiSdkIntegration } from '@langfuse/vercel-ai-sdk';
import { NodeSDK } from '@opentelemetry/sdk-node';

// Exported so the Route Handler can force-flush it before the
// serverless function suspends (see pitfall #2 below).
export const langfuseSpanProcessor = new LangfuseSpanProcessor();

const sdk = new NodeSDK({ spanProcessors: [langfuseSpanProcessor] });
sdk.start();

registerTelemetry(new LangfuseVercelAiSdkIntegration());
```
Credentials (`LANGFUSE_SECRET_KEY`/`LANGFUSE_PUBLIC_KEY`/`LANGFUSE_BASE_URL`) are picked up automatically from `process.env` by `LangfuseSpanProcessor`'s default constructor — no need to pass them explicitly unless overriding.

**Node runtime requirement:** `@opentelemetry/sdk-node` does not run on Next.js's Edge runtime. The Analyze Route Handler must run on the Node.js runtime — this is already implicit (default) for `app/api/companies/[id]/analyze/route.ts` per ARCHITECTURE.md (no `export const runtime = 'edge'` anywhere in this codebase today), but worth stating explicitly as a hard constraint: never add `runtime: 'edge'` to this route.

### 2. Inside the Route Handler — generate the trace ID *yourself*, before calling the agent

This is the piece that directly drives the `signal_proposal` schema decision (see below). Rather than calling `generateText` and then trying to retrieve whatever trace ID Langfuse happened to assign, generate a known trace ID first, run the agent under it via `startObservation`, and you already have the ID to store — no post-hoc lookup needed:

```ts
// src/app/api/companies/[id]/analyze/route.ts
import { after } from 'next/server';
import { createTraceId, startObservation } from '@langfuse/tracing';
import { langfuseSpanProcessor } from '../../../../../instrumentation';
import { generateText, stepCountIs } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  await requireStaffAccess();

  const langfuseTraceId = await createTraceId(); // random, or seed with e.g. `analyze-${companyId}-${Date.now()}` for determinism

  const result = await startObservation(
    'analyze-signal-detection',
    {},
    { parentSpanContext: { traceId: langfuseTraceId, spanId: '0123456789abcdef', traceFlags: 1 } },
    () =>
      generateText({
        model: openai('gpt-5.1'), // verify current model id at implementation time
        tools: {
          webSearch: openai.tools.webSearch({ searchContextSize: 'high' }),
          proposeSignal: proposeSignalTool, // no `execute` — per STACK.md/ARCHITECTURE.md, never auto-writes
        },
        stopWhen: stepCountIs(6),
        prompt: buildAnalyzePrompt(company),
        telemetry: { functionId: 'analyze-signal-detection' },
      }),
  );

  // Insert proposal rows, one langfuseTraceId shared across all proposals from this run
  const proposals = extractProposeSignalCalls(result.toolCalls);
  await insertSignalProposals(proposals.map((p) => ({ ...p, langfuseTraceId })));

  after(() => langfuseSpanProcessor.forceFlush());

  return Response.json({ proposalCount: proposals.length });
}
```

**Schema implication — direct answer to the downstream question:** yes, `signal_proposal` needs a `langfuseTraceId` (`text`, nullable) column. All proposals produced by one Analyze run share the same trace ID — add it as one column on `signalProposal`, not a separate join table, since the relationship is many-proposals-to-one-trace and the trace ID is just an opaque string, not a foreign key into anything queryable in this app's own DB.

```ts
// addition to src/lib/db/schema.ts's signalProposal table (from ARCHITECTURE.md)
langfuseTraceId: text('langfuse_trace_id'), // nullable — null if LANGFUSE_* env vars unset (tracing optional per fail-open pattern)
```

### 3. Human-feedback scoring — attaching a reviewer's decision to the original trace, minutes later, in a separate request

This is the concrete mechanism for requirement 3 (track *why* a reviewer rejected/edited a proposal). Langfuse's scoring API is designed exactly for this: **the trace does not need to still be "open" or even exist yet** — you score by `traceId` string, and Langfuse links the score to the trace whenever both exist. This works cleanly across the gap between the original Route Handler request (writes the trace) and the later review-queue approve/reject Server Action (writes the score), since both only need the `langfuseTraceId` string, not any live connection/session.

```ts
// src/app/companies/actions.ts (or wherever the review-queue approve/reject Server Action lives)
import { LangfuseClient } from '@langfuse/client';

const langfuse = new LangfuseClient(); // reads LANGFUSE_* env vars automatically

const REJECTION_REASONS = [
  'wrong_signal_type',
  'missed_inclusion_exclusion_criteria',
  'hallucinated_no_evidence',
  'other',
] as const;

export async function rejectSignalProposalAction(
  proposalId: number,
  reason: (typeof REJECTION_REASONS)[number],
  note?: string,
) {
  await requireStaffAccess();
  const proposal = await rejectSignalProposal(proposalId); // existing DB update, status -> 'rejected'

  if (proposal.langfuseTraceId) {
    langfuse.score.create({
      traceId: proposal.langfuseTraceId,
      name: 'human-review',
      value: reason,             // categorical value
      dataType: 'CATEGORICAL',
      comment: note,             // optional free-text
    });
    await langfuse.flush();      // flush explicitly — Server Actions are also short-lived
  }
}
```
Use `dataType: 'CATEGORICAL'` (not `'NUMERIC'`/`'BOOLEAN'`) so `value` is one of the four structured reason strings from the milestone requirement, with `comment` carrying the optional free-text note. For **approvals** (positive signal — reason doesn't apply), score the same way with a `'human-review'` score of value `'approved'`, or a separate boolean score (`name: 'approved'`, `dataType: 'BOOLEAN'`) — either works; picking one consistent scheme now (recommend: single `'human-review'` categorical score with values `approved | wrong_signal_type | missed_inclusion_exclusion_criteria | hallucinated_no_evidence | other`) keeps Langfuse's scores table queryable as one dimension when tuning prompts later.

**No `id` idempotency key is strictly required** for this use case (one score per proposal, proposals aren't re-reviewed), but pass `id: `review-${proposalId}`` if you want re-submission (e.g., a reviewer changing their mind) to overwrite rather than duplicate.

## Does cost tracking work automatically?

**Partially — token/dollar cost for the LLM generation itself: yes, automatic. Cost for OpenAI's web-search tool specifically: not confirmed automatic — treat as a gap.**

- Langfuse's AI SDK integration converts each `generateText` call's OTel spans into a Langfuse **`generation`** observation carrying `model`, `usage.promptTokens`/`completionTokens`, etc. Langfuse then computes **$ cost automatically** by matching the `model` string against its built-in pricing table (OpenAI/Anthropic/Google models supported out of the box; custom models configurable in Settings → Model Definitions if a non-standard model id is ever used). This is confirmed, standard Langfuse behavior, not specific to tool-calling.
- Each **tool call** (both `webSearch` and the custom `proposeSignal` tool) shows up as its own nested **span/tool-call observation** under the trace — this comes from AI SDK's own OTel instrumentation (it emits an `ai.toolCall` span per tool invocation regardless of Langfuse), which Langfuse's integration maps into the trace tree. So the full reasoning/tool-call chain (search queries issued, `proposeSignal` arguments) is visible in the Langfuse UI per-step — this **does** satisfy requirement 2 (chain-of-thought/tool-call trace) without any extra code.
- What's **not confirmed**: whether Langfuse attributes a dollar cost to the `webSearch` tool call itself. OpenAI's web-search tool has its own per-call fee (~$0.01/search, separate from token cost) — official Langfuse docs describe cost tracking only in terms of token-based `generation`/`embedding` observations, with no documented handling of non-token tool fees. **Practical implication for this project:** the token-based LLM cost per Analyze run will show up correctly and automatically; the web-search line-item fee likely will not be reflected in Langfuse's cost total unless manually reported (e.g., via a custom `usageDetails`/cost override on that span). Given this is a low-volume, staff-triggered feature (not a cost-sensitive high-scale pipeline), **recommend accepting this gap for v1.1** rather than building manual cost-reporting — flag it as a known limitation, revisit only if OpenAI web-search volume/cost becomes material.
- The custom `proposeSignal` tool has no `execute` and isn't a billed API call itself (it's structured output extraction from the same model turn), so there's no cost to track for it beyond what's already captured in the parent `generation`'s token usage.

## Pitfalls specific to a Next.js Route Handler on Vercel

1. **Must flush before the function suspends, or traces are silently lost.** Vercel serverless functions terminate (or freeze) immediately after the response is sent; Langfuse's SDK batches events client-side and sends them asynchronously. Without an explicit flush, some or all of a run's trace data can simply never arrive. **Fix:** use Next.js's `after()` (from `next/server`, stable in App Router) to schedule `langfuseSpanProcessor.forceFlush()` to run after the response is returned but before the function fully suspends — this is Langfuse's own documented recommendation for Vercel specifically (as opposed to AWS Lambda, where the pattern is slightly different).
2. **Never call `.shutdown()` on the OTel SDK inside the handler** — only `forceFlush()` on the `LangfuseSpanProcessor`. `shutdown()` tears down the whole telemetry pipeline; on a warm serverless invocation (module state persists across requests when the function instance is reused), that would permanently break tracing for every subsequent request handled by that warm instance, not just the current one.
3. **`instrumentation.ts` runs once per server instance (cold start), not once per request.** The `NodeSDK`/`registerTelemetry` setup in `instrumentation.ts` is a one-time module-level initialization — do not duplicate this setup inside the Route Handler itself. This adds negligible latency on warm invocations; on cold starts it adds OTel SDK init time on top of the existing cold-start cost, which is worth noting but not a blocker for a manually-triggered, non-latency-critical "Analyze" button.
4. **Edge runtime is incompatible.** `@opentelemetry/sdk-node` requires the Node.js runtime. Confirm the Analyze route never gets `export const runtime = 'edge'` added (it shouldn't be, per ARCHITECTURE.md's existing Route Handler design, but worth a lint/review check given this is the codebase's first Route Handler and there's no established convention yet to catch a slip).
5. **Don't also wire up `@vercel/otel`** unless deliberately wanting Vercel's own observability pipeline too — running both `@vercel/otel`'s `registerOTel()` and a raw `NodeSDK` in the same `instrumentation.ts` risks double-registering global tracer providers. This project has no existing `@vercel/otel` usage, so just skip it.
6. **Fail-open, matching this codebase's existing external-service convention.** If `LANGFUSE_*` env vars are unset (optional, per the env var section above), `LangfuseSpanProcessor`'s export calls will fail — but this must never break the Analyze feature itself. Since Langfuse's SDK failures happen inside the OTel export pipeline (not inside your `generateText` call), a missing/invalid Langfuse key naturally cannot throw into your Route Handler's own try/catch — but confirm this holds in a smoke test before relying on it, since it's inferred from the architecture (async batched export, decoupled from the main call) rather than explicitly documented as a guaranteed non-throwing behavior.

## Sources

- Context7 `/langfuse/langfuse-js` — `LangfuseVercelAiSdkIntegration`/`registerTelemetry` v7 setup, `LangfuseSpanProcessor` OTel registration, `propagateAttributes`/`createTraceId`/`getActiveTraceId` API shapes (from `packages/vercel-ai-sdk/README.md` and `_autodocs/08-otel-integration.md`), HIGH confidence.
- [Trace AI SDK 7 with Langfuse — changelog, 2026-06-26](https://langfuse.com/changelog/2026-06-26-vercel-ai-sdk-7) — confirms v7-specific package (`@langfuse/vercel-ai-sdk@5.9.0`+ stable), callback-based telemetry replacing `experimental_telemetry`, HIGH confidence.
- [Observability and Tracing for the Vercel AI SDK — Langfuse](https://langfuse.com/integrations/frameworks/vercel-ai-sdk) — package list, `@vercel/otel` v2 alternative registration path, env var names/regions, `after()` flush pattern for Vercel, HIGH confidence.
- [Observability Integrations: Langfuse — AI SDK docs](https://ai-sdk.dev/providers/observability/langfuse) — corroborates package set and Next.js `instrumentation.ts` shape from the AI SDK side (not just Langfuse's own docs), HIGH confidence (cross-source agreement).
- [How to use Langfuse Tracing in Serverless Functions — FAQ](https://langfuse.com/faq/all/aws-lambda-and-serverless-functions) — Vercel `after`/`waitUntil` flush guidance, "don't call shutdown" warning, MEDIUM-HIGH confidence (FAQ-tier doc, but specific and consistent with the integration guide).
- [Trace IDs & Distributed Tracing — Langfuse](https://langfuse.com/docs/observability/features/trace-ids-and-distributed-tracing) — `createTraceId`/`startObservation`/`getActiveTraceId` pattern for predetermined trace IDs, directly informs the `langfuseTraceId` schema decision, HIGH confidence.
- [Scores via API/SDK — Langfuse](https://langfuse.com/docs/evaluation/evaluation-methods/scores-via-sdk) + [Custom Scores via API/SDKs](https://langfuse.com/docs/evaluation/features/evaluation-methods/custom-scores) — `LangfuseClient`, `langfuse.score.create({ traceId, name, value, dataType, comment })` shape, confirms scoring works without the trace still being "live," HIGH confidence.
- [Token & Cost Tracking — Langfuse](https://langfuse.com/docs/observability/features/token-and-cost-tracking) — automatic cost calc for `generation`/`embedding` observations based on model name + token usage; **does not address tool-call-specific costs** (gap explicitly flagged above, not inferred as confirmed), MEDIUM confidence (official doc, but incomplete on this specific question).
- npm registry (`npm view`) — exact current versions and peer-dependency/engine constraints for `@langfuse/vercel-ai-sdk`, `@langfuse/otel`, `@langfuse/tracing`, `@langfuse/client` (all `5.9.1`), `@opentelemetry/sdk-node` (`0.221.0`), `@vercel/otel` (`2.1.3`) — confirmed `ai": ">=7.0.0 <8"` and `node >=22` peer/engine constraints match this project's exact stack, HIGH confidence.
- WebSearch (multiple 2026 pricing write-ups: Coverge, DEV Community, Cekura, Glassbrain, Sentrial) — Langfuse Cloud Hobby tier (free, 50K units/month, 30-day retention, 2 seats) and self-hosted infra requirements (ClickHouse/Redis/Postgres/blob storage), MEDIUM confidence (third-party pricing summaries, not Langfuse's own pricing page directly fetched — cross-checked across 5+ independent sources agreeing on the Hobby tier numbers).

---
*Research addendum for: ArcLumen 360 v1.1 Analytic Agent — Langfuse observability integration*
*Researched: 2026-07-29*
