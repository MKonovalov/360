# Feature Research

**Domain:** Per-user AI model settings (primary model + ordered fallback chain) for an internal staff tool — ArcLumen 360 v1.3
**Researched:** 2026-08-02
**Confidence:** HIGH (in-repo integration points + opencode mechanics, empirically verified); MEDIUM (OhMyOpenCode behavior — docs/community sources)

## Failover UX Contract (the milestone's core question)

The milestone asks: *when the primary model fails, does the user see it, does the run silently retry, is there an indicator of which model actually ran?*

**Answer — model on OhMyOpenCode/opencode:**

| Question | OhMyOpenCode/opencode behavior | v1.3 recommendation |
|---|---|---|
| Does the user see the failure? | No. Model resolution is config-driven and automatic (`doctor --verbose` is the only introspection surface). No interactive retry prompt. | No. **Silent retry within the run.** The existing Analyze UX already shows one "Analyzing…" strip; staff never sees per-model attempts. |
| Does the run silently retry? | Yes — `fallback_models` ("Fallback models on API errors") is tried in order; opencode core itself has *no* fallback, this is OMO's addition. | Yes — retry down the ordered chain inside the same request/run, bounded by the 60s Vercel `maxDuration` ceiling (D-07). Only retry on *retryable* errors (429 / 5xx / timeout / overloaded), never on 400/401/404 (auth, bad request, model-not-found) or validation failures. |
| Is there an indicator of which model ran? | In OMO: only via `doctor`/logs. In this app's observability: Langfuse traces already carry the model name per `generateText` (OTel `gen_ai.request.model`) via `@langfuse/vercel-ai-sdk`. | **Table stakes:** durable record — `agent_run.modelUsed` (+ `modelsAttempted`) column and the existing Langfuse trace. **Differentiator:** a subtle "ran on Claude Sonnet 4.6 (fallback)" line in the Analyze run-status strip on success-after-fallback. |

**Contract in one sentence:** *one run, silent retry down the chain, fail loud only when the whole chain is exhausted, and the actual model is recorded everywhere it matters (run row + trace) and shown subtly where it helps (status strip on fallback).*

