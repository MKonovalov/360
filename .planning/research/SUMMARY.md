# Project Research Summary

**Project:** ArcLumen 360
**Domain:** Internal, source-grounded Company and Persona buying-signal analysis with human review
**Milestone:** v1.7 Agent Constructor & Buying Signal Analysis
**Researched:** 2026-08-06
**Confidence:** MEDIUM-HIGH

## Executive Summary

ArcLumen 360 v1.7 is a constrained internal decision-support workflow, not autonomous enrichment: staff run one of two reusable GBS Buying Signal Analysis templates against an existing Company or Persona, inspect immutable source-backed findings, then make exactly one confirm-or-dismiss decision for the completed run. Experts build this as a durable execution ledger with immutable input/template/taxonomy snapshots, normalized findings and citations, and an approval-gated read model. A model may propose; it must never directly write live Signals, signal-offering links, or record-level candidate offerings.

Reuse the existing Next.js, AI SDK 7, Firecrawl, Langfuse, Neon/Drizzle, Clerk, and `modelFactory` seams. Keep provider SDKs isolated behind the existing factory and public-web access isolated behind the existing Firecrawl tool. Introduce application-owned template, executor, lifecycle, result/finding/source, and run-review contracts instead of bending the Company-only `agent_run` and per-signal `signal_proposal` tables into a shape they cannot safely represent. Confirmed candidate offerings must be computed exclusively from run-level confirmed state in a dedicated query, with provenance returned alongside each offering.

The principal implementation risk is execution durability: persisting a queued row does not create a worker. The current request-bound agent has a 54-second budget within Vercel's 60-second cap. Before the roadmap promises detached, navigable-away, retryable runs, it must select and validate a Vercel-compatible durable executor/queue; neither `after()`, a Server Action, an in-process promise, nor database polling supplies that guarantee. Other non-negotiable safeguards are snapshotting before execution, claim-to-evidence persistence, terminal/idempotent review decisions, tool/spend limits, redaction/retention controls, and evaluation fixtures for groundedness and indirect prompt injection.

## Key Findings

### Recommended Stack

No new AI, web-search, ORM, citation, or agent-framework package is warranted for v1.7. The product should be built as typed application contracts over the current stack, with normalized Neon records as the product audit source and Langfuse retained for trace/cost observability.

**Core technologies:**
- **Next.js App Router 16.2.11:** authenticated management, detail, run, history, and review surfaces; execute server work in Node rather than Edge.
- **Vercel AI SDK 7 + Zod 4:** provider-neutral tool-loop execution and versioned runtime validation of template inputs, results, findings, and citations.
- **Existing `modelFactory` and four-provider catalog:** the sole provider-SDK boundary; snapshot the resolved model chain at start and actual model at completion.
- **Firecrawl 4.32:** the sole public-web research tool; reuse its normalized `{ url, title, snippet }` results and do not add Exa.
- **Neon Postgres + Drizzle:** durable, queryable templates → runs → results/findings/sources → one run decision, with transactions, FKs, state guards, and history/aggregation indexes.
- **Langfuse:** traces, cost, and operational diagnostics only; retain trace ID/URL on the run but never make it the evidence store.
- **Clerk `requireStaffAccess()`:** mandatory server-side authorization for every template, run, history, and decision endpoint.

### Expected Features

The minimum useful flow is: an applicable Company or Persona template is selected from the target record; its resolved instruction and active-signal checklist are previewed; the user selects effort and starts exactly one run; durable status/history and a source-backed result packet are available after navigation or reload; then a partner confirms or dismisses the entire completed run. Only confirmation exposes candidate offerings on the record.

**Must have (table stakes):**
- Two reusable, target-kind-compatible templates and a small `Manage > Reviews > Agents` lifecycle surface.
- Resolved pre-run preview, active-signal checklist snapshot, explicit effort selection, and a durable run lifecycle including safe failure states.
- Immutable completed-result packet: normalized findings, navigable citations/excerpts, resolved inputs, timing, model/trace provenance, and history.
- One terminal, attributable, idempotent Confirm or Dismiss action per completed run; dismiss has no live-record side effect.
- Confirmed-only candidate-offering projection and protected access across all workflow surfaces.

