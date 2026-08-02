# Phase 20: Cross-Provider Run Path - Context

**Gathered:** 2026-08-02
**Status:** Ready for planning

<domain>
## Phase Boundary

The Analytic Agent can resolve and run cross-provider fallback chains safely — a fallback may come from a different provider than the primary — with an extended error classifier (402 billing, 502/503 model-availability), a hop-aware 429 policy, a chain-aware env gate at run entry, and audit columns recording the actual provider served. Builds on Phase 19's registry (`getProviderForModelId`, `getUnionServableIds`), `modelFactory` seam, and `OPENROUTER_API_KEY` declaration.

**What this phase is NOT:** no Settings UI (Phase 21), no verification gate (Phase 22). No servable-set changes (Phase 19 owns those). No new providers beyond Anthropic + OpenRouter.

</domain>

<decisions>
## Implementation Decisions

### Cross-Provider Env Gate (FAL-04)
- **D-20-01:** The chain-aware gate names the missing key in its `not_configured` result — e.g. a structured reason "missing OPENROUTER_API_KEY" — not a bare `not_configured`. The route surfaces the named key so the user knows which provider to configure.
- **D-20-02:** The gate is ALL-or-nothing at `analyzeCompany` entry — a chain spanning providers requires every provider's key present up front (FIRECRAWL_API_KEY + each provider key in the resolved chain). Never a mid-chain crash, never a lazy per-hop key check (ARCHITECTURE Pattern 4).
- **D-20-03:** The `FIRECRAWL_API_KEY` requirement stays as-is (webSearch tool needs it regardless of provider); the provider-set check is ADDED to the existing gate, not a replacement.
- **D-20-04:** Gate-only in Phase 20 — no Settings UI surface for missing keys (that's Phase 21's provider-scoped pickers / hints). The gate returns the structured reason; the route surfaces it.

### Mid-Stream OpenRouter Rate Limits (PITFALLS 3 — accept + document)
- **D-20-05:** Mid-stream 429s (OpenRouter `finish_reason: "error"` after HTTP 200) stay classified as `'output'` via the flat `generateText` contract — safe (fail loud, never burn a fallback wrongly). Accepted and documented, NOT reclassified in Phase 20.
- **D-20-06:** The documentation is comment-only: a code comment on the `'output'` branch in `classifyModelError` (modelConfig.ts) + a note in the `runAgent` loop comment + Phase 22's error matrix records the expected behavior. No distinct reason code for stream aborts in Phase 20.

### 429 Helper Scope (PITFALLS 3/5)
- **D-20-07:** `isOpenRouterPlatformRateLimit(err)` is DIAGNOSTICS-ONLY — it informs the structured reason string + telemetry (platform-level vs upstream pass-through), and NEVER changes the advance decision. The hop decision uses ONLY provider identity (from/to) per the locked 4-cell matrix (FAL-03). Clean separation: decision = pure provider matrix, helper = diagnostics.
- **D-20-08:** The body-level helper lives loop-side (runAgent module) as a separate narrow helper, NOT inside the pure `classifyModelError` — keeps the classifier dependency-free for D-16 zero-live-call tests and the research's "helper used by the loop, not the pure classifier" mandate.

### Error Reason Surfacing (FAL-02, route mapping)
- **D-20-09:** The analyze route maps the new distinct classes to distinct HTTP statuses: `not_configured` → 400, `rate_limited` → 429, `billing` → 402, `gate_failed` → 422. The UI branches on status + reason string.
- **D-20-10:** Structured reason strings returned in the response body for the distinct classes — `billing` = "provider credits exhausted" (research-specified), `rate_limited` = 429 reason (existing D-04 carve-out precedent), `not_configured` = names the missing key. Consistent with the existing structured-reason pattern.
- **D-20-11:** Only the NEWLY-distinct classes (billing, not_configured, rate_limited) get their own statuses — existing 502 `analysis_failed` propagation for auth/input/output/config/connection stays untouched. Minimal blast radius on the route.

### Claude's Discretion
- Exact structured reason string wording for `billing` ("provider credits exhausted" is the research anchor, adapt to route conventions).
- The `shouldAdvance(cls, from, to)` / hop-aware predicate's exact signature + where it composes with `isFailoverEligible` (loop-side, per D-20-08).
- 4-cell Vitest matrix file placement and fixture style (follow `modelConfig.test.ts` / `runAgent.test.ts` D-16 conventions).
- How `modelUsed`/`modelChain` (FAL-05) and `usedFallback` flow from the loop to the route — Phase 19 already wires `instantiateChain`/`defaultChain`; the provider-accurate audit column population follows the existing run-return shape.
- 502/503 comment wording (model-availability signal note) in the classifier.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone research (v1.4 — primary source of locked decisions)
- `.planning/research/SUMMARY.md` — Research summary; Conflicts 1–10 resolutions; §Phase 20 deliverables + avoids (classifier extension, billing reason, body-level 429 helper, hop-aware advance + matrix, budget notes). Read the full Conflicts section — most FAL decisions trace here.
- `.planning/research/ARCHITECTURE.md` — Component build order; Pattern 4 (entry-time provider-set env gate: gated ONCE at entry, never per-attempt); `modelFactory` seam spec; derive-don't-persist safety arguments.
- `.planning/research/FEATURES.md` — P1/P2 feature split; provider-aware run path completion; cross-provider chain execution.
- `.planning/research/PITFALLS.md` — Pitfall 3 (402/502/503/dual-source 429 body semantics), Pitfall 5 (429 blanket-fix regression; 4-cell matrix), Pitfall C (free-tier 429 policy), Pitfall F (cross-provider gate hole).

