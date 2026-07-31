# Phase 9: Analytic Agent + Observability - Context

**Gathered:** 2026-07-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Staff can trigger Menu → Analyze on a **Company** detail panel and the agent runs a web-search-based, AI-driven signal analysis for that single Company. Findings appear ONLY as candidate proposals in a review queue — never as live Signal records. Proposals are typed to the existing `signalType`/`signalStrength` enums and carry AIRS-style citation discipline: evidence URL, R/C reliability-confidence rating, evidence snippet, and reasoning. Staff reviews each proposal (Accept → becomes a live Signal record; Reject → captures a structured correction reason + optional note). A pending-proposal count badge shows on the Company detail page. Re-running Analyze never re-proposes a signal that already exists as a live record for that Company. Every run is traced in Langfuse (chain-of-thought/tool-call steps, token cost); every rejection/correction is persisted in a DB table and linked to that run's Langfuse trace.

Requirements: ANLZ-01 through ANLZ-05, OBSV-01, OBSV-02 (`.planning/REQUIREMENTS.md` §Analytic Agent, §Observability). No new capabilities beyond the listed ones — full AIRS compliance-footer/approval semantics, Persona Analyze, background-job execution, and batch/"analyze all" are out of scope this phase (see Deferred).

The phase is governed by the external standards documents the user supplied from the sibling repo `/Users/mkonovalov/Projects/arclumen-int360/standards/` (AIRS report standard, AAW agent workflow, AAR architecture reference — all DRAFT v0.1.0). Phase 9 implements a **hybrid subset** of those standards scoped to the proposal-queue flow (D-01), not the full AAW 10-stage pipeline.

</domain>

<decisions>
## Implementation Decisions

### Agent output shape (AIRS conformance)
- **D-01:** **Hybrid output shape.** The agent's run produces two artifacts:
  1. **Proposals** — signal candidates for the review queue: `signalType` (existing enum), `strength` (existing enum), `detectedAt`, evidence `url`, `reliability` (R1–R3), `confidence` (C1–C3), `evidence_snippet`, and a reasoning string. This is the unit of staff review (ANLZ-02/03).
  2. **Run record** — per-run metadata including the full evidence appendix (evidence_id → url, ingested_at, retention_tag, R/C) and the agent's analysis (hypotheses with status + diagnostic evidence, per AIRS §4 sections 3–5), stored as JSON for traceability.
- **D-02:** Every proposal's evidence must resolve to the run's evidence appendix (AIRS §5 citation rule). Orphan citations are a hard failure — enforced by a ported validation gate (D-03).
- **D-03:** Port the standards' Stage-8 validation gate (`validate_report.py` → TypeScript) and run it **server-side on every run's output before proposals enter the review queue**. Fails closed: a run that fails the gate never surfaces proposals. Apply the subset of rules that maps to the hybrid shape (citation resolution, R/C enums, no R3·C3 in "strong" claims, `key_uncertainties` non-empty, signals-empty ⇒ no-intent verdict analog). Full-report rules (compliance_footer.approved_by, dissemination semantics) are intentionally not enforced — approval here is per-proposal, not per-report (see Deferred).
- **D-04:** **Verdict/score semantics:** no full `composite_score`/trajectory machinery this phase — ANLZ requirements don't ask for ranking or scoring; the run record may carry a lightweight verdict (`active|emerging|no_intent`-style) only if it falls out naturally from the proposal set. Do not build scoring/taxonomy-weighting infrastructure (that is the v2 PIPE-01 scoring phase).