**Should have (differentiators):**
- Active-signal-derived Company/Persona checklists make the analysis specific to ArcLumen's maintained taxonomy.
- Shared constructor primitives with target-specific contracts preserve repeatability without run-time prompt editing.
- Decision-linked history and offering provenance let staff reconstruct why a candidate is visible.

**Defer (v2+):** Persona Discovery; bulk, scheduled, or automatic reruns; ad-hoc prompts; provider controls in the run flow; per-finding curation; hypotheses; outreach/CRM actions; scoring; and auto-confirmation or direct writes.

### Architecture Approach

Use a subject-neutral, snapshot-first pipeline: a staff-gated orchestration boundary validates the target/template pairing, snapshots subject/template/version/active signal schema/model chain, creates a queued run, dispatches an in-house executor, validates and persists immutable normalized artifacts, and creates exactly one review item only on successful completion. The executor owns no database or review writes. A run-level adapter reuses review conventions where safe but never calls the legacy per-proposal acceptance path, whose side effect writes live Company Signals.

**Major components:**
1. **Template registry and runtime schema derivation** — manages enabled Company/Persona templates and deterministically derives active-signal schemas, versioned/snapshotted per run.
2. **Run ledger and provider-agnostic executor contract** — creates/claims/completes/fails durable runs and adapts the existing `runAgent`/`modelFactory`/Firecrawl path behind normalized input/output validators.
3. **Result, finding, and source persistence** — keeps normalized immutable artifacts plus raw/audit snapshots, trace references, usage, and safe error envelopes.
4. **Run-level review adapter** — creates one unique review record and atomically resolves `completed → confirmed|dismissed` with reviewer attribution and optional dismissal rationale.
5. **Approved-only candidate-offering query** — joins only confirmed run findings through existing signal-offering links and returns provenance; it is the policy boundary, not a React filter.
6. **Detail, Reviews, and management UI** — composes shared server read models for preview/run, status/history, review packets, approved candidates, and template administration.

### Critical Pitfalls

1. **Success-only persistence loses failed/gated runs** — create the queued ledger row before external work; persist guarded terminal states and sanitized errors even for provider, validation, timeout, and persistence failures.
2. **A valid URL is not proof of a claim** — persist immutable source metadata/excerpts/hash and link each material finding to evidence IDs; evaluate support/recency/source quality rather than URL membership alone.
3. **Legacy per-proposal review leaks unconfirmed output** — use a run-level state machine and conditional transaction; candidates and future consumers must predicate on confirmed parent-run state.
4. **Web content can inject instructions** — treat sources as untrusted data; allowlist/validate/cap tools and content, strip active/suspicious markup, with no model access to writes, credentials, or arbitrary URLs.
5. **Duplicate starts and retries waste money** — enforce server-held idempotency and one non-terminal run per template/subject, then persist bounded attempts, Firecrawl credits, model usage, budgets, rate limits, and a kill switch.
6. **Persona research creates privacy/retention risk** — define disallowed claim categories, minimize/redact data before providers and telemetry, classify artifacts, and enforce retention/tombstone policy.

## Implications for Roadmap

Based on the locked product direction, the roadmap should be ordered by trust boundary and dependency rather than by screen.

### Phase 1: Run Ledger, Template Versioning, and Evidence Contract
**Rationale:** Every later feature depends on durable identifiers, immutable meaning, and source-grounded artifacts; starting with UI or the existing success-only run table would lock in unsafe semantics.
**Delivers:** generalized template/run/result/source/finding schema and query contracts; lifecycle states; indexes/FKs; immutable template, signal-schema, subject-input, model-chain, policy, and output-schema snapshots; claim-to-evidence validation; privacy classification and retention fields.
**Addresses:** reusable templates, audit-ready history, completed-result packet, active-signal snapshot.
**Avoids:** missing failed runs, mutable historical meaning, citation-without-support, unsafe URL identity, and uncontrolled Persona data retention.

