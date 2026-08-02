# Pitfalls Research

**Domain:** Adding per-user AI model settings (primary + ordered fallback chain, live model list, error-driven failover) to an existing Next.js 16 + Neon/Drizzle + Clerk + `ai@7` app that already runs the Analytic Agent on `claude-sonnet-4-6` with Langfuse tracing
**Researched:** 2026-08-02
**Confidence:** HIGH — every AI SDK claim verified against installed `ai@7.0.45` + `@ai-sdk/anthropic@4.0.26` (node_modules types + the SDK's retry source via Context7); every opencode claim verified by executing `opencode models` (1.18.10) locally and fetching models.dev; app-side claims verified by direct reads of `runAgent.ts`, `analyzeCompany.ts`, the analyze route, `schema.ts`, `env.ts`, telemetry, and the v1.1 fail-loud/D-14 decision records in PROJECT.md

## The one decision that prevents half of these pitfalls

**The opencode model list is a *menu*, not a *guarantee* — and it is not a *runtime dependency* of the deployed app. Make a curated, provider-filtered allowlist the source of truth for "what the app can run"; use `opencode models` only as a dev-machine display enhancement that degrades gracefully to that allowlist when opencode (or its cache) is absent.**

Verified facts that force this:

- `opencode models` (v1.18.10) returns **1130 entries** as `provider/model-id` slugs — including `opencode/*` gateway models that this app can never call (no opencode API key in the app), 69 `anthropic/*` models, and **dated snapshot IDs** (`anthropic/claude-sonnet-4-5-20250929`, `anthropic/claude-opus-4-5-20251101`, …) — the exact class of ID that 404'd at the live API during v1.1 (`'claude-sonnet-4-20250514'` → 404 `not_found_error`, per `runAgent.ts:7-12`). models.dev/api.json (the source behind the opencode list) is publicly fetchable (3.3MB) and its anthropic catalog likewise contains dated snapshots.
- The AI SDK provider `anthropic('id')` does **no client-side model validation** — a bad string only fails at request time as an `AI_APICallError` 404. So "the list said it exists" and "the API accepts it" are different truths, and the runtime failover loop is the *only* real safety net.
- Vercel serverless has **no opencode binary and no `~/.config/opencode` cache** — a request-time `opencode models` fetch on the deployed app will throw. The fetch must be designed for absence from day one.

Consequence of following it: the model-ID drift pitfall (1), the opencode-source breakage pitfall (8), and most of the list-leakage pitfall (7) become non-issues by construction — the allowlist filters the menu, and runtime 404 classification handles whatever still slips through.

---

## Critical Pitfalls

### Pitfall 1: Model-ID drift — the opencode slug is not the AI SDK model string

**What goes wrong:**
A user's saved model `anthropic/claude-sonnet-4-6` (as shown by `opencode models`) is fed verbatim into `anthropic('anthropic/claude-sonnet-4-6')` — a 404 on every run. Or the prefix is stripped naively and both `opencode/claude-sonnet-4-6` (opencode's own gateway model, unusable without an opencode key) and `anthropic/claude-sonnet-4-6` collapse to the same `claude-sonnet-4-6` string. Or a dated snapshot from the list (`claude-sonnet-4-5-20250929`) is saved and 404s weeks later when Anthropic retires it — the v1.1 incident repeating through user config instead of a constant.

**Why it happens:**
There are **three distinct catalogs** with different ID grammars, and the milestone's phrasing ("model list from local opencode") invites treating one as the other:
1. `opencode models` → `provider/model-id` slugs (1130 entries, from models.dev).
2. `@ai-sdk/anthropic` → expects the **raw Anthropic API model ID** (`claude-sonnet-4-6`), no provider prefix.
3. The live Anthropic API roster → a *subset* of catalog entries (dated IDs get retired; the v1.1 404 was a roster removal).

A mapping layer that is provider-aware is mandatory: only `anthropic/<id>` slugs are usable today (only `@ai-sdk/anthropic` + `ANTHROPIC_API_KEY` are configured — `package.json`, `env.ts`), and the strip must happen *after* a provider filter so the `opencode/*` collision never occurs.

**How to avoid:**
- Store the **raw provider model ID** (`claude-sonnet-4-6`) in the DB — not the opencode slug. The opencode slug is a display artifact; the DB value must be what the provider SDK consumes.
- Build the mapping in one tested pure function: `opencodeSlugToModelId('anthropic/claude-sonnet-4-6') → 'claude-sonnet-4-6'`, `opencodeSlugToModelId('opencode/...') → null` (unusable). Filter by provider prefix *before* stripping.
- The allowlist is the source of truth (the single decision above); the list UI only offers `anthropic/` entries that intersect the allowlist, so dated/retired IDs and `opencode/*` models never reach the save path.
- Keep the existing v1.1 model-string re-verify practice as a standing routine: the verified-roster check (`claude-sonnet-4-6` was verified against `GET /v1/models` on 2026-08-01) becomes part of the allowlist maintenance, and the runtime 404 classification (Pitfall 3) is the automatic backstop.

**Warning signs:**
- Saved settings contain a `/` in the model value.
- Any code does `model.replace(/^.*\//, '')` or `split('/')[1]` without a provider check.
- The settings UI renders 1130 rows including `opencode/*` and `gpt-*` entries while the app only has an Anthropic key.
- A model that is in the opencode list 404s at runtime.

