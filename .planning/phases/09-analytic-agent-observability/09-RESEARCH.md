# Phase 9: Analytic Agent + Observability - Research

**Researched:** 2026-07-31
**Domain:** AI agent orchestration (Vercel AI SDK v7) + web-search evidence acquisition (Firecrawl) + LLM observability (Langfuse Cloud) + durable HITL review queue (Neon Postgres + Drizzle)
**Confidence:** HIGH

## Summary

Phase 9 builds the first AI feature in ArcLumen 360: a staff-triggered, single-Company web-search signal analysis whose output lands ONLY in a durable review queue (`signal_proposal` table) — never directly in the live `signal` table (ANLZ-02 is a hard invariant). Execution is a synchronous first-ever Route Handler `POST /api/companies/[id]/analyze` behind the existing single auth gate (`requireStaffAccess()`), with `export const maxDuration = 60` fitting the Vercel Hobby ceiling (D-07). Every run is traced to Langfuse Cloud (OBSV-01) and every staff rejection writes a structured correction reason + Langfuse traceId (OBSV-02).

The governing contract is the sibling repo's AIRS/AAW/AAR standards (DRAFT v0.1.0) implemented as a **hybrid subset** (D-01): proposals carry AIRS citation discipline (evidence URL + R/C rating + snippet + reasoning), a ported TypeScript validation gate (D-03, port of `validate_report.py`) runs server-side on every run's output and **fails closed**, and the run record persists the evidence appendix + hypotheses as JSON for traceability.

**Critical version discovery:** the existing `.planning/research/*.md` documents describe **AI SDK v6** (`Experimental_Agent`, `stepCountIs(n)`, `system:`), but the registry now ships **AI SDK v7 GA** (`ai@7.0.45`): `ToolLoopAgent`, `isStepCount(n)`, `instructions:`. Likewise `@langfuse/vercel` **does not exist** (404) — the current integration package is `@langfuse/vercel-ai-sdk` with `registerTelemetry(new LangfuseVercelAiSdkIntegration())`. Planning must use the v7 API surface below, not the v6 shapes in the old research docs.

**Primary recommendation:** Use `ai@^7` + `@ai-sdk/anthropic@^4` (fast Claude model family) + `firecrawl@^4` (`/search` for this phase's freshness budget) + `@langfuse/vercel-ai-sdk@^5` callback integration (no `instrumentation.ts` needed for OBSV-01's scope). New tables: `signal_proposal`, `agent_run`, `correction`. Port the gate as a pure zod-4 schema + rule set with the sample-valid.json fixture as the canonical passing test.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Analyze trigger (Menu → Analyze) | Browser / Client | API / Backend | Menu action fires `POST /api/companies/[id]/analyze`; response renders feedback strip |
| Agent orchestration (tool loop, LLM calls) | API / Backend | — | Route Handler runs sync server-side; never in browser (secret keys) |
| Web-search evidence acquisition | API / Backend | — | Firecrawl SDK called server-side with `FIRECRAWL_API_KEY` |
| Proposal/run/correction persistence | Database / Storage | API / Backend | Drizzle writes in `signal_proposal` / `agent_run` / `correction` tables |
| Review queue (Accept/Reject) | API / Backend | Browser / Client | Server Actions mutate DB; Server Components render queue |
| Dedup vs live signals | API / Backend | Database / Storage | Server-side query (D-11); prompt-level skip instruction as secondary |
| Langfuse tracing | API / Backend | — | `registerTelemetry` in app bootstrap; runs inside Route Handler context |
| Pending-count badge | API / Backend | Browser / Client | Server Component count query; badge is presentational |

## User Constraints (from CONTEXT.md)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Agent output shape (AIRS conformance)
- **D-01:** **Hybrid output shape.** The agent's run produces two artifacts:
  1. **Proposals** — signal candidates for the review queue: `signalType` (existing enum), `strength` (existing enum), `detectedAt`, evidence `url`, `reliability` (R1–R3), `confidence` (C1–C3), `evidence_snippet`, and a reasoning string. This is the unit of staff review (ANLZ-02/03).
  2. **Run record** — per-run metadata including the full evidence appendix (evidence_id → url, ingested_at, retention_tag, R/C) and the agent's analysis (hypotheses with status + diagnostic evidence, per AIRS §4 sections 3–5), stored as JSON for traceability.
- **D-02:** Every proposal's evidence must resolve to the run's evidence appendix (AIRS §5 citation rule). Orphan citations are a hard failure — enforced by a ported validation gate (D-03).
- **D-03:** Port the standards' Stage-8 validation gate (`validate_report.py` → TypeScript) and run it **server-side on every run's output before proposals enter the review queue**. Fails closed: a run that fails the gate never surfaces proposals. Apply the subset of rules that maps to the hybrid shape (citation resolution, R/C enums, no R3·C3 in "strong" claims, `key_uncertainties` non-empty, signals-empty ⇒ no-intent verdict analog). Full-report rules (compliance_footer.approved_by, dissemination semantics) are intentionally not enforced — approval here is per-proposal, not per-report (see Deferred).
- **D-04:** **Verdict/score semantics:** no full `composite_score`/trajectory machinery this phase — ANLZ requirements don't ask for ranking or scoring; the run record may carry a lightweight verdict (`active|emerging|no_intent`-style) only if it falls out naturally from the proposal set. Do not build scoring/taxonomy-weighting infrastructure (that is the v2 PIPE-01 scoring phase).