### Roadmap & requirements (locked scope)
- `.planning/ROADMAP.md` §Phase 20 — Goal, Depends on, Requirements (FAL-01..05), Success Criteria, Research flag.
- `.planning/REQUIREMENTS.md` — v1.4 requirements FAL-01..05 (full text).

### Project state & decision records
- `.planning/STATE.md` — v1.4 locked product decisions (hop-aware 429 advance FAL-03; D-01/D-03 same-provider never-advance invariant preserved); Phase 20 pre-flag (APICallError.responseBody check).
- `.planning/PROJECT.md` — Key Decisions table (D-01/D-03 429-never-advance, D-07, D-14 durable-truth audit, D-15 degrade-gracefully, D-16 zero-live-call tests).

### Existing code (integration points)
- `src/lib/agents/modelConfig.ts` — `classifyModelError` (add `billing` for 402, comment 502/503 semantics), `isFailoverEligible`, `resolveModelChain` (union default, D-06).
- `src/lib/agents/runAgent.ts` — the failover loop (`runAgent.ts:88` — currently `if (!isFailoverEligible(classifyModelError(err))) throw err`); hop-aware advance + body-level 429 helper land here; FAL-04 54s budget clamp already in place.
- `src/lib/agents/analyzeCompany.ts` — D-15 env gate (`:44`, currently `ANTHROPIC_API_KEY` + `FIRECRAWL_API_KEY` only) → chain-aware gate; FAL-05 audit fields (`modelUsed`, `modelChain`, `usedFallback`) already flow from the loop.
- `src/lib/agents/modelFactory.ts` — `instantiateModel`/`instantiateChain`/`defaultChain` (Phase 19) — the provider-aware seam the hop logic keys off (`getProviderForModelId`).
- `src/lib/models/catalog.ts` — `getProviderForModelId`, `getUnionServableIds`, `PROVIDER_GATES` — the provider-identity source for hop decisions.
- `src/app/api/companies/[id]/analyze/route.ts` — route mapping to extend (billing → 402, not_configured → 400 naming the key, rate_limited → 429).
- `src/lib/env.ts` — `OPENROUTER_API_KEY` (Phase 19 declaration) — now READ by the Phase 20 gate.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `classifyModelError` / `isFailoverEligible` (modelConfig.ts) — pure classifier + eligibility predicate; the extension points for `billing` + hop-aware advance.
- `getProviderForModelId(catalogJson, id)` (catalog.ts) — the provider-identity source for the hop decision (from/to providers).
- `instantiateChain` / `defaultChain` (modelFactory.ts) — the Phase-19 seam the run path already uses.
- Existing Vitest convention (D-16 zero-live-call) — the 4-cell matrix + billing/502-503 error matrix follow `modelConfig.test.ts`/`runAgent.test.ts` patterns.

### Established Patterns
- Pure classifier: statusCode-first, RetryError-unwrap-first, dependency-free (D-16) — the body-level 429 helper must stay OUT of it (D-20-08).
- Same-provider 429 never advances (v1.3 D-01/D-03) — preserved verbatim; hop-aware advance is a DELIBERATE TESTED EXTENSION, not a relaxation.
- D-15 degrade-gracefully env pattern — `not_configured` reasons, never crash.
- Structured reason codes (D-04 `rate_limited` carve-out precedent) — billing/not_configured follow the same pattern (D-20-09/10).
- FAL-04 budget honesty: loop clamped to LOOP_BUDGET_MS (54s) — cross-provider hops stay under the 60s Vercel wall.

### Integration Points
- `analyzeCompany` env gate (`:44`) → chain-aware, names missing key (D-20-01/02/03).
- `runAgent` loop (`:88`) → hop-aware `shouldAdvance` composing with `isFailoverEligible` (D-20-07/08).
- `classifyModelError` → `'billing'` for 402 + 502/503 comment (FAL-02).
- analyze route → distinct statuses for billing/not_configured/rate_limited (D-20-09/10/11).
- `model_used`/`model_chain` audit — provider-accurate recording of as-saved ids (FAL-05, D-04 verbatim).
</code_context>

<specifics>
## Specific Ideas

- The 4-cell matrix is provider-keyed (from→to): Anthropic→Anthropic (never advance, v1.3 verbatim), Anthropic→OpenRouter (advance), OpenRouter→OpenRouter (never advance), OpenRouter→Anthropic (advance). The body-level helper does not change these cells (D-20-07).
- 402 billing is account-level on OpenRouter: never failover-eligible, even to another OpenRouter model — advancing would fail identically. Distinct structured reason "provider credits exhausted" so nobody later "fixes" it into the advance set (PITFALLS 3).
- 502/503 on OpenRouter are model-availability signals (the purest failover case) — stay `server_error`, never "fixed" into non-eligible. Comment-only (D-20-06 sibling).
- Chain-aware gate message should name the key AND be human-readable (e.g. "OPENROUTER_API_KEY not configured — add it to set up OpenRouter fallbacks").
</specifics>

<deferred>
## Deferred Ideas

- **Mid-stream 429 detection/reclassification** — OpenRouter can rate-limit mid-stream after HTTP 200 (`finish_reason: "error"`); accepted-and-documented in Phase 20 (D-20-05/06). Revisit detection only if telemetry shows it misleads run analysis.
- **Distinct `stream_aborted` reason code** — considered and rejected for Phase 20; would require digging into v7 step/stream result shape beyond budget.
- **Settings-side missing-key warning** — deferred to Phase 21's provider-scoped pickers/hints (D-20-04).
- **Full status map for all error classes** (401 auth, 500 server_error, etc.) — deferred; Phase 20 only makes the NEW classes distinct (D-20-11).

</deferred>

---

*Phase: 20-Cross-Provider Run Path*
*Context gathered: 2026-08-02*