---

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Settings nav item + route | Every Manage-group tool has a Settings entry; the v1.2 sidebar chrome is the established pattern | LOW | Add `settings` to `NavKey` union + `getActiveNavKey` (Vitest suite grows a case), `getNavTooltipLabel`, new `SidebarMenuButton` under the **Manage** group (next to Reviews); new `/settings` page inside the `(dashboard)` route group behind `requireStaffAccess()`. |
| Per-user persistence keyed by Clerk userId | "My model choice" must survive reloads and differ per staff member | LOW | New Drizzle table following the in-repo precedent (`recentlyViewed`/`importBatch`: `userId: text('user_id')` — "Clerk userId, opaque string — no FK (Clerk is external)"). One row per user: `primaryModelId` + `fallbackModels` (jsonb ordered array — matches `usageTokens`/`evidenceAppendix` jsonb pattern). |
| Settings page: primary model selector + ordered fallback list | The explicit milestone deliverable, OMO-style | MEDIUM | Two controls: primary `<Select>` + an ordered reorderable list (up/down, remove, add) for fallbacks. Load = server read (Server Action or RSC), save = one Server Action with `requireStaffAccess()`. Enforce ≥1 fallback optional, primary required, no duplicates. |
| Model list sourced from opencode (the `/models` source) | The milestone's stated registry source | MEDIUM | **Two sources verified live:** (a) CLI `opencode models` (~1,130 `provider/model` lines; `--verbose` appends JSON metadata blocks: id, name, family, cost, `status: active/deprecated`, context/output limits, `api.{npm,url}`); (b) headless server `GET /api/model` (clean JSON `{location, data[]}`, but only the *enabled/runnable* set — here just 24 `opencode/*` free zen models). **Recommendation:** snapshot into a DB registry table (see Dependencies); the CLI snapshot script is the primary path. |
| Agent consumes the config with error-driven failover | The entire point of the milestone — first consumer is the Analytic Agent | MEDIUM–HIGH | `runAgent` currently takes ONE model (`anthropic(FAST_MODEL_ID)` default, `FAST_MODEL_ID = 'claude-sonnet-4-6'` verified 2026-08-01). Change to accept a chain; loop attempts with retryable-error classification; return `modelUsed`/`modelsAttempted`. The fail-closed gate (`validateRunArtifacts`) runs only after the final successful attempt. |
| Record which model actually ran | Trust + debugging; feeds the existing Langfuse observability (OBSV-01) | LOW | Add `modelUsed` + `modelsAttempted` to `agent_run` (jsonb like `usageTokens`); Langfuse already captures model per attempt via the SDK. |
| Graceful degradation when the registry is empty/stale | Mirrors the repo's `not_configured` pattern (D-15, optional env keys) | LOW | Registry empty → Settings shows a "model list not synced" empty state; agent keeps the hardcoded `FAST_MODEL_ID` default. Never crash the app because a dev machine didn't sync. |
| Only selectable models the app can actually run | A picker full of models that 502 at runtime is a broken feature | MEDIUM | The app runtime has **only `@ai-sdk/anthropic` + `ANTHROPIC_API_KEY`** installed. The opencode catalog spans 75+ providers. Either (a) restrict the runnable set to Anthropic-family IDs (`anthropic/*` — zero new deps), or (b) add `@ai-sdk/openai-compatible` pointed at `https://opencode.ai/zen/v1` with the machine's `OPENCODE_API_KEY` to unlock zen models. Registry must mark `runnable` vs `listed`; UI filters (or badges). **(a) is the v1.3 path; (b) is a later milestone.** |
| Validate model ids against the registry before use | Untrusted user input must never reach `generateText({model})` | LOW | Zod-validate stored ids; the registry table is the allowlist. Matches the repo's route-side zod + fail-safe conventions. |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Ordered user fallback chain** | opencode core has NO fallback — OMO's `fallback_models` is the fork's differentiator; shipping it as a first-class per-user UI beats both | MEDIUM | The exact OMO semantics: resolution = user choice → fallback list → built-in default (`FAST_MODEL_ID`). |
| **"Which model ran" transparency** | Staff trusts analysis more when they can see (and audit in Langfuse) that a fallback produced the result; feeds the existing human-reviewed queue with confidence | LOW–MEDIUM | Subtle mono line in `AnalyzeRunStatus` on success-after-fallback: "ran on Claude Sonnet 4.6 (fallback)" — styled with existing token palette (no new UI language). |
| **Rich registry metadata in the picker** | The opencode snapshot carries name, family, cost ($/MTok), context window, active/deprecated status — a dropdown with `(family · $3/$15 · 1M ctx · active)` beats any plain list | LOW–MEDIUM | Data is already in the snapshot; render cost/context from the registry table; gray out `deprecated`. |
| **General agent model registry** | The Analytic Agent is consumer #1; the registry is agent-agnostic so future agents (per PROJECT.md future candidates: AI-drafted outreach) read the same config | MEDIUM | Keep the registry + settings tables model-agnostic (no agent_id column in v1.3 — the "per-agent assignment" selector is explicitly future work). |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Proxying opencode's `/config/providers` (or any endpoint returning credentials) | "Live" model/provider data with zero snapshot lag | **Empirically verified: the response contains the raw API key (`"key":"sk-…"`).** One proxy mistake exfiltrates the machine's opencode credential to every browser | Only `GET /api/model` (verified secret-free) or CLI snapshot; never `/config`, never `/config/providers`; server-side fetch only, never client-side |
| Listing the full 1,130-model catalog as selectable | "Why can't I pick GPT-5.4?" | ~95% of it cannot run — the app has one provider package/key. Dead selects → confusing 502s → trust erosion | Filter to `runnable`; show the rest only as a "not available in this app" state; add provider support in a later milestone |
| Per-user bring-your-own-key (BYOK) | Power users want their own API keys | Multi-tenant credential storage = a full security program (encryption, rotation, abuse); far beyond a settings UI; contradicts "any staff user = staff" | Shared app-level keys only; registry-allowlisted models; BYOK as an explicit future candidate with security review |
| Cross-family auto-fallback without guardrails (e.g. Claude → GPT) | "More fallbacks = more resilience" | OMO docs are explicit: prompts are family-tuned ("Sisyphus → GPT: no GPT prompt, will degrade significantly"). The Analyze prompt is Claude-tuned; a GPT fallback silently produces lower-quality proposals | Constrain chains to the same family (Anthropic) in v1.3; add a "cross-family allowed" flag + prompt-family detection later |
| Per-model advanced settings in v1.3 (variant, thinking budget, temperature, reasoningEffort) | OMO's per-fallback-model settings look powerful | Config explosion; each knob needs model-family validation; the milestone scope is explicitly "primary + ordered fallback" | Ship the chain only; store `variant`/`reasoningEffort` as future-ready nullable jsonb, render later |
| Writing user settings back into the local opencode/OMO config file | "Keep one source of truth" | The opencode config is a dev machine's global tool state — not multi-user, not deployable, not auditable; app DB is the source of truth | App DB (`userModelSettings` table) is the single source; opencode stays a read-only snapshot source |
| Interactive "retry with fallback?" prompt on failure | "Let the user choose" | Interrupts the one-run mental model; OMO/opencode never do this; the 60s budget makes a mid-run human round-trip impossible | Silent retry + fail-loud when exhausted (existing ERROR_COPY pattern in `AnalyzeRunStatus`) |
| Auto-refresh of the registry on every Settings visit | "Always live" | Localhost unreachable from Vercel; refresh is a dev-machine act, not a request-time act | On-demand sync script (dev machine) + `syncedAt` timestamp + "Last synced" UI; never a request-time fetch |