**Phase to address:** Phase A (Model Registry foundation — mapping function + allowlist + storage schema) and Phase C (Settings UI consumes the filtered list).

---

### Pitfall 2: Non-failover errors get wrongly retried — input/validation/auth errors burn the whole chain

**What goes wrong:**
A `catch (err) { fallback to next model }` around `generateText` treats every throw as "model is bad." An Anthropic 400/422 (malformed structured-output spec, content-policy rejection, oversized prompt), a 401/403 (key missing/invalid), or an SDK `LoadAPIKeyError` sends the run through every fallback model — each attempt re-running the **full 12-step web-search agent** (Firecrawl calls + tokens). The same input fails identically on every model, so the run ends `502 analysis_failed` after N× cost and N× the time budget — inside a 60s serverless ceiling (Pitfall 6).

**Why it happens:**
Failover loops are written as "try this model, catch, try next." Error *classification* is a separate, unglamorous step that gets skipped. The v1.1 codebase precedent (`isMisconfigurationError` regex in `analyzeCompany.ts:170-172`) shows how lightly errors are classified today — a regex match on "not configured|api key" is fine for one hardcoded provider but not a classification layer for a chain.

**How to avoid:**
Classify before failing over, using the SDK's own flags (verified in `ai@7.0.45`):
- `AI_APICallError.isInstance(err) && err.statusCode === 404` → **model-not-found** → the only status that *should* advance the chain.
- `APICallError.isInstance(err) && !err.isRetryable && statusCode is 400/401/403/422` → **input/auth/config error** → NO fallback; fail loud with a distinct structured reason (`error: 'model_input_invalid'` / `'model_auth_failed'`), mirroring the existing fail-loud route contract (`route.ts:57-76`).
- `RetryError.isInstance(err)` (SDK exhausted its retries — see Pitfall 4) → **transient** → per the rate-limit policy (Pitfall 4), do not chain-switch; fail loud with a retry suggestion.
- `LoadAPIKeyError` → **config** → map to the existing `not_configured` (503) path; never fallback.
- `InvalidResponseDataError` (model output failed schema parse) → **schema/output contract** → one optional fallback attempt is defensible (a weaker model may emit unparseable JSON where the primary wouldn't — but a primary that parses fine and a fallback that doesn't should not fail the run); decide explicitly, default to *no* fallback + fail loud so the gate (`validateRunArtifacts`) is never skipped.

Extract `classifyModelError(err): 'model_not_found' | 'input' | 'auth' | 'transient' | 'config' | 'output'` as a pure function — it is the single most testable, highest-value unit this milestone can add (it converts Pitfall 2 + 3 into Vitest cases, matching the pure-functions-only convention).

**Warning signs:**
- The failover loop has no status-code branch — just `catch → next model`.
- A run that fails on a 400 produces 2-3 failed attempts in the Langfuse trace instead of one.
- The `agent_run` row for a failed run shows multiple attempts with zero model-not-found among them.

**Phase to address:** Phase B (Failover Orchestration) — the classifier and the loop land together; Phase D (Verification) asserts 400/401/403 never trigger a fallback.

---

### Pitfall 3: Provider auth/rate-limit vs model-not-found misclassification

**What goes wrong:**
Two directions of failure:
1. **429 rate-limit treated as model-not-found** → the chain switches models. But Anthropic rate limits are **account-level, not model-level** — the fallback model on the same key/account hits the same limit. The run burns 2× attempts (each with SDK backoff retries baked in) and still fails.
2. **404 hidden behind a `RetryError`** → a naive `instanceof APICallError` check misses it (see Pitfall 4), so a genuinely-dead model ID never triggers the fallback that would have saved the run — the exact v1.1 scenario now happening per-user.

**Why it happens:**
The SDK's retry machinery sits *between* the provider and the app. After `maxRetries: 2` (default) the throw is a `RetryError` wrapping the last `APICallError` — status-code checks on the top-level error see `RetryError`, not `APICallError`. And 429 is *retryable by the SDK* (408/409/429/5xx are `isRetryable`), so it never even surfaces to the app until retries are exhausted — by which point the app must decide whether "still rate-limited after 3 attempts" is a model problem (it isn't).

