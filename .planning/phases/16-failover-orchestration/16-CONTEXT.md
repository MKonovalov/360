# Phase 16: Failover Orchestration - Context

**Gathered:** 2026-08-02
**Status:** Ready for planning

<domain>
## Phase Boundary

The Analytic Agent consumes each user's saved model chain — resolved once at run start (snapshot-at-entry) from `userModelSettings` — and retries down it on provider/model failures within the 60s Vercel ceiling, failing loud when the chain is exhausted or the error is not model-related. Delivers: pure `classifyModelError`, the `runAgent` chain loop (primary + 1 fallback, per-attempt timeouts, 60s budget), snapshot-at-entry chain resolution with dedupe, `userId` threading through the analyze route, `model_used`/`model_chain` population on `agent_run`, and the fallback surfacing line in the Analyze status strip.

Delivers: FAL-01..05. Nothing about the Settings UI (Phase 17) or the verification gate (Phase 18) lands here.

</domain>

<decisions>
## Implementation Decisions

### Failover Eligibility (Rate-limit / 429 Policy — user-discussed)
- **D-01:** **429 rate-limit NEVER advances the chain.** After the SDK's own retries are exhausted (`RetryError` wrapping `APICallError` 429), the run fails loud as a transient error. Rationale: Anthropic rate limits are account-level, not model-level — the fallback shares `ANTHROPIC_API_KEY` and hits the same limit, burning the 60s budget for nothing. The classifier's RetryError-unwrap-first order makes this a distinct category.
- **D-02:** **5xx (500/502/529 overloaded) DOES advance the chain.** Anthropic overload/5xx can be endpoint-specific, so a fallback may genuinely succeed. Failover-eligible set = connection errors (`AIConnectionError`) + `NoSuchModelError` + 404 model-not-found + 5xx `APICallError`.
- **D-03:** **The classifier predicate deviates from research ARCHITECTURE.md's example.** That example returns `err.isRetryable || statusCode === 404` — but `isRetryable` includes 429 (408/409/429/5xx), which D-01 carves out. The predicate must switch on `statusCode` explicitly: `404` OR `>=500` OR connection/`NoSuchModelError` → failover-eligible; `429` → transient; `400/401/403/422` → input/auth/config → fail loud, single attempt only (Pitfall 2/3).
- **D-04:** **429 surfaces as a distinct structured reason** (`error: 'rate_limited'`, 502) with a new staff-facing ERROR_COPY line ("Rate limited — try again in a moment") in `analyze-run-status.tsx`. Only 429 gets a new reason row — other non-failover classes keep the existing generic `analysis_failed` fail-loud pattern (fail-loud granularity area was not selected for discussion; Claude has discretion but no requirement to split further).

### Fallback Surfacing UI (user-discussed)
- **D-05:** **The status-strip fallback line lands in Phase 16** — FAL-05 ("staff can see when a fallback ran") is fully closed here. The Analyze API response carries `modelUsed` (raw provider ID) + `usedFallback` (boolean); `agent_run` rows carry `model_used`/`model_chain` (Phase 15 D-05); and the `AnalyzeRunStatus` client component shows the fallback note.
- **D-06:** Success-after-fallback **appends to the existing success line**: `Analysis complete — ran on Claude Sonnet 4.6 (fallback)`. Normal success stays `Analysis complete`. Display name comes from the committed catalog snapshot (`catalog.json` `name` field); raw provider ID is the fallback if the model isn't in the snapshot.
- **D-07:** Reviews/run-history surfacing of the producing model is **deferred** — there is no run-history UI today; it's not built in 16 or 17.

### Degenerate Chain Handling (user-discussed)
- **D-08:** **Chain resolution dedupes (stable unique) before attempting** — never attempt the same model twice. A `[sonnet, sonnet]` settings row resolves to `[sonnet]`; `model_chain` records the deduped resolved chain. Prevents double-burning the 60s budget on an identical retry.
- **D-09:** **A single-model chain runs normally through the loop** (no special-casing, no bypass). Today's allowlist is sonnet-only (`ANTHROPIC_ALLOWLIST = ['claude-sonnet-4-6']`), so real chains are usually N=1 — the same code path handles real chains once haiku-4-5 passes roster verification. `model_chain` records `[claude-sonnet-4-6]` honestly.
- **D-10:** **The FAL-03 "primary + 1 fallback" cap applies AFTER dedupe.** A saved `[sonnet, haiku, opus]` row resolves to `[sonnet, haiku]` — the extra model stays in the settings row but is never attempted. Keeps the FAL-04 budget math (35s + 20s ≤ 60s) honest.