---

## Feature Dependencies

```
Settings nav item + /settings route
    └──requires──> NavKey union + getActiveNavKey + getNavTooltipLabel updates (nav.ts, sidebar-collapse.ts + Vitest suites)
    └──requires──> (dashboard) route group + requireStaffAccess gate (existing shell)

Settings page (primary + fallback selectors)
    └──requires──> userModelSettings table (Clerk userId keyed) + Server Actions (save/load)
    └──requires──> modelRegistry table (the allowlist the picker reads)
                       └──requires──> opencode snapshot sync (CLI `opencode models --verbose` or server GET /api/model)
                                      run on the DEV machine — opencode is localhost-only (verified)

Agent error-driven failover
    └──requires──> runAgent chain support (accept ordered models, loop attempts)
    └──requires──> retryable-error classifier (pure function — Vitest target; AI SDK error classes: AI_APICallError.statusCode, AI_NoSuchModelError, AI_RetryError)
    └──requires──> userModelSettings read at run time (route handler fetches by auth().userId)
    └──requires──> 60s maxDuration budget management (D-07) — chain length/time budget bounded
    └──requires──> agent_run.modelUsed / modelsAttempted columns

"Which model ran" status-strip indicator
    └──requires──> analyze route returns modelUsed in its JSON body
    └──enhances──> AnalyzeRunStatus component (already owns the run state machine)

Registry marks runnable vs listed
    └──requires──> runtime provider map (anthropic → @ai-sdk/anthropic; future: zen → @ai-sdk/openai-compatible) — v1.3 ships the anthropic entry only

[Settings page] ──feeds──> [agent failover]  (the config the agent consumes)
[modelRegistry] ──feeds──> [Settings picker] + [runtime provider resolution] (allowlist + id→provider map)
[Langfuse tracing] ──enhances──> [record which model ran] (OTel gen_ai.request.model already emitted per attempt)
```

### Dependency Notes

