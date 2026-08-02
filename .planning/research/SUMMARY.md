# Research Summary — v1.3 AI Model Settings

**Project:** ArcLumen 360 (internal staff demand-gen tool)
**Domain:** Per-user AI model management — primary model + ordered fallback chain for AI agents, model list sourced from the local opencode installation, error-driven failover consumed by the Analytic Agent
**Milestone:** v1.3 (per-user AI model settings)
**Researched:** 2026-08-02
**Confidence:** HIGH overall — three research files HIGH (live-verified opencode CLI 1.18.10, installed `ai@7.0.45`/`@ai-sdk/anthropic@4.0.26` node_modules, direct codebase reads); two MEDIUM sub-flags (OhMyOpenCode behavior is docs-sourced; the Drizzle migration apply flow is unconfirmed)

## Executive Summary

v1.3 adds a Settings surface where each staff user picks a primary AI model plus an ordered fallback chain, with the model list sourced from the local opencode installation and the Analytic Agent consuming the config via error-driven failover. Research verified the reference pattern: **opencode core has no error-driven fallback — ordered fallback is OhMyOpenCode's `fallback_models` addition, resolved silently (no interactive retry), never surfaced to the user.** v1.3 replicates exactly that: one run, silent retry down the chain, fail loud only when the whole chain is exhausted, and the model that actually served recorded durably (`agent_run` columns + the existing Langfuse trace, per the D-14 "DB is truth, Langfuse is mirror" rule).

**The single architectural constraint dominates the design: Vercel serverless cannot reach a local opencode installation.** Verified empirically — `opencode serve` binds `127.0.0.1`, there is no binary and no `~/.config/opencode` cache in serverless, and a request-time shell-out would throw (and would be an RCE-adjacent subprocess on the request path). The model list is therefore a **dev-machine snapshot**: a fetch script runs `opencode models --verbose` on the developer's machine and writes a committed, trimmed JSON file (`src/data/opencode-models.json` / `src/lib/models/catalog.json`); the settings page reads the committed snapshot; refresh is a deliberate `npm run models:fetch`. Second, **the opencode catalog is a menu, not a guarantee**: it lists 1,130 `provider/model` slugs across 75+ providers, while the app has only `@ai-sdk/anthropic` + `ANTHROPIC_API_KEY`, and `anthropic('id')` does zero client-side validation (bad/dated IDs only fail at runtime as a 404 — the exact v1.1 incident class). The curated **allowlist** (verified-runnable models) is the source of truth; the opencode list is only a dev-machine display enhancement that degrades gracefully to the allowlist when opencode is absent. A secret-leak hazard was confirmed: opencode's `GET /config/providers` returns the machine's raw API key — never proxy it.

The integration surface is small, well-precedented, and needs **zero new runtime npm dependencies**: a `settings` key added to the locked `NavKey` contract (nav.ts + Vitest suites), a `/settings` route in the `(dashboard)` group behind `requireStaffAccess()`, one new Drizzle table (`userModelSettings`, Clerk-`userId`-keyed, no FK — the `recentlyViewed` pattern), a `LanguageModel[]`-shaped chain replacing the single-model `runAgent` seam, a pure `classifyModelError`/`isFailoverEligibleError` gate so **only provider/model errors (404/model-not-found) advance the chain — never validation, auth, or rate-limit errors** — and `agent_run.modelUsed`/`modelChain` audit columns. The Vercel Hobby 60s `maxDuration` ceiling bounds the chain to **primary + 1 fallback** with per-attempt timeouts (PITFALLS budget math: `attempts × per-attempt budget + SDK backoff ≤ 60s`). The biggest risks are config-drift (a saved ID that 404s — mitigated by the failover loop + allowlist), the 60s ceiling being blown by compounding SDK retries, and the "settings stored but never consumed" wiring gap (locked by one end-to-end UAT: change settings → Analyze → `agent_run.model_used` matches).

## Key Findings

### Recommended Stack (from STACK.md — HIGH)