### AI stack & execution
- **D-05:** Stack is **Vercel AI SDK + Anthropic Claude + Firecrawl web search** (user choice; AAR Layer 1 names Firecrawl as the org's acquisition tool). Reasoner = Anthropic Claude (model family chosen at plan time; prefer a fast model to fit D-08's budget). Search = Firecrawl `/search` or `/scrape`+`/extract` per AAR §4 — plan-time decision against current Firecrawl API docs.
- **D-06:** Execution is a **synchronous Route Handler**: `POST /api/companies/[id]/analyze` (first Route Handler in the codebase — call this out as a new architectural pattern). `requireStaffAccess()` is the first call inside the handler (same single gating check as every page/Server Action). Fail-loud: real error status/body on failure so the client can render it (consistent with Phase 8's fail-loud stance; do NOT copy `arcpedia.ts`'s silent-`[]` shape).
- **D-07:** **`maxDuration = 60`** (user confirmed Hobby-tier ceiling). The agent loop must fit in 60s: parallel/streamed tool calls, capped Firecrawl rounds, lean prompt. No background workers/queues (existing architectural constraint — confirmed again).
- **D-08:** Independent failure domains: the Firecrawl/AI call and the DB writes (run record + proposals) are in **separate try/catch scopes** — an LLM/tool failure is never reported as a DB error or vice versa (same pattern as `company-detail.tsx`'s DB-fetch vs Arcpedia-fetch separation).

### Review queue & writes
- **D-09:** Proposals persist in a **new DB table** (e.g. `signal_proposal`) — this is a durable queue (unlike Phase 8's transient review screen). Accept ⇒ write a live `signal` row (typed to existing enums) **and** mark the proposal accepted (idempotent; one Accept = one Signal). Reject ⇒ mark rejected with the structured correction reason. Never auto-write to `signal` under any circumstance (ANLZ-02).
- **D-10:** Accepted Signal rows record provenance consistent with Phase 8 conventions: `source` = the evidence URL (the `signal.source` column already exists and is free text — use it), plus the run/proposal linkage. Whether a `fieldSources`-style provenance extension is needed for signals is a plan-time call (prefer minimal: `source` URL + proposal FK).
- **D-11:** Dedup (ANLZ-05): enforced **server-side** — before (and after) the agent run, filter out any proposal whose (companyId, signalType) already exists as a live signal. The prompt also instructs the agent to skip known signals. A re-run over an already-covered signal type yields no duplicate proposals, and the UI states why ("already covered").
- **D-12:** Review queue UI: dedicated view listing pending proposals with evidence/citation shown inline (URL + snippet + R/C + reasoning), Accept / Reject controls, and the correction-reason selector on Reject (OBSV-02: wrong signal type / missed inclusion-exclusion criteria / hallucinated-no real evidence / other + optional free-text note). Badge with pending count on Company detail (ANLZ-04). Exact placement (queue page vs. detail-panel section) is a planning/UI decision — prefer a route consistent with the app's explorer patterns.

### Observability & corrections
- **D-13:** **Langfuse Cloud** (cloud.langfuse.com) via the AI SDK Langfuse integration (`@langfuse/vercel` or equivalent current package) — traces capture tool-call/chain-of-thought steps and token cost per run (OBSV-01).
- **D-14:** Correction reasons persist in a **DB table** (durable, queryable for future prompt/taxonomy tuning) with a `traceId` column linking to the Langfuse run trace, AND are mirrored as a Langfuse annotation/feedback on that trace (OBSV-02). DB is the source of truth; Langfuse annotation is the mirror.
- **D-15:** Keys are **server-only**, added to `src/lib/env.ts` following the existing optional-with-graceful-degrade pattern (like `ARCPEDIA_ACCESS_CLIENT_*` / `APOLLO_API_KEY`): `ANTHROPIC_API_KEY`, `FIRECRAWL_API_KEY`, `LANGFUSE_PUBLIC_KEY` + `LANGFUSE_SECRET_KEY` (+ `LANGFUSE_TRACE_BASE_URL`/region if needed). If unset → Analyze action disabled with a "not configured" message; app never crashes. Keys are already provisioned (user confirmed) — never logged, never exposed to client, never committed.

### Test policy
- **D-16:** **Tests must minimize live API calls — mock everything external.** The test suite never hits Anthropic, Firecrawl, or Langfuse: mock the AI SDK tool-loop/`generateText` layer, mock Firecrawl responses, and stub the Langfuse exporter. Real provider calls happen only in manual UAT (Phase 9's UAT run). Unit tests cover the pure logic: prompt construction, proposal schema validation, the ported validation gate, dedup filtering, accept/reject write paths, correction capture.

### Claude's Discretion
- Exact Anthropic model family (fast variant preferred given D-07's 60s budget) — decide in research/planning against current AI SDK + Anthropic docs.
- Firecrawl API surface used (`/search` vs `/scrape`+`/extract`) and how search results map to evidence appendix entries.
- Review-queue UI shape: dedicated route vs. detail-panel section; badge component placement (ANLZ-04) — follow existing explorer patterns, no new design language.
- Proposal table schema details (columns, statuses enum, FK to company, run linkage) — must support D-09/D-10/D-11/D-14.
- Whether the run record stores hypotheses per AIRS §4 section 4 verbatim or a simplified reasoning log — keep it structured JSON either way.
- Langfuse trace naming/organization (trace name = company name + timestamp; generation per LLM call).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### External standards (user-supplied, sibling repo — READ ALL, they govern the agent)
- `/Users/mkonovalov/Projects/arclumen-int360/standards/AIRS-spec.md` — the report standard: 8-section structure, R/C rating scales (§3), citation/no-fabrication rule (§5), GDPR/SCIP + retention tags (§6), client_key isolation (§7), Stage-8 validation gate spec (§8), versioning (§9). DRAFT v0.1.0.
- `/Users/mkonovalov/Projects/arclumen-int360/standards/agent-workflow-spec.md` (AAW) — the 10-stage agent contract (intake → collect → rate → synthesize → ACH → calibrate → draft → gate → human review → feedback). Phase 9 implements the Stage-2/3/4/5/7/8-shaped subset via D-01/D-03; Stages 1/9/10 full semantics are out of scope.
- `/Users/mkonovalov/Projects/arclumen-int360/standards/architecture-reference.md` (AAR) — 6-layer topology, agent placement §4 (reads Layers 1–3, writes only via approval gate), cross-cutting guardrails §5.
- `/Users/mkonovalov/Projects/arclumen-int360/standards/airs-report.schema.json` — the report data model the hybrid shape derives from.
- `/Users/mkonovalov/Projects/arclumen-int360/standards/airs-validation-rules.json` — the gate rule set to port (D-03).
- `/Users/mkonovalov/Projects/arclumen-int360/standards/validate_report.py` — the canonical Stage-8 gate; port its checks to TypeScript (D-03).
- `/Users/mkonovalov/Projects/arclumen-int360/standards/examples/sample-valid.json` — a valid report fixture; reuse as the shape reference for the ported gate's test data.

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — ANLZ-01..05 and OBSV-01..02 exact requirement text (§Analytic Agent, §Observability) + phase-mapping table
- `.planning/ROADMAP.md` — Phase 9 section: Goal, Depends on Phase 6/8, requirements list, research flag (now closed: maxDuration = 60, D-07)
- `.planning/PROJECT.md` — Core Value ("trustworthy 360 view"), Analytic Agent feature framing, Out-of-Scope (no auto-write to DB; no scoring/ranking this milestone)

### Research (grounds the decisions — read before planning)
- `.planning/research/ARCHITECTURE.md` — **§AI agent section (the `analyze` Route Handler block):** `/api/companies/[id]/analyze` reasoning, `maxDuration` flag, AI SDK v6 shape (`generateText` + `Output.object`, `ToolLoopAgent`, `stopWhen: stepCountIs(n)` — verify against installed package docs at implementation time), no-background-jobs justification, fail-loud guidance
- `.planning/research/FEATURES.md` §"4. Analytic Agent" — HITL approval-queue UX research (Clay/Claygent closest analog), review-queue framing, menu-placement rationale (§3a: shadcn `dropdown-menu` prerequisite was already added in Phase 6)
- `.planning/research/PITFALLS.md` — Pitfall 5 (don't copy Arcpedia's never-throws/never-logs onto paid calls — informs D-06/D-15); Pitfall 2 (dedup discipline — informs D-11); Pitfall 4 (metered-API blast radius — per-record-only, D-06/D-07)

### Existing code (must reuse/extend, not diverge)
- `src/lib/db/schema.ts` — `signalTypeEnum` (4 values), `signalStrengthEnum` (3 values), `signal` table shape (D-09/D-10 write target); `company` table (FK target)
- `src/lib/env.ts` — optional-key degrade pattern (D-15: add the 4–5 new keys here)
- `src/lib/auth/requireStaffAccess.ts` — the gate every page/action/handler uses (D-06)
- `src/components/explorer/explorer-menu.tsx` — detail-panel Menu; the Analyze action slot (Phase 6 MENU-02)
- `src/components/companies/company-detail.tsx` — pending-proposals badge home (ANLZ-04); independent-failure-domain pattern reference (D-08)
- `src/lib/db/queries/signals.ts` — existing signal query patterns; dedup query will extend here (D-11)
- `src/lib/import/` + Phase 8 write-path conventions (`fieldSources`, version-guarded commits) — provenance pattern reference for D-10
- `src/components/import/` — Phase 7 wizard-review components; share the "current vs incoming, accept per field" table shape where it maps to proposal review (D-12)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ExplorerMenu` (`src/components/explorer/explorer-menu.tsx`): detail-panel dropdown with a reserved Analyze slot — the trigger for D-06's flow
- `requireStaffAccess()`: the single auth gate reused by the new Route Handler
- `env.ts` zod-validated optional-key pattern: template for D-15's new keys
- shadcn `dropdown-menu` (added Phase 6): if the review-queue needs menu/select affordances
- Phase 7/8 review-UI components: "propose → review → commit" shape precedent for D-12

### Established Patterns
- Server Components + 'use client' islands; nuqs URL-synced filters; fail-safe-but-fail-loud-on-actions (Phase 8 D-02)
- No background workers/queues — single-request serverless (D-06/D-07)
- Named-export modules, camelCase, strict TS, relative imports (conventions)
- Review-before-write trust model (Phase 7 wizard, Phase 8 enrichment review) — Phase 9 extends it to a durable queue (D-09)

### Integration Points
- `src/app/api/companies/[id]/analyze/route.ts` — NEW first Route Handler (D-06)
- `src/lib/agents/` (new) — agent orchestration + tool definitions + prompt
- `src/lib/db/schema.ts` + new migrations — `signal_proposal`, `agent_run` (+ `correction` table), D-09/D-14
- `src/lib/db/queries/` — new query modules for proposals/runs/corrections/dedup
- Company detail page — Analyze menu action + pending-count badge (ANLZ-04)
- Review-queue route/UI — new (D-12)
- Langfuse — via AI SDK integration (D-13)

</code_context>

<specifics>
## Specific Ideas

- User supplied the AIRS/AAW/AAR standards from the sibling `arclumen-int360` repo as the governing contract — implement the hybrid subset faithfully, and port `validate_report.py` rather than inventing a parallel gate (D-03).
- User explicitly wants **tests to minimize live API calls** — mock AI SDK + Firecrawl + Langfuse in the suite (D-16); live provider behavior is verified in manual UAT only.
- Keys are already provisioned; planning should include wiring them into `src/lib/env.ts` + `.env.example` + Vercel env vars, not collecting them.

</specifics>

<deferred>
## Deferred Ideas

- **Persona Analyze** — same agent flow on Persona detail panels; out of ANLZ scope this phase (ANLZ-01 says Company). Future phase candidate.
- **Full AIRS report semantics** — `compliance_footer`/`approved_by` (Layer 5 dissemination gate), SCIP/GDPR statement field, full 8-section report rendering + per-report human approval. The standards' DRAFT status and the per-proposal review model make this premature now; the hybrid shape (D-01) keeps the door open.
- **Composite scoring / taxonomy weights (S1–S11) + trajectory** — v2 PIPE-01 scoring phase owns this; Phase 9 stores structured analysis only.
- **Background-job execution / fire-and-poll** — only if Analyze usage grows beyond per-record single runs (research ARCHITECTURE.md flags as Future Candidate).
- **Self-hosted Langfuse** — EU data control option if cloud compliance becomes an issue.
- **Batch "analyze all" / scheduled re-analysis** — bulk agent runs need cost guards + queue infra (Pitfall 4 class).
- **Outcome feedback loop (AAW Stage 10)** — retuning agent weights from conversion outcomes; needs outcome capture infrastructure, later milestone.

</deferred>

---

*Phase: 9-Analytic Agent + Observability*
*Context gathered: 2026-07-31*