### Phase 2: Subject-Neutral Agent Contract and Deterministic Schema Assembly
**Rationale:** The executor must receive a validated, serializable snapshot before it can run safely for both Company and Persona; this separates domain semantics from provider mechanics.
**Delivers:** Company/Persona active-signal schema builders; two built-in GBS templates; versioned Zod contracts; generic executor input/output interface; adaptation of `runAgent`, `modelFactory`, Firecrawl, server-derived citation derivation, and Langfuse without changing the provider boundary.
**Addresses:** target-kind compatibility, resolved preview content, active-signal-derived checklist, provider-agnostic execution.
**Avoids:** invented taxonomy, Company-only coupling, provider/client leakage into templates, and raw-model/trace-only persistence.

### Phase 3: Durable Dispatch, Safe Execution, and Completion Gate
**Rationale:** A persisted run needs a real execution/recovery mechanism before the UI can promise asynchronous navigation, polling, or retries.
**Delivers:** validated durable executor/queue choice; create/claim/lease/recover/complete/fail workflow; idempotent start; active-run uniqueness; bounded tool/retry/time/cost controls; redacted telemetry; result validation/persistence; one pending review creation only after terminal successful completion.
**Addresses:** on-demand asynchronous runs, clear lifecycle/failure states, durable history, safe cost/time effort execution.
**Avoids:** request-bound pseudo-async work, permanent running rows, duplicate spend, prompt injection, runaway tool use, and telemetry data leakage.

### Phase 4: Whole-Run Review and Confirmed-Only Projection
**Rationale:** The commercial safety gate must exist below the UI before any record-level candidate-offering surface is introduced.
**Delivers:** a discriminated run-review item in Reviews; guarded/idempotent confirm/dismiss transaction with attribution/checksum/rationale; dedicated `listApprovedCandidateOfferingsForSubject` query and provenance; legacy per-signal proposal behavior preserved.
**Addresses:** one decision per completed run, decision-safe confirmation, dismiss-without-side-effects, confirmed-only candidate offerings.
**Avoids:** partial approval, concurrent conflicting decisions, direct agent writes, and pending/dismissed/failed candidate leakage.

### Phase 5: Company and Persona Preview, Run, History, and Result Flows
**Rationale:** With durable execution and the policy gate established, both target experiences can be composed consistently from the same contracts.
**Delivers:** contextual template entry points; immutable preview/effort/start flow; durable status refresh; history; run detail with sources/findings/provenance; confirmed candidate-offering panels for both Company and Persona.
**Addresses:** the staff-visible end-to-end workflow and shared two-target experience.
**Avoids:** launch without resolved preview, false certainty, result laundering, and client polling as source of truth.

### Phase 6: Agent Management and End-to-End Evaluation Gate
**Rationale:** Administration and proof belong after the core contracts and flows exist, so they validate real policy boundaries instead of mock behavior.
**Delivers:** `Manage > Reviews > Agents` create/edit/enable/disable semantics that version rather than rewrite templates; lifecycle/recovery/concurrency tests; groundedness golden set; indirect prompt-injection fixtures; cost/credit reconciliation; redaction/retention checks; Company/Persona UAT.
**Addresses:** template management, operational confidence, reviewable evidence, and policy verification.
**Avoids:** mutable template history, unsupported AI accuracy language, silently weak citations, and untested review/security guarantees.

### Phase Ordering Rationale

