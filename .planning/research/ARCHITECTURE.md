# Architecture Research

**Domain:** Per-user AI model settings for a Next.js 16 App Router demand-gen app (ArcLumen 360, milestone v1.3)
**Researched:** 2026-08-02
**Confidence:** HIGH (all integration claims verified against on-disk source + installed package source + live `opencode` CLI; one MEDIUM item flagged)

## Scope

This is a **subsequent-milestone architecture file** — it does not re-describe the app's foundations (Clerk auth, Drizzle+Neon, AppShellLayout, the Analytic Agent) as greenfield; it answers exactly how the new **user_model_settings** feature integrates with the existing architecture, per the six research questions (a)–(f) in the milestone context.

## System Overview (as-is + the new feature)

```
┌─────────────────────────── (dashboard) route group ───────────────────────────┐
│  (dashboard)/layout.tsx  → requireStaffAccess() → AppShellLayout             │
│  ├─ /                      Start page          (existing)                    │
│  ├─ /reviews               Reviews queue       (existing)                    │
│  └─ /settings              Settings page       ★ NEW (b)                     │
├─────────────────────────── /companies /personas route groups ────────────────┤
│  companies/layout.tsx · personas/layout.tsx → requireStaffAccess() → shell   │
│  company detail panel → ExplorerMenu → "Analyze" (existing)                  │
└───────────────────────────────────────────────────────────────────────────────┘

Agent run path (existing + ★ = new wiring):
  POST /api/companies/[id]/analyze (route.ts)
    → requireStaffAccess() → ★ { userId }        (c)
    → initLangfuse()
    → analyzeCompany(companyId) → ★ analyzeCompany(companyId, userId)   (c)
        → ★ getUserModelSettings(userId)          (a)
        → ★ resolveModelChain(settings, defaults) (pure, testable)
        → runAgent({ ... }) → ★ runAgent with ordered models + failover loop  (e)
            → generateText({ model, tools, prompt, stopWhen, output })
            → on provider/model error → ★ retry next fallback
    → gate → persist run + proposals (unchanged)

Settings write path (★ new):
  /settings page (server) → ModelSettingsForm (client) → settings.ts Server Action
    → requireStaffAccess() → zod-validate → ★ upsertUserModelSettings(userId, …)
    → revalidatePath('/settings')

Model catalog (★ new, d):
  dev machine:  scripts/refresh-model-catalog.ts → `opencode models` (or
                ~/.cache/opencode/models.json) → src/lib/models/catalog.json (committed)
  settings page: imports catalog.json (static, Vercel-safe)
```

## Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| `user_model_settings` table | Per-user primary + ordered fallback model IDs | NEW — `src/lib/db/schema.ts` (a) |
| `userModelSettings` query module | `getUserModelSettings(userId)` / `upsertUserModelSettings(...)` | NEW — `src/lib/db/queries/userModelSettings.ts`, mirrors `recentlyViewed.ts` (a) |
| Settings page | Server component: gates, reads settings + catalog, renders form | NEW — `src/app/(dashboard)/settings/page.tsx`, mirrors `(dashboard)/reviews/page.tsx` (b) |
| Model settings form | Client form: primary select + ordered fallback list | NEW — `src/components/settings/model-settings-form.tsx` |
| Settings Server Action | zod-validate + upsert + revalidatePath | NEW — `src/app/actions/settings.ts`, mirrors `actions/reviews.ts` (b) |
| Model catalog | Static vendored list of runnable models (id, name, provider) | NEW — `src/lib/models/catalog.json` (generated) + `src/lib/models/catalog.ts` (filter/type) (d) |
| Model-config resolver | Pure: settings row → ordered `anthropic(id)` chain; failover error predicate | NEW — `src/lib/agents/modelConfig.ts` (c, e) |
| Analyze route | Threads `userId` into `analyzeCompany` | MODIFIED — `src/app/api/companies/[id]/analyze/route.ts` (c) |
| `analyzeCompany` | Accepts userId, resolves + passes model chain | MODIFIED — `src/lib/agents/analyzeCompany.ts` (c) |
| `runAgent` | Accepts ordered models; runs failover loop | MODIFIED — `src/lib/agents/runAgent.ts` (e) |
| `getActiveNavKey` / sidebar | New `settings` key + Manage-group item | MODIFIED — `src/lib/nav.ts`, `src/components/layout/app-sidebar.tsx` (b) |

## Recommended Project Structure (delta)