**How to avoid:**
- **Check `RetryError` first and unwrap** before classifying: `if (RetryError.isInstance(err)) { classify the underlying APICallError/`err.errors`[last] }`. Then a 429-that-exhausted-retries classifies as `transient`, never `model_not_found`; a wrapped 404 (rare, since 404 isn't retried — it surfaces directly) classifies correctly.
- **Rate-limit policy, written down:** 429 → do *not* switch models (same-provider quota). After SDK retries are exhausted, fail loud with a "rate limited, try again in a moment" message and the trace link. Optionally one hail-mary fallback attempt *only if* the chain is cross-provider (it isn't in v1.3 — Anthropic only). Never silently chain-switch on 429.
- **Auth (401/403) → no fallback** — the whole chain shares `ANTHROPIC_API_KEY`; a bad key fails every model. Fail loud with `model_auth_failed` and surface "check the API key" (the D-15 `not_configured` messaging pattern).
- The classifier (Pitfall 2) is the single gate for all of this; the loop calls `classifyModelError` and switches only on `model_not_found`.

**Warning signs:**
- Two consecutive failed attempts in one trace when the first failure was a 429.
- A per-user saved model that 404s never falling back (fallback works for other errors but not this one).
- Error messages in the DB/route that say "rate limited" while the chain advanced.

**Phase to address:** Phase B — classification ordering (`RetryError` unwrap) and the 429 policy are loop-level decisions; Phase D verifies the 404→fallback and 429→no-fallback matrices.

---

### Pitfall 4: App-level failover compounds the SDK's internal retries — cost, latency, and RetryError unwrapping

**What goes wrong:**
The SDK already retries `isRetryable` errors up to 2× with backoff (2s initial, 2× factor, honoring retry-after headers — verified in `packages/ai/src/util/retry-with-exponential-backoff.ts`). An app-level failover loop that doesn't account for this means: one broken primary = 3 SDK attempts + 1+ fallback attempt, each re-running the full 12-step agent with Firecrawl. Inside `maxDuration = 60` (Vercel Hobby, `route.ts:16`), the *latency* math matters as much as the cost: a 30s primary + SDK backoff (~6s) + a 30s fallback ≈ 66s → **Vercel kills the request mid-fallback** → the user sees a 504 even though the fallback model would have produced a result.

**Why it happens:**
Two retry layers are invisible to each other. The v1.1 agent ran exactly one `generateText` per request with no timeout configured (`runAgent.ts:32-38` has no `timeout`/`abortSignal`), so "it fit in 60s before" is not evidence it fits with a chain. Failover design in docs/LLM training data rarely accounts for the platform ceiling.

**How to avoid:**
- **Budget the chain against the ceiling explicitly:** decide max attempts (recommend: 1 fallback in v1.3; chain of N only if per-attempt budgets fit), and set a per-attempt `timeout` (`{ totalMs }` — verified supported in ai@7 RequestOptions) so a slow primary doesn't eat the fallback's share. Document the math: `attempts × (per-attempt budget) + SDK backoff ≤ 60s`.
- Set `maxRetries` consciously: keep the default 2 for transient blips, but count SDK retries in the budget (a 429/5xx burns 3 attempts before the app sees it). For model-not-found (404) the SDK does *not* retry — single attempt, so classification is cheap — but that's exactly why unwrapping `RetryError` (Pitfall 3) matters: only retryable errors produce the expensive retry pile-up.
- Surface a timeout-aware failure: if the budget is exhausted by attempts, the route returns the existing `502 analysis_failed` with the trace link — never a silent partial.

**Warning signs:**
- Analyze starts returning `504`/timeouts after the settings feature ships when it never did before (budget blowout from the chain).
- A trace shows 4+ inference spans for one run on the same company.
- The fallback loop is written without any timeout option on `generateText`.

**Phase to address:** Phase B — attempt-count cap + per-attempt timeout are loop-level; Phase D's verification runs the budget math as a checklist item.

---

### Pitfall 5: Failover silently runs a different model — the audit/trace must record which model actually ran

**What goes wrong:**
Primary 404s → fallback succeeds → the run returns `201` with proposals, and nothing anywhere records that the user's chosen primary was dead and a different model did the work. Cost, quality, and prompt-sensitivity all differ by model — a fallback may hallucinate more or refuse structured output. Worse, the `agent_run` table has **no model column** (`schema.ts:233-246`), so "what actually ran" is unanswerable in the durable record; the v1.1 correction-mirror decision (D-14: DB is durable truth, Langfuse is a best-effort mirror) is directly violated if the only evidence lives in Langfuse.

**Why it happens:**
`runAgent` returns `{ output, usage, steps }` — the model identity isn't part of the result shape. Failover code that loops `generateText` naturally returns "the last successful result" without remembering which attempt won or why the others lost.

**How to avoid:**
- **Add model audit to the run result and the DB:** `runAgent`/the chain loop returns `modelUsed: string` (raw provider ID) and `attempts: [{ model, status: 'failed'|'succeeded', reason?: 'model_not_found'|... }]`. Persist both on `agent_run` — new columns (e.g. `model_used` text + `model_chain` jsonb, following the existing `usageTokens` jsonb precedent). The proposals' provenance (already a strength of this app) now includes *which model produced them*.
- **Record the config snapshot at run start** — the resolved chain the run *actually used*, not a mid-run re-read (see Pitfall 9). The audit row must be reproducible after the fact.
- **Langfuse already records `ai.model.id`/`ai.model.provider` on every inference span** (verified: base telemetry attributes + `gen_ai.request.model` at call-end) — each attempt is a separate span under the run's trace. That's the *visual* evidence; the DB columns are the *durable* evidence. Both, never either.
- Attach `telemetry.metadata` (attempt index, failover reason) per `generateText` call so the trace is self-describing — cheap, verified supported.
- Surface it in the UX: the Analyze response can include `modelUsed`; the review/run history can show it. "The user doesn't know their primary is broken" is itself a UX pitfall (Pitfall 13).

**Warning signs:**
- `agent_run` has no model column after the milestone ships.
- A code-review pass finds the chain loop returning only the final `generateText` result.
- Langfuse shows model A's span with the run annotated as model B.

**Phase to address:** Phase A (schema columns) — the audit shape is a persistence decision, not a loop detail; Phase B populates it; Phase D asserts the `agent_run` row for a failed-primary run records the fallback.

---

### Pitfall 6: The fallback chain collides with the 60s serverless ceiling (and the SDK's retry pile-up)

**What goes wrong:**
Covered mechanically in Pitfall 4 — but its own head here because it's the most likely *user-visible* regression: Analyze worked fine at 30-45s in v1.1; after failover ships, a broken primary turns every run into a timeout. The app already tells staff "this can take up to a minute" (`route.ts:14-16`); failing that promise with a 504 is a trust regression, not an edge case.

**Why it happens:**
Failover is added as "more chances" without a total-budget model. Serverless ceilings are external hard walls — you can't extend the wall with code.

**How to avoid:**
- Treat the chain as a **budget allocation**: `maxAttempts`, `perAttemptTimeout` (ai@7 `timeout: { totalMs }`), and the SDK's own retry latency must sum under 60s with margin. In v1.3 with Anthropic-only fallbacks, the realistic shape is **primary + 1 fallback**, primary timeout ~35s, fallback ~20s — validated numbers at Phase D.
- If the primary failure is a fast 404 (single attempt, no backoff), the fallback almost always fits — the danger is only 429/5xx pile-ups, which Pitfall 4's policy (no chain-switch on 429) already prevents.
- Keep `maxDuration = 60` explicit and add a comment documenting the budget math — the codebase's why-comments convention.

**Warning signs:**
- Analyze timeouts cluster on users whose primary is broken.
- The route's `maxDuration` is raised to 300 "to be safe" without a Hobby-plan check (Hobby caps at 60s — raising it is a plan change, not a config change).

**Phase to address:** Phase B; verified in Phase D with the budget checklist.

---

### Pitfall 7: Leaking the full model list instead of only usable models

**What goes wrong:**
The settings UI fetches `opencode models` and renders all 1130 entries — `opencode/*` gateway models (require opencode's own API key, never available here), `gpt-*`/`gemini-*`/`deepseek-*` (no provider SDK or key installed), and dated Anthropic snapshot IDs that 404. Users pick what looks good, save it, and every Analyze run silently falls back (or fails). The UI has also leaked the full global catalog as a *maintenance promise* — users expect every listed model to work.

**Why it happens:**
The milestone brief says "available-models list fetched live from opencode." Fetching without filtering treats "exists in a global registry" as "runnable in this app" — the same menu-vs-guarantee confusion as Pitfall 1.

**How to avoid:**
- **Filter server-side, twice:** (1) provider filter — only `anthropic/` (the only configured provider; `package.json` has only `@ai-sdk/anthropic`, `env.ts` only `ANTHROPIC_API_KEY`); (2) allowlist intersect — only models the app has *verified* runnable (the roster-verified set; `claude-sonnet-4-6` is the current confirmed one, plus explicitly-curated additions). Render the intersection, nothing else.
- Keep the allowlist as the source of truth (the single decision) so the UI can never offer an unrunnable model even if the source list changes.
- The response to the settings page must be the *filtered* list — never the raw `opencode models` output passed through (also avoids shipping a 3.3MB models.dev payload to the client).
- Mark the list honestly: a small "verified working" caption beats 1130 unchecked rows.

**Warning signs:**
- The settings page shows models from providers the app has no SDK for.
- A "model X isn't available in this app" support question reaches the team.
- The settings payload is several MB or contains `opencode/` entries.

**Phase to address:** Phase C (Settings UI + list source); the filter function belongs in Phase A (registry) so it's testable independent of UI.

---

### Pitfall 8: The opencode model-list source breaks in a non-opencode deployment

**What goes wrong:**
The settings page runs `opencode models` (or reads its cache) in a Server Component / Server Action on Vercel — **no opencode binary exists in serverless**, so it throws on every load: settings page 500s, or (worse) a `try/catch` swallows it and the list renders empty with no fallback. Dev machine works, production is broken — the classic environment-split bug.

**Why it happens:**
The list source is a *local dev-machine tool* (opencode + its `~/.config/opencode` models cache), and the milestone conflates "local opencode" with a deployable data source. Vercel serverless is a different machine with no CLI tools and no user config.

**How to avoid:**
- **Never shell out to `opencode` at request time on the server.** The deployed list must come from one of: (a) the curated allowlist (source of truth — always works), (b) a direct fetch of `models.dev/api.json` (publicly reachable from Vercel, verified 2026-08-02) filtered per Pitfall 7 and cached, or (c) a build-time snapshot baked into the bundle. Recommend (a) as truth + (b) as the "live feel" enhancement, with (a) as the automatic degradation.
- If `opencode models` is used at all (local DX nicety), gate it behind an env flag / non-production check and wrap it in a never-throws helper that returns the allowlist on any failure — the codebase's degrade-gracefully pattern (Arcpedia `fetchArcpediaArticles` never-throws precedent).
- The list fetch is a settings-page concern only — it must never block the Analyze path or the agent (the agent reads *saved config*, not the live list).

**Warning signs:**
- Any `exec`/`spawn`/`child_process` reference in `src/` for model listing.
- The settings page works in `npm run dev` and 500s in a Vercel preview.
- A `try/catch` around the list fetch with an empty-array fallback (silent empty list = users can't change anything).

**Phase to address:** Phase C; the degradation helper is a Phase A registry concern so tests cover "no opencode" without a binary.

---

### Pitfall 9: Per-user config races — settings edited mid-run (and concurrent saves)

**What goes wrong:**
Two distinct races:
1. **Mid-run edit:** the Analyze request reads the user's chain *lazily* (inside the failover loop, per attempt). The user edits Settings while a run is in flight; attempt 1 uses the old primary, attempt 2 reads the new config — a mixed-model run whose audit row doesn't match what the user sees now.
2. **Concurrent saves:** two tabs both save the chain; a read-modify-write upsert (`SELECT chain; append; UPDATE`) loses one save — a silent settings revert.

**Why it happens:**
Serverless requests are stateless and concurrent by default; settings UIs typically do full-document saves without versioning. The `recentlyViewed` precedent (`userId` + `onConflictDoUpdate` upsert, `queries/recentlyViewed.ts`) shows the codebase's upsert pattern — but an upsert of a *derived* value (read-modify-write) reintroduces the race the upsert was supposed to kill.

**How to avoid:**
- **Snapshot the resolved chain once at request start** (read settings → resolve to a concrete model list → pass into `analyzeCompany`/`runAgent` as the single source for every attempt). The audit row records the snapshot. Mid-run edits affect the *next* run, never the current one — and the UI can say so.
- **Save settings as a full-value atomic upsert** (`onConflictDoUpdate` writing the complete chain object, no read-modify-write), matching the `recentlyViewed` pattern. Add a `updatedAt` column so the UI can show/compare last-saved time; a lightweight `version` guard is optional at this scale but cheap.
- The settings Server Action runs under the existing `requireStaffAccess()` gate (the `rejectProposalAction` precedent) — per-user scoping is `userId` keyed, never a shared row.

**Warning signs:**
- `analyzeCompany` calls a `getUserModelSettings(userId)` inside the failover loop instead of once at entry.
- The settings save path does `getSettings(); settings.chain.push(x); updateSettings(settings)`.
- Two browser tabs diverge after both save.

**Phase to address:** Phase A (atomic upsert + snapshot semantics defined in the query module) and Phase B (snapshot-at-entry consumed by the chain); Phase D asserts a mid-run save doesn't change the in-flight run's audit row.

---

### Pitfall 10: The settings are stored but never actually consumed — the registry wiring gap

**What goes wrong:**
The most boring failure in the milestone: the Settings page saves a chain beautifully, and `runAgent` still uses `FAST_MODEL_ID = 'claude-sonnet-4-6'` because the seam `RunAgentInput.model` (a single optional model instance, `runAgent.ts:15-19`) was never threaded through to the saved config. Every user's settings are decorative; nobody notices until the "which model ran" audit (Pitfall 5) shows one model for everyone.

**Why it happens:**
The existing seam was designed for "pass a model instance" in v1.1 tests, not "resolve a chain from per-user config." Wiring config → orchestrator → seam is a chain of three call sites that are each individually easy to skip.

**How to avoid:**
- Make the seam **chain-shaped and provider-agnostic**: `RunAgentInput` gains a resolved chain (or `modelUsed`-producing loop) typed as `LanguageModel` from `ai` — not `ReturnType<typeof anthropic>` (single-provider-typed, and the registry would otherwise be locked to Anthropic forever). Build a `modelRegistry.ts` with `resolveChain(userId, snapshot?) → { models: LanguageModel[], ids: string[] }` as the one entry point the agent consumes.
- Add a Phase-D UAT line that is *exactly* this: change settings → run Analyze → assert `agent_run.model_used` matches the saved primary. That single end-to-end assertion is the milestone's core acceptance test.
- Keep `FAST_MODEL_ID` as the **default when no settings exist** (backward compatible), never as an override that shadows settings.

**Warning signs:**
- `runAgent.ts` still hardcodes the model string while the settings table exists.
- `getUserModelSettings` is called nowhere in `analyzeCompany`/the route.
- All `agent_run` rows share one `model_used` value despite users having different settings.

**Phase to address:** Phase B — the wiring is the failover phase's core deliverable, not a Phase-C afterthought; Phase D's UAT locks it end-to-end.

---

### Pitfall 11: AI-SDK syntax drift — training data says fallback/`createProvider` works a certain way; ai@7 differs

**What goes wrong:**
The v1.1 plan's `ToolLoopAgent`/`agent:` syntax was stale for ai@7 (`runAgent.ts:22-24` documents this). The same risk recurs: someone writes the failover using a v5-era pattern — e.g. passing model *strings* to `generateText` (only `embed` accepts strings; `generateText` needs a `LanguageModel` instance), or assuming `NoSuchModelError` (exported in ai@7 but only thrown by string-resolution paths like `createProvider` model lookup, *not* by `anthropic('id')` + provider call) will catch bad IDs. The v1.1 incident class: plan/assumption errors that compile fine and fail at runtime.

**Why it happens:**
`ai` moves fast and the codebase pins v7.0.45; general knowledge of "the AI SDK" is usually a mix of v3-v5. The existing mitigation is already proven: verify against `node_modules/ai/dist/index.d.ts` before writing the loop (the v1.1 decision record).

**How to avoid:**
- Verify before coding, in-repo: confirm `generateText`'s model option type, the exported error classes (`APICallError`, `RetryError`, `LoadAPIKeyError`, `InvalidResponseDataError` — all confirmed in `ai@7.0.45` dist exports), and that `anthropic('id')` returns a `LanguageModel` (`AnthropicProvider extends ProviderV4`, `@ai-sdk/anthropic@4.0.26`).
- Prefer building the loop on the *documented primitive contract* — `generateText` per attempt, error classification from `APICallError.isInstance`/`RetryError.isInstance` (verified static helpers) — over any `agent:`/`result.object`/`createProvider` sugar from memory.
- Add a note in the phase plan mirroring the v1.1 one: "verify against installed types before writing the failover loop."

**Warning signs:**
- The plan (or a draft) contains `agent:`, `result.object`, or model-string args to `generateText`.
- An import of a class that isn't in the installed `ai` dist exports (e.g. `TooManyRequestsError` is NOT re-exported from `ai@7`'s root — classify 429 via `statusCode === 429`).
- `next build`/tsc passes but the first live run throws at the model call.

**Phase to address:** Phase 0/planning (the syntax note goes in the phase plan before Phase B code is written) — same placement as the v1.1 syntax correction.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keep the allowlist in code instead of building a "live sync" pipeline | Zero infra; trivially correct; the list is ~10 curated models | Adding a new model = code change + deploy; list can lag Anthropic releases | Acceptable and **recommended** for v1.3 — correctness over freshness; revisit when the team wants self-serve model adds |
| Read settings once at request start instead of a cache/invalidation system | Simple, always-consistent-per-run | Each run pays a settings query (tiny, Neon; acceptable) | Acceptable — don't build a settings cache at this scale |
| Store the chain as one jsonb column instead of a normalized table | One upsert, no joins | No per-model metadata (per-model enable/disable flags later need a migration) | Acceptable for v1.3 — keep it a jsonb chain; normalize only when a second agent with *different* per-user settings appears |
| Per-model timeout math documented in comments instead of a config table | No new abstractions | Budget changes require code edits | Acceptable — the numbers belong with the route, not in DB |
| Cross-provider support deferred (Anthropic-only chain) | No new SDKs/keys; 429 policy stays simple | A user wanting OpenAI fallback can't have it | Acceptable for v1.3; the `LanguageModel`-typed registry seam (Pitfall 10) is what makes it *possible* later without a rewrite |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `opencode models` output | Treating `provider/model-id` slugs as SDK model strings, or passing the raw 1130-row list to the UI | Map via provider-aware pure function; DB stores the raw provider ID; UI renders the allowlist-intersected `anthropic/` subset (Pitfall 1, 7) |
| models.dev/api.json | Fetching 3.3MB per settings-page load, or relying on it as the source of truth | Cache it (e.g. a build-time snapshot or a long TTL); filter server-side; allowlist is truth (Pitfall 8) |
| AI SDK retry machinery | App-level fallback unaware of `maxRetries: 2` + backoff → double retries, budget blowout | Count SDK retries in the budget; `RetryError.isInstance` first, unwrap, then classify (Pitfall 3, 4) |
| `anthropic('id')` | Expecting client-side model validation or `NoSuchModelError` | No validation exists — rely on runtime 404 classification for the chain; allowlist keeps the menu clean (Pitfall 1) |
| Langfuse telemetry | Believing the trace alone is the audit ("which model ran") | `ai.model.id`/`gen_ai.request.model` are on the spans — great for visuals; the `agent_run` columns are the durable truth (D-14 precedent, Pitfall 5) |
| Vercel Hobby `maxDuration` | Adding fallback attempts without budget math → 504s | Budget = attempts × per-attempt `timeout.totalMs` + SDK backoff ≤ 60s; cap the chain (Pitfall 4, 6) |
| Clerk user identity | Keying settings by anything other than the Clerk `userId` from `requireStaffAccess()` | `userId: text` no-FK pattern (precedent: `recentlyViewed`); settings are per-user, never global (Pitfall 9) |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Fallback re-runs the full 12-step agent | 2-3× Firecrawl + token cost on runs whose primary is broken | Only `model_not_found` triggers the chain (Pitfall 2); cap at 1 fallback; log/alert when fallback rate is high | Every run on a broken primary costs 2×; a popular broken primary becomes a cost incident |
| SDK retries × app retries compounding | Single run latency 3× normal, 504s | Count both layers in the budget; never chain-switch on 429/5xx (Pitfall 4, 6) | When a provider has a bad 5xx/429 day — the whole chain times out at once |
| Raw model list in the settings payload | MB-scale response, slow TTFB | Filter server-side to the allowlist intersection (~10 rows), never the 1130-row or 3.3MB payload (Pitfall 7, 8) | The moment anyone wires `opencode models` output straight into a Server Component prop |
| Per-run settings query | Negligible at this scale | One indexed `userId` lookup per Analyze; snapshot once (Pitfall 9) | Never at <1k runs/day; revisit only if the agent grows to high-frequency batch runs |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Shelling out to `opencode` (or any binary) at request time on the server | Subprocess on the request path; breaks in serverless; an env-controllable binary path would be an RCE vector | Never spawn in `src/`; list source = allowlist + cached models.dev fetch (Pitfall 8). If a dev-only `opencode` call is ever added, it must be non-production-gated and fixed-command |
| Exposing the raw model catalog to the client | Information surface + false usability promise; users configure unrunnable models | Filter server-side; only the usable, verified intersection reaches the UI (Pitfall 7) |
| Storing provider API keys per-user (future feature) | Keys in the DB = secret-at-rest problem; the current design shares one server-level `ANTHROPIC_API_KEY` | v1.3 stores **no keys** — only model IDs. If per-user provider keys ever land, they need encryption (Neon + envelope encryption), never plaintext jsonb — flag as an explicit future anti-pattern |
| Settings endpoint without the staff gate | Anonymous user configures/reads other users' chains | Every settings Server Action/route starts with `requireStaffAccess()` and keys by the returned `userId` (Pitfall 9) |
| `Langfuse-as-audit` reliance | Trace deletion/retention drift loses the "which model ran" record | Durable truth in `agent_run` columns; Langfuse is the mirror (D-14 precedent, Pitfall 5) |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| 1130-row unfiltered model picker | Impossible to choose; users pick broken entries | 5-15 verified, `anthropic/`-only rows with the primary clearly marked (Pitfall 7) |
| Silent fallback | User's chosen primary is dead and nothing says so — quality/cost drift invisible | Return `modelUsed` with the run; show a "fallback was used" hint on Settings ("last run used X — your primary failed"); this turns Pitfall 5 into user-visible feedback |
| "Up to a minute" promise broken by timeouts | Trust regression on the Analyze action | Budget the chain under 60s (Pitfall 6); a fast-404 primary means fallback usually fits |
| Settings save with no feedback on validity | User saves a model the app can't run | Save-time allowlist validation + a clear "verified working" label; the runtime 404 fallback is the backstop, not the primary UX |
| No indication the list is dev-machine-derived | "Why is this list different on staging?" | Document the source in the UI ("verified models"); the list is a curated set, not a mirror of the local terminal |

---

## "Looks Done But Isn't" Checklist

- [ ] **Settings actually consumed:** change primary → run Analyze → `agent_run.model_used` equals the new primary (the milestone's core acceptance test; Pitfall 10).
- [ ] **Chain stored as raw provider IDs:** no `/` in any saved model value; DB values are directly usable by `anthropic(...)` (Pitfall 1).
- [ ] **Only usable models offered:** the settings response contains zero `opencode/`, `gpt-*`, `gemini-*` rows while only Anthropic is configured (Pitfall 7).
- [ ] **List works without opencode:** deploy a Vercel preview, open Settings — list renders from the allowlist/cached source, no 500, no empty state (Pitfall 8).
- [ ] **404 triggers fallback:** mock/force a dead primary → fallback runs → audit records `model_used` = fallback + the 404 attempt (Pitfall 2, 3, 5).
- [ ] **400/401/429 never chain-switch:** force each — run fails loud in one attempt with the right structured reason (Pitfall 2, 3).
- [ ] **Budget holds:** with a slow-but-working primary and one fallback, the run completes under 60s — no new 504s (Pitfall 4, 6).
- [ ] **Mid-run edit is inert:** start Analyze, change Settings mid-run — the run's audit row reflects the snapshot, not the new config (Pitfall 9).
- [ ] **Concurrent saves don't lose updates:** two tabs saving different chains → last write wins wholesale, no half-merged chain (Pitfall 9).
- [ ] **Audit survives Langfuse absence:** with Langfuse keys unset (D-15), `agent_run.model_used`/`model_chain` are still recorded (Pitfall 5).
- [ ] **No subprocess calls in `src/`:** grep for `exec|spawn|child_process` returns nothing (Pitfall 8).
- [ ] **Existing tests still pass:** `runAgent`'s default-model test (`anthropic('claude-sonnet-4-6')`) is updated deliberately, not deleted — the default is "no settings configured," not a shadow (Pitfall 10).
- [ ] **Failover is observable in the trace:** a failed-primary run shows two inference spans (each with `ai.model.id`) under one Langfuse trace with telemetry metadata (Pitfall 5).

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Saved model 404s (per-user) | LOW | User edits Settings to a verified model; the failover keeps Analyze working until then — this is the design's self-healing path |
| Allowlist missing a newly-released model | LOW | Add the ID to the allowlist (one-line + deploy); no migration needed |
| Chain budget blows the 60s ceiling | LOW-MEDIUM | Lower per-attempt `timeout.totalMs` or drop to 1 fallback; re-run the Phase-D budget check |
| Audit gap discovered late (no `model_used` column) | MEDIUM | Drizzle migration adds the columns; backfill impossible for old runs — the gap only covers pre-milestone runs |
| Settings corruption from a lost-update race | LOW | Re-save; the atomic full-value upsert prevents recurrence (Pitfall 9) |
| Misclassification causing wasted quota | MEDIUM | Fix `classifyModelError` (pure function — one tested change); re-run the 400/401/429 matrix |
| A broad provider outage making every fallback fail | MEDIUM | The run fails loud with the trace link (existing 502 contract); users retry after the outage — no silent partial writes (D-03 fail-closed still holds) |

---

## Pitfall-to-Phase Mapping

Suggested phase structure for the v1.3 roadmap (exact numbering at `/gsd-new-milestone` — dependency ordering, not a prescription):

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Model-ID drift (slug vs SDK string) | Phase A — Model Registry (mapping fn + allowlist + storage schema) | Vitest on `opencodeSlugToModelId`; DB values never contain `/` |
| 10. Settings stored but never consumed | Phase B — Failover Orchestration (registry → chain → `LanguageModel` seam) | Phase-D UAT: change settings → Analyze → `model_used` matches |
| 2. Non-failover errors wrongly retried | Phase B (`classifyModelError` gates the loop) | Vitest matrix: 400/401/403/422 → no fallback; 404 → fallback |
| 3. Auth/rate-limit vs model-not-found | Phase B (RetryError unwrap first; 429 = no chain-switch) | Vitest matrix incl. a wrapped-404 and an exhausted-retry 429 |
| 4. SDK retries compounding app retries | Phase B (attempt cap + per-attempt timeout) | Phase-D budget checklist vs the 60s ceiling |
| 5. Failover silently runs a different model | Phase A (schema columns) + Phase B (populate) | `agent_run.model_used`/`model_chain` asserted in tests + UAT; Langfuse spans cross-checked |
| 6. Fallback collides with the 60s ceiling | Phase B (same budget work as Pitfall 4) | Live UAT with a slow primary + fallback under 60s |
| 7. Leaking the full model list | Phase A (filter fn) + Phase C (UI consumes filtered list) | Settings response contains only allowlisted `anthropic/` rows |
| 8. opencode source breaking on Vercel | Phase A (degradation helper) + Phase C (list source) | Vercel preview: Settings renders from allowlist, no opencode dependency |
| 9. Per-user config races | Phase A (atomic full-value upsert) + Phase B (snapshot at entry) | Two-tab save test; mid-run edit inertness assertion |
| 11. AI-SDK syntax drift | Phase 0/planning (verify against installed types first) | Pre-plan type check of `generateText`/error classes vs `ai@7.0.45` dist |

**Phase ordering rationale:** Phase A (registry + persistence + schema) must land first — every other pitfall's fix composes on the mapping function, the allowlist, the audit columns, and the atomic upsert; the pure functions (`opencodeSlugToModelId`, `classifyModelError`, `resolveChain`) are testable before any UI or loop exists, matching the repo's pure-functions Vitest convention. Phase B (failover orchestration) is the core value and depends on A's registry + schema. Phase C (Settings UI + list source) depends on A and can proceed in parallel with B. Phase D is the verification gate: the Vitest matrices, the budget checklist, the live-browser settings→analyze→audit UAT, and a Vercel-preview check that the list works without opencode.

---

## Sources

- `runAgent.ts` (v1.1 comment: dated ID 404 incident, `claude-sonnet-4-6` verified against live `GET /v1/models` 2026-08-01; `RunAgentInput.model: ReturnType<typeof anthropic>` seam; flat ai@7 `generateText` contract note) — HIGH
- `analyzeCompany.ts` (`isMisconfigurationError` regex precedent; fail-loud D-08/D-06 semantics; gate fail-closed D-03) — HIGH
- `src/app/api/companies/[id]/analyze/route.ts` (`maxDuration = 60` Vercel Hobby ceiling; `requireStaffAccess()` first gate; `startActiveObservation` Langfuse wrapper; 502/422/503/404 structured error contract) — HIGH
- `schema.ts` (`agent_run` has NO model column; `usageTokens` jsonb precedent; `recentlyViewed` per-user `userId` text + unique upsert pattern; D-14 correction/durable-truth record) — HIGH
- `env.ts` (only `ANTHROPIC_API_KEY` + `FIRECRAWL_API_KEY`; all optional/degrade-gracefully D-15) — HIGH
- `package.json` (only `@ai-sdk/anthropic@4.0.26` installed; `ai@7.0.45`; no `@ai-sdk/openai`/other providers) — HIGH
- `langfuse.ts` (OTel `registerTelemetry` + `LangfuseVercelAiSdkIntegration`; DB-as-truth/mirror-best-effort D-14/D-15) — HIGH
- `runAgent.test.ts` + `analyzeCompany.test.ts` (mockable-seam convention, D-16 zero-live-calls; pure-functions Vitest harness) — HIGH
- `node_modules/ai/dist/index.d.ts` (`ai@7.0.45` exports `APICallError`/`RetryError`/`LoadAPIKeyError`/`InvalidResponseDataError`/`NoSuchModelError`/`createProvider`/`LanguageModel`; NO `TooManyRequestsError` re-export) — HIGH
- `node_modules/@ai-sdk/anthropic/dist/index.d.ts` (`AnthropicProvider extends ProviderV4`; `anthropic('id')` returns a language model; no client-side model validation) — HIGH
- AI SDK retry source via Context7 (`/vercel/ai`): `maxRetries` default 2; retryable = 408/409/429/≥500; 404 not retryable; `RetryError` created on retry exhaustion; retry-after headers + 2s×2 backoff; `telemetry.metadata`; `ai.model.id`/`ai.model.provider` base attributes + `gen_ai.request.model`/usage at call-end — HIGH
- `opencode models` executed locally (v1.18.10): 1130 entries, `provider/model-id` slugs, 69 `anthropic/*`, dated snapshot IDs present, `--refresh` pulls from models.dev, `opencode models <provider>` filters — HIGH (executed 2026-08-02)
- `models.dev/api.json` fetched (2026-08-02): publicly reachable, 3.3MB, anthropic catalog = 15 models incl. dated snapshots (`claude-sonnet-4-5-20250929`, `claude-opus-4-5-20251101`, …) — HIGH (fetched directly)
- `.planning/PROJECT.md` v1.1/v1.2 decision records (D-14 durable-truth, D-15 degrade-gracefully, D-16 zero-live-call tests, v1.1 AI-SDK syntax-drift correction) — HIGH
- v1.2 `.planning/research/` files (predecessor research pattern; the app's no-component-test constraint carried forward) — HIGH

---
*Pitfalls research for: ArcLumen 360 v1.3 AI Model Settings*
*Researched: 2026-08-02*