#### AI stack & execution
- **D-05:** Stack is **Vercel AI SDK + Anthropic Claude + Firecrawl web search** (user choice; AAR Layer 1 names Firecrawl as the org's acquisition tool). Reasoner = Anthropic Claude (model family chosen at plan time; prefer a fast model to fit D-08's budget). Search = Firecrawl `/search` or `/scrape`+`/extract` per AAR §4 — plan-time decision against current Firecrawl API docs.
- **D-06:** Execution is a **synchronous Route Handler**: `POST /api/companies/[id]/analyze` (first Route Handler in the codebase — call this out as a new architectural pattern). `requireStaffAccess()` is the first call inside the handler (same single gating check as every page/Server Action). Fail-loud: real error status/body on failure so the client can render it (consistent with Phase 8's fail-loud stance; do NOT copy `arcpedia.ts`'s silent-`[]` shape).
- **D-07:** **`maxDuration = 60`** (user confirmed Hobby-tier ceiling). The agent loop must fit in 60s: parallel/streamed tool calls, capped Firecrawl rounds, lean prompt. No background workers/queues (existing architectural constraint — confirmed again).
- **D-08:** Independent failure domains: the Firecrawl/AI call and the DB writes (run record + proposals) are in **separate try/catch scopes** — an LLM/tool failure is never reported as a DB error or vice versa (same pattern as `company-detail.tsx`'s DB-fetch vs Arcpedia-fetch separation).

#### Review queue & writes
- **D-09:** Proposals persist in a **new DB table** (e.g. `signal_proposal`) — this is a durable queue (unlike Phase 8's transient review screen). Accept ⇒ write a live `signal` row (typed to existing enums) **and** mark the proposal accepted (idempotent; one Accept = one Signal). Reject ⇒ mark rejected with the structured correction reason. Never auto-write to `signal` under any circumstance (ANLZ-02).
- **D-10:** Accepted Signal rows record provenance consistent with Phase 8 conventions: `source` = the evidence URL (the `signal.source` column already exists and is free text — use it), plus the run/proposal linkage. Whether a `fieldSources`-style provenance extension is needed for signals is a plan-time call (prefer minimal: `source` URL + proposal FK).
- **D-11:** Dedup (ANLZ-05): enforced **server-side** — before (and after) the agent run, filter out any proposal whose (companyId, signalType) already exists as a live signal. The prompt also instructs the agent to skip known signals. A re-run over an already-covered signal type yields no duplicate proposals, and the UI states why ("already covered").
- **D-12:** Review queue UI: dedicated view listing pending proposals with evidence/citation shown inline (URL + snippet + R/C + reasoning), Accept / Reject controls, and the correction-reason selector on Reject (OBSV-02: wrong signal type / missed inclusion-exclusion criteria / hallucinated-no real evidence / other + optional free-text note). Badge with pending count on Company detail (ANLZ-04). Exact placement (queue page vs. detail-panel section) is a planning/UI decision — prefer a route consistent with the app's explorer patterns.

#### Observability & corrections
- **D-13:** **Langfuse Cloud** (cloud.langfuse.com) via the AI SDK Langfuse integration (`@langfuse/vercel` or equivalent current package) — traces capture tool-call/chain-of-thought steps and token cost per run (OBSV-01).
- **D-14:** Correction reasons persist in a **DB table** (durable, queryable for future prompt/taxonomy tuning) with a `traceId` column linking to the Langfuse run trace, AND are mirrored as a Langfuse annotation/feedback on that trace (OBSV-02). DB is the source of truth; Langfuse annotation is the mirror.
- **D-15:** Keys are **server-only**, added to `src/lib/env.ts` following the existing optional-with-graceful-degrade pattern (like `ARCPEDIA_ACCESS_CLIENT_*` / `APOLLO_API_KEY`): `ANTHROPIC_API_KEY`, `FIRECRAWL_API_KEY`, `LANGFUSE_PUBLIC_KEY` + `LANGFUSE_SECRET_KEY` (+ `LANGFUSE_TRACE_BASE_URL`/region if needed). If unset → Analyze action disabled with a "not configured" message; app never crashes. Keys are already provisioned (user confirmed) — never logged, never exposed to client, never committed.

#### Test policy
- **D-16:** **Tests must minimize live API calls — mock everything external.** The test suite never hits Anthropic, Firecrawl, or Langfuse: mock the AI SDK tool-loop/`generateText` layer, mock Firecrawl responses, and stub the Langfuse exporter. Real provider calls happen only in manual UAT (Phase 9's UAT run). Unit tests cover the pure logic: prompt construction, proposal schema validation, the ported validation gate, dedup filtering, accept/reject write paths, correction capture.

### Claude's Discretion
- Exact Anthropic model family (fast variant preferred given D-07's 60s budget) — decide in research/planning against current AI SDK + Anthropic docs.
- Firecrawl API surface used (`/search` vs `/scrape`+`/extract`) and how search results map to evidence appendix entries.
- Review-queue UI shape: dedicated route vs. detail-panel section; badge component placement (ANLZ-04) — follow existing explorer patterns, no new design language.
- Proposal table schema details (columns, statuses enum, FK to company, run linkage) — must support D-09/D-10/D-11/D-14.
- Whether the run record stores hypotheses per AIRS §4 section 4 verbatim or a simplified reasoning log — keep it structured JSON either way.
- Langfuse trace naming/organization (trace name = company name + timestamp; generation per LLM call).

### Deferred Ideas (OUT OF SCOPE)
- **Persona Analyze** — same agent flow on Persona detail panels; out of ANLZ scope this phase (ANLZ-01 says Company). Future phase candidate.
- **Full AIRS report semantics** — `compliance_footer`/`approved_by` (Layer 5 dissemination gate), SCIP/GDPR statement field, full 8-section report rendering + per-report human approval. The standards' DRAFT status and the per-proposal review model make this premature now; the hybrid shape (D-01) keeps the door open.
- **Composite scoring / taxonomy weights (S1–S11) + trajectory** — v2 PIPE-01 scoring phase owns this; Phase 9 stores structured analysis only.
- **Background-job execution / fire-and-poll** — only if Analyze usage grows beyond per-record single runs (research ARCHITECTURE.md flags as Future Candidate).
- **Self-hosted Langfuse** — EU data control option if cloud compliance becomes an issue.
- **Batch "analyze all" / scheduled re-analysis** — bulk agent runs need cost guards + queue infra (Pitfall 4 class).
- **Outcome feedback loop (AAW Stage 10)** — retuning agent weights from conversion outcomes; needs outcome capture infrastructure, later milestone.
</user_constraints>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ANLZ-01 | Staff can trigger on-demand, web-search-based signal analysis for a single Company via Menu → Analyze | Route Handler pattern (D-06) + ExplorerMenu Analyze slot at `src/components/enrichment/enrichment-review-dialog.tsx:177`; Firecrawl search acquisition |
| ANLZ-02 | Agent proposes candidate Signals typed to existing enums, with citation + reasoning, stored in a review queue; never auto-writes to live Signal table | D-09 `signal_proposal` table; accept-path transaction writes `signal` row only on staff Accept |
| ANLZ-03 | Staff sees a dedicated review queue listing pending proposals with evidence inline, can Accept or Reject | D-12 queue UI; Phase 7/8 review-component precedents (`src/components/import/`, enrichment review) |
| ANLZ-04 | Pending-proposal count badge on Company detail page | Badge on `company-detail.tsx`; count query over `signal_proposal` where status=pending |
| ANLZ-05 | Agent avoids re-proposing a signal that already exists as a live record for that Company | D-11 server-side dedup query against live `signal` rows by (companyId, signalType) + prompt skip instruction |
| OBSV-01 | Every run traced in Langfuse capturing CoT/tool-call steps and cost | `@langfuse/vercel-ai-sdk` `registerTelemetry(new LangfuseVercelAiSdkIntegration())`; traceId persisted on `agent_run` |
| OBSV-02 | Structured correction reason + optional note captured and linked to run's Langfuse trace | `correction` table with `traceId` column (DB = source of truth) + mirrored Langfuse annotation via `@langfuse/client` |

## Project Constraints (from CLAUDE.md)

> **Note on staleness:** `./CLAUDE.md` (project instructions) describes the pre-migration **Astro + Sanity** stack and has NOT been updated for the Next.js App Router / Neon Postgres / Drizzle migration (verified against `package.json`: `next@16.2.11`, `@clerk/nextjs@7.5.22`, `drizzle-orm@0.45.2`, `@neondatabase/serverless@1.1.0`). Stack/framework sections are superseded by the actual repo. The following directives remain binding:

- **Reuse existing Clerk integration** — ported to `@clerk/nextjs`, same Clerk project/session model, never re-implement auth. Phase 9 uses the single `requireStaffAccess()` gate (`src/lib/auth/requireStaffAccess.ts`) everywhere.
- **Node 22.x pin** (Vercel Node 20 deprecation Oct 2026) — `package.json` `engines` node 22; the Astro adapter pin bug is gone. Keep Node 22 for builds.
- **Strict TypeScript** — `tsconfig.json` strict mode active project-wide; no implicit any. New agent/gate code must type strictly.
- **Named exports only** — no default exports anywhere (`export const`, `export async function`). Follow for all new modules (`src/lib/agents/`, queries, actions).
- **camelCase identifiers**; PascalCase interfaces for record shapes (`ShortLinkRecord` precedent). Booleans read as predicates.
- **Single quotes, semicolons, 2-space indent** — no formatter/linter enforced; keep manual consistency.
- **Env vars typed centrally** — Phase 8/9 repo uses zod-validated `src/lib/env.ts` (supersedes the old `env.d.ts`); new keys go there with the optional-with-graceful-degrade pattern (D-15).
- **Server-only secrets never exposed to client** — non-`PUBLIC_` vars are server-only; `ANTHROPIC_API_KEY` etc. must never reach client bundles.
- **Comments explain *why*, not *what*** — mark non-obvious decisions (e.g., fail-closed gate, dedup ordering, traceId mirroring).
- **Error-handling guidance** — CLAUDE.md's old "fail safe, fail silent" guidance for external calls is **superseded for paid/AI calls by Phase 8's fail-loud stance** (D-06 explicitly forbids copying `arcpedia.ts`'s silent-`[]` shape). Fail-loud on the analyze route; fail-safe only for non-critical display fetches.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ai` (Vercel AI SDK) | ^7.0.45 | Agent tool-loop orchestration, structured output, telemetry hook | v7 GA is the current stable line; `ToolLoopAgent` is the maintained agent API; `Output.object` gives schema-typed structured output; built-in Langfuse telemetry integration |
| `@ai-sdk/anthropic` | ^4.0.26 | Anthropic Claude provider for the AI SDK | Official AI SDK provider package; matches D-05 (user-locked Anthropic) |
| `firecrawl` | ^4.32.0 | Web search + scrape/extract evidence acquisition | D-05 locked; AAR Layer 1 names Firecrawl as org acquisition tool; `new Firecrawl({ apiKey })`, `firecrawl.search(q, { limit })` |
| `@langfuse/vercel-ai-sdk` | ^5.9.1 | Langfuse ↔ AI SDK v7 telemetry bridge | **The** current integration package (NOT `@langfuse/vercel`, which is 404); `registerTelemetry(new LangfuseVercelAiSdkIntegration())` — no `instrumentation.ts` needed for AI-run tracing scope |
| `@langfuse/client` | ^5.10.0 | Langfuse annotation/feedback mirror + optional prompt linking | D-14 mirror writes (annotation on traceId); `langfusePrompt()` for future prompt versioning |
| `zod` | ^4.4.3 (already installed) | Proposal/run schema validation + ported gate rule typing | Already in `package.json`; zod 4 supports the enums/refinements the gate needs |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@langfuse/otel` | ^5.10.0 | `LangfuseSpanProcessor` for full OTel export | Only if extending tracing beyond AI SDK calls (HTTP/DB spans). **Not needed** for OBSV-01's scope (AI steps + cost) — the vercel-ai-sdk integration suffices; avoids adding `instrumentation.ts` to a repo that has none |
| `@langfuse/tracing` | ^5.10.0 | `propagateAttributes` trace-level metadata (userId, sessionId, tags) | If trace metadata beyond defaults is wanted; optional this phase |
| `@vercel/otel` / `@opentelemetry/sdk-node` | ^2.1.3 / ^0.221.0 | Next.js `instrumentation.ts` OTel bootstrap | Only if the OTel path is chosen; defer unless a concrete need appears |
| `@ai-sdk/otel` | ^1.0.2 | OpenTelemetry export for AI SDK spans | Only with the full OTel path; skip for minimal footprint |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@langfuse/vercel-ai-sdk` (callback integration) | `@langfuse/otel` + `@vercel/otel` full OTel | Callback integration captures AI SDK traces without `instrumentation.ts`; OTel adds infra/tuning for marginal gain this phase |
| Firecrawl `/search` | Firecrawl `/scrape` + `/extract` | `/search` fits the 60s budget (one round, capped results); `/scrape`+`/extract` gives richer extraction but costs multiple HTTP rounds — use only if search snippets prove insufficient in UAT |
| Anthropic Claude (fast family, e.g. `claude-sonnet-4`/`claude-haiku-*` current naming) | `gpt-5`/OpenAI or `o3` | User locked Anthropic (D-05); model naming must be checked at plan time against `@ai-sdk/anthropic` docs — exact string decided then, not now |
| Vercel AI SDK v6 (`Experimental_Agent`) | v7 (`ToolLoopAgent`) | v6 is superseded on the registry; v7 renames `system`→`instructions`, `stepCountIs`→`isStepCount` — plan against v7 |
| Hand-rolled agent loop | AI SDK `ToolLoopAgent` | Tool-loop edge cases (tool errors, stop conditions, step budgets, telemetry) are exactly what the SDK maintains |

**Installation:**
```bash
npm install ai@^7 @ai-sdk/anthropic@^4 firecrawl@^4 @langfuse/vercel-ai-sdk@^5 @langfuse/client@^5
```
*(Defer `@langfuse/otel`/`@langfuse/tracing`/`@vercel/otel`/`@opentelemetry/sdk-node` unless the OTel path is explicitly chosen at plan time.)*

**Version verification (npm registry, 2026-07-31):**
```bash
npm view ai version                      # 7.0.45
npm view @ai-sdk/anthropic version       # 4.0.26
npm view firecrawl version               # 4.32.0
npm view @langfuse/vercel-ai-sdk version # 5.9.1
npm view @langfuse/client version        # 5.10.0
```

## Package Legitimacy Audit

> All 10 candidate packages scanned with `slopcheck install ...` (2026-07-31) — **10/10 [OK]**, none flagged SLOP or SUS. Registry verification via `npm view` for the 5 core packages above. All package names cross-verified against official docs/Context7 (AI SDK + Langfuse docs confirmed package identities and usage), so they earn `[VERIFIED: npm registry]` per provenance rules.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `ai` | npm | mature (v7 GA line) | high (standard AI SDK) | github.com/vercel/ai | [OK] | Approved |
| `@ai-sdk/anthropic` | npm | mature | high | github.com/vercel/ai | [OK] | Approved |
| `firecrawl` | npm | ~2 yrs | growing | github.com/firecrawl/firecrawl | [OK] | Approved |
| `@langfuse/vercel-ai-sdk` | npm | ~9 mo | medium | github.com/langfuse/langfuse-js | [OK] | Approved |
| `@langfuse/client` | npm | mature | medium | github.com/langfuse/langfuse-js | [OK] | Approved |
| `@langfuse/otel` | npm | ~1 yr | low-medium | github.com/langfuse/langfuse-js | [OK] | Approved (deferred unless OTel chosen) |
| `@langfuse/tracing` | npm | ~1 yr | low-medium | github.com/langfuse/langfuse-js | [OK] | Approved (optional) |
| `@vercel/otel` | npm | mature | medium | github.com/vercel/next.js | [OK] | Approved (deferred — OTel path only) |
| `@opentelemetry/sdk-node` | npm | mature | high | github.com/open-telemetry/opentelemetry-js | [OK] | Approved (deferred — OTel path only) |
| `@ai-sdk/otel` | npm | ~1 yr | low-medium | github.com/vercel/ai | [OK] | Approved (deferred — OTel path only) |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none
**Note on `@langfuse/vercel`:** this package name from D-13's parenthetical does **not exist** on npm (404). It is NOT in the recommended stack; `@langfuse/vercel-ai-sdk` is the correct current package. Do not install `@langfuse/vercel`.

## Architecture Patterns

### System Architecture Diagram

```text
Staff (browser)
   │  Menu → Analyze
   ▼
POST /api/companies/[id]/analyze        (Route Handler — FIRST in codebase)
   │  requireStaffAccess()               ← single auth gate, first call
   │  maxDuration = 60                   ← Hobby ceiling (D-07)
   ▼
┌─────────────────────  try/catch A (AI + Firecrawl domain — D-08)  ─────────────────────┐
│ 1. Load company + live signals (dedup input, D-11)                                       │
│ 2. ToolLoopAgent(instructions, tools: [firecrawlSearch], stopWhen: isStepCount(N))       │
│      ├─ tool calls → Firecrawl /search → result snippets (evidence candidates)           │
│      └─ final step → Output.object(proposalSchema ∪ runMetaSchema)                       │
│ 3. Build hybrid artifacts: proposals + run record (evidence appendix, hypotheses)        │
│ 4. PORTED GATE (validate_report.ts): citation resolution, R/C enums, R3·C3 rule,         │
│    key_uncertainties non-empty, signals-empty ⇒ no-intent  — FAILS CLOSED (D-03)         │
└──────────────────────────────────────────────────────────────────────────────────────────┘
   │  gate passed
   ▼
┌─────────────────────  try/catch B (DB domain — D-08)  ──────────────────────┐
│ tx: insert agent_run (traceId ← Langfuse trace) + signal_proposal rows      │
│     (status=pending), post-dedup filter again (D-11)                        │
└──────────────────────────────────────────────────────────────────────────────┘
   │ 201 { runId, proposals, status: 'pending' }        ← fail-loud on error (D-06)
   ▼
Company detail page            Review queue (/reviews route)
   • feedback strip             • pending proposals w/ evidence inline
   • pending badge (ANLZ-04)    • Accept → tx: signal row + proposal accepted (D-09)
                                 • Reject → correction reason + traceId (OBSV-02)
                                         │
                                         ▼
                                correction table (source of truth)
                                Langfuse annotation mirror (D-14)
```

### Recommended Project Structure

```text
src/
├── app/api/companies/[id]/analyze/route.ts   # NEW first Route Handler (D-06)
├── app/(dashboard)/reviews/                  # review queue route (D-12; inside authed shell)
├── lib/agents/
│   ├── analyzeCompany.ts                     # orchestration: load → agent → gate → persist
│   ├── prompt.ts                             # instructions + tool descriptions
│   ├── tools.ts                              # firecrawlSearch tool definition
│   ├── runAgent.ts                           # ToolLoopAgent wrapper (mockable seam, D-16)
│   └── types.ts                              # Proposal, RunRecord, agent output schemas
├── lib/validation/
│   ├── airsRules.ts                          # ported gate rules (R/C, citations, R3·C3 …)
│   ├── validateReport.ts                     # gate entry (fails closed)
│   ├── airsRules.test.ts                     # ported-rule unit tests
│   └── fixtures/sample-valid.json            # canonical passing fixture (from standards repo)
├── lib/db/queries/
│   ├── proposals.ts                          # queue list, accept, reject, count
│   ├── runs.ts                               # agent_run insert/get, traceId linkage
│   └── corrections.ts                        # correction write + traceId
└── lib/telemetry/langfuse.ts                 # registerTelemetry bootstrap + annotation mirror
```

### Pattern 1: AI SDK v7 ToolLoopAgent (replaces v6 Experimental_Agent)

**What:** The maintained agent API: tool definitions + model + stop condition, run via `generateText` with `agent`. v7 renamed `system:` → `instructions:`, `stepCountIs(n)` → `isStepCount(n)`, and `stopWhen` defaults to `isStepCount(20)`.
**When to use:** The analyze run — the tool loop is Firecrawl search; the final step returns structured output.
**Key v7 behaviors verified (Context7, AI SDK docs):** structured output via `Output.object({ schema })` consumes an **extra step** (account for it in the `stopWhen` budget); `result.usage` is **total** usage across steps while `result.finalStep.usage` is the last step only (report totals for OBSV-01 cost); agent results are on `result.steps` (each step has `type: 'tool-step' | 'reasoning-step' | 'text-step'` and `usage`).

### Pattern 2: Durable HITL proposal queue (D-09)

**What:** `signal_proposal` rows are durable state, not transient UI. Status enum (`pending | accepted | rejected`). Accept runs a **transaction**: insert live `signal` row (typed to `signalTypeEnum`/`signalStrengthEnum`, `source` = evidence URL per D-10) + flip proposal to `accepted`. Idempotent — one Accept = one Signal (guard with a status check inside the tx). Reject writes `correction` row with reason enum + optional note + `traceId`, flips proposal to `rejected`.
**When to use:** All review-queue writes. Mirrors Phase 8's review-before-write trust model, extended to durability.

### Pattern 3: Independent failure domains (D-08)

**What:** Two separate try/catch scopes — (A) Firecrawl/AI agent call and gate; (B) DB writes. An LLM/tool failure returns a 502-style fail-loud body ("analysis failed: search provider error"), never a DB error; a DB failure returns a DB-domain error, never a fake LLM error. The AI domain must not be able to write anything (proposals only enter DB after the gate passes, and even then only in domain B).
**When to use:** The analyze route handler; also the accept/reject Server Actions (auth fail vs write fail).

### Anti-Patterns to Avoid

- **Copying `arcpedia.ts`'s silent-`[]`/never-throws shape onto the analyze route (D-06, Pitfall 5):** paid, metered AI calls MUST fail loudly with real status/body so the client can render the failure. Silent degradation hides cost and correctness failures.
- **Auto-writing live `signal` rows from the agent (ANLZ-02):** the "never under any circumstance" invariant. Any code path that writes to `signal` must be staff-gated in a review action.
- **Using the v6 API shapes from `.planning/research/*.md`:** `Experimental_Agent`/`stepCountIs`/`system` are v6; the registry ships v7 (`ToolLoopAgent`/`isStepCount`/`instructions`). Copying the old research examples verbatim will not compile.
- **Porting the gate as a lenient "best effort" validator:** the ported gate must **fail closed** (D-03). A run that fails the gate never surfaces proposals — no warnings-then-accept.
- **Dedup only in the prompt:** prompt-level skip instructions are advisory; the server-side query filter (before and after the run, D-11) is the enforcement.
- **Exceeding `maxDuration = 60`:** unbounded Firecrawl rounds or a large `stopWhen` budget will hit the Hobby ceiling mid-run. Cap rounds (1–2), keep `stopWhen` modest (structured-output step + loop steps ≤ ~8–12), stream/parallelize.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Agent tool-loop (repeat-until-done LLM orchestration) | Custom `while` loop over `generateText` | AI SDK `ToolLoopAgent` | Stop conditions, step budgets, per-step telemetry, tool error handling, and structured final output are SDK-maintained; hand-rolled loops miss step/usage accounting that OBSV-01 needs |
| Structured JSON from the LLM | Regex/string parsing of model output | `Output.object({ schema: zodSchema })` | Type-safe, validated, retried structured output; feeds the zod-typed gate directly |
| Validation gate | A new ad-hoc validator | Port `validate_report.py` rules to TS (zod + rule functions) | D-03 locked; the standards repo's rules + `sample-valid.json` fixture are the canonical contract — parallel gates drift |
| LLM tracing/observability | Log lines or custom trace tables | `@langfuse/vercel-ai-sdk` | CoT/tool-step/token-cost tracing is the integration's entire job; hand-rolled tracing misses span semantics and costs build time |
| Web research acquisition | Raw fetch + HTML parsing | Firecrawl SDK | Search/scrape/extract, markdown extraction, and anti-bot handling are Firecrawl's core; raw fetching is brittle and slow |
| Schema validation of agent output | `as` casts / trusts the LLM | zod 4 schemas | Already installed; the gate and proposal schemas are pure zod — types, refinements, and `.safeParse` for fails-closed behavior |

**Key insight:** every hand-rolled alternative in this phase duplicates SDK-maintained behavior with strictness/robustness gaps. The AI SDK owns the loop and telemetry; zod owns validation; Firecrawl owns acquisition; Langfuse owns tracing. The agent code should be a thin orchestration layer over these four.

## Common Pitfalls

### Pitfall 1: AI SDK v6 → v7 API rename drift
**What goes wrong:** Research docs and older examples say `Experimental_Agent`, `stepCountIs(n)`, `system:`, `result.usage` per step — code written against them fails to compile or misbehaves on v7.
**Why it happens:** v7 GA shipped renames + behavioral changes after the phase-09 research docs were written (docs describe v6).
**How to avoid:** Write all code against v7: `ToolLoopAgent`, `isStepCount(n)`, `instructions:`, `result.usage` = total / `result.finalStep.usage` = last step, `Output.object` consumes an extra step. Confirm exact model strings from `@ai-sdk/anthropic` docs at plan/implementation time.
**Warning signs:** `stepCountIs` or `Experimental_Agent` appears in new code; type errors on `system:`.

### Pitfall 2: `@langfuse/vercel` (404) vs `@langfuse/vercel-ai-sdk`
**What goes wrong:** D-13's parenthetical names `@langfuse/vercel`; installing it fails (package does not exist on npm).
**Why it happens:** The Langfuse package was renamed/reorganized; older docs reference the old name.
**How to avoid:** Install `@langfuse/vercel-ai-sdk@^5` and use `registerTelemetry(new LangfuseVercelAiSdkIntegration())`. The `@langfuse/client` handles the annotation mirror for D-14.
**Warning signs:** npm install error for `@langfuse/vercel`; imports failing.

### Pitfall 3: 60s maxDuration blowout (silent timeout)
**What goes wrong:** The route times out server-side mid-run; client sees a generic failure with no usable state; cost is still incurred.
**Why it happens:** Unbounded Firecrawl rounds, a large step budget, or slow model family exceeds the Hobby ceiling (D-07).
**How to avoid:** Cap Firecrawl rounds (1–2, `limit` ≤ 5–8 results), keep `stopWhen` budget modest (structured-output step + ≤ ~8 loop steps), prefer the fast Claude family, and return the fail-loud body on any `Error` so the strip renders "timed out / failed".
**Warning signs:** Long tail latency in UAT; repeated generic failures on the analyze route.

### Pitfall 4: Gate leniency (fail-open validation)
**What goes wrong:** Orphan citations or R3·C3 "strong" claims reach the queue; staff lose trust; AIRS conformance is void.
**Why it happens:** Porting the gate as warnings instead of hard failures, or skipping rules that don't obviously map to the hybrid shape.
**How to avoid:** Port ALL rules from `airs-validation-rules.json` that map (citation resolution, R/C enums, R3·C3, `key_uncertainties` non-empty, signals-empty ⇒ no-intent); gate returns `{ valid: false, errors[] }` and the route 422s with the gate errors — proposals never enter the queue.
**Warning signs:** Any proposal with an evidence_id absent from the appendix reaching the UI.

### Pitfall 5: Dedup race / single-sided dedup
**What goes wrong:** A re-run proposes a signal type that was accepted between run start and persist; or dedup only filters pre-run, letting a duplicate persist.
**Why it happens:** Checking live signals only once (pre-run) misses concurrent accepts; trusting the prompt alone never enforces.
**How to avoid:** D-11's two-sided filter — query live signals pre-run (prompt input) AND re-filter the final proposal set against live signals immediately before the DB insert (inside domain B). Unique partial index on `(company_id, signal_type)` where live is a belt-and-suspenders option — plan-time call.
**Warning signs:** Duplicate live signals appearing after a re-run.

### Pitfall 6: Test suite hitting live providers
**What goes wrong:** CI/local `vitest run` makes real Anthropic/Firecrawl/Langfuse calls — slow, flaky, costly, and it violates D-16.
**Why it happens:** Mocking the SDK seam is done wrong (mocking internals instead of the wrapper).
**How to avoid:** `runAgent.ts` is the thin wrapper mock seam; tests `vi.mock('ai')` + `vi.mock('firecrawl')` + stub the Langfuse exporter/telemetry registration (never call `registerTelemetry` in tests — guard by `process.env.NODE_ENV === 'test'` or a registry stub). Live calls happen only in manual UAT.
**Warning signs:** Test output showing API keys, network calls, or trace exports; slow/flaky tests.

## Code Examples

Verified patterns from official sources:

### ToolLoopAgent v7 with a Firecrawl search tool
```typescript
// Source: Context7 AI SDK v7 docs (Agent API) — adapted
import { generateText, ToolLoopAgent, isStepCount, tool, Output } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { Firecrawl } from 'firecrawl';

const firecrawl = new Firecrawl({ apiKey: env.FIRECRAWL_API_KEY }); // lazily, see env gate

const agent = new ToolLoopAgent({
  instructions: `Analyze buying-intent signals for the given company.
    Use the webSearch tool. Never fabricate evidence — every claim needs a search result URL.
    Skip signal types the user says are already covered.`,
  stopWhen: isStepCount(12), // structured output consumes an extra step
  tools: {
    webSearch: tool({
      description: 'Search public web sources for company news, cost pressure, org changes, transformation programs.',
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }) => {
        const res = await firecrawl.search(query, { limit: 5 });
        return res.data.map((r) => ({ url: r.url, title: r.title, snippet: r.description ?? '' }));
      },
    }),
  },
  // telemetry: true, // AI SDK telemetry hook — Langfuse integration captures it
});

export const outputSchema = z.object({
  proposals: z.array(z.object({
    signalType: z.enum(['cost_pressure', 'immature_gbs_org', 'new_cfo_or_gbs_head', 'transformation_announcement']),
    strength: z.enum(['low', 'medium', 'high']),
    detectedAt: z.string(),
    evidenceUrl: z.string().url(),
    reliability: z.enum(['R1', 'R2', 'R3']),
    confidence: z.enum(['C1', 'C2', 'C3']),
    evidenceSnippet: z.string(),
    reasoning: z.string(),
  })).min(0),
  keyUncertainties: z.array(z.string()),
});

const { result } = await generateText({
  model: anthropic('claude-sonnet-4-20250514'), // EXACT string from @ai-sdk/anthropic docs at plan time
  agent,
  prompt: buildAnalyzePrompt(company, liveSignals),
  output: Output.object({ schema: outputSchema }),
});
// result.usage        → total tokens across all steps (report for OBSV-01)
// result.finalStep.usage → last-step tokens
// result.steps        → per-step { type, toolCalls?, usage? } for traceability
```

### Langfuse integration (AI SDK callback — no instrumentation.ts)
```typescript
// Source: Context7 Langfuse docs (AI SDK v7 integration) — adapted
// src/lib/telemetry/langfuse.ts
import { registerTelemetry } from '@ai-sdk/telemetry';
import { LangfuseVercelAiSdkIntegration, LangfuseSpanProcessor } from '@langfuse/vercel-ai-sdk';
import { Client } from 'langfuse'; // @langfuse/client

let langfuseClient: Client | null = null;

export function initLangfuse() {
  if (process.env.NODE_ENV === 'test') return; // D-16: never in tests
  const integration = new LangfuseVercelAiSdkIntegration();
  registerTelemetry({ telemetry: new LangfuseSpanProcessor(integration) });
  langfuseClient = new Client({
    publicKey: env.LANGFUSE_PUBLIC_KEY,
    secretKey: env.LANGFUSE_SECRET_KEY,
    baseUrl: env.LANGFUSE_TRACE_BASE_URL ?? 'https://cloud.langfuse.com',
  });
}

export function mirrorCorrectionAnnotation(traceId: string, correction: { reason: string; note?: string }) {
  // D-14 mirror: DB is source of truth; Langfuse annotation is the mirror
  langfuseClient?.feedback.create({
    traceId,
    name: 'correction',
    value: 0,
    comment: JSON.stringify(correction),
  });
}
```

### Ported validation gate skeleton (fails closed)
```typescript
// src/lib/validation/validateReport.ts — port of validate_report.py (D-03)
import { z } from 'zod';
import { outputSchema } from '@/lib/agents/types';

const R_C_ENUMS = z.enum(['R1', 'R2', 'R3']) /* ... */;

export interface GateResult { valid: boolean; errors: string[]; }

export function validateRunArtifacts(input: z.infer<typeof outputSchema>): GateResult {
  const errors: string[] = [];
  // 1. citation resolution: every proposal.evidenceUrl must appear in the appendix
  // 2. R/C enums in range
  // 3. no R3·C3 pair on "strong" claims (bluf_cannot_use_R3C3 analog)
  // 4. key_uncertainties non-empty
  // 5. signals empty ⇒ verdict must be 'no_intent' (empty_signals_implies_no_intent)
  return { valid: errors.length === 0, errors };
}
```

### Route Handler skeleton (first in codebase — D-06)
```typescript
// src/app/api/companies/[id]/analyze/route.ts
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { analyzeCompany } from '@/lib/agents/analyzeCompany';
import { validateRunArtifacts } from '@/lib/validation/validateReport';

export const maxDuration = 60; // Hobby ceiling (D-07)

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireStaffAccess();                       // single gate, first call (D-06)
  const { id } = await params;
  try {
    // Domain A: agent run + gate
    const output = await analyzeCompany(id);
    const gate = validateRunArtifacts(output);
    if (!gate.valid) {
      return Response.json({ error: 'gate_failed', errors: gate.errors }, { status: 422 });
    }
    // Domain B: DB writes (post-dedup inside)
    const run = await persistRunAndProposals(id, output);
    return Response.json(run, { status: 201 });     // fail-loud on any throw above
  } catch (err) {
    return Response.json({ error: 'analysis_failed', message: String(err) }, { status: 502 });
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AI SDK v6 `Experimental_Agent` / `stepCountIs(n)` / `system:` | v7 `ToolLoopAgent` / `isStepCount(n)` / `instructions:` | v7 GA (registry: `ai@7.0.45`, 2026) | All agent code must use v7 API; old research examples are stale |
| `result.usage` as last-step usage | `result.usage` = total, `result.finalStep.usage` = last step | v7 | OBSV-01 cost reporting must sum/use total, not final step |
| `@langfuse/vercel` (v1 integration) | `@langfuse/vercel-ai-sdk` `registerTelemetry(new LangfuseVercelAiSdkIntegration())` | package rename (2025–2026) | Old package 404 on npm; new callback integration needs no `instrumentation.ts` |
| Next.js route config via `runtime`/`maxDuration` in older docs | `export const maxDuration = 60` in route segment | stable in Next 15/16 | Standard App Router route segment config |

**Deprecated/outdated:**
- `@langfuse/vercel` npm package — does not exist (404). Replaced by `@langfuse/vercel-ai-sdk`.
- AI SDK v6 `Experimental_Agent` + `stepCountIs` — renamed in v7; do not use in new code.
- `.planning/research/ARCHITECTURE.md` §AI-agent AI SDK **v6** shapes — superseded; treat as design intent, not API reference.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@langfuse/vercel-ai-sdk@5.9.1` `registerTelemetry` + `LangfuseSpanProcessor` is the complete OBSV-01 path without `instrumentation.ts` | Standard Stack | If Langfuse's v5 needs extra bootstrap, add the OTel path (`@langfuse/otel` + `@vercel/otel`); minor scope addition |
| A2 | `firecrawl.search()` (v4 SDK) returns `{ data: [{ url, title, description }] }` and is the right acquisition call for the 60s budget | Standard Stack | If search results are too thin, switch to `/scrape`+`/extract` (more HTTP rounds; recheck budget) — discretion item |
| A3 | Exact Anthropic model string unresolved (fast family) | Standard Stack / Code Examples | Wrong/obsolete model string fails at first call — must verify against `@ai-sdk/anthropic` docs at plan/impl time |
| A4 | Langfuse Cloud keys + regions default (`cloud.langfuse.com`) | env | If region is EU (`https://eu.langfuse.com`), the `LANGFUSE_TRACE_BASE_URL` override (D-15 parenthetical) is required — user confirmed keys exist but region unconfirmed |
| A5 | `signal.source` free-text column is sufficient provenance (no `fieldSources`-style extension) | D-10 | If provenance needs structured fields later, a migration adds them; minimal-first recommended by D-10 |
| A6 | `signal_proposal`/`agent_run`/`correction` table names + status enum (`pending/accepted/rejected`) | Architecture | Names are discretion; planner may adjust, must stay consistent with D-09/D-14 semantics |

## Open Questions

1. **Anthropic model string — which exact fast model?**
   - What we know: fast family preferred (D-07 budget); `@ai-sdk/anthropic@4.0.26` current.
   - What's unclear: the exact model ID that is current, fastest, and fits a ~60s run with 1 Firecrawl round.
   - Recommendation: at plan time, check `@ai-sdk/anthropic` docs (Context7) for the current fast model string (e.g., Sonnet-line or Haiku-line); bake the string as a constant in `lib/agents/` so it's swappable without code surgery.

2. **Langfuse region — `cloud.langfuse.com` vs EU base URL?**
   - What we know: D-15 allows a `LANGFUSE_TRACE_BASE_URL` override; user confirmed keys provisioned.
   - What's unclear: whether the project uses the US or EU cloud region.
   - Recommendation: include the optional env key; confirm region with user at plan/execution start (one question, unblocks OBSV-01 verification).

3. **Dedup enforcement depth — DB unique index as belt-and-suspenders?**
   - What we know: D-11 mandates server-side filter before + after run.
   - What's unclear: whether to add a partial unique index on live `signal(company_id, signal_type)` to make duplicate insertion impossible even under races.
   - Recommendation: planner decision — add the partial unique index (cheap, prevents a whole bug class); the accept path already serializes via the proposal status check.

4. **Queue route placement — inside `(dashboard)` route group?**
   - What we know: D-12 prefers a route consistent with explorer patterns; `(dashboard)` layout provides `requireStaffAccess` + `AppShellLayout`; `/companies` and `/personas` use identical per-subtree layouts.
   - What's unclear: whether the reviews route should be a sibling of `(dashboard)` (own layout, same gate) or nested within it.
   - Recommendation: sibling route (`src/app/reviews/` or `src/app/(dashboard)/reviews/`) reusing the same layout pattern — planner/UI decision; no new design language.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | build/dev/tests | ✓ | v22.23.1 (engines node 22.x) | — |
| npm | installs | ✓ | lockfile `package-lock.json` present | — |
| Neon Postgres (DATABASE_URL) | signal_proposal/agent_run/correction + live signal reads | ✓ | existing (`drizzle-orm` + `@neondatabase/serverless`) | — |
| Clerk | auth gate `requireStaffAccess()` | ✓ | `@clerk/nextjs@7.5.22`, keys in `.env.local` | — |
| Anthropic API | agent LLM calls (UAT only) | ✓ (key provisioned per user; not yet in `env.ts`) | — | Analyze disabled w/ "not configured" (D-15) |
| Firecrawl API | web-search evidence (UAT only) | ✓ (key provisioned per user; not yet in `env.ts`) | — | same D-15 degrade |
| Langfuse Cloud | OBSV-01/02 traces (UAT only) | ✓ (keys provisioned per user; region unconfirmed) | — | same D-15 degrade |
| Vercel Hobby | deployment | ✓ (existing project `prj_DbEzimzON9nzF7Nmk7Nueta7k00V`) | maxDuration 60 ceiling | — |
| vitest | test suite | ✓ | 4.1.10 (devDep; `npm test` → `vitest run`) | — |

**Missing dependencies with no fallback:**
- None blocking. All external services are network APIs with the D-15 "not configured" degrade path; real calls occur only in manual UAT.

**Missing dependencies with fallback:**
- Anthropic/Firecrawl/Langfuse env keys not yet wired into `src/lib/env.ts` — the phase's first task wires them (D-15). No keys are missing, only wiring.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.10 |
| Config file | `vitest.config.ts` (alias `@` → `./src`, `environment: 'node'`, include `src/**/*.test.ts`) |
| Quick run command | `npm test` (`vitest run`) — full suite is the quick run; no watch in CI |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ANLZ-01 | analyze trigger builds a valid run (prompt construction, tool defs) | unit | `vitest run src/lib/agents/analyzeCompany.test.ts` | ❌ Wave 0 |
| ANLZ-02 | proposals never auto-write; accept tx writes signal + marks accepted (idempotent) | unit + integration | `vitest run src/lib/db/queries/proposals.test.ts` | ❌ Wave 0 |
| ANLZ-03 | queue list returns pending proposals with evidence fields | unit | `vitest run src/lib/db/queries/proposals.test.ts` | ❌ Wave 0 |
| ANLZ-04 | pending count query returns correct count per company | unit | `vitest run src/lib/db/queries/proposals.test.ts` | ❌ Wave 0 |
| ANLZ-05 | dedup filter drops (companyId, signalType) present in live signals (pre + post) | unit | `vitest run src/lib/agents/dedup.test.ts` | ❌ Wave 0 |
| OBSV-01 | run persists traceId; runAgent wrapper emits trace events (stubbed exporter) | unit | `vitest run src/lib/agents/runAgent.test.ts` | ❌ Wave 0 |
| OBSV-02 | reject writes correction row with reason enum + traceId + optional note; annotation mirror stubbed | unit | `vitest run src/lib/db/queries/corrections.test.ts` | ❌ Wave 0 |
| D-03 (gate) | ported gate: passes sample-valid fixture; fails each rule (orphan citation, R3·C3, empty uncertainties, signals-empty ≠ no_intent) | unit | `vitest run src/lib/validation/airsRules.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test` (fast, pure-unit)
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/agents/runAgent.ts` + `runAgent.test.ts` — mockable seam (D-16): `vi.mock('ai')`, `vi.mock('firecrawl')`, never `registerTelemetry` in tests
- [ ] `src/lib/agents/analyzeCompany.test.ts` — orchestration incl. gate fail-closed path (422)
- [ ] `src/lib/validation/validateReport.ts` + `airsRules.test.ts` — ported rules, fixture-driven (`fixtures/sample-valid.json` copied from the standards repo)
- [ ] `src/lib/db/queries/proposals.test.ts`, `corrections.test.ts`, `runs.test.ts` — accept/reject/count/dedup/correction write paths
- [ ] No test framework install needed — vitest already configured in Wave 0 of earlier phases (14 existing `*.test.ts` files)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Clerk via existing `requireStaffAccess()` gate — first call in every route/action/handler (D-06) |
| V3 Session Management | yes | Reuse existing Clerk session model (`@clerk/nextjs`); no new session code |
| V4 Access Control | yes | Staff-only: the single gate covers the new `/reviews` route (layout-level) and the analyze handler |
| V5 Input Validation | yes | zod 4 for proposal/run schemas + the ported gate (fails closed); route params validated |
| V6 Cryptography | no | No new crypto; no keys in client bundles (server-only env, D-15); Langfuse keys never logged |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via fetched web content | Tampering | Web content enters ONLY as tool-call results (search snippets); the structured-output schema + gate constrain what the model can emit; evidence URLs must resolve to the run's appendix (D-02) — the model cannot invent citations that pass the gate |
| Orphan/fabricated citations | Tampering | D-03 gate `every_citation_must_resolve` ported to TS — fail-closed, 422 on violation |
| API key exposure (Anthropic/Firecrawl/Langfuse) | Information Disclosure | D-15: server-only `env.ts` keys, never `PUBLIC_`-prefixed, never logged; analyze route runs server-side only |
| Abuse of paid API (run amplification) | Denial of Service / cost | Single-company-per-run (D-06/07), `maxDuration = 60`, capped Firecrawl rounds, staff-gated trigger; Pitfall 4 (metered-API blast radius) precedent |
| Mass-proposal flooding of queue | Tampering | Proposals only from gated runs + post-dedup filter; accept path is staff-only |
| Race: duplicate signal writes | Tampering | Accept tx guarded by proposal status check; optional partial unique index on live `signal(company_id, signal_type)` (Open Question 3) |
| Trace data leakage (personal data in Langfuse) | Information Disclosure | Retention tags on evidence appendix entries (`public_biz`/`personal_data`); trace naming uses company name (already internal); staff-only access to traces |

## Sources

### Primary (HIGH confidence)
- Context7 — `vercel/ai` (AI SDK v7: `ToolLoopAgent`, `isStepCount`, `instructions`, `Output.object`, usage semantics, telemetry hook)
- Context7 — Langfuse docs (AI SDK v7 integration: `@langfuse/vercel-ai-sdk` `registerTelemetry` + `LangfuseSpanProcessor`, annotation/feedback via `@langfuse/client`)
- npm registry (`npm view`) — versions: `ai@7.0.45`, `@ai-sdk/anthropic@4.0.26`, `firecrawl@4.32.0`, `@langfuse/vercel-ai-sdk@5.9.1`, `@langfuse/client@5.10.0`, `@langfuse/otel@5.10.0`, `@langfuse/tracing@5.10.0`, `@vercel/otel@2.1.3`, `@opentelemetry/sdk-node@0.221.0`, `@ai-sdk/otel@1.0.2`
- slopcheck scan (2026-07-31) — 10/10 packages `[OK]`, none SLOP/SUS
- Sibling repo standards (verbatim contract): `AIRS-spec.md`, `airs-report.schema.json`, `airs-validation-rules.json`, `validate_report.py`, `examples/sample-valid.json`, `agent-workflow-spec.md`, `architecture-reference.md`
- Repo code verification: `src/lib/db/schema.ts` (signalTypeEnum/signalStrengthEnum/signal), `src/lib/env.ts`, `src/lib/auth/requireStaffAccess.ts`, `src/app/actions/enrichment.ts`, `enrichment-review-dialog.tsx:177`, `company-detail.tsx`, `vitest.config.ts`, `next.config.ts`, `package.json`, `(dashboard)/layout.tsx`, `companies/layout.tsx`

### Secondary (MEDIUM confidence)
- Firecrawl SDK usage (`new Firecrawl({ apiKey })`, `.search(q, { limit })`) — from Firecrawl official docs/npm readme (verified against registry; exact response shape to confirm against current SDK at implementation)
- Vercel Hobby `maxDuration` ceiling = 60s (user-confirmed decision D-07; standard Vercel docs)

### Tertiary (LOW confidence)
- None material — all load-bearing claims verified via Context7, npm registry, slopcheck, or direct repo/standards-file reads.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — package identities/versions verified on npm registry; AI SDK + Langfuse API surface verified via Context7 official docs; slopcheck clean
- Architecture: HIGH — patterns verified against actual repo code (schema, env, auth, actions, layouts, configs) and the user-supplied standards contract
- Pitfalls: HIGH — the two biggest (v6→v7 API drift, `@langfuse/vercel` 404) verified directly against registry + docs; remaining pitfalls are code-pattern-based and verified against repo precedent

**Research date:** 2026-07-31
**Valid until:** 2026-08-07 (fast-moving: AI SDK v7 line and Langfuse integration packages; re-verify package versions + Anthropic model strings before implementation)