### Carried forward from Phase 15 (locked — do NOT re-ask)
- Snapshot-at-entry: the chain is resolved ONCE at run start; settings edited mid-run never change the in-flight run's chain or audit row (FAL-01).
- `model_chain` = resolved ID list snapshot at entry; per-attempt detail lives in Langfuse spans only (15-CONTEXT D-05).
- Raw provider IDs only (never provider-prefixed or dated IDs — Pitfall 1); `FAST_MODEL_ID = 'claude-sonnet-4-6'` is the no-settings default (REG-05).
- Per-attempt timeouts: ~35s primary / ~20s fallback, `{ totalMs }` in ai@7 RequestOptions (FAL-04).
- Loop returns the existing structured failure (502 + trace link) on chain exhaustion — never a 504.

### Claude's Discretion
- `classifyModelError` exact name/signature/return union (PITFALLS suggests `'model_not_found' | 'input' | 'auth' | 'transient' | 'config' | 'output'` — free to adapt), `modelConfig.ts` module layout (per research ARCHITECTURE.md), timeout literal values (approx. 35s/20s), `maxRetries` handling (keep SDK default 2; count SDK retries in the 60s budget math — Pitfall 4).
- Whether non-429 non-failover classes share the generic `analysis_failed` reason (D-04 default) or get distinct reasons — no requirement to split.
- Exact `usedFallback` shape in the API response (`{ modelUsed, usedFallback }` vs nested), and the `AnalyzeRunStatus` line formatting within D-06's spec.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` — Phase 16 goal, success criteria (5 items), requirements FAL-01..05, depends-on Phase 15, plans TBD
- `.planning/REQUIREMENTS.md` — FAL-01 through FAL-05 definitions (§ Error-driven failover); VER-01..04 reference (§ Verification gate, Phase 18)
- `.planning/PROJECT.md` — Key Decisions: D-14 (DB is durable truth, Langfuse mirror), D-15 (degrade gracefully), D-16 (Vitest pure functions only, zero live calls); v1.3 milestone goal

### Research (decisions above resolve its flags/conflicts)
- `.planning/research/PITFALLS.md` — Pitfall 2 (non-failover errors get wrongly retried — classification is the gate), Pitfall 3 (429 rate-limit policy + RetryError unwrap ordering), Pitfall 4 (SDK retry pile-up vs 60s ceiling, budget math, `{ totalMs }`), Pitfall 1 (raw provider ID invariant)
- `.planning/research/ARCHITECTURE.md` — Pattern 2 (failover loop with pure retry predicate — NOTE: its example predicate `isRetryable || 404` is SUPERSEDED by D-01/D-03), module layout (`src/lib/agents/modelConfig.ts`, runAgent loop, route/analyzeCompany modifications)
- `.planning/research/FEATURES.md` — Failover UX Contract: one run, silent retry down the chain, fail loud only when exhausted, actual model recorded everywhere it matters (run row + trace) and shown subtly where it helps (status strip on fallback)
- `.planning/research/STACK.md` — ai@7 timeout `{ totalMs }` support, SDK retry defaults (maxRetries 2, backoff 2s×2), `APICallError.isRetryable` defaults (408/409/429/≥500)

### Prior phase decisions to carry forward
- `.planning/phases/15-model-registry-foundation-persistence/15-CONTEXT.md` — D-02 (roster), D-03 (allowlist is the gate), D-05 (model_used/model_chain shapes), D-07/D-08 (catalog snapshot), all locked
- `.planning/phases/15-model-registry-foundation-persistence/15-02-PLAN.md` — catalog module implementation (`src/lib/models/catalog.ts`, allowlist, filter fns) this phase consumes