- Phase 1 establishes the immutable data and audit boundary that every execution, review, and UI query depends on.
- Phase 2 makes inputs/outputs trustworthy and reusable across Company and Persona without reopening provider or search choices.
- Phase 3 is a hard prerequisite for the promised durable asynchronous user experience; its executor selection is an infrastructure validation, not a product-direction decision.
- Phase 4 puts the confirmed-only business rule into transactional/query contracts before Phase 5 exposes candidates to users.
- Phase 5 is then mostly shared UI composition, while Phase 6 locks behavior with operational, security, and human-oversight evidence.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** inspect live `agent_run`/foreign-key data to choose safe in-place migration versus generalized companion tables; define stable signal identity and archival semantics.
- **Phase 3:** select and validate the Vercel-compatible durable executor/queue, including disconnect, timeout, retry, lease, cost, and recovery semantics. This is the sole material stack uncertainty.
- **Phase 6:** design the evaluation corpus, evidence-retention/redaction tests, and adversarial web-content fixtures with product/privacy owners.

Phases with standard patterns (skip research-phase unless implementation findings contradict this summary):
- **Phase 2:** existing AI SDK, Zod, Firecrawl, `modelFactory`, citation derivation, and Langfuse seams are documented and already exercised by the app.
- **Phase 4:** guarded conditional updates, transactions, idempotency, and approved-only relational queries are established Postgres/Drizzle patterns.
- **Phase 5:** authenticated master-detail pages, Server Actions, history views, and bounded status polling/revalidation follow existing product patterns once contracts are available.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Current package versions, source seams, AI SDK/Firecrawl/Drizzle/Vercel documentation, and explicit exclusions were verified. |
| Features | HIGH | The project record locks the workflow, review unit, candidate visibility rule, and out-of-scope boundaries; governance sources reinforce the safeguards. |
| Architecture | MEDIUM-HIGH | Integration seams and desired invariants are clear; the migration shape and durable executor remain to be selected. |
| Pitfalls | HIGH | Codebase gaps plus OWASP/NIST guidance identify concrete, testable failure modes and mitigations. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Durable execution platform:** decide and prove the executor/queue before committing to detached/retryable asynchronous behavior; otherwise explicitly retain the current request-bound ceiling and do not market it as durable async.
- **Legacy data migration:** inventory production `agent_run`, `signal_proposal`, and foreign-key usage; choose an additive generalized schema or a fully backfilled migration without breaking historic analytic-agent records.
- **Signal identity and retirement:** specify whether findings reference signal row IDs, stable keys, or both, and how later archival affects historical display versus approved aggregation.
- **Review storage shape:** validate whether a discriminated extension of Reviews is safe; prefer a companion run-review table/read model if it risks legacy `acceptProposal` semantics.
- **Privacy and retention policy:** obtain explicit approved/disallowed claim categories, artifact retention windows, telemetry redaction rules, and correction/tombstone handling before Persona runs are enabled.

## Sources

### Primary (HIGH confidence)
- `.planning/PROJECT.md` — v1.7 locked direction, target features, existing stack/seams, and explicit exclusions.
- `.planning/research/STACK.md` — installed versions, provider/search/data/observability seams, and durable-execution constraint.
- `.planning/research/FEATURES.md` — product boundary, table stakes, safeguards, feature dependencies, and deferred scope.
- `.planning/research/ARCHITECTURE.md` — component boundaries, schema/query contracts, integration points, and dependency-respecting sequence.
- `.planning/research/PITFALLS.md` — codebase-specific failure modes, prevention owners, and required verification.
- Vercel AI SDK, Firecrawl, Drizzle, and Vercel Function duration documentation — structured-output/tool-loop, source retrieval, relational constraints, and route-duration facts.
- OWASP GenAI guidance and NIST AI RMF / Generative AI Profile — prompt-injection controls, provenance, human oversight, retention, and evaluation principles.

### Secondary (MEDIUM confidence)
- OpenAI agent guardrail/approval guidance and AWS Well-Architected Agentic AI Lens — implementation-neutral human-review and durable decision-context patterns.
- FTC AI claims guidance — conservative language and validation expectations; not a determination of ArcLumen's legal obligations.

---
*Research completed: 2026-08-06*
*Ready for roadmap: yes — after the Phase 3 durable-executor research/approval gate is resolved.*
