# Stack Research — v1.3 AI Model Settings

**Domain:** Per-user AI model management for ArcLumen 360 — (a) fetching the available-models list from the local opencode installation (the source behind opencode's `/models` command), and (b) persisting + serving per-user model preferences (primary + ordered fallback chain) to the Analytic Agent at runtime.
**Researched:** 2026-08-02
**Confidence:** HIGH (every claim verified against the live opencode CLI 1.18.10, the installed `ai@7.0.45`/`@ai-sdk/anthropic@4.0.26` packages, the live models.dev API, and the existing codebase conventions)

## Executive Answer

**Model list (a):** opencode's `/models` TUI command is backed by the CLI command `opencode models` — a plain-text list of `provider/model` IDs, with `--verbose` emitting one JSON record per model (id, providerID, name, cost, context/output limits, status, and — critically — `api.npm`, the AI SDK package that serves the model). Verified live: `opencode models --verbose` yields **1130 records (1128 active)** in ~2.2s, JSON on stdout. The underlying registry is models.dev (opencode caches it at `~/.cache/opencode/models.json`; byte-identical to `https://models.dev/api.json` — 177 providers, 5939 models — but opencode's CLI *filters* to the 1130 it can actually route). **Because the app runs on Vercel serverless where no opencode CLI exists, the correct integration is a committed snapshot**: a fetch script shells out to `opencode models --verbose` on the dev machine, normalizes the records, and writes a trimmed `src/data/opencode-models.json` that the settings page reads. "Live from opencode" = re-run `npm run models:fetch` whenever the list should refresh; the settings UI shows the snapshot's timestamp. No new runtime dependency.

**Persistence + serving (b):** A new Drizzle table `userModelSettings` (userId keyed, mirroring the existing `recentlyViewed` pattern — `text` userId, no Clerk FK) stores `primaryModel` + an ordered `fallbackModels` jsonb array. Stored IDs use the **vendor-normalized** `provider/model` form (the same format `opencode models <provider>` itself prints), because the runtime registry maps the provider segment to an installed `@ai-sdk/*` provider factory via the snapshot's `api.npm` field. The Analytic Agent thread: route handler (already holds `userId` from `requireStaffAccess()`) → reads settings → registry resolves `[primary, ...fallbacks]` → passes them into `analyzeCompany` → `runAgent` loops `generateText` with an **error-driven failover loop** (ai@7.0.45 has no built-in fallback helper — verified; the loop keys on `APICallError`/`NoSuchModelError`/`LoadAPIKeyError`, ~20 lines). Default with no settings row = today's exact behavior (`anthropic('claude-sonnet-4-6')`).

