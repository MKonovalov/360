# Phase 9: Analytic Agent + Observability - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-31
**Phase:** 9-Analytic Agent + Observability
**Areas discussed:** Report shape, AI + web-search stack, Async execution, Langfuse + corrections, Model choice, Vercel plan tier / maxDuration, Analyze entry point, Test policy

---

## Report shape

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid: proposals + run record | Proposals carry AIRS citation discipline (evidence URL, R/C rating, snippet, reasoning); run record stores evidence appendix + hypotheses JSON, validated via a ported gate | ✓ |
| Proposals only, minimal run row | Signal candidates + citation + reasoning; no report envelope, no R/C ratings, no gate | |
| Full AIRS report per run | bluf/signals/analysis/intent_assessment/evidence_appendix/compliance_footer each run; queue derives proposals from signals | |

**User's choice:** Hybrid (recommended option)
**Notes:** Standards (AIRS/AAW/AAR, DRAFT v0.1.0) govern the phase; implement a hybrid subset — citation discipline + R/C ratings + ported validation gate on run output. Full compliance-footer/approval semantics deferred.

---

## AI + web-search stack

| Option | Description | Selected |
|--------|-------------|----------|
| AI SDK + Firecrawl | Vercel AI SDK (OpenAI or Anthropic) + Firecrawl web search; matches AAR Layer 1 | ✓ |
| AI SDK + Exa/Tavily | Dedicated search-API tool; new vendor the org doesn't use | |
| Perplexity API only | One key, search-native, citations built-in; weaker structured-output control | |

**User's choice:** AI SDK + Firecrawl (recommended option)
**Notes:** Follow-up Q1 — reasoning model: **Anthropic Claude** (chosen over OpenAI; strong tool-calling + structured output, mature AI SDK integration).

---

## Async execution

| Option | Description | Selected |
|--------|-------------|----------|
| Sync Route Handler + fail-loud | POST /api/companies/[id]/analyze, one invocation, explicit maxDuration; client pending state; timeout → explicit retry | ✓ |
| Fire-and-poll with run row | Persisted run record + client polling; nicer UX for long runs, more infra; handler still one sync invocation without queues | |

**User's choice:** Sync Route Handler + fail-loud (recommended option)
**Notes:** Follow-up Q2 — Vercel plan tier: **Hobby, 60s ceiling** → `maxDuration = 60`; agent loop must be lean (parallel tool calls, capped Firecrawl rounds).

---

## Langfuse + corrections

| Option | Description | Selected |
|--------|-------------|----------|
| Langfuse Cloud + DB corrections | Cloud traces via AI SDK integration; correction reasons persisted in a DB table linked to trace ID + mirrored as Langfuse annotation | ✓ |
| Langfuse Cloud only | Corrections as annotations only; no new table | |
| Self-hosted Langfuse + DB | EU data control; needs Docker/ops | |

**User's choice:** Langfuse Cloud + DB corrections (recommended option)

---

## Analyze entry point

| Option | Description | Selected |
|--------|-------------|----------|
| Company only | Matches ANLZ-01; Persona Analyze deferred | ✓ |
| Company + Persona | Both detail menus; more scope | |

**User's choice:** Company only (recommended option)

---

## Test policy

**User's choice (free-text):** "Keys have been provisioned. Minimize API calls usage in tests"
**Notes:** Test suite must never hit Anthropic/Firecrawl/Langfuse — mock AI SDK tool-loop, Firecrawl responses, Langfuse exporter. Real provider calls only in manual UAT.

---

## Claude's Discretion

- Exact Anthropic model family (fast variant preferred for the 60s budget)
- Firecrawl API surface (`/search` vs `/scrape`+`/extract`) and evidence mapping
- Review-queue UI placement (dedicated route vs detail-panel section); badge placement
- Proposal/run/correction table schema details
- Whether run record stores AIRS hypotheses verbatim or a simplified reasoning log
- Langfuse trace naming/organization

## Deferred Ideas

- Persona Analyze (same flow on Persona detail) — future phase
- Full AIRS compliance_footer/approved_by + per-report approval semantics
- Composite scoring / taxonomy weights (S1–S11) / trajectory — v2 PIPE-01
- Background-job execution / fire-and-poll — Future Candidate
- Self-hosted Langfuse — EU data-control option
- Batch "analyze all" / scheduled re-analysis
- AAW Stage 10 outcome feedback loop