```
src/
├── app/
│   ├── (dashboard)/
│   │   ├── settings/
│   │   │   └── page.tsx            # ★ NEW — server page (b)
│   │   └── ...existing
│   ├── actions/
│   │   └── settings.ts             # ★ NEW — 'use server' (b)
│   └── api/companies/[id]/analyze/route.ts   # MODIFIED — thread userId (c)
├── components/
│   ├── settings/
│   │   └── model-settings-form.tsx # ★ NEW — client form (b)
│   └── layout/app-sidebar.tsx      # MODIFIED — Settings item (b)
├── lib/
│   ├── agents/
│   │   ├── modelConfig.ts          # ★ NEW — pure resolver + failover predicate (c/e)
│   │   ├── runAgent.ts             # MODIFIED — ordered models + loop (e)
│   │   ├── analyzeCompany.ts       # MODIFIED — userId param (c)
│   │   └── *.test.ts               # MODIFIED + NEW pure tests (f)
│   ├── db/
│   │   ├── schema.ts               # MODIFIED — user_model_settings (a)
│   │   └── queries/
│   │       └── userModelSettings.ts # ★ NEW — query module (a)
│   ├── models/
│   │   ├── catalog.json            # ★ NEW — GENERATED, committed (d)
│   │   └── catalog.ts              # ★ NEW — typed catalog access + filter (d)
│   └── nav.ts                      # MODIFIED — 'settings' NavKey (b)
├── scripts/
│   └── refresh-model-catalog.ts    # ★ NEW — dev-machine generator (d)
```

### Structure Rationale

- **Settings lives in `(dashboard)`** (not a new route group): `(dashboard)` already hosts non-explorer pages (`/reviews`) behind the exact gate + shell the Settings page needs. A new route group would duplicate `(dashboard)/layout.tsx` for zero benefit. Confidence HIGH — verified `(dashboard)/layout.tsx` and `(dashboard)/reviews/page.tsx` on disk.
- **Query module under `lib/db/queries/`**: the repo convention (14 modules there today). `userModelSettings.ts` copies `recentlyViewed.ts`'s userId-keyed shape almost 1:1.
- **Pure resolver + failover predicate in `lib/agents/modelConfig.ts`**: keeps the AI-domain decision logic testable under the repo's "Vitest pure functions only, zero live calls" (D-16) rule.
- **Catalog generated into `lib/models/`**: a committed snapshot is the only opencode-derived source that survives Vercel serverless (see (d) below).

## Architectural Patterns

### Pattern 1: Per-user row with Clerk-id PK + upsert (a)

**What:** `user_model_settings` keyed by `userId` (Clerk opaque string, no FK — Clerk is external), one row per user, created/updated by upsert.
**When to use:** Any per-user preference store. This exactly replicates `recentlyViewed.userId` (schema.ts L140) and its verified `onConflictDoUpdate` upsert (`recentlyViewed.ts` L18-21, confirmed against installed `drizzle-orm@0.45.2`).
**Trade-offs:** Single row per user means no history — correct for a preference; a JSON column variant would be simpler but loses type safety per field and the `updated_at` discipline.

**Example (schema delta, `src/lib/db/schema.ts`):**
```typescript
// D-XX (v1.3): per-user AI model preference. Clerk userId is an opaque string,
// NO FK (Clerk is external) — same pattern as recentlyViewed.userId (L140).
export const userModelSettings = pgTable('user_model_settings', {
  userId: text('user_id').primaryKey(),
  // Model IDs as the APP instantiates them (e.g. 'claude-sonnet-4-6' passed to
  // anthropic()) — never provider-prefixed catalog ids. The catalog is the
  // join for display metadata; the DB stores plain ids only (Anti-pattern 4).
  primaryModel: text('primary_model').notNull(),
  // Drizzle-native ordered array (same shape as company.techStack, L61).
  // jsonb was considered but text[] is a homogeneous string list — the
  // array type is the honest Postgres shape and typed string[] in Drizzle.
  fallbackModels: text('fallback_models').array().notNull().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```
**Example (query module, `src/lib/db/queries/userModelSettings.ts`):**
```typescript
import { eq } from 'drizzle-orm';
import { db } from '../index';
import { userModelSettings } from '../schema';

// Query modules never catch (callers do) — house convention.
export async function getUserModelSettings(userId: string) {
  return db.query.userModelSettings.findFirst({ where: eq(userModelSettings.userId, userId) });
}

export async function upsertUserModelSettings(input: {
  userId: string;
  primaryModel: string;
  fallbackModels: string[];
}) {
  await db
    .insert(userModelSettings)
    .values({ ...input, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: userModelSettings.userId,
      set: {
        primaryModel: input.primaryModel,
        fallbackModels: input.fallbackModels,
        updatedAt: new Date(),
      },
    });
}
```

