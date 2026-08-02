# Phase 16: Failover Orchestration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-02
**Phase:** 16-Failover Orchestration
**Areas discussed:** Rate-limit (429) policy, Fallback surfacing UI, Degenerate chain handling

---

## Rate-limit (429) policy

Gray area background: Research internally conflicts — ARCHITECTURE.md's `isFailoverEligibleError` example returns `err.isRetryable || statusCode === 404` (making 429/5xx failover-eligible), while PITFALLS Pitfall 3 explicitly recommends NOT chain-switching on 429 (Anthropic rate limits are account-level, fallback on the same key hits the same limit). ROADMAP FAL-02's wording ("retryable APICallError") also reads as failover-eligible. The SDK's own retry machinery (maxRetries 2, backoff) sits between provider and app, so a 429 surfaces as `RetryError` wrapping `APICallError` 429.

| Option | Description | Selected |
|--------|-------------|----------|
| Fail loud on 429 | A 429 after SDK retries fail loud as a transient error (e.g. 'rate limited, try again in a moment' + trace link). No chain switch — fallback shares the same account key and hits the same limit. Matches PITFALLS Pitfall 3. | ✓ |
| Advance chain on 429 | Treat 429 as failover-eligible; simpler predicate (isRetryable covers it) and matches FAL-02 literal wording, but burns 2x budget and still fails. | |
| Fail on 429, advance on 5xx | 429 never advances; 5xx (server error, provider-side) does — may be endpoint-specific so a fallback could succeed. | |

**User's choice:** Fail loud on 429
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Distinct 'rate_limited' reason | Add a distinct structured reason (error: 'rate_limited') with a staff-facing ERROR_COPY line ('Rate limited — try again in a moment'). Only one new reason added. | ✓ |
| Fold into analysis_failed | Reuse the existing generic `analysis_failed` 502 for 429; no new ERROR_COPY row. | |

**User's choice:** Distinct 'rate_limited' reason
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Advance chain on 5xx | 5xx (500/502/503/529 overloaded) advances to the fallback model — Anthropic overload/5xx can be endpoint-specific, so a fallback may genuinely succeed. | ✓ |
| 5xx also fails loud | Only NoSuchModelError + 404 + connection errors advance; every APICallError status (429 and 5xx alike) fails loud. Tightest budget, but provider-side outage burns the run. | |

**User's choice:** Advance chain on 5xx
**Notes:** Failover-eligible set = connection errors + NoSuchModelError + 404 + 5xx. The predicate must switch on statusCode explicitly (404 OR >=500), NOT `isRetryable` (which includes 429) — the research ARCHITECTURE.md example is superseded.

---

## Fallback surfacing UI

Gray area background: FAL-05 requires staff to know when a fallback ran. The `agent_run` DB columns are populated server-side regardless; the question was how much visible surface lands in Phase 16 vs Phase 17 (Settings UI phase).

| Option | Description | Selected |
|--------|-------------|----------|
| Strip line in Phase 16 | Phase 16 delivers modelUsed + usedFallback in the Analyze API response, DB rows, and the subtle 'ran on Sonnet 4.6 (fallback)' line in AnalyzeRunStatus. FAL-05 fully closed here. Run-history surfacing stays deferred (no UI today). | ✓ |
| Server-side only in 16 | Phase 16 stops server-side: modelUsed/usedFallback in the API response + DB rows only. Status-strip line lands with Phase 17. | |
| Include run-history surfacing | Phase 16 also gets the Reviews/run-history surface a producing-model column now. Broadest scope — touches the Reviews UI. | |

**User's choice:** Strip line in Phase 16
**Notes:** Run-history surfacing explicitly deferred (D-07) — no run-history UI exists today.

| Option | Description | Selected |
|--------|-------------|----------|
| Append to success line | On success-after-fallback: 'Analysis complete — ran on Claude Sonnet 4.6 (fallback)'. Normal success unchanged. Display name from catalog snapshot (human-readable), not raw provider ID. | ✓ |
| Separate mono line | A separate subtle mono line under the existing success line. More visually distinct, slightly more chrome. | |
| No visible change | Fallback note only in Langfuse trace + DB; no visible strip change. | |

**User's choice:** Append to success line
**Notes:** Display name verified available in `catalog.json` (`name` field); raw provider ID as fallback if the model isn't in the snapshot (Claude discretion).

---

## Degenerate chain handling

Gray area background: Allowlist is currently sonnet-only (`ANTHROPIC_ALLOWLIST = ['claude-sonnet-4-6']`), haiku-4-5 gated on execution-time roster re-verify. Real chains usually resolve to a single model; duplicates possible if a saved row repeats a model once haiku lands.

| Option | Description | Selected |
|--------|-------------|----------|
| Dedupe at resolution | Chain resolution dedupes (stable unique) — never attempt the same model twice. model_chain records the deduped chain. Prevents double-burning the 60s budget on an identical retry. | ✓ |
| Attempt as-saved | Attempt the chain as-saved, duplicates included. Simplest, but a duplicate wastes a full ~35s attempt re-running an identical 12-step agent that fails identically. | |

**User's choice:** Dedupe at resolution
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Run single-model chain normally | Loop runs exactly as designed with N=1: one attempt on sonnet, fail loud if it 404s. model_chain records [claude-sonnet-4-6] honestly. Same code path as real chains later. | ✓ |
| Bypass loop when N=1 | Detect the degenerate chain and skip failover machinery — run looks like today's single-attempt behavior. Forks the code path, risks divergence. | |

**User's choice:** Run single-model chain normally
**Notes:** No special-casing — the same code path handles real chains once haiku passes roster verification.

| Option | Description | Selected |
|--------|-------------|----------|
| Cap after dedupe | Cap the ATTEMPTED chain at primary + 1 fallback after dedupe (FAL-03). A saved [sonnet, haiku, opus] resolves to [sonnet, haiku]. Keeps 35s+20s budget math honest. | ✓ |
| Attempt full deduped chain | Dedupe first, then attempt the whole remaining chain regardless of length. More resilience later, but breaks FAL-04 budget math for chains longer than 2. | |

**User's choice:** Cap after dedupe
**Notes:** Extra models stay in the settings row but are never attempted.

---

## Claude's Discretion

- `classifyModelError` exact name/signature/return union (PITFALLS suggests `'model_not_found' | 'input' | 'auth' | 'transient' | 'config' | 'output'`), `modelConfig.ts` module layout, timeout literals (~35s/~20s), `maxRetries` handling (keep SDK default 2, count SDK retries in budget).
- Whether non-429 non-failover classes share the generic `analysis_failed` reason (default) or get distinct reasons — no requirement to split (fail-loud granularity area not selected).
- Exact `usedFallback` shape in the API response and `AnalyzeRunStatus` line formatting within D-06's spec.

## Deferred Ideas

- Reviews/run-history producing-model surfacing — no run-history UI exists today; future phase (D-07).
- Per-attempt detail in `model_chain` — rejected (Phase 15 D-05); Langfuse spans carry attempts.
- MRG-01..04 (per-agent assignment, multi-provider, per-model advanced settings, team defaults) — already in REQUIREMENTS.md Future Requirements.