**Core technologies:**
- **opencode CLI `models` command (v1.18.10, dev-time tool only)** — the exact `/models` TUI backend. `opencode models` prints 1,130 `provider/model` IDs; `--verbose` adds JSON metadata (name, family, cost, context/output limits, status, and critically `api.npm` — the AI SDK package that serves the model). Never a runtime dependency — the deployed app never shells out.
- **Committed model snapshot (`npm run models:fetch` → `src/data/opencode-models.json`)** — the only Vercel-safe bridge. Fetch script shells `opencode models --verbose` on the dev machine, trims to UI-needed fields (~100–200KB, not the 3.3MB raw registry), writes the committed JSON; settings page imports it at render time; UI shows `generatedAt`. Binary resolution: `OPENCODE_BIN` → `which opencode` → `~/.opencode/bin/opencode`; fails with a clear message if absent (snapshot stays usable).
- **Drizzle `userModelSettings` table** — per-user persistence: `userId text not null` (Clerk external, no FK — `recentlyViewed` pattern), `primaryModel text`, `fallbackModels` (ordered array), `updatedAt timestamp`, one row per user, upsert via `onConflictDoUpdate` (the `recordView` pattern).
- **Query module `src/lib/db/queries/userModelSettings.ts`** — `getModelSettingsForUser(userId)` + `upsertModelSettings(...)`; house convention: query modules never catch, no `db.transaction()` (neon-http has none).
- **Runtime model registry `src/lib/models/registry.ts`** — maps stored IDs → callable AI SDK models via the snapshot's `api.npm` (provider factory selection) and `api.url` (empty = vendor default = servable; custom URL = opencode/OpenRouter/gateway proxy = NOT servable from Vercel). Only includes providers with an env key set (the `not_configured` degrade pattern). Exposes `resolveModels(ids)` — pure, unit-testable.
- **Error-driven failover loop (`runWithFallback`, ~20 lines)** — verified `ai@7.0.45` has no built-in fallback helper. Loops `generateText` per model; continues on `APICallError`/`NoSuchModelError` (and `NoObjectGeneratedError` — structured-output failure is model-dependent); rethrows prompt/validation errors (`InvalidPromptError`, `TypeValidationError`).
- **Existing `ai@7.0.45` + `@ai-sdk/anthropic@4.0.26`** — zero new runtime deps. The registry's `api.npm` mapping is the growth path: adding `OPENAI_API_KEY` + `@ai-sdk/openai` makes OpenAI models servable with no code change beyond the install.