### Pattern 2: Failover loop with a pure retry predicate (e)

**What:** Attempt `generateText` down an ordered model chain; on a *provider/model* error, advance to the next model; on success return; on exhaustion rethrow the last error. The "is this worth falling back for?" decision is a **pure function** so it is unit-testable with constructed error instances (D-16 — no live calls).

**When to use:** Any agent that must tolerate model-availability drift. Verified against the installed `@ai-sdk/provider` source (dist/index.js L52-66): `APICallError.isRetryable` defaults to `408/409/429/>=500` — **a 404 (model removed from roster, the exact failure `runAgent.ts` L7-12 documents for dated Sonnet ids) is NOT retryable by default**, so the predicate must add `statusCode === 404` explicitly. `AIConnectionError` (network) and `NoSuchModelError` (SDK-side unknown id — note `@ai-sdk/anthropic`'s model-id union has a `(string & {})` escape hatch, so bad ids reach the API and surface as `APICallError` 404, not `NoSuchModelError`; keep both in the predicate for forward-safety).

**Trade-offs:** Retrying inside `runAgent` keeps the seam the existing tests mock (`runAgent.test.ts` mocks `generateText`), so the loop is testable without a provider. A per-attempt Langfuse span is nice but the AI SDK already emits a span per `generateText` call under the active observation — the loop itself needs no extra telemetry plumbing (OBSV-01 trace nesting survives; see Integration Points).

**Example (`src/lib/agents/modelConfig.ts` — pure, co-located tests):**
```typescript
import { APICallError, AIConnectionError, NoSuchModelError } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

export type ModelChain = ReturnType<typeof anthropic>[];

export function resolveModelChain(
  primary: string | undefined,
  fallbacks: string[] | undefined,
  defaults: string[], // default chain when no user settings row
): ModelChain {
  const ids = [
    ...(primary ? [primary] : []),
    ...(fallbacks ?? []),
    ...(defaults.length && !primary ? defaults : []),
  ];
  // The app only runs Anthropic today (sole installed @ai-sdk provider).
  // Unknown/duplicate ids are filtered; the loop then skips any that 404.
  return [...new Set(ids)].map((id) => anthropic(id));
}

export function isFailoverEligibleError(err: unknown): boolean {
  if (err instanceof AIConnectionError) return true;      // network blip — retry
  if (err instanceof NoSuchModelError) return true;       // SDK-side unknown id
  if (err instanceof APICallError) {
    // 404 = model not in roster (the dated-id failure runAgent.ts documents);
    // 429/5xx/408/409 are SDK-default isRetryable.
    return err.isRetryable || err.statusCode === 404;
  }
  return false; // InvalidPromptError, TypeValidationError, gate errors… retry won't help
}
```

**Example (`src/lib/agents/runAgent.ts` — modified; loop returns first success):**
```typescript
export interface RunAgentInput {
  company: CompanyInput;
  liveSignals: LiveSignalInput[];
  models?: ModelChain;            // ★ replaces the single `model?` seam
}

export async function runAgent({ company, liveSignals, models = [anthropic(FAST_MODEL_ID)] }: RunAgentInput) {
  let lastError: unknown;
  for (const model of models) {
    try {
      return await generateText({
        model,
        tools: { webSearch: webSearchTool },
        prompt: buildAnalyzePrompt(company, liveSignals),
        stopWhen: isStepCount(12),
        output: Output.object({ schema: outputSchema }),
      });
    } catch (err) {
      lastError = err;
      if (!isFailoverEligibleError(err)) throw err; // never burn fallbacks on non-model errors
    }
  }
  throw lastError; // chain exhausted — fail loud (D-06)
}
```
Backward-compatible: the existing `runAgent.test.ts` default-model case still passes (`models` omitted → `[anthropic(FAST_MODEL_ID)]`).

### Pattern 3: Vendored generated catalog (d)

**What:** A dev-machine script runs the **local opencode installation** and writes a committed JSON snapshot; the settings page (a Server Component) imports it. No runtime fetch.
**When to use:** Always for this app — **Vercel serverless cannot reach a "local opencode installation"** (localhost on a dev machine); the milestone's "live from opencode" is only achievable at *generation* time on the machine where opencode runs. Verified: the app deploys to Vercel serverless (`maxDuration = 60`, `src/proxy.ts`, neon-http), and `opencode serve` binds `127.0.0.1` by default.
**Trade-offs:** The snapshot is stale until re-run. Acceptable — model rosters change weekly at most, and a 404 at runtime triggers the failover loop (Pattern 2), which is the safety net.

**Verified opencode sources (all confirmed live on this machine, opencode 1.18.10):**
- `opencode models [provider]` — CLI, 1,130 models across anthropic(17) / google(37) / kilo(345) / openai(13) / opencode(60) / opencode-go(17) / openrouter(335) / vercel(306); `--verbose` adds cost/limit metadata; `--refresh` re-pulls models.dev.
- `~/.cache/opencode/models.json` — 3.3 MB cached models.dev database opencode syncs (the same data the CLI prints); every model carries `id`, `name`, `limit.context`, `cost`, `reasoning`, `tool_call`.
- `opencode serve` → `GET /api/model` (HttpApi "List models"), `GET /api/model/default`, `GET /config/providers` — the HTTP surface, but only reachable on the machine running the server.

**Recommendation (opinionated):** the generator script shells out to `opencode models --verbose` (or parses the cache file) and writes a **filtered** snapshot: only models whose provider the app has an SDK + key for. Today that is **Anthropic only** (`@ai-sdk/anthropic` is the sole installed provider SDK; `ANTHROPIC_API_KEY` is the only model-provider key in `src/lib/env.ts`). Catalog entry shape: `{ id, name, provider: 'anthropic', contextWindow? }` — the settings UI needs id + display name; context window is a nice-to-have. Do **not** ship the 3.3 MB raw database or 1,130 openrouter/kilo/opencode models the agent can never call (Anti-pattern 1).

## Data Flow

### Settings write (new)
```
User edits primary/fallbacks in ModelSettingsForm
    ↓ (Server Action: settings.ts)
zod-validate input → requireStaffAccess() → upsertUserModelSettings(userId, …)
    ↓
revalidatePath('/settings')  →  re-render shows saved state (same pattern as reviews.ts)
```

### Agent run with model config (new wiring on existing path)
```
ExplorerMenu "Analyze"  →  POST /api/companies/[id]/analyze
    ↓
requireStaffAccess() → { userId }          ★ userId now captured (route L25)
    ↓
analyzeCompany(companyId, userId)
    ↓
getUserModelSettings(userId)   (query module, may return undefined = no row)
    ↓
resolveModelChain(primary, fallbacks, [FAST_MODEL_ID])   (pure)
    ↓
runAgent({ models: chain }) → failover loop → first successful generateText
    ↓
deriveEvidenceAppendix → gate → dedup → persist run + proposals   (UNCHANGED — D-08 domains preserved)
```

### Model catalog (new)
```
dev machine: scripts/refresh-model-catalog.ts → opencode models --verbose
    → src/lib/models/catalog.json (committed)
settings page (server): import catalog.json → filter by supported provider → render
```

### State management

No new client state beyond the form's local editing state. The saved settings are read **server-side per request** (`getUserModelSettings` in both the Settings page and the agent route) — no cache, matching the app's "read fresh from DB" posture (`recentlyViewed` has no cache either). The catalog is static (import-time constant).

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-100 users (current team) | One row per user, upsert per save, catalog snapshot re-run on demand — nothing more needed |
| 1k-100k users | Add a `revalidateTag`-style catalog cache if it ever goes runtime-fetched; today it's a static import so cost is zero |
| 100k+ users | `user_model_settings` is a trivial single-PK table; only the agent-run path matters (already traced/capped by `isStepCount(12)` + 60s budget) |

### Scaling Priorities

1. **First bottleneck (realistic):** None for settings. The honest risk is *catalog staleness* (a model the user saved gets removed) — mitigated by the 404→fallback loop, not by scaling.
2. **Second:** If "live" model lists become a requirement, move the catalog to a runtime fetch from models.dev with a long `cacheLife` — never from a local opencode server (unreachable from Vercel).

## Anti-Patterns

### Anti-Pattern 1: Listing every opencode model, including providers the app can't call

**What people do:** Feed all 1,130 `opencode models` entries into the Settings select so it "looks complete."
**Why it's wrong:** Users pick an openrouter/kilo/opencode-routed model → the agent instantiates `anthropic('<that id>')` → guaranteed 404 at run time. The list advertises capability that doesn't exist.
**Do this instead:** Filter the generated catalog to installed provider SDKs + configured keys (Anthropic today). When a second provider lands (adds SDK + key), regenerate.

### Anti-Pattern 2: Runtime fetch to a "local" opencode from Vercel

**What people do:** Design a route handler that hits `http://127.0.0.1:4096/api/model` (or shells `opencode models`) on every Settings page load.
**Why it's wrong:** Vercel serverless runs in AWS — no dev-machine opencode, no shell, no localhost. It works in `next dev` and 404s in production, silently if errors are swallowed.
**Do this instead:** Generate at build/dev time and commit (Pattern 3). A future runtime-fetch variant must point at a *publicly reachable* opencode server or models.dev, with caching.

### Anti-Pattern 3: Failing over on every error type

**What people do:** `try { return await generateText(...) } catch { /* next model */ }` — swallowing gate/validation/schema errors and burning fallback tokens.
**Why it's wrong:** `InvalidPromptError`, `TypeValidationError`, and the app's own `gate_failed` are deterministic — a different model produces the same failure. Retrying them hides real bugs (violates D-06 fail-loud).
**Do this instead:** Gate with `isFailoverEligibleError` (Pattern 2) — only provider/model/network errors advance the chain.

### Anti-Pattern 4: Storing display metadata in the DB

**What people do:** Persist `{ id, name, provider, contextWindow }` JSON per user so the Settings page doesn't need the catalog.
**Why it's wrong:** Duplicates the catalog, drifts when the catalog refreshes, and bloats the row. The catalog is the join.
**Do this instead:** Store plain model IDs only; the page joins against the static catalog for labels; unknown/removed ids render as "model no longer available" (and the agent's 404 loop skips them).

### Anti-Pattern 5: Putting model resolution inside the route handler

**What people do:** `auth()` → query → `anthropic(id)` all inside `route.ts`.
**Why it's wrong:** Untestable (D-16: zero live calls in tests — the route handler is never unit-tested in this repo; only `lib/` modules are).
**Do this instead:** Resolve in `analyzeCompany` (which is the tested orchestrator, `analyzeCompany.test.ts` mocks its seams) via the pure `resolveModelChain`.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| opencode (dev machine) | **Build/generation-time only**: `scripts/refresh-model-catalog.ts` shells `opencode models --verbose` (or parses `~/.cache/opencode/models.json`) | Confirmed live (opencode 1.18.10). NOT reachable at runtime from Vercel — do not wire a runtime fetch. `--refresh` re-pulls models.dev if the cache is stale |
| Anthropic API | Unchanged — `@ai-sdk/anthropic` + `ANTHROPIC_API_KEY`; `generateText` per attempt | The only provider the app can run today; catalog is filtered to it (Anti-pattern 1). Verified `@ai-sdk/anthropic@4.0.26` installed |
| Neon Postgres | Unchanged — `db` from `@neondatabase/serverless`; new table via `drizzle-kit` | ⚠️ MEDIUM: `drizzle/meta/_journal.json` has **zero migration entries** — the live schema appears to be pushed/applied without committing generated migrations. The v1.3 phase must confirm the repo's actual apply flow (`drizzle-kit push` vs generate+commit) before adding the table |
| Langfuse | Unchanged — each `generateText` attempt emits its own span under the route's `startActiveObservation('analyze-company')` | Fallback attempts are automatically visible in the trace (span per call). Optionally record the resolved model chain on `agent_run` (new nullable column or reuse `verdict`-style jsonb) for post-run audit — DB-first, trace-best-effort per D-14 |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Analyze route ↔ `analyzeCompany` | Direct call, signature change `(companyId)` → `(companyId, userId)` | The route already owns `requireStaffAccess()`; capturing `userId` is a 1-line change at L25. No auth re-check inside `analyzeCompany` (D-08 domains) |
| `analyzeCompany` ↔ query module | `getUserModelSettings(userId)` — server-read; a missing row → defaults (never a gate failure) | Must NOT surface as `gate_failed` or `not_configured` — a user without settings simply gets the `FAST_MODEL_ID` default |
| `analyzeCompany` ↔ `runAgent` | `models?: ModelChain` replaces `model?: ReturnType<typeof anthropic>` | Existing tests updated at the same commit (f) |
| Settings page ↔ Server Action | Standard form action; zod-validate at the boundary | Input arrives as `unknown` (Server Action contract) — validate id ∈ catalog + primary required + fallbacks ⊆ catalog, ≤ N (e.g. 3) |
| `getActiveNavKey` ↔ sidebar | `NavKey` union grows `'settings'` | Pure function + 11-case test suite updated; `getNavTooltipLabel`/`getCollapseToggleLabel` need a tooltip label (current 7-case suite updated too). Manage group is the natural home (Reviews already sits there) |

## Suggested Build Order (dependency-driven)

1. **Schema + query module (a):** `user_model_settings` table, `drizzle-kit` migration/apply (confirm flow — MEDIUM flag), `userModelSettings.ts` queries. Nothing depends on it yet.
2. **Catalog generator (d):** `scripts/refresh-model-catalog.ts` → `src/lib/models/catalog.json` + `catalog.ts` (typed, provider-filtered). Pure filter logic gets Vitest coverage; generated snapshot committed. *Prereq for the Settings UI and for validating user picks.*
3. **Model-config pure functions (c/e):** `modelConfig.ts` — `resolveModelChain`, `isFailoverEligibleError`. Co-located Vitest suite (constructed `APICallError(404/429/500)`/`AIConnectionError`/non-eligible instances — zero live calls). *Prereq for agent wiring and failover; independently testable now.*
4. **Settings UI (b):** `getActiveNavKey` `'settings'` + tests → sidebar item → `(dashboard)/settings/page.tsx` + `model-settings-form.tsx` + `actions/settings.ts`. Consumes catalog + query module from 1/2.
5. **Agent wiring (c):** route threads `userId` → `analyzeCompany(companyId, userId)` → resolve + pass chain to `runAgent`. Update `analyzeCompany.test.ts` (mock `getUserModelSettings`; assert chain reaches `runAgent`; missing-row → defaults).
6. **Failover (e):** `runAgent` loop + `runAgent.test.ts` cases (primary throws 404 → fallback called; all fail → last error rethrown; non-eligible error → no fallback). Optionally persist the used model on `agent_run` for the review queue's "which model produced this" context.
7. **Polish/observability:** settings-page empty/error states (EXPL-06 error-card pattern), Langfuse attempt visibility, UAT.

**Ordering rationale:** schema→queries→catalog→pure logic are all independently shippable foundations; Settings UI consumes 1+2+4's nav change; the agent path (5+6) is the riskiest consumer (touches the tested orchestrator) and lands after the pure failover predicate is locked by tests, so the wiring change is a thin, provable slice.

## Sources

- **Codebase (HIGH):** `src/lib/db/schema.ts`, `src/lib/db/queries/recentlyViewed.ts`, `src/app/(dashboard)/layout.tsx` + `reviews/page.tsx` + `page.tsx`, `src/app/api/companies/[id]/analyze/route.ts`, `src/lib/agents/{runAgent,analyzeCompany,tools,types}.ts` + both `.test.ts`, `src/lib/auth/requireStaffAccess.ts`, `src/components/layout/{app-shell-layout,app-sidebar}.tsx`, `src/lib/nav.ts`, `src/lib/env.ts`, `src/app/actions/reviews.ts`, `drizzle.config.ts`, `drizzle/meta/_journal.json`
- **opencode (HIGH, live-verified 2026-08-02):** `opencode --help`, `opencode models` (1,130 models, 8 provider buckets, `--verbose`/`--refresh` flags), `opencode serve --help`, `~/.cache/opencode/models.json` (3.3 MB models.dev database); docs — https://opencode.ai/docs/server/, https://opencode.ai/v2/docs/api (GET `/api/model`, `/api/model/default`, `/config/providers`)
- **AI SDK (HIGH, from installed node_modules):** `@ai-sdk/provider/dist/index.d.ts` + `dist/index.js` (APICallError default `isRetryable` = 408/409/429/≥500 — verified at L52-66), `@ai-sdk/anthropic/dist/index.d.ts` (AnthropicModelId union incl. `claude-sonnet-4-6` + `(string & {})` escape hatch), `ai@7.0.45`
- **MEDIUM:** migration apply flow (empty `_journal.json` — push vs generate unconfirmed; verify in phase 1)

---
*Architecture research for: ArcLumen 360 — v1.3 AI Model Settings (subsequent-milestone integration)*
*Researched: 2026-08-02*