**No new runtime dependencies are required for v1.3.** The only new packages would be future provider SDKs (`@ai-sdk/openai`, `@ai-sdk/google`, `@ai-sdk/openai-compatible`) — deferred until a second provider API key is configured; the registry is designed to absorb them automatically via `api.npm`.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| opencode CLI `models` command | 1.18.10 (local install at `~/.opencode/bin/opencode`, on PATH) | Model-list source — the exact `/models` backend | Verified live: `opencode models [provider]` prints `provider/model` IDs (filterable by provider), `--verbose` adds JSON metadata (cost, limits, status, `api.npm`), `--pure` excludes plugin models (1113 IDs), `--refresh` re-syncs from models.dev. This is a **dev-time fetch tool, not an app dependency** — the app never shells out to it. |
| Snapshot fetch script (`scripts/fetch-models.ts`) + committed `src/data/opencode-models.json` | repo script (tsx, already a devDep) | Bridge the local CLI to the deployed app | Vercel serverless has no opencode binary. The script runs `opencode models --verbose` (records are multi-line pretty JSON starting at column 0 on stdout), accumulates records, trims to UI-needed fields, and writes the committed JSON (~100-200KB, not the 3.3MB raw registry). Read at render time by the settings Server Component. |
| Drizzle `userModelSettings` table (existing `drizzle-orm`, existing `schema.ts`) | drizzle-orm 0.45.2 (installed) | Per-user model preference persistence | Follows the proven user-keyed pattern: `userId text not null` (Clerk external, no FK — same as `recentlyViewed`), `primaryModel text`, `fallbackModels jsonb` (ordered array — same jsonb-array precedent as `company.techStack`), `updatedAt timestamp`, `unique(userId)` + upsert via `onConflictDoUpdate` (exactly the `recordView` pattern). One row per user. |
| Query module `src/lib/db/queries/userModelSettings.ts` | repo module | Read/write settings, pure query layer | House convention: query modules never catch (callers own error handling), named exports, no `db.transaction()` (neon-http has none). Exports `getModelSettingsForUser(userId)` (returns row or null) and `upsertModelSettings(userId, { primaryModel, fallbackModels })`. |
| Runtime model registry `src/lib/models/registry.ts` | repo module | Map stored `provider/model` → callable AI SDK model | Reads the snapshot's `api.npm` to select the provider factory (`@ai-sdk/anthropic` → `createAnthropic()`, etc. — verified factory API) and the model's `api.url` (empty = vendor default endpoint = directly servable; custom URL = opencode/OpenRouter/gateway proxy = NOT servable from Vercel). Lazily constructs provider instances; **only includes providers with an env key set** (mirrors the `not_configured` degrade-gracefully pattern in `env.ts`). Exposes `resolveModels(ids: string[]): LanguageModel[]` — pure, unit-testable. |
| Error-driven failover loop (`runWithFallback`, in `src/lib/models/failover.ts` or inline in `runAgent`) | repo module (~20 lines) | Retry down the fallback chain on provider/model failure | Verified ai@7.0.45 exports: **no built-in fallback/multi-model helper exists**. The AI SDK throws `APICallError` (has `statusCode` + `isRetryable`, covers 429/4xx/5xx), `NoSuchModelError` (bad/retired model id), `LoadAPIKeyError` (missing key) — all `instanceof AISDKError`. Loop: try `generateText` with model[i]; on those errors continue to model[i+1]; `NoObjectGeneratedError` (structured-output failure) is model-dependent, so it should also trigger failover; prompt/validation errors (`InvalidPromptError`, `TypeValidationError`) rethrow. |
| `ai` + `@ai-sdk/anthropic` (existing) | ai 7.0.45, @ai-sdk/anthropic 4.0.26 (installed) | Runtime generation | No new AI SDK dependency for v1.3 — the app's only configured key is `ANTHROPIC_API_KEY`, so the servable set is the 36 anthropic models. The registry's `api.npm` mapping is the growth path: adding `OPENAI_API_KEY` + `@ai-sdk/openai` makes the 36 OpenAI models servable with zero code changes beyond the package install. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui primitives (already vendored, `nova` preset) | shadcn 4.14.0 (installed) | Select/combobox + list-reorder UI on the settings page | Primary-model selector and per-slot fallback selects — use the already-vendored Select/Button/Badge. **No new UI package.** |
| `zod` (installed, 4.4.3) | 4.4.3 | Server Action input validation | `modelSettingsSchema` for the upsert action — model IDs validated as `provider/model` strings against the snapshot's known set (reject unknown IDs fail-loud, matching the reject-input pattern in `reviews.ts`). |
| `nuqs` (installed, 2.9.1) | 2.9.1 | URL state | **Not needed for a settings form** — listed to say explicitly: don't introduce it here. |
| `@langfuse/vercel-ai-sdk` (installed, 5.9.1) | 5.9.1 | Per-run tracing | The AI SDK instrumentation emits `ai.model.id` per span automatically — with failover, the trace already shows which model actually served. Optionally record `servingModel` + `modelsTried` on the `agentRun` row (small jsonb addition) so the review queue shows it without opening Langfuse. |
| Vitest (installed, 4.1.10) | 4.1.10 | Unit tests | Registry resolver + failover loop are pure functions — add `registry.test.ts` / `failover.test.ts` following the existing no-mocking-library, pure-function-only harness. Extend `nav.test.ts` (11-case suite) with the `/settings` case. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `npm run models:fetch` (new script → `tsx scripts/fetch-models.ts`) | Refresh the committed opencode model snapshot | Resolve binary: `process.env.OPENCODE_BIN` → `which opencode` → `~/.opencode/bin/opencode` fallback. Run `opencode models --verbose` capturing stdout. Fail with a clear message if opencode isn't installed (snapshot stays usable — the app only needs the committed JSON). |
| `drizzle-kit generate` (installed 0.31.10) | New `userModelSettings` migration | Existing `drizzle.config.ts` (schema `./src/lib/db/schema.ts`, out `./drizzle`) — add the table, run `npx drizzle-kit generate`, apply. |
| Live re-verify (Playwright MCP) | UAT of settings page + failover | The milestone's established live-browser pattern; also exercise the analyze route with a deliberately bad primary to observe the fallback in the Langfuse trace. |