### Codebase patterns to follow
- `src/lib/agents/runAgent.ts` — the mockable seam (09-01-01; D-16 zero live calls); `FAST_MODEL_ID`; gains the chain loop + per-attempt timeout
- `src/lib/agents/analyzeCompany.ts` — `isMisconfigurationError` regex precedent (Pitfall 2 notes it's too light for a chain); `analyzeCompany(companyId)` gains userId param
- `src/app/api/companies/[id]/analyze/route.ts` — the fail-loud route contract (502 + `analysis_failed`), `maxDuration = 60`, `requireStaffAccess()` returns `{ userId }` (currently discarded — Phase 16 threads it), `persistRunAndProposals` gains modelUsed/modelChain
- `src/lib/db/queries/runs.ts` — `createRun` input already accepts `modelUsed`/`modelChain` (REG-04 seam, Phase 15)
- `src/lib/db/queries/userModelSettings.ts` — `getModelSettingsForUser` returns `{ primaryModel, fallbackModels }` or `undefined` (REG-05 absence → default chain)
- `src/lib/models/catalog.ts` — `ANTHROPIC_ALLOWLIST`, `opencodeSlugToModelId`, `getAllowlistedServableIds` (chain resolution consumes servable ids + display `name` for D-06)
- `src/components/agents/analyze-run-status.tsx` — `AnalyzeRunStatus` client strip; `ERROR_COPY` reason→copy table (D-04 adds `rate_limited`); success/failure state rendering (D-06 adds fallback note)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getModelSettingsForUser(userId)` — already returns the saved chain or `undefined`; Phase 16 resolver maps absence to the default `[FAST_MODEL_ID]`
- `createRun` — `CreateRunInput` already carries `modelUsed`/`modelChain`; the route's `persistRunAndProposals` is the single write seam
- `src/lib/models/catalog.ts` — committed snapshot accessor + `name` field for the D-06 display name; `getAllowlistedServableIds` for validating saved ids against servable set
- `AnalyzeRunStatus` ERROR_COPY table — established fail-loud copy pattern (Phase 8 precedent) that D-04 extends
- `runAgent.test.ts` — the mockable seam test; `anthropic` and `generateText` mocked; new failover/classify tests slot in here (D-16)

### Established Patterns
- Query modules: named exports, never try/catch, no `db.transaction()`; the caller owns error handling (runs.ts house comment)
- Fail-loud (D-06, Phase 9): structured error reasons mapped to staff-facing copy; genuine agent/provider failures propagate to the route's AI-domain scope → 502
- Vitest: co-located `*.test.ts`, pure functions only, no mocking library beyond `vi.mock`, zero live calls (D-16) — `classifyModelError` is the natural new test target (VER-01 feeds off it in Phase 18)
- Langfuse: AI SDK emits one span per `generateText` under the active observation — per-attempt spans get `ai.model.id` for free; the loop needs no extra telemetry plumbing (ARCHITECTURE.md Pattern 2 note)

### Integration Points
- `src/lib/agents/runAgent.ts` — replace the single `model?` seam with an ordered chain; loop attempts; return `modelUsed`/`usedFallback`
- `src/lib/agents/analyzeCompany.ts` — accept `userId`; resolve + dedupe + cap the chain once at entry; pass to runAgent; snapshot-at-entry
- `src/app/api/companies/[id]/analyze/route.ts` — capture `{ userId }` from `requireStaffAccess()` (currently `await`-discarded); pass to `analyzeCompany`; add `modelUsed`/`usedFallback` to the 201 response; add `rate_limited` branch + persist model fields
- `src/lib/db/queries/runs.ts` — no change needed (seam exists); `persistRunAndProposals` fills `modelUsed`/`modelChain` from the run result
- `src/components/agents/analyze-run-status.tsx` — D-04 `rate_limited` copy row; D-06 fallback note on the success line

</code_context>

<specifics>
## Specific Ideas

- **"Only 429 gets a new reason row"** — the fail-loud granularity area was deliberately not selected; D-04 is the sole carve-out from the generic `analysis_failed` pattern.
- **The research's example predicate is superseded** — ARCHITECTURE.md's `isFailoverEligibleError` (`isRetryable || 404`) would treat 429 as failover-eligible; the user explicitly overrode this (D-01/D-03). Planners must not copy the research example verbatim.
- Roster verification is a hard gate carried from Phase 15 (D-02): `claude-haiku-4-5` only joins the allowlist if an execution-time `GET /v1/models` re-verify passes; the loop must not assume haiku is servable.

</specifics>

<deferred>
## Deferred Ideas

- **Reviews/run-history producing-model surfacing** — no run-history UI exists today; adding one (or a model column to proposal/review surfaces) is a future phase (D-07).
- **Per-attempt detail in `model_chain`** — rejected (Phase 15 D-05); Langfuse spans carry attempts detail, DB carries the resolved-chain snapshot.
- (Carried from research) Per-agent model assignment MRG-01, multi-provider MRG-02, per-model advanced settings MRG-03, team defaults MRG-04 — already recorded in `.planning/REQUIREMENTS.md` Future Requirements.

</deferred>

---

*Phase: 16-Failover Orchestration*
*Context gathered: 2026-08-02*