**Critical version facts (verified against installed node_modules):** `ai@7.0.45` + `@ai-sdk/anthropic@4.0.26` work together in production (Phase 9). `APICallError` has `statusCode` + `isRetryable` (defaults to 408/409/429/≥500 — **a 404 is NOT retryable by default and must be added explicitly**). `RetryError` wraps the last error after the SDK's built-in `maxRetries: 2` backoff. **`TooManyRequestsError` does NOT exist in this version — never import it; classify 429 via `statusCode === 429`.** `anthropic('id')` returns a `LanguageModel` (`AnthropicProvider extends ProviderV4`) but does no client-side model validation. Models.dev (`https://models.dev/api.json`) is content-identical to opencode's cache but **unfiltered** (5,939 models vs opencode's 1,130 servable) — don't use it as the settings source.

### Expected Features (from FEATURES.md — HIGH in-repo/opencode, MEDIUM OMO)

**Must have (table stakes, all P1):** Settings nav item + `/settings` route behind `requireStaffAccess()`; per-user persistence keyed by Clerk `userId`; settings page (primary `<Select>` + ordered reorderable fallback list); model list from the opencode snapshot restricted to **runnable** models (Anthropic-only in v1.3 — the app has one provider package/key); agent consumes the config with error-driven failover; `agent_run.modelUsed` + `modelsAttempted` (feeds the D-14 durable audit + existing Langfuse); fail-loud when the chain is exhausted (existing `analysis_failed` + ERROR_COPY); graceful empty-registry degradation (agent keeps the `FAST_MODEL_ID` default — never breaks the shipped agent).

**Should have (differentiators, P2):** "ran on X (fallback)" line in the Analyze status strip on success-after-fallback (needs the route body to carry `modelUsed`); rich registry metadata in the picker (family · cost · context · deprecated) — data already in the snapshot; "Last synced" timestamp + dev-only refresh action; agent-agnostic registry so future agents (AI-drafted outreach) read the same config.

**Defer (v2+, P3):** cross-provider expansion (zen/openai/google via `@ai-sdk/openai-compatible` — needs the OPENCODE_API_KEY strategy decided); per-agent model assignment; cross-family fallback with prompt-family detection (OMO's explicit "prompt degradation" warning); per-model settings (variant/reasoningEffort/thinking — schema-ready, render later); `small_model` second selector; BYOK (needs a dedicated security milestone).

**Anti-features (do NOT build):** proxying opencode's `/config/providers` (verified: returns the raw API key — exfiltration hazard); listing the full 1,130-model catalog as selectable (~95% can't run → dead selects → 502s); per-user BYOK in v1.3; unguarded cross-family fallback (Anthropic-tuned prompt degrades on GPT); interactive retry prompts (breaks the one-run model, impossible in the 60s budget); auto-refresh of the registry per request (localhost unreachable from Vercel).

### Architecture Approach (from ARCHITECTURE.md — HIGH)

The feature integrates with the existing app rather than creating new foundations. **Major components:**
1. **`user_model_settings` table + `userModelSettings` query module** — per-user primary + ordered fallback; mirrors `recentlyViewed.ts` (Clerk-id keyed, no FK, atomic `onConflictDoUpdate` upsert — full-value write, never read-modify-write).
2. **Settings page + form + Server Action** — server page in `(dashboard)/settings/` (mirrors `reviews/page.tsx`), client `model-settings-form.tsx`, `actions/settings.ts` ('use server', zod-validate at the boundary, `revalidatePath`).
3. **Vendored generated catalog** — `scripts/refresh-model-catalog.ts` → committed `src/lib/models/catalog.json` + typed `catalog.ts` (provider-filtered); a Server Component imports it — no runtime fetch.
4. **Model-config resolver + failover predicate** — pure `resolveModelChain(primary, fallbacks, defaults)` + `isFailoverEligibleError(err)` in a testable module (repo's "Vitest pure functions only, zero live calls" D-16 rule).
5. **Analyze route wiring** — route captures `{ userId }` from `requireStaffAccess()` (1-line change), threads it into `analyzeCompany(companyId, userId)` → `getUserModelSettings(userId)` → resolve chain → `runAgent({ models })`; missing row → defaults (never a gate failure).
6. **`runAgent` failover loop** — `models?: LanguageModel[]` replaces the single-model seam (backward compatible: omitted → `[anthropic(FAST_MODEL_ID)]`, existing test still passes); per-attempt `generateText` with `timeout: { totalMs }`; first success returns; exhaustion rethrows last error (fail loud).
7. **Nav contract + sidebar** — `NavKey` union gains `'settings'`; Manage-group item next to Reviews; 11-case + 7-case Vitest suites grow cases.

**Key patterns:** Pattern 1 = per-user row with Clerk-id PK + atomic upsert (exact `recentlyViewed` precedent, verified against installed `drizzle-orm@0.45.2`); Pattern 2 = failover loop gated by a pure retry predicate (each `generateText` already emits its own Langfuse span — the loop needs no extra telemetry plumbing); Pattern 3 = vendored generated catalog (the only opencode-derived source that survives Vercel serverless). A missing settings row must NEVER surface as `gate_failed`/`not_configured` — no settings simply means the default chain. ⚠️ **MEDIUM flag:** `drizzle/meta/_journal.json` has **zero migration entries** — the live schema appears pushed/applied without committed migrations; the phase must confirm the repo's actual apply flow (`drizzle-kit push` vs generate+commit) before adding the table.

### Critical Pitfalls (from PITFALLS.md — HIGH, verified)

The "one decision that prevents half of these pitfalls": **the opencode model list is a menu, not a guarantee, and not a runtime dependency — a curated, provider-filtered allowlist is the source of truth for "what the app can run".**

1. **Model-ID drift (Pitfall 1 — CRITICAL):** the opencode slug `anthropic/claude-sonnet-4-6` is not the AI SDK string `claude-sonnet-4-6`; dated snapshot IDs (`claude-sonnet-4-5-20250929`) 404 weeks later — the v1.1 incident repeating through user config. *Avoid:* store the **raw provider model ID** (no `/`) in the DB, strip the provider prefix only after an `anthropic/` filter (never `opencode/*`), in one tested pure function; allowlist is truth; 404 classification is the backstop. **Prevented in Phase A + C.**
2. **Non-failover errors wrongly retried (Pitfall 2):** a bare `catch → next model` burns the whole chain (and N× 12-step agent runs + Firecrawl) on a 400/422/401 or `LoadAPIKeyError` that fails identically on every model. *Avoid:* `classifyModelError(err) → 'model_not_found' | 'input' | 'auth' | 'transient' | 'config' | 'output'` as a pure function; only `model_not_found` advances. **Phase B.**
3. **Auth/rate-limit vs model-not-found misclassification (Pitfall 3):** 429s are account-level (fallback on the same key hits the same limit — never chain-switch); a 404 hidden behind a `RetryError` never triggers fallback. *Avoid:* unwrap `RetryError` FIRST, then classify the underlying error; written rate-limit policy (429 → no chain-switch → fail loud with retry suggestion). **Phase B.**
4. **SDK retries compounding app retries → 60s blowout (Pitfall 4/6):** one broken primary = 3 SDK attempts + backoff + fallback attempt; ~66s → Vercel kills the request mid-fallback (504). *Avoid:* budget explicitly — `maxAttempts` (recommend **primary + 1 fallback** in v1.3), per-attempt `timeout: { totalMs }` (verified supported in ai@7), document `attempts × per-attempt + SDK backoff ≤ 60s`. **Phase B, verified Phase D.**
5. **Failover silently runs a different model (Pitfall 5):** nothing records that the primary was dead — and `agent_run` has no model column today (D-14 violation if only Langfuse knows). *Avoid:* `runAgent` returns `modelUsed` + `attempts[]`; persist `model_used` text + `model_chain` jsonb on `agent_run`; Langfuse spans are the visual, DB columns are the durable truth. **Phase A (columns) + Phase B (populate).**
6. **Settings stored but never consumed (Pitfall 10):** the seam `RunAgentInput.model` never gets threaded to the saved config; settings become decorative. *Avoid:* make the seam chain-shaped and provider-agnostic (`LanguageModel[]`, not `ReturnType<typeof anthropic>`); the milestone's core acceptance test is: change settings → Analyze → `agent_run.model_used` matches. **Phase B + D.**
7. **The opencode source breaks on Vercel (Pitfall 8):** shelling out at request time throws in serverless — dev works, production 500s. *Avoid:* never spawn in `src/`; committed snapshot + allowlist + (optionally) cached models.dev fetch; never-throws degradation helper. **Phase A + C.**
8. **AI-SDK syntax drift (Pitfall 11):** training data says v5-era patterns (`agent:`, model strings to `generateText`, `NoSuchModelError` catching bad IDs) — ai@7 differs. *Avoid:* verify against installed `node_modules/ai/dist/index.d.ts` **before** writing the loop (the proven v1.1 mitigation); prefer the documented primitive contract. **Phase 0/planning note.**

## Implications for Roadmap

The four research files converge on a dependency-driven **Phase A → B → C → D** structure (PITFALLS' mapping table + ARCHITECTURE's build order agree; the pre-existing SUMMARY draft's "nav first" ordering is superseded — see Conflicts). Foundations first, riskiest consumer last, verification as a gate.

### Phase A: Model Registry Foundation + Persistence
**Rationale:** every other pitfall's fix composes on the mapping function, the allowlist, the audit columns, and the atomic upsert; the pure functions are testable before any UI or loop exists (D-16 convention).
**Delivers:** `user_model_settings` table + `userModelSettings` query module (atomic full-value upsert, `updatedAt`); `agent_run.model_used` + `model_chain` audit columns; `scripts/refresh-model-catalog.ts` → committed `src/lib/models/catalog.json` + typed `catalog.ts`; pure `opencodeSlugToModelId` (provider-filtered) + allowlist-filter functions + never-throws degradation helper; resolve the migration apply flow (MEDIUM flag).
**Addresses (FEATURES.md):** registry table-equivalent (snapshot), per-user settings persistence foundation, modelUsed audit columns, empty-registry degradation.
**Avoids (PITFALLS.md):** 1 (ID drift — storage format + mapping locked here), 5 (audit columns), 7 (filter fn), 8 (degradation helper), 9 (atomic upsert).

### Phase B: Failover Orchestration (the core value)
**Rationale:** the riskiest consumer (touches the tested orchestrator) lands after the pure predicate is locked by tests, so the wiring change is a thin, provable slice.
**Delivers:** `classifyModelError` pure function (RetryError-unwrap-first; only `model_not_found` advances; 429 → no chain-switch); `runAgent` chain loop (`LanguageModel[]` seam, per-attempt `timeout`, attempt cap → **primary + 1 fallback**); snapshot-chain-at-request-start (mid-run edits inert); route threads `userId` → `analyzeCompany(companyId, userId)` → resolve → pass chain; `runAgent`/`analyzeCompany` test updates; populate `model_used`/`model_chain`.
**Addresses (FEATURES.md):** the entire P1 failover set — chain support, retryable-error classifier, 60s budget management, modelUsed/modelsAttempted.
**Avoids (PITFALLS.md):** 2, 3, 4, 6, 9 (snapshot-at-entry), 10 (wiring — the core deliverable here, not a Phase-C afterthought).

### Phase C: Settings UI + List Source
**Rationale:** depends on Phase A (catalog + queries); can proceed in parallel with Phase B — the UI and the loop are decoupled by the DB.
**Delivers:** `settings` NavKey + `getActiveNavKey`/tooltip branches + Vitest cases; Manage-group sidebar item; `(dashboard)/settings/page.tsx` + `model-settings-form.tsx` (primary Select + ordered reorderable fallback list, runnable-only, no duplicates, ≥0 fallbacks, zod-validated against the catalog) + `actions/settings.ts` (requireStaffAccess, upsert, revalidatePath); empty-registry empty state; (P2) "ran on X (fallback)" status line + metadata-rich picker + last-synced.
**Addresses (FEATURES.md):** all table-stakes P1 UI + P2 differentiators.
**Avoids (PITFALLS.md):** 1 (UI only offers allowlisted `anthropic/` rows), 7 (server-side double filter — never the 1130-row payload), 8 (no opencode dependency at request time — Vercel preview must render).

### Phase D: Verification Gate
**Rationale:** the milestone's correctness claims are falsifiable checklists — a dedicated gate, not an afterthought.
**Delivers:** Vitest matrices (400/401/403/422 → no fallback; 404 → fallback; wrapped-404; exhausted-retry 429; non-eligible errors rethrown); 60s budget checklist; live-browser UAT: settings → Analyze → `agent_run.model_used` matches (the core acceptance test); mid-run-edit inertness; two-tab concurrent saves; Vercel preview with no opencode; grep `exec|spawn|child_process` in `src/` = zero; existing `runAgent` default-model test updated deliberately, not deleted; Langfuse trace shows per-attempt spans with `ai.model.id`.
**Addresses:** the full "Looks Done But Isn't" checklist (PITFALLS).
**Avoids:** every pitfall's verification row.

### Phase Ordering Rationale
- **A before B and C:** schema→queries→catalog→pure logic are independently shippable foundations; both the failover runtime and the Settings UI consume them.
- **B before D, C parallel to B:** the failover loop is the highest-risk logic and needs the pure classifier locked by tests before wiring into the tested orchestrator; the UI is decoupled via the DB.
- **This ordering supersedes the earlier "nav/route first" draft** — nav is cheap and can ride with Phase C; starting with foundations prevents the pitfalls that the nav-first draft left unaddressed.

### Research Flags
- **Phase 0 / planning pre-flight (all phases):** resolve the open decisions below; add the Pitfall 11 note to the phase plan — "verify `generateText` model option type, exported error classes, and `anthropic('id')` behavior against installed `ai@7.0.45`/`@ai-sdk/anthropic@4.0.26` dist types BEFORE writing the loop" (the proven v1.1 mitigation).
- **Phase A:** confirm the migration apply flow (`drizzle-kit push` vs generate+commit) — the one MEDIUM-confidence item (empty `_journal.json`). Small, targeted check; not deep research.
- **Phase C:** standard patterns (shadcn Select/Button/Badge already vendored, Server Actions, nav contract) — **skip research-phase**.
- **Phase B:** failover taxonomy is fully specified by PITFALLS (verified against SDK source) — **skip research-phase**; no new ai@7 research needed.
- **No phase needs `/gsd-plan-phase --research-phase`** unless the planner rejects the recommended resolutions of the conflicts below.

## Conflicts / Open Decisions (planner MUST resolve)

1. **DB storage format — raw provider ID vs `provider/model` slug. [CONFLICT — HIGH impact]**
   - ARCHITECTURE + PITFALLS (agree): store the **raw provider ID** (`claude-sonnet-4-6`) — PITFALLS' invariant is "saved values never contain `/`", and the mapping function strips the prefix at save. ARCHITECTURE's schema comment: "Model IDs as the APP instantiates them — never provider-prefixed catalog ids."
   - STACK: store the **vendor-normalized `provider/model` form** (`anthropic/claude-sonnet-4-6`, the `opencode models <provider>` output), resolved at runtime by the registry's `api.npm` mapping.
   - **Recommendation:** raw provider ID for v1.3 (Anthropic-only — removes the verbatim-feed 404 bug class and the `opencode/*` collision; matches the two most detailed files). Keep the registry's `api.npm` mapping as the seam so multi-provider support later only adds a provider column/mapping, not a storage migration. Planner must state this in PROJECT.md to end the ambiguity.
2. **Catalog storage — committed JSON snapshot vs DB registry table. [CONFLICT — HIGH impact]**
   - STACK + ARCHITECTURE (agree): committed JSON snapshot (`src/data/opencode-models.json` or `src/lib/models/catalog.json`), zero DB writes for static data.
   - FEATURES: a `modelRegistry` DB table (upserted by the sync script). The earlier SUMMARY draft followed FEATURES — superseded.
   - **Recommendation:** committed snapshot (Vercel-safe, no migration for static data, "only preferences are per-user DB state" scope guard). If "live" freshness is ever required, revisit with a cached models.dev fetch — never a DB table for static catalog data.
3. **Failover taxonomy — only-404-advances vs any-`isRetryable`. [CONFLICT — HIGH impact]**
   - PITFALLS (deepest, SDK-source-verified): classify first, **only `model_not_found` (404/`NoSuchModelError`) advances**; 429 → no chain-switch (account-level); auth → fail loud; `LoadAPIKeyError` → `not_configured`, never fallback; `RetryError` unwrapped first.
   - ARCHITECTURE's `isFailoverEligibleError`: retries any `isRetryable` (incl. 429/5xx) + 404 — missing RetryError unwrap and the 429 policy. STACK lists `LoadAPIKeyError` as failover-eligible (wrong per PITFALLS — the whole chain shares one key).
   - **Recommendation:** adopt PITFALLS' classification model wholesale (`classifyModelError` with RetryError-unwrap-first, only `model_not_found` advances). ARCHITECTURE's version is a reasonable v1 simplification but insufficient; the planner should not mix the two.
4. **Chain length — primary + 1 vs primary + 2. [CONFLICT — LOW impact]**
   - PITFALLS: **primary + 1 fallback** (budget math: 35s primary + 20s fallback + SDK backoff ≤ 60s). FEATURES: "primary + 2 fast fallbacks".
   - **Recommendation:** primary + 1 for v1.3 (PITFALLS has the budget model and the 60s ceiling constraint); revisit with real-world 429/5xx observation (FEATURES' P2 tuning item). Max 3 in the UI to keep the option open.
5. **`fallbackModels` column type — `text[]` vs jsonb. [MINOR]**
   - ARCHITECTURE: `text('fallback_models').array()` — "the honest Postgres shape" for a homogeneous string list, typed `string[]` in Drizzle. STACK/FEATURES: jsonb (repo precedent: `company.techStack`, `usageTokens`).
   - **Recommendation:** `text[]` (simpler, no `$type<>` casting, direct typing); jsonb is acceptable if repo-jsonb consistency is preferred. Either works with the upsert pattern — decide in Phase A, don't leave it open.
6. **Output/schema-failure fallback — `NoObjectGeneratedError`/`InvalidResponseDataError`. [MINOR]**
   - STACK: `NoObjectGeneratedError` should trigger failover (model-dependent). PITFALLS: default to **no fallback** (fail loud, gate never skipped); one fallback "defensible" if decided explicitly.
   - **Recommendation:** no fallback on output/schema errors in v1.3 — the gate (`validateRunArtifacts`) must never be skipped; revisit if a weaker-model-produces-unparseable-JSON pattern shows up in traces.
7. **Naming variance (non-blocking):** `src/lib/models/registry.ts` (STACK) vs `src/lib/agents/modelConfig.ts` (ARCHITECTURE); `modelUsed`/`modelsAttempted` (FEATURES) vs `model_used`/`model_chain` (PITFALLS); snapshot path `src/data/` vs `src/lib/models/`. Planner picks one consistent set; the functional shape is agreed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | opencode CLI 1.18.10 + models.dev live-verified; installed `ai@7.0.45`/`@ai-sdk/anthropic@4.0.26`/`drizzle-orm@0.45.2` read from node_modules; `@opencode-ai/sdk` existence MEDIUM (not installed, rejected anyway) |
| Features | HIGH (in-repo + opencode) · MEDIUM (OMO) | OMO `fallback_models` semantics from docs/community, not a local run — but v1.3 builds its own loop, so OMO is a reference, not a dependency |
| Architecture | HIGH · one MEDIUM | migration apply flow unconfirmed (empty `_journal.json`) — verify in Phase A; all integration points read directly from on-disk source |
| Pitfalls | HIGH | error-class semantics verified against installed SDK dist source; opencode claims executed live; app claims from direct code reads + v1.1/v1.2 decision records |

**Overall confidence: HIGH** (with the two MEDIUM sub-flags above and the open decisions in the previous section).

### Gaps to Address
- **Migration apply flow (MEDIUM):** confirm `drizzle-kit push` vs generate+commit in Phase A before touching `schema.ts`.
- **Allowlist curation:** only `claude-sonnet-4-6` is currently roster-verified (2026-08-01, `GET /v1/models`); Phase A must re-verify any curated additions — the standing v1.1 practice, now part of allowlist maintenance.
- **Open decisions 1–6:** must be resolved at planning (recommendations provided above) — they change schema, storage, and loop behavior.
- **OMO semantics (docs-sourced):** if cross-family fallback or per-model settings are ever pursued (v2+), run OMO locally to confirm behavior rather than trusting docs.

## Sources

### Primary (HIGH confidence)
- **opencode CLI 1.18.10 (live execution, 2026-08-02):** `opencode models`, `--verbose`/`--pure`/`--refresh`, `opencode models <provider>`, `opencode serve` + `GET /api/model` + `GET /config/providers` (raw-key leak confirmed); `~/.cache/opencode/models.json` vs `https://models.dev/api.json` byte-identical (177 providers, 5,939 models)
- **Installed node_modules:** `ai@7.0.45` exports (`APICallError`/`RetryError`/`LoadAPIKeyError`/`InvalidResponseDataError`/`NoSuchModelError`/`LanguageModel`; NO `TooManyRequestsError`, no fallback helper), `@ai-sdk/provider@4.0.4` (`isRetryable` defaults 408/409/429/≥500, 404 not retryable), `@ai-sdk/anthropic@4.0.26` (factory + callable provider, no client-side validation), `drizzle-orm@0.45.2` (`onConflictDoUpdate`, jsonb/text[] typing)
- **Context7 `/vercel/ai`:** `createAnthropic`/`createOpenAI` factory docs, error semantics, retry-with-exponential-backoff source (`maxRetries` 2, backoff 2s×2, retry-after honored), `timeout: { totalMs }`, `telemetry.metadata`, `ai.model.id`/`gen_ai.request.model` span attributes
- **Codebase reads:** `schema.ts` (+ `recentlyViewed`/`usageTokens`/`agent_run` patterns), `queries/recentlyViewed.ts`, `runAgent.ts` (+ v1.1 dated-ID 404 comment, `FAST_MODEL_ID`), `analyzeCompany.ts` (`isMisconfigurationError` precedent, fail-closed gate), `api/companies/[id]/analyze/route.ts` (`maxDuration = 60`, `requireStaffAccess`, structured error contract), `nav.ts` + `nav.test.ts`, `app-sidebar.tsx`/`app-shell-layout.tsx`, `(dashboard)/layout.tsx` + `reviews/page.tsx`, `actions/reviews.ts`, `env.ts` (D-15 optional keys), `langfuse.ts` (D-14), v1.1/v1.2 PROJECT.md decision records (D-06, D-07, D-08, D-14, D-15, D-16)

### Secondary (MEDIUM confidence)
- **OhMyOpenCode / oh-my-opencode docs (github.com/code-yeongyu/oh-my-opencode):** `fallback_models` semantics, resolution priority, per-model settings, cross-family degradation warnings — docs/community, not run locally
- **npm registry:** `@opencode-ai/sdk@1.18.11` exists (rejected: requires a running `opencode serve` host), `@opencode-ai/plugin@1.18.11`
- **Migration apply flow:** `drizzle/meta/_journal.json` has zero entries — push-vs-generate unconfirmed (verify in Phase A)

---
*Research completed: 2026-08-02*
*Ready for roadmap: yes — pending resolution of Conflicts / Open Decisions 1–6 at planning*