## Installation

```bash
# Core — NO new runtime dependencies for v1.3.
# (The registry is provider-factory-driven; nothing to install for anthropic-only.)

# Dev tooling — none required either: the fetch script runs on the existing tsx devDep.

# Model-list fetch (writes src/data/opencode-models.json)
npm run models:fetch

# DB migration for userModelSettings
npx drizzle-kit generate
```

**Future provider additions (only when a key is configured):**

```bash
npm install @ai-sdk/openai          # OPENAI_API_KEY
npm install @ai-sdk/google          # GOOGLE_GENERATIVE_AI_API_KEY
npm install @ai-sdk/openai-compatible  # deepseek/glm/zhipuai and other custom-URL providers with a baseURL
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| opencode CLI snapshot (committed JSON) | `https://models.dev/api.json` fetched at build time | If the milestone's "local opencode installation" phrasing is relaxed to "the registry opencode uses". models.dev is public, keyless, content-identical to opencode's cache (verified byte-identical `zhipuai.glm-5` record, same 5939 models / 177 providers) — but it is **unfiltered**: opencode's CLI reduces 5939 → 1130 models it can actually route, and that filtering is the whole point of sourcing "from opencode". Stick with the CLI snapshot. |
| opencode CLI snapshot | `@opencode-ai/sdk` (1.18.11 on npm) programmatic API | Never for this app. The SDK talks to a **running** opencode server (`opencode serve`); you'd need to host opencode somewhere reachable from Vercel — heavyweight, out of scope, and adds a moving dependency. Use only if the model list ever needs to be *queried live* rather than snapshotted. |
| Committed snapshot | Per-request `opencode models` shell-out | Never — ~2.2s cold start per call and no binary on Vercel. |
| Committed snapshot | Read `~/.cache/opencode/models.json` directly | Never — internal cache format (brittle across versions), and the file is the *unfiltered* registry, not opencode's 1130-model view. |
| Store `provider/model` vendor-normalized IDs | Store the literal `opencode/<id>` router form the unfiltered `/models` TUI displays | The unfiltered TUI shows every model as `opencode/<id>` (the router prefix). Storing that adds an indirection at runtime (registry must map router→vendor). The filtered form `opencode models <provider>` prints `anthropic/claude-sonnet-4-6` — the vendor form maps 1:1 onto AI SDK provider factories. Normalize in the fetch script (snapshot records already carry `providerID`/`api.npm`). |
| Custom failover loop | A `fallback`/`retry` npm package | ai@7.0.45 ships no fallback helper (verified exports); a generic retry package can't distinguish model-scoped errors from prompt bugs. ~20 lines of typed code beats a dependency. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@opencode-ai/sdk` in the app | Requires a running `opencode serve` host; useless on Vercel serverless | `opencode models --verbose` CLI snapshot |
| `@openrouter/ai-sdk-provider`, `@ai-sdk/gateway` | 641 of the 1130 opencode models route through OpenRouter/gateway/open-code-proxy custom URLs (`api.url` set, 757 custom-URL total) — the app has none of those credentials. Listing them is fine; wiring them is out of scope | Registry gates on `api.url` empty + env key; those models render disabled in the UI |
| models.dev raw registry as the settings source | 5939 models, no opencode provider filtering — pollutes the picker with models opencode itself can't serve | `opencode models` output (1130) |
| Per-request model-list fetch | 2.2s CLI cold start / 3.3MB network pull per request on a settings page | Committed snapshot, refreshed by `npm run models:fetch` |
| A generic retry/fallback npm package | Wrong failure taxonomy; ai@7 errors are model-scoped | The ~20-line `APICallError`/`NoSuchModelError` loop |
| Reading `~/.cache/opencode/models.json` | Internal format; unfiltered; missing on CI | The CLI command |
| A `settings` route outside `(dashboard)` | Breaks the shared sidebar shell + nav layout used by Start/Reviews | `src/app/(dashboard)/settings/page.tsx` (matches the route group's existing structure) |

## Stack Patterns by Variant

**If the milestone means literally "sourced from the local opencode installation" (recommended reading):**
- Use the CLI snapshot (`opencode models --verbose` → committed `src/data/opencode-models.json`).
- Because the snapshot is a local-machine artifact, commit it and treat refresh as a deliberate `npm run models:fetch` action; show `generatedAt` in the UI so staleness is visible.

**If "live" must mean zero manual refresh in production:**
- Add a CI step (GitHub Action on `opencode` upgrade detection, or a scheduled job) that re-runs `models:fetch` and opens a PR when the diff is non-empty — still snapshot-based, no runtime fetch.
- Or relax the source: fetch models.dev at build time on Vercel. (Not recommended — loses opencode's filtering.)

**If a second provider key is configured (e.g. `OPENAI_API_KEY`):**
- `npm install @ai-sdk/openai`; the registry's `api.npm` mapping picks up the provider automatically; settings UI's servable filter expands; the same failover loop crosses providers (anthropic primary → openai fallback).

**If a model id in a stored preference is no longer in the snapshot (retired/deprecated):**
- `resolveModels` returns the models it can serve and drops unknown ones; if the result is empty, fall back to the current default `[anthropic('claude-sonnet-4-6')]` (fail-soft, matching the house "degrade toward a known-good state" pattern) rather than failing the Analyze action.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| ai 7.0.45 | @ai-sdk/anthropic 4.0.26 (both installed) | Verified working together in production (Phase 9). `generateText` `model` param accepts any `LanguageModel` — heterogeneous provider arrays type-check. |
| ai 7.0.45 error surface | `@ai-sdk/provider` 4.0.4 (installed transitively) | Exports `APICallError` (`statusCode`, `isRetryable`, `instanceof AISDKError`), `NoSuchModelError`, `LoadAPIKeyError`, `NoObjectGeneratedError`. **`TooManyRequestsError` does NOT exist in this version** (a 429 surfaces as `APICallError` with `isRetryable: true`) — don't import it. |
| `createAnthropic()` / `createOpenAI()` factories | ai 7.0.45 | Verified: provider instances are callable — `provider('model-id')` returns the language model. This is the registry's construction path. |
| opencode CLI 1.18.10 | macOS (darwin), Node 22.x | `opencode models [provider]`, `--verbose` (JSON on stdout, multi-line records), `--pure` (1113 models vs 1130), `--refresh`. ~2.2s cold start — fine for a fetch script, never per-request. CLI surface may shift across minor versions; the fetch script should parse defensively (skip non-JSON lines, tolerate missing fields) and the snapshot stays valid if the command changes (re-verify `models:fetch` after opencode upgrades). |
| opencode's model registry | models.dev public API | Verified byte-identical (`~/.cache/opencode/models.json` == `https://models.dev/api.json`; 177 providers, 5939 models). opencode CLI filters to 1130 servable. |
| drizzle-orm 0.45.2 | neon-http driver (existing) | `onConflictDoUpdate` with a composite/unique target works (verified in `recentlyViewed`). `jsonb` column typing via `.$type<>` (existing precedent: `company.techStack`, `importBatch.mapping`). |

## Integration Points (how the pieces connect)

```
opencode CLI (dev machine)                ── npm run models:fetch ──▶  src/data/opencode-models.json  (committed)
                                                                              │
Settings page  src/app/(dashboard)/settings/page.tsx  ◀──── reads snapshot + getModelSettingsForUser(userId)
      │  (client sub-component: primary select + ordered fallback slots, reorder via shadcn primitives)
      ▼  'use server'
src/app/actions/modelSettings.ts  ── zod-validated upsert ──▶  userModelSettings table (unique(userId), onConflictDoUpdate)

Analyze route  src/app/api/companies/[id]/analyze/route.ts
      ├─ requireStaffAccess()  →  userId
      ├─ getModelSettingsForUser(userId)  →  { primaryModel, fallbackModels[] }
      ├─ resolveModels([primary, ...fallbacks])  →  LanguageModel[]   (registry gates on api.npm + api.url + env key)
      └─ analyzeCompany(companyId, { models })  →  runAgent({ models })  →  runWithFallback(models, () => generateText({...}))
           ├─ APICallError / NoSuchModelError / NoObjectGeneratedError  →  next model in chain
           ├─ default (no settings row)  →  [anthropic('claude-sonnet-4-6')]  (today's behavior, unchanged)
           └─ Langfuse span records ai.model.id of the serving model automatically (OBSV-01 continuity)
```

**Touch-points that must change (existing code):**
- `src/lib/nav.ts` — `NavKey` union gains `'settings'` + a `getActiveNavKey` branch for `/settings`; the 11-case Vitest suite in `nav.test.ts` grows a case (the suite is the regression lock — QLTY-01).
- `src/lib/agents/runAgent.ts` — `RunAgentInput.model` (currently unused by callers) becomes `models?: LanguageModel[]`; the failover loop lives here (it already wraps the single `generateText` call, so the step cap `isStepCount(12)`, tools, and `Output.object` stay intact per attempt).
- `src/lib/agents/analyzeCompany.ts` — signature gains an optional `models` passthrough (defaults to the current constant); keeps its `not_configured` env gate and fail-closed validation unchanged.
- Sidebar nav (shared `app-shell-layout.tsx` / nav items) — "Settings" item in the Manage group (alongside Reviews), following the Exa-style anatomy; active state via the extended `getActiveNavKey`.

## What NOT to Add (scope guard for v1.3)

| Don't add | Instead |
|-----------|---------|
| Any new npm runtime dependency | The milestone is fully servable with ai@7 + @ai-sdk/anthropic + the committed snapshot (verified) |
| `@opencode-ai/sdk` | CLI snapshot |
| Per-request model fetching / polling | Committed JSON + explicit `models:fetch` refresh |
| A "test model connection" ping feature | The Analyze route itself is the live test; a saved setting is exercised on the next run and its failure/failover lands in the Langfuse trace |
| Writing model-list metadata into the DB | The snapshot is static data; only *preferences* are per-user DB state |
| Multi-tenant / org-scoped settings | Milestone is per-user only (matches the app's "any authenticated user = staff" model); the table is trivially extensible with an org column later |

## Sources

- **opencode CLI 1.18.10 (live verification)** — `opencode models`, `opencode models <provider>`, `--verbose`, `--pure`, `--refresh`; 1130 records / 1128 active; JSON on stdout; `~/.opencode/bin/opencode` on PATH — HIGH confidence
- **`~/.cache/opencode/models.json` vs `https://models.dev/api.json`** — content-identical (177 providers, 5939 models, byte-equal `zhipuai.glm-5` record) — HIGH confidence
- **Installed packages (node_modules)** — `ai@7.0.45` exports (error classes, no fallback helper), `@ai-sdk/provider@4.0.4` (no `TooManyRequestsError`), `@ai-sdk/anthropic@4.0.26` (factory + callable provider), `drizzle-orm@0.45.2` — HIGH confidence
- **Context7 `/vercel/ai`** — `createAnthropic`/`createOpenAI` factory docs, `NoSuchModelError`/`APICallError` semantics, "provider('model-id')" construction pattern — HIGH confidence
- **Codebase conventions** — `src/lib/db/schema.ts`, `queries/recentlyViewed.ts`, `runAgent.ts` (model seam), `analyzeCompany.ts`, `api/companies/[id]/analyze/route.ts`, `actions/reviews.ts`, `lib/nav.ts`, `env.ts` (degrade-gracefully gate), `drizzle.config.ts` — HIGH confidence
- **npm registry** — `@opencode-ai/sdk@1.18.11` exists (rejected: requires running server), `@opencode-ai/plugin@1.18.11` — MEDIUM confidence (not installed locally)

---
*Stack research for: ArcLumen 360 v1.3 AI Model Settings*
*Researched: 2026-08-02*