- **Settings nav → nav.ts contract chain:** `NavKey` is a closed union consumed by `getActiveNavKey` (11-case Vitest lock), `getNavTooltipLabel` (Vitest copy contract), and `AppSidebar`. Adding `'settings'` touches all three + their test suites — small, but it is a locked contract, not a one-liner (QLTY-01 precedent).
- **Settings page → registry:** the picker must read the registry, so the registry table + sync script are a prerequisite *phase* before the page is usable. Without a snapshot the page shows the empty state (graceful, table-stakes).
- **Registry → opencode sync is a dev-machine act:** opencode (`~/.opencode/bin/opencode`, v1.18.10) binds `127.0.0.1` by default and lives only on the dev machine. Vercel cannot reach it. The snapshot (script → DB) is the only production-viable path — "live at refresh, cached at read." This is the single most important architectural dependency in the milestone (see STACK.md/ARCHITECTURE.md).
- **Failover → error classification:** without a correct retryable/non-retryable split, the chain either retries permanent errors (wasted 60s budget, triple 401s) or gives up on transient ones (false failures). This is the highest-risk logic — make it a pure, tested function (repo's Vitest pure-function precedent).
- **Failover → 60s ceiling:** Vercel Hobby `maxDuration = 60` is a hard, user-confirmed constraint on the analyze route (D-07). Each attempt costs wall-clock; a 3-model chain must either be fast models or carry a time budget. This bounds chain length in v1.3 (recommend primary + 2 fallbacks, Anthropic family).
- **Registry → runtime provider map:** the opencode id (`anthropic/claude-sonnet-4-6`) must resolve to an AI SDK provider instance. v1.3 ships one mapping (anthropic). The map is the seam where zen/openai/google support lands later.
- **`agent_run.modelUsed` → status strip:** the route handler persists `modelUsed` and returns it in the JSON body; `AnalyzeRunStatus` renders the fallback note only when `modelUsed !== primary`.

---

## MVP Definition

### Launch With (v1.3)

- [x] Settings nav item (Manage group) + `/settings` route behind `requireStaffAccess()` — *the entry point*.
- [ ] `modelRegistry` table + sync script (runs `opencode models --verbose`, parses JSON blocks, upserts; stores id, provider, name, family, cost, context, status, api package, syncedAt) — *the source; gated to dev machine execution*.
- [ ] `userModelSettings` table + Server Actions (save/load) — *per-user persistence, Clerk userId keyed, jsonb fallback array*.
- [ ] Settings page: primary `<Select>` + ordered fallback list (add/remove/reorder), restricted to **runnable** models, ids zod-validated against the registry — *the deliverable UI*.
- [ ] `runAgent` chain: accepts ordered models, attempts sequentially, retries only on retryable errors, bounded by a time budget under 60s — *the failover engine*.
- [ ] `agent_run.modelUsed` + `modelsAttempted` persisted; Langfuse trace already shows per-attempt model — *"which model ran" is durable*.
- [ ] Fail-loud when the whole chain is exhausted (existing `analysis_failed` path + ERROR_COPY) — *no silent empty results*.
- [ ] Empty-registry degradation: Settings empty state + agent keeps `FAST_MODEL_ID` default — *never breaks the shipped agent*.

### Add After Validation (v1.3.x)

- [ ] "ran on X (fallback)" line in `AnalyzeRunStatus` on success-after-fallback — *transparency differentiator; needs route body to carry modelUsed*.
- [ ] "Last synced" timestamp + explicit dev-only "Refresh models" action on the Settings page.
- [ ] Render registry metadata (family · cost · context · deprecated) in the picker.
- [ ] Chain-length/time-budget tuning after real-world 429/5xx observation.

### Future Consideration (v2+)

- [ ] Zen/openai/google provider support via `@ai-sdk/openai-compatible` + `https://opencode.ai/zen/v1` (needs the OPENCODE_API_KEY strategy decided — shared key vs. service identity).
- [ ] Per-agent model assignment (registry stays agent-agnostic; a per-agent override selector).
- [ ] Cross-family fallback with prompt-family detection (OMO's "dangerous overrides" lesson).
- [ ] Per-model settings (variant/reasoningEffort/thinking) — schema-ready, render later.
- [ ] `small_model` (cheap model for background/labeling work) second selector.
- [ ] BYOK — only with a dedicated security milestone.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Settings nav item + route | HIGH | LOW | P1 |
| Registry table + sync script | HIGH | MEDIUM | P1 |
| Per-user settings table + Server Actions | HIGH | LOW | P1 |
| Settings page (primary + fallback, runnable-only) | HIGH | MEDIUM | P1 |
| runAgent chain + retryable-error classifier | HIGH | MEDIUM–HIGH | P1 |
| modelUsed/modelsAttempted + trace | MEDIUM | LOW | P1 |
| Fail-loud on chain exhaustion | HIGH | LOW | P1 |
| Empty-registry graceful degradation | MEDIUM | LOW | P1 |
| "ran on X (fallback)" status line | MEDIUM | LOW–MEDIUM | P2 |
| Registry metadata in picker | MEDIUM | LOW–MEDIUM | P2 |
| Last-synced + refresh action | LOW | LOW | P2 |
| Zen/provider expansion | MEDIUM | HIGH | P3 |
| Per-agent assignment | MEDIUM | MEDIUM | P3 |
| Per-model advanced settings | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | opencode core (v1.18.10, verified) | OhMyOpenCode / OMO (docs) | ArcLumen 360 v1.3 (our plan) |
|---------|------------------------------------|---------------------------|------------------------------|
| Model list source | `/models` dialog; `opencode models` CLI; server `GET /api/model` | Same (delegates to opencode) | Snapshot of `opencode models --verbose` → DB registry |
| Primary model selection | Config `model` key (`provider/model`), `/models` dialog | Same + per-agent/per-category `model` overrides | Per-user `<Select>` persisted per Clerk user |
| Ordered fallback chain | **None — no error-driven fallback** | `fallback_models` ("Fallback models on API errors"), string or array with per-model settings | Per-user ordered list (jsonb), OMO-resolution semantics |
| Resolution priority | `--model` flag → config → last-used → internal priority | UI-selected → user override → category default → user fallback_models → built-in provider chain → system default | user settings → fallback chain → `FAST_MODEL_ID` built-in default |
| "Which model ran" visibility | Trace/log only | `doctor --verbose` | `agent_run.modelUsed` + Langfuse OTel attribute + (P2) status-strip note |
| Retry UX | None (error surfaces) | Silent automatic | Silent automatic, fail-loud on exhaustion |
| Credential model | Machine-level provider auth (`opencode auth`) | Same | Shared app-level keys; **never** proxy `/config/providers` |

---

## Sources

- **Verified live (HIGH):** `opencode models` / `opencode models opencode --verbose` on the local installation (v1.18.10, `~/.opencode/bin/opencode`); `opencode serve` + `GET /api/model` (24-model runnable set, secret-free) and `GET /config/providers` (⚠ contains raw API key — leak hazard confirmed); `@opencode-ai/sdk` route definitions (`/api/model`, `/config`, `/config/providers`); opencode config docs (`https://opencode.ai/docs/models/` — `model` key, `provider/model` ids, variants, no fallback).
- **OhMyOpenCode behavior (MEDIUM — docs/community, not run locally):** `oh-my-opencode`/`oh-my-openagent` config reference (`fallback_models`, resolution priority, per-model settings, model catalog) — github.com/code-yeongyu/oh-my-opencode docs (configuration.md, agent-model-matching.md) and encodedocs.com model-resolution page.
- **In-repo integration points (HIGH — code read):** `src/lib/nav.ts` + `src/lib/nav.test.ts` (NavKey contract), `src/lib/sidebar-collapse.ts` + test, `src/components/layout/app-sidebar.tsx` (Manage group), `src/components/layout/app-shell-layout.tsx`, `src/lib/auth/requireStaffAccess.ts`, `src/lib/db/schema.ts` (userId/text/jsonb patterns; `agent_run`), `src/lib/agents/runAgent.ts` (single-model seam, `FAST_MODEL_ID`), `src/lib/agents/analyzeCompany.ts` (fail-closed gate, not_configured), `src/app/api/companies/[id]/analyze/route.ts` (60s maxDuration, fail-loud mapping), `src/components/agents/analyze-run-status.tsx` (ERROR_COPY), `src/lib/env.ts` (optional-key degradation).

---
*Feature research for: ArcLumen 360 v1.3 AI Model Settings*
*Researched: 2026-08-02*
