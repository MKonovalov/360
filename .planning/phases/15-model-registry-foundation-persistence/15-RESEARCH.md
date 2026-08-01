# Phase 15: Model Registry Foundation + Persistence — Research

**Researched:** 2026-08-02
**Domain:** Drizzle schema + atomic upsert queries (Neon Postgres), `agent_run` audit columns, dev-time opencode catalog snapshot + pure filter functions
**Confidence:** HIGH — all claims verified against the authoritative milestone research (`.planning/research/*.md`), on-disk source, installed `drizzle-orm@0.45.2`/`drizzle-kit@0.31.10`, the live `opencode` CLI 1.18.10, and a live `GET /v1/models` roster check executed during this research.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Keep `drizzle-kit push` — `schema.ts` stays the source of truth, applied via push. No migration files or generate+commit workflow introduced (repo has zero committed migrations today; single-dev internal tool with seed-data DB; nothing to roll back that a re-seed doesn't fix). `drizzle/meta/_journal.json` stays as-is. A `db:push` npm script is a Claude-discretion nicety, not a requirement.
- **D-02:** Curated small roster = **`claude-sonnet-4-6` + `claude-haiku-4-5`**. Both must be roster-verified against live `GET /v1/models` during Phase 15 before appearing in the catalog. Opus 4.5 explicitly deferred (user declined). `claude-sonnet-4-6` remains the no-settings default (REG-05 preserves existing behavior).
- **D-03:** The allowlist is a **hand-curated code constant** in `src/lib/models/` (explicit array of verified raw provider IDs), independent of the opencode snapshot. The snapshot is a menu; the allowlist is the gate. Adding a model = code change + deploy + roster re-verify (standing maintenance, per STATE.md).
- **D-04:** `user_model_settings.fallback_models` = **`text[]`** (`text('fallback_models').array()`), the research-recommended resolution of conflict #5. First array column in the repo — intentional; direct `string[]` typing, no JSON casting.
- **D-05:** `agent_run` audit columns (REG-04): **`model_used` = text** (raw provider ID that actually served) + **`model_chain` = jsonb** storing the **resolved ID list snapshot** captured at run start (e.g. `["claude-sonnet-4-6","claude-haiku-4-5"]`). Resolved-chain shape chosen over per-attempt detail — `model_used` + `model_chain` answer "which model ran" from the DB alone (D-14 durable-truth rule); attempts detail lives in Langfuse spans. Phase 16 populates these.
- **D-06:** `user_model_settings` carries **`updatedAt` only** (`timestamp` defaultNow, overwritten on each upsert). No version column — the atomic full-value upsert already prevents lost updates; versioning adds schema with no consumer in v1.3.
- **D-07:** The committed snapshot carries **all providers, trimmed to UI-needed fields** (~100–200KB, not the 3.3MB raw registry). Keeps the multi-provider growth path (adding OpenAI later = install SDK + extend allowlist; no snapshot change) and makes CAT-03's filter function meaningful (provider filter → strip prefix → intersect allowlist). Server-side read only, never shipped to the client bundle.
- **D-08:** Snapshot file location and module naming (e.g. `src/data/opencode-models.json` vs `src/lib/models/catalog.json`; `registry.ts` vs `modelConfig.ts`; filter fn names) are **Claude's discretion** — pick one consistent set (research conflict #7), matching existing `src/lib/` conventions. Script name `scripts/refresh-model-catalog.ts` per ROADMAP.

### Claude's Discretion
- Snapshot file path + module naming (conflict #7 resolution).
- `opencodeSlugToModelId` / filter-function exact names and signatures (CAT-03) — pure, provider-filtered, tested (D-16).
- `db:push` npm script nicety; `generatedAt` field on the snapshot for the Phase 17 "last synced" display.
- Exact trimmed field set for the snapshot (name, family, cost, context/output limits, status, `api.npm`, `api.url` per research).

### Deferred Ideas (OUT OF SCOPE)
- **Opus 4.5 in the roster** — user declined for v1.3; adding later is a one-line allowlist change + roster re-verify (allowlist maintenance standing practice)
- **`updatedAt` + version column** — version guard rejected (no consumer in v1.3); atomic upsert already prevents lost updates. Revisit if multi-tab/multi-device edit-conflict UI ever lands
- **Per-attempt detail in `model_chain`** — rejected; Langfuse spans carry attempts detail, DB carries the resolved-chain snapshot (D-14 split)
- (Carried from research, not this discussion) Per-agent model assignment MRG-01, multi-provider MRG-02, per-model advanced settings MRG-03, team defaults MRG-04 — already recorded in `.planning/REQUIREMENTS.md` Future Requirements
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REG-01 | `userModelSettings` Drizzle table persists per-user model preferences, keyed by Clerk `userId` (unique per user) | Schema delta verified below (§Pattern 1) — `userId` text primaryKey, no FK (Clerk external), mirroring `recentlyViewed.userId` (`schema.ts:140`). D-01 push flow confirmed: `drizzle/meta/_journal.json` = `{"entries":[]}` — push-based, matches every existing table. |
| REG-02 | Stores raw provider IDs (`claude-sonnet-4-6`, never `anthropic/...`), primary as text, fallbacks as `text[]` (ordered) | D-04: `primaryModel` text + `fallbackModels` `text().array()`. Raw-ID invariant is PITFALLS Pitfall 1 — DB values are directly consumable by `anthropic('id')`. ⚠️ Correction: CONTEXT calls this the "first array column in the repo" — **factually wrong**: `company.techStack` is already `text('tech_stack').array()` (`schema.ts:61`). The `text[]` choice stands; the code comment should cite the `techStack` precedent, not "first in repo". |
| REG-03 | Query module `src/lib/db/queries/userModelSettings.ts` exposes get + atomic upsert | Mirrors `queries/recentlyViewed.ts` (`onConflictDoUpdate` verified against installed drizzle 0.45.2, L11-21). House convention: named exports, never try/catch, no `db.transaction()` (neon-http has none) — caller owns error handling. |
| REG-04 | `agent_run` gains `model_used` (text) + `model_chain` (jsonb) audit columns | D-05 locked. `agentRun` table (`schema.ts:233-246`) has NO model columns today. New columns nullable (pre-milestone rows stay NULL — "backfill impossible for old runs" per PITFALLS recovery table). jsonb precedents: `usageTokens`, `evidenceAppendix`, `hypotheses` (all plain `jsonb(...)`); recommend `.$type<string[]>()` for direct typing. |
| REG-05 | No saved settings → existing `claude-sonnet-4-6` default behavior preserved | `runAgent.ts:13` `FAST_MODEL_ID = 'claude-sonnet-4-6'` (re-verified against live `GET /v1/models` 2026-08-02 in this research). The query module returns a falsy absence value when no row — resolution to the default chain is Phase 16's consumer; Phase 15 only guarantees "missing row → null, never throws". |
| CAT-01 | Dev-time script fetches model list from local opencode CLI → committed JSON snapshot | `opencode models --verbose` verified live (1.18.10): 1130 JSON records on stdout, each preceded by a `provider/id` header line. Exact record shape documented below (§Pattern 2). Script placement: **repo-root `scripts/refresh-model-catalog.ts`** (see D-08 recommendation — keeps `exec|spawn|child_process` out of `src/` for the Phase 18 grep gate). |
| CAT-02 | Snapshot is the production source — zero runtime opencode dependency | Pitfall 8: Vercel serverless has no binary/cache; the committed JSON is the only Vercel-safe bridge. No runtime fetch, no `@opencode-ai/sdk` (rejected — needs a running `opencode serve` host). |
| CAT-03 | Pure function filters snapshot → servable (Anthropic) models + maps opencode slugs → raw provider IDs | `opencodeSlugToModelId` + `filterServableModels`/allowlist-intersect designed below (§Pattern 2). Pure, co-located Vitest (D-16 — no mocks, no live calls). |
| CAT-04 | Catalog ships with the app build (committed file), read server-side | `resolveJsonModule: true` in `tsconfig.json` — JSON import works. `src/lib/models/` does not exist yet (created in this phase). No client consumer in Phase 15 (Settings UI is Phase 17). |
</phase_requirements>

## Summary

Phase 15 is the foundation slice of v1.3 (research phase A). It delivers four independent, shippable artifacts, each with an existing in-repo precedent to mirror: **(1)** a `user_model_settings` table + `userModelSettings` query module — a near 1:1 copy of the verified `recentlyViewed` Clerk-userId-keyed, no-FK, `onConflictDoUpdate` atomic full-value upsert pattern; **(2)** `agent_run` audit columns `model_used` (text) + `model_chain` (jsonb) — nullable, no backfill, populated in Phase 16; **(3)** a dev-time snapshot script `scripts/refresh-model-catalog.ts` that shells `opencode models --verbose` (verified live: 1130 JSON records on stdout, each preceded by a `provider/id` header line) and writes a trimmed committed `src/lib/models/catalog.json`; **(4)** pure catalog functions in `src/lib/models/catalog.ts` — `opencodeSlugToModelId`, the Anthropic allowlist constant, and the allowlist∩snapshot servable filter — all Vitest-locked under the D-16 pure-functions-only rule.

**Zero new npm dependencies.** Everything Phase 15 needs is already installed and production-proven: `drizzle-orm@0.45.2`, `drizzle-kit@0.31.10`, `tsx@4.23.1`, `vitest@4.1.10`. The only external tool is the local opencode CLI (dev-time only) and the Neon DB (existing). The migration apply flow (the one MEDIUM research flag) is **resolved as D-01: `drizzle-kit push`** — confirmed consistent with the empty `_journal.json` and `drizzle.config.ts` loading `.env.local`.

**Two research-time findings the planner MUST act on:**

1. **`claude-haiku-4-5` is NOT roster-verified as of 2026-08-02.** This research executed the D-02 gate live: `GET /v1/models` returns 11 models; `claude-sonnet-4-6` **present**, `claude-haiku-4-5` **absent** (only the dated `claude-haiku-4-5-20251001` is on the roster — precisely the Pitfall-1 dated-ID class that 404s when retired). Per D-02's own gate ("if it 404s, it's dropped from the allowlist and the roster ships with sonnet only — no invented IDs"), **the Phase 15 allowlist ships `['claude-sonnet-4-6']`**. Plan the re-verify as an execution task (roster can change), but write the constant as sonnet-only and expect Haiku 4.5 to be deferred unless the live check passes at execution.
2. **CONTEXT.md's "first `text[]` column in the repo" claim is factually wrong** — `company.techStack` (`schema.ts:61`) is already a text array. The D-04 choice stands and is *stronger* (an in-repo precedent exists); the schema comment must cite `techStack`, not claim "first".

**Primary recommendation:** follow the architecture-map below. Schema + queries first (REG-01..05), then the script + catalog module + tests (CAT-01..04), then the `npm run models:fetch` run and commit. No runtime wiring in this phase — Phase 16 consumes the query module and populates the audit columns.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Per-user settings persistence (`user_model_settings` + upsert) | Database / Storage | API / Backend (query module) | The table is pure storage; the `userModelSettings` query module is the server-side data-access layer. No browser tier involvement in Phase 15. |
| `agent_run` audit columns (`model_used`/`model_chain`) | Database / Storage | — | Durable-truth record (D-14); populated by Phase 16's backend loop, read by future review UI. |
| Catalog snapshot generation | Dev machine / Build tooling | — | `scripts/refresh-model-catalog.ts` shells the local opencode CLI at generation time only — never request-time (Pitfall 8). |
| Catalog filter + slug→ID mapping (CAT-03) | API / Backend (server-side lib) | — | Pure functions in `src/lib/models/` consumed server-side by Phase 17's Settings Server Component; never shipped to the client bundle (D-07). |
| Default behavior when no settings row (REG-05) | API / Backend | — | The `FAST_MODEL_ID = 'claude-sonnet-4-6'` constant already lives in `runAgent.ts`; Phase 15's query module must return absence (not throw) so Phase 16's resolution defaults cleanly. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `drizzle-orm` (existing) | 0.45.2 (installed) | `userModelSettings` pgTable + `onConflictDoUpdate` upsert | The repo's ORM; `recentlyViewed.ts` proves the exact upsert pattern works on this version. No new dep. |
| `drizzle-kit` (existing) | 0.31.10 (installed) | `drizzle-kit push` schema apply (D-01) | Confirmed apply flow — `drizzle/meta/_journal.json` is `{"entries":[]}` (push-based); `drizzle.config.ts` loads `.env.local` via `dotenv config({ path: '.env.local' })`. |
| `tsx` (existing devDep) | 4.23.1 (installed) | Run `scripts/refresh-model-catalog.ts` + DB smoke queries | Existing convention: `"seed": "tsx src/scripts/seed.ts"`. |
| opencode CLI (dev-time tool only) | 1.18.10 (local `~/.opencode/bin/opencode`, on PATH — verified) | `opencode models --verbose` snapshot source | The exact `/models` backend (research STACK.md HIGH). NEVER a runtime dependency. |
| `vitest` (existing devDep) | 4.1.10 (installed) | Pure-function tests for `catalog.ts` | Existing harness: `vitest.config.ts` (node env, `src/**/*.test.ts`, `@` → `./src` alias). D-16: pure functions only, no mocking library beyond vitest's `vi`, zero live calls. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `dotenv` (existing devDep) | 17.4.2 | Load `.env.local` in the smoke-query script | Only if the phase adds a DB smoke script (mirror `seed.ts`'s `config({ path: '.env.local' })` + dynamic-import-inside-main pattern — tsx does not auto-load `.env.local`, and `src/lib/env.ts` validates at module-evaluation time). |
| `@neondatabase/serverless` (existing) | 1.1.0 | Neon HTTP client for the smoke query | `src/lib/db/index.ts` already builds `drizzle({ client: neon(env.DATABASE_URL), schema })`. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `drizzle-kit push` (D-01) | generate+commit migrations | Push matches the repo's zero-migration reality (empty `_journal.json`); generate+commit adds a workflow with no rollback consumer (re-seed covers recovery). LOCKED — do not revisit. |
| Committed JSON snapshot | `modelRegistry` DB table (FEATURES.md draft) | Static catalog data must not become per-user DB state; snapshot is Vercel-safe and needs no migration (research conflict #2 — committed snapshot recommended and locked by D-07). |
| `src/lib/models/catalog.json` | `src/data/opencode-models.json` | `src/data/` doesn't exist as a convention; `src/lib/models/` co-locates the JSON with its typed accessor/filters (ARCHITECTURE.md structure). D-08 discretion — see below. |
| Repo-root `scripts/refresh-model-catalog.ts` | `src/scripts/refresh-model-catalog.ts` | The script shells `opencode` (`child_process`). Phase 18's gate greps **zero `exec|spawn|child_process` in `src/`** — repo-root `scripts/` keeps `src/` clean. ROADMAP's literal path is `scripts/refresh-model-catalog.ts`. |
| `jsonb('model_chain').$type<string[]>()` | plain `jsonb('model_chain')` | D-05 locks jsonb; `.$type<>` gives direct `string[]` typing with zero runtime cost (precedent: `company.fieldSources` uses `.$type<>`). Plain jsonb also fine — planner picks one. |

**Installation:** None. `npm run models:fetch` (new script → `tsx scripts/refresh-model-catalog.ts`) and `npx drizzle-kit push` use already-installed tooling.

**Version verification (all verified against `package.json` + live execution):** drizzle-orm ^0.45.2, drizzle-kit ^0.31.10, tsx ^4.23.1, vitest ^4.1.10, dotenv ^17.4.2, opencode 1.18.10 — all present on this machine; no install steps required.

## Package Legitimacy Audit

> This phase installs **zero new packages** — every dependency used is already installed, in production (drizzle-orm drives all Phase 1–14 tables), and verified by direct `package.json` read + live execution in this research. The package-legitimacy gate (slopcheck) has no new-package surface to audit. The only npm package *considered and rejected* by the milestone research is `@opencode-ai/sdk` (exists on npm but requires a running `opencode serve` host — useless on Vercel serverless).

| Package | Registry | Status | Disposition |
|---------|----------|--------|-------------|
| — (no new packages) | — | — | Approved — no installs in this phase |

**Packages removed due to slopcheck [SLOP] verdict:** none (no new packages)
**Packages flagged as suspicious [SUS]:** none
**Rejected with rationale (research-verified):** `@opencode-ai/sdk@1.18.11` — rejected by milestone research (STACK.md "What NOT to Use"); `@opencode-ai/plugin@1.18.11` — not needed. If the planner ever installs these, gate behind `checkpoint:human-verify`.

## Architecture Patterns

### System Architecture Diagram

```
┌─ DEV MACHINE (generation-time only) ──────────────────────────────────────────┐
│  scripts/refresh-model-catalog.ts  ──child_process──▶  opencode models --verbose│
│      (repo-root scripts/, keeps exec|spawn OUT of src/ — Phase 18 grep gate)  │
│          │  trims records to UI-needed fields + generatedAt                    │
│          ▼                                                                     │
│  src/lib/models/catalog.json  (committed, all providers, ~100-200KB)          │
└───────────────────────────────────────────────────────────────────────────────┘
                              │ imported at build/render time (static, Vercel-safe)
                              ▼
┌─ SERVER (Next.js App Router) ─────────────────────────────────────────────────┐
│  src/lib/models/catalog.ts  (pure, tested — Phase 15)                          │
│    ├─ ANTHROPIC_ALLOWLIST: readonly string[]   ← the GATE (D-03)              │
│    ├─ opencodeSlugToModelId(slug) → string|null (provider-filtered strip)     │
│    └─ filterServableModels(catalog) / getAllowlistedServableIds(catalog)      │
│        = providerID==='anthropic' ∩ status!=='deprecated' ∩ allowlist         │
│                                                                                │
│  src/lib/db/schema.ts  (MODIFIED — Phase 15)                                   │
│    ├─ userModelSettings  pgTable   ← NEW (REG-01/02)                           │
│    └─ agentRun + model_used text / model_chain jsonb  ← NEW columns (REG-04)  │
│                                                                                │
│  src/lib/db/queries/userModelSettings.ts  (NEW — REG-03)                       │
│    ├─ getModelSettingsForUser(userId) → row | undefined   (REG-05: absence)   │
│    └─ upsertModelSettings({userId, primaryModel, fallbackModels})              │
│        = insert ... onConflictDoUpdate (atomic full-value — Pitfall 9)         │
│                                                                                │
│  src/lib/db/queries/runs.ts  (MODIFIED — REG-04 insert seam)                   │
│    └─ CreateRunInput + modelUsed?: string, modelChain?: string[]               │
│       (columns added to the explicit .values() map too — Phase 16 populates)  │
└────────────────────────────────────────────────────────────────────────────────┘
      ▲ Phase 16 consumes (getModelSettingsForUser → resolve chain → populate
      │ model_used/model_chain). Phase 17 consumes (catalog filter → pickers).
      └── NOT in Phase 15 scope — this phase only lays the durable foundations.
```

### Recommended Project Structure (delta for Phase 15)

```
scripts/
└── refresh-model-catalog.ts     # NEW — dev-time: opencode models --verbose → trimmed JSON
src/
├── lib/
│   ├── db/
│   │   ├── schema.ts            # MODIFIED — +userModelSettings table; +agent_run.model_used/model_chain
│   │   └── queries/
│   │       ├── userModelSettings.ts      # NEW — get + atomic upsert (REG-03)
│   │       ├── userModelSettings.integration.test.ts   # NEW — TEST_DATABASE_URL-gated (optional)
│   │       └── runs.ts                   # MODIFIED — CreateRunInput + values() gain modelUsed/modelChain
│   └── models/
│       ├── catalog.json         # NEW — GENERATED, committed (CAT-01/02/04)
│       ├── catalog.ts           # NEW — typed accessor + allowlist + pure filters (CAT-03)
│       └── catalog.test.ts      # NEW — Vitest, pure-only (D-16)
└── (no changes to app/, components/, agents/ — Phase 15 has no UI/runtime wiring)
```

**Structure rationale (all verified):** the query module goes under `src/lib/db/queries/` (repo convention — 14 modules there today); the script goes at **repo-root `scripts/`** (ROADMAP's literal path + keeps `exec|spawn` out of `src/` for Phase 18's grep gate); the catalog lands in `src/lib/models/` co-located with its type/filter module (`src/data/` has no precedent); `tsconfig.json` has `resolveJsonModule: true` so `catalog.json` imports cleanly.

### Pattern 1: Per-user row with Clerk-id PK + atomic full-value upsert (REG-01..03, REG-05)

**What:** `user_model_settings` keyed by Clerk `userId` as the primary key (one row per user, no FK — Clerk is external), created/updated by a single `insert ... onConflictDoUpdate` that writes the **complete** settings object on every save. Never read-modify-write (Pitfall 9 — concurrent saves can never produce a half-merged chain).

**When to use:** Any per-user preference store. This exactly replicates `recentlyViewed.userId` (`schema.ts:140`) and its verified `onConflictDoUpdate` upsert (`recentlyViewed.ts:14-22`, verified against installed drizzle-orm 0.45.2).

**Schema delta** (add to `src/lib/db/schema.ts`; import `text` already present):
```typescript
// D-04/D-06 (v1.3): per-user AI model preference. Clerk userId is an opaque
// string, NO FK (Clerk is external) — same pattern as recentlyViewed.userId.
// Model IDs are stored as the APP instantiates them ('claude-sonnet-4-6',
// passed to anthropic()) — NEVER provider-prefixed catalog ids (Pitfall 1).
export const userModelSettings = pgTable('user_model_settings', {
  userId: text('user_id').primaryKey(),
  primaryModel: text('primary_model').notNull(),
  // text[] for a homogeneous ordered string list — direct string[] typing,
  // same precedent as company.techStack (schema.ts:61).
  fallbackModels: text('fallback_models').array().notNull().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```
Note on D-06: the decision's intent is "no version column" — the ARCHITECTURE research (which D-06 resolves) ships `createdAt` + `updatedAt`; `createdAt` matches the every-table repo convention. If the planner reads D-06 strictly as "`updatedAt` only", omit `createdAt` — but the repo has no table without it; recommend including both.

**Query module** (`src/lib/db/queries/userModelSettings.ts`) — named exports, never try/catch, no `db.transaction()` (house convention, `runs.ts` L15-18):
```typescript
import { eq } from 'drizzle-orm';
import { db } from '../index';
import { userModelSettings } from '../schema';

// REG-05: absence is a falsy value (undefined/null), never a throw — the
// Phase 16 resolver maps "no row" to the FAST_MODEL_ID default chain.
export async function getModelSettingsForUser(userId: string) {
  return db.query.userModelSettings.findFirst({
    where: eq(userModelSettings.userId, userId),
  });
}

// Pitfall 9: full-value atomic upsert — every save writes the COMPLETE chain,
// never a merge of the current row + a partial change (no read-modify-write).
export async function upsertModelSettings(input: {
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
Verified: `db.query.<table>.findFirst` works because `src/lib/db/index.ts` passes `schema` to `drizzle()` (`drizzle({ client: sql, schema })`) — the relational query API is configured. Alternative in-repo form: `db.select().from(userModelSettings).where(eq(...))` + `rows[0]` (exactly `getRunById`, `runs.ts:36-38`). Both HIGH confidence; pick one.

### Pattern 2: Vendored generated catalog + pure filter functions (CAT-01..04)

**What:** A dev-machine script shells `opencode models --verbose`, trims each record to UI-needed fields, writes a committed JSON; pure functions in `catalog.ts` filter it to servable Anthropic models and map slugs → raw provider IDs. No runtime fetch — the snapshot is imported at render/build time (Vercel-safe; Pitfall 8).

**Verified `opencode models --verbose` output shape** (executed 2026-08-02, opencode 1.18.10 — 1130 JSON records):
```
anthropic/claude-sonnet-4-6          ← header line: provider/id, non-JSON — script must skip it
{
  "id": "claude-sonnet-4-6",         ← RAW provider ID, no prefix (the DB's storage format!)
  "providerID": "anthropic",
  "name": "Claude Sonnet 4.6",
  "family": "claude-sonnet",
  "api": { "id": "claude-sonnet-4-6", "url": "", "npm": "@ai-sdk/anthropic" },
  "status": "active",
  "cost": { "input": 3, "output": 15, "cache": { "read": 0.3, "write": 3.75 } },
  "limit": { "context": 1000000, "output": 128000 },
  "capabilities": { ... }
}
```
Key facts for the script: records are **multi-line pretty JSON on stdout**, each preceded by a `provider/id` header line at column 0; the record's `id` is already the raw provider ID (no `anthropic/` prefix); `api.url === ""` means vendor-default endpoint (directly servable from Vercel) vs a custom URL (opencode/OpenRouter/gateway proxy — NOT servable); `api.npm` is the AI SDK package that serves the model. Script must parse defensively: skip non-JSON lines, tolerate missing fields, and keep working if the CLI surface shifts (STACK.md version-compat note).

**Trimmed snapshot field set** (D-08 discretion, per research: name, family, cost, context/output limits, status, `api.npm`, `api.url`):
```typescript
// src/lib/models/catalog.json (generated; ~1130 records × ~250B ≈ 100-280KB)
{
  "generatedAt": "2026-08-02T…Z",            // Phase 17 "last synced" display
  "models": [
    {
      "id": "claude-sonnet-4-6",              // raw provider id
      "providerID": "anthropic",
      "name": "Claude Sonnet 4.6",
      "family": "claude-sonnet",
      "status": "active",
      "api": { "npm": "@ai-sdk/anthropic", "url": "" },
      "cost": { "input": 3, "output": 15 },
      "limit": { "context": 1000000, "output": 128000 }
    }
  ]
}
```

**Pure catalog module** (`src/lib/models/catalog.ts`) — the allowlist is the gate (D-03), the snapshot is the menu:
```typescript
import type catalogJson from './catalog.json';
export type CatalogModel = (typeof catalogJson)['models'][number];
export type ModelCatalog = { generatedAt: string; models: CatalogModel[] };

// D-02/D-03: THE GATE — hand-curated, roster-verified raw provider IDs.
// Roster check (GET /v1/models) executed 2026-08-02: claude-sonnet-4-6 VERIFIED;
// claude-haiku-4-5 NOT on roster (only dated claude-haiku-4-5-20251001) → per
// D-02's gate it ships only if the execution-time re-verify passes; default is
// sonnet-only. Adding a model = code change + deploy + roster re-verify.
export const ANTHROPIC_ALLOWLIST: readonly string[] = ['claude-sonnet-4-6'];

// Pitfall 1: provider-aware slug→raw-ID mapping. Filter by prefix BEFORE
// stripping so 'opencode/*' gateway models can never collapse onto a real ID.
export function opencodeSlugToModelId(slug: string): string | null {
  if (!slug.startsWith('anthropic/')) return null; // 'opencode/…', 'openrouter/…' → unusable
  return slug.slice('anthropic/'.length);          // 'anthropic/claude-sonnet-4-6' → 'claude-sonnet-4-6'
}

// CAT-03: snapshot → servable (Anthropic, active) → allowlist-intersected raw IDs.
export function getAllowlistedServableIds(catalog: ModelCatalog): string[] {
  return catalog.models
    .filter((m) => m.providerID === 'anthropic' && m.status !== 'deprecated')
    .map((m) => m.id)
    .filter((id): id is string => ANTHROPIC_ALLOWLIST.includes(id));
}
```
Design notes for the planner: the snapshot's `id` is already raw, so the pure path is providerID-filter → allowlist-intersect; `opencodeSlugToModelId` exists for any slug-shaped input (future UI, header lines, tests) and encodes the strip-after-filter invariant (Pitfall 1). The dated-ID exclusion is automatic because dated IDs are not in the allowlist. Keep all three functions pure (no imports of `db`, `env`, `ai`) so tests run mock-free under D-16.

### Pattern 3: `agent_run` audit columns (REG-04)

**What:** Two nullable columns on the existing `agentRun` table; `CreateRunInput` gains matching optional fields **and** the explicit `.values()` map in `runs.ts:20-31` gains the two keys (adding only the interface silently does nothing — the insert enumerates columns).

```typescript
// schema.ts — inside agentRun pgTable (after hypotheses, before createdAt):
// D-05 (v1.3): durable "which model ran" truth (D-14) — populated by Phase 16.
// Nullable: pre-milestone rows are NULL (backfill impossible — PITFALLS recovery).
modelUsed: text('model_used'),
modelChain: jsonb('model_chain').$type<string[]>(),
```
```typescript
// runs.ts — CreateRunInput gains:
//   modelUsed?: string;         // raw provider ID that actually served (REG-04)
//   modelChain?: string[];      // resolved ID list snapshot captured at run start (D-05)
// and createRun's .values({...}) map gains:
//   modelUsed: input.modelUsed,
//   modelChain: input.modelChain,
```
Phase 15 writes nothing into these columns (Phase 16 populates them at run end) — but the insert seam must accept them now so Phase 16's change is a one-line call-site edit, not a schema/query rewrite.

### Anti-Patterns to Avoid (Phase-15-relevant)

- **Listing every opencode model as selectable** — the committed snapshot carries ALL providers (D-07) but the filter/render path must only ever expose allowlist∩snapshot. The 1130-row payload never reaches the UI (Phase 17 concern; the filter functions land now, tested).
- **Storing display metadata in the DB** — the DB stores plain model IDs only; the catalog is the join for labels (ARCHITECTURE Anti-pattern 4).
- **Saving with a `/` in the value** — the raw-ID invariant (Pitfall 1): `anthropic/...` and `opencode/...` never reach `user_model_settings`. The allowlist ∩ filter enforces it; the upsert query is the last line of defense (a guard/assert is optional, not required).
- **Repeating "first text[] column in the repo" in code comments** — false; `company.techStack` is the precedent. Cite `techStack`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic per-user upsert | Read-modify-write (`SELECT chain; merge; UPDATE`) | `insert ... onConflictDoUpdate` (the `recentlyViewed` pattern) | Pitfall 9: read-modify-write reintroduces the lost-update race the upsert exists to kill; full-value upsert is a single atomic statement. |
| Model-list fetch at request time | `exec`/`spawn` opencode in a route/Server Component | Committed snapshot + dev-time `models:fetch` script | Pitfall 8: no binary in Vercel serverless; request-time shell-out throws (and is RCE-adjacent). Phase 18 greps zero `exec\|spawn\|child_process` in `src/`. |
| Runtime opencode SDK | `@opencode-ai/sdk` | CLI snapshot | The SDK needs a running `opencode serve` host — unreachable from Vercel (STACK.md, verified). |
| Raw models.dev registry as source | `https://models.dev/api.json` fetched per request | Committed snapshot | Unfiltered (5,939 models vs opencode's 1,130 servable); 3.3MB payload; opencode's filtering is the point (STACK.md alternatives). |
| JSON-blob per-user settings column | `jsonb` holding the whole settings object | Typed columns (`primaryModel` text + `fallbackModels` text[]) | Loses per-field type safety and the `updated_at` discipline (ARCHITECTURE Pattern-1 tradeoffs; D-04 locked text[]). |

**Key insight:** every "don't" here is a verified trap from the milestone research (PITFALLS 1, 7, 8, 9) — the phase's core discipline is *"the allowlist is the gate, the snapshot is the menu, the DB stores raw IDs, and no code in `src/` ever shells out."*

## Common Pitfalls

### Pitfall 1: Model-ID drift — opencode slug ≠ AI SDK model string (CRITICAL)
**What goes wrong:** Saving `anthropic/claude-sonnet-4-6` verbatim (or a dated `claude-sonnet-4-5-20250929` snapshot ID) → every run 404s — the v1.1 dated-ID incident repeating through user config.
**Why it happens:** Three catalogs with different ID grammars (opencode slugs / AI SDK raw IDs / live API roster), and `anthropic('id')` does zero client-side validation (verified).
**How to avoid:** Store raw provider IDs only (D-04); filter by provider prefix before stripping (Pitfall-1-invariant, in `opencodeSlugToModelId`); the allowlist is the gate; roster re-verify standing practice. **This phase** locks the storage format and the mapping function; **Phase 17** must only offer allowlist∩snapshot rows.
**Warning signs:** any saved value containing `/`; any `split('/')[1]` without a provider check; a model in the opencode list that 404s live.

### Pitfall 2: `agent_run` audit columns missing → "which model ran" unanswerable from the DB
**What goes wrong:** If REG-04 columns don't land now, Phase 16 cannot persist the durable truth (D-14: DB is truth, Langfuse is mirror) — failover runs leave only trace evidence.
**Why it happens:** The audit shape is a persistence decision; retrofitting it after Phase 16's loop ships is a mid-milestone schema change.
**How to avoid:** Land `model_used`/`model_chain` in this phase (nullable, no backfill — pre-milestone rows stay NULL); extend `CreateRunInput` AND the `.values()` map.
**Warning signs:** Phase 16 plan references columns that don't exist; `runs.ts` interface gains fields the insert ignores.

### Pitfall 3: Snapshot script breaks on opencode CLI drift or absence
**What goes wrong:** `opencode models --verbose` output format shifts, or opencode isn't installed → the script fails and the committed snapshot goes stale.
**Why it happens:** CLI surface is not an API contract; `~/.opencode/bin/opencode` may be missing on a fresh machine.
**How to avoid:** Parse defensively (skip non-JSON header lines, tolerate missing fields); binary resolution `OPENCODE_BIN` → `which opencode` → `~/.opencode/bin/opencode`; fail with a clear message when absent — the committed snapshot stays usable (the app only needs the JSON).
**Warning signs:** script throws on a valid-but-reshaped CLI output; snapshot regenerated with zero records.

### Pitfall 4: `exec|spawn` in `src/` tripping the Phase 18 gate
**What goes wrong:** The refresh script placed in `src/scripts/` (alongside `seed.ts`) makes Phase 18's "grep zero `exec|spawn|child_process` in `src/`" fail — the gate exists to prove no request-time subprocess.
**Why it happens:** `src/scripts/seed.ts` sets the tsx-script convention; the refresh script naturally follows it.
**How to avoid:** Put the script at **repo-root `scripts/refresh-model-catalog.ts`** (ROADMAP's literal path) with `"models:fetch": "tsx scripts/refresh-model-catalog.ts"`. This is the one place Phase 15 deviates from the `src/scripts/` convention, deliberately.
**Warning signs:** `grep -r "exec|spawn|child_process" src/` returns hits at phase close.

### Pitfall 5: Missing row surfaces as an error instead of the default (REG-05)
**What goes wrong:** `getModelSettingsForUser` throws (or the caller treats absence as misconfiguration) → a user with no settings blocks the Analyze run.
**Why it happens:** The query module or its caller forgets that "no settings row" is a *valid* state meaning "use the default chain".
**How to avoid:** The query module returns absence (undefined/null), never throws, never logs an error (house convention); document REG-05 in the module comment; Phase 16's resolver maps absence → `[anthropic(FAST_MODEL_ID)]`.
**Warning signs:** any `getModelSettingsForUser` caller that gates on "row exists".

### Pitfall 6: Dated-ID leakage into the allowlist
**What goes wrong:** `claude-haiku-4-5-20251001` (the only Haiku 4.5 form on the live roster today) gets curated into the allowlist — it works now and 404s when Anthropic retires it.
**Why it happens:** The live roster check surfaces the dated form; "it exists in the API" reads as "safe to pin".
**How to avoid:** The allowlist contains **undated aliases only** (`claude-sonnet-4-6`); dated IDs are the Pitfall-1 class. Haiku 4.5 stays out until Anthropic exposes an undated alias — per D-02's gate, no invented IDs.
**Warning signs:** allowlist contains a `-2025xxxx`/`-2026xxxx` suffix.

## Code Examples

Verified patterns from official/repo sources:

### Common Operation 1: Atomic full-value upsert (REG-03)
```typescript
// Source: mirrors src/lib/db/queries/recentlyViewed.ts:14-22 (verified against
// drizzle-orm@0.45.2 installed). Target is the single-column PK.
await db
  .insert(userModelSettings)
  .values({ userId, primaryModel, fallbackModels, updatedAt: new Date() })
  .onConflictDoUpdate({
    target: userModelSettings.userId,
    set: { primaryModel, fallbackModels, updatedAt: new Date() },
  });
```

### Common Operation 2: Snapshot script core (CAT-01) — dev-time, repo-root `scripts/`
```typescript
// scripts/refresh-model-catalog.ts — run via npm run models:fetch (tsx).
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// Binary resolution (research STACK.md): OPENCODE_BIN → which → ~/.opencode/bin/opencode
function resolveOpencodeBin(): string { /* ... */ }

const raw = execFileSync(resolveOpencodeBin(), ['models', '--verbose'], { encoding: 'utf8' });
// Records are multi-line pretty JSON, each preceded by a 'provider/id' header
// line at column 0 — skip non-JSON lines, accumulate parsed records.
const models = raw
  .split('\n')
  .filter((line) => line.startsWith('{'))
  .map((line) => JSON.parse(line))
  // trim to UI-needed fields (D-07/D-08); tolerates missing fields
  .map((m) => ({
    id: m.id, providerID: m.providerID, name: m.name, family: m.family,
    status: m.status,
    api: { npm: m.api?.npm, url: m.api?.url ?? '' },
    cost: { input: m.cost?.input ?? 0, output: m.cost?.output ?? 0 },
    limit: { context: m.limit?.context, output: m.limit?.output },
  }));
const snapshot = { generatedAt: new Date().toISOString(), models };
mkdirSync(join(process.cwd(), 'src/lib/models'), { recursive: true });
writeFileSync(join(process.cwd(), 'src/lib/models/catalog.json'), JSON.stringify(snapshot, null, 2));
// ~1130 records × ~250B ≈ 100-280KB committed file.
```

### Common Operation 3: DB smoke query after `drizzle-kit push` (verification)
```bash
# Apply the schema change (D-01): loads .env.local per drizzle.config.ts:5
npx drizzle-kit push
# Smoke query — mirror seed.ts's dotenv-first + dynamic-import pattern:
#   config({ path: '.env.local' });  then  await import('./src/lib/db/queries/userModelSettings')
# and assert: table exists (select *), upsert twice (insert then onConflict update),
# getModelSettingsForUser('no-such-user') returns undefined (REG-05 absence).
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single hardcoded model (`FAST_MODEL_ID` in `runAgent.ts`) | Per-user `user_model_settings` row (Phase 15) + chain resolution (Phase 16) | v1.3 (this phase starts it) | "Which model ran" becomes per-user configurable + durably auditable (D-14). |
| Dated snapshot IDs (`claude-sonnet-4-20250514` → v1.1 404 incident) | Undated aliases in the allowlist (`claude-sonnet-4-6`), roster re-verified | 2026-08-01 (v1.1) + standing practice | The 404 class is designed out: allowlist gate + failover backstop (Phase 16). |
| No model audit on `agent_run` | `model_used` text + `model_chain` jsonb columns | Phase 15 | DB alone answers "which model ran" — Langfuse stays the visual mirror (D-14). |

**Deprecated/outdated:**
- **`TooManyRequestsError` import** — does not exist in ai@7.0.45 (verify via `node_modules/ai/dist/index.d.ts`); classify 429 by `statusCode === 429`. Phase 16 concern, but don't let it leak into Phase 15 type imports.
- **`@opencode-ai/sdk`** — rejected for this app (needs a running serve host); the CLI snapshot supersedes it.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `claude-haiku-4-5` will remain off the live roster through Phase 15 execution, so the allowlist ships sonnet-only | Summary / Pattern 2 | LOW — the D-02 gate re-verifies at execution; if it appears, adding it is a one-line change. The research finding is authoritative as of 2026-08-02. |
| A2 | `drizzle-kit push` applies the new table + 2 nullable columns non-destructively without a TTY prompt | Pattern 1 / Validation | LOW — push is the established flow (D-01, empty `_journal.json`); a new table + nullable columns are additive. If a confirm prompt blocks CI, use `--force` (verify against drizzle-kit 0.31 docs before relying on the flag). |
| A3 | `db.query.userModelSettings.findFirst` (relational query API) is available and returns `undefined` on absence | Pattern 1 | LOW — `drizzle({ client, schema })` enables it (verified `db/index.ts`); absence return shape (undefined vs null) is a minor type detail — the contract is "falsy absence, never throw". |
| A4 | The trimmed snapshot at ~250B/record ≈ 100-280KB meets the "~100-200KB" research estimate | Pattern 2 | LOW — size is a nicety (D-07), not a gate; server-side only. |
| A5 | jsonb `.$type<string[]>()` on `model_chain` is acceptable (vs plain jsonb like `usageTokens`) | Pattern 3 | LOW — pure typing sugar; either compiles. Planner picks one. |

**No compliance, retention, or security-standard claims are assumed** — see Security Domain; everything above is derived from verified sources.

## Open Questions

1. **Haiku 4.5 roster status at execution time (D-02 gate)**
   - What we know: as of 2026-08-02, live `GET /v1/models` has `claude-sonnet-4-6` but **not** `claude-haiku-4-5` (only dated `claude-haiku-4-5-20251001`).
   - What's unclear: whether Anthropic adds an undated Haiku alias before Phase 15 executes (unlikely in days).
   - Recommendation: plan the allowlist as `['claude-sonnet-4-6']`; include an execution-time roster re-verify task (D-02's own mechanism) that adds haiku-4-5 **only if** the live check passes; otherwise the roster ships sonnet-only and Haiku 4.5 is deferred (surfaces to the user at plan review — this is a locked-decision content change, not a decision reversal).

2. **`createdAt` on `user_model_settings` (D-06 reading)**
   - What we know: D-06 says "`updatedAt` only"; the ARCHITECTURE research the decision resolves ships both `createdAt` + `updatedAt`; every existing repo table has `createdAt`.
   - What's unclear: strict vs. intent reading of D-06.
   - Recommendation: include `createdAt` (repo convention; harmless; matches the research shape). Planner may omit if strict reading preferred — note it in the plan so the executor knows which.

3. **`db:push` npm script nicety (Claude discretion)**
   - What we know: D-01 leaves it optional.
   - Recommendation: add `"db:push": "drizzle-kit push"` — cheap DX win, no behavior change.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| opencode CLI | `models:fetch` snapshot generation (CAT-01) | ✓ (at `~/.opencode/bin/opencode`, on PATH) | 1.18.10 | Script fails with a clear message; committed snapshot stays usable (by design) |
| Node.js | tsx script + drizzle-kit + vitest | ✓ | 22.x (v22.23.1 per CLAUDE.md; `engines` 22.x) | — |
| Neon Postgres (DATABASE_URL in `.env.local`) | `drizzle-kit push` + smoke query | ✓ (existing DB, all Phase 1-14 tables) | — | — |
| `drizzle-kit` | schema apply (D-01) | ✓ | 0.31.10 | — |
| `tsx` | script runner + smoke query | ✓ | 4.23.1 | — |
| `vitest` | pure-function tests | ✓ | 4.1.10 | — |
| Anthropic `GET /v1/models` | D-02 roster re-verify (execution task) | ✓ (live check succeeded in this research) | — | Roster absent → allowlist stays sonnet-only (no invented IDs) |
| `TEST_DATABASE_URL` (optional) | integration tests for the upsert (if used) | ? (repo convention; tests `describe.skip` when absent) | — | Skip integration tests; rely on push + smoke query + code review |

**Missing dependencies with no fallback:** none — every tool Phase 15 needs is installed and verified on this machine.

## Validation Architecture

> `workflow.nyquist_validation: true` in `.planning/config.json` — REQUIRED section.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (installed) |
| Config file | `vitest.config.ts` (node env, `include: ['src/**/*.test.ts']`, `@` → `./src`) |
| Quick run command | `npx vitest run src/lib/models/catalog.test.ts` |
| Full suite command | `npm test` (existing 245-test suite must stay green) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REG-01/02/03 | Table + query module exist and upsert atomically | integration (TEST_DATABASE_URL-gated, `describe.skip` without it — the `enrichment.integration.test.ts` pattern) | `npx vitest run src/lib/db/queries/userModelSettings.integration.test.ts` | ❌ Wave 0 (new) |
| REG-01 | Schema applies | contract | `npx drizzle-kit push` (exit 0, applies `user_model_settings` + 2 agent_run columns) | — (command) |
| REG-03 | Atomic full-value upsert semantics (no half-merge under concurrent saves) | integration | `Promise.all` of two upserts with different chains → row equals one complete chain, never a mix | ❌ Wave 0 (in integration test) |
| REG-04 | `createRun` accepts + persists `modelUsed`/`modelChain` | integration (optional) + code review | `npx vitest run src/lib/db/queries/runs.test.ts` (extend existing) | ❌ extend |
| REG-05 | Absence → falsy, never throws | integration | `getModelSettingsForUser('no-such-user')` → undefined | ❌ Wave 0 (in integration test) |
| CAT-01 | Script regenerates valid snapshot | smoke (manual/execution) | `npm run models:fetch` → `catalog.json` valid JSON, non-empty, contains `anthropic/claude-sonnet-4-6`-derived record, `generatedAt` present | ❌ (script itself is Wave 0) |
| CAT-02 | No runtime opencode dependency | grep gate | `grep -rE 'exec\|spawn\|child_process' src/` → zero hits | — (command) |
| CAT-03 | Pure filters: slug mapping + allowlist intersect | unit (pure, no mocks — D-16) | `npx vitest run src/lib/models/catalog.test.ts` | ❌ Wave 0 (new) |
| CAT-04 | Catalog ships with the build | contract | `npm run build` passes (catalog.ts imports catalog.json server-side; `resolveJsonModule` on) | — (command) |

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/models/catalog.test.ts` (fast, pure)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green + `drizzle-kit push` applied + `models:fetch` regenerated snapshot committed + `grep exec|spawn` clean before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/models/catalog.test.ts` — covers CAT-03 (REQ: `opencodeSlugToModelId` anthropic→raw, `opencode/*`→null, non-anthropic→null; filter: anthropic-only, no dated IDs, allowlist intersect, no `opencode/` leakage)
- [ ] `src/lib/db/queries/userModelSettings.integration.test.ts` — covers REG-01/03/05 (TEST_DATABASE_URL-gated; insert → upsert-update → full-value overwrite; concurrent upserts; absence → undefined)
- [ ] Extend `src/lib/db/queries/runs.test.ts` — `createRun` persists `modelUsed`/`modelChain` when provided (integration-gated or via existing mock seam)
- [ ] No framework gaps — vitest.config.ts, tsconfig paths, and all packages already exist

## Security Domain

> `workflow.security_enforcement: true`, ASVS level 1 — REQUIRED section.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (no auth surface in Phase 15) | — future phases gate via existing `requireStaffAccess()` |
| V3 Session Management | no (no session code in Phase 15) | — |
| V4 Access Control | partial | Query module is userId-keyed by contract; the Phase 17 Server Action runs under `requireStaffAccess()`. No route in this phase. |
| V5 Input Validation | yes | Typed TS input shape on `upsertModelSettings`; zod validation lands at the Phase 17 Server Action boundary (REQ pattern: `actions/reviews.ts`). No free-form user input reaches Phase 15 code. |
| V6 Cryptography | no (no keys stored — only model IDs; no crypto introduced) | — |

### Known Threat Patterns for this phase
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Request-time subprocess (`exec` opencode) | DoS / Tampering (RCE-adjacent) | Script lives at repo-root `scripts/`, never imported by `src/`; Phase 18 grep gate proves zero `exec\|spawn\|child_process` in `src/` (PITFALLS security table) |
| API-key exfiltration via opencode `/config/providers` | Information Disclosure | The refresh script reads **only** `opencode models` (secret-free, verified); never `/config/providers` (returns the raw key — FEATURES.md anti-feature, empirically verified) |
| Raw catalog leaked to the client bundle | Information Disclosure | Snapshot is imported server-side only (D-07); filter functions run server-side; no client consumer in Phase 15, and Phase 17 must keep it server-only |
| Stored-secret risk (future per-user keys) | Elevation / Spoofing | Phase 15 stores **no keys — only model IDs**; per-user provider keys (if ever) need encryption — flagged as explicit future anti-pattern (PITFALLS security table) |
| Model-ID tampering → unrunnable config | Tampering | Allowlist gate (D-03) + raw-ID invariant (Pitfall 1) + zod at the Phase 17 boundary; runtime 404 classification (Phase 16) is the backstop |
| Repudiation of "which model ran" | Repudiation | Durable `agent_run.model_used`/`model_chain` columns (D-14: DB is truth, Langfuse is mirror) |

## Sources

### Primary (HIGH confidence)
- **Milestone research (authoritative, 2026-08-02):** `.planning/research/SUMMARY.md` (conflicts 1-7 + recommendations, phase-A mapping, flags), `STACK.md` (opencode CLI mechanics, snapshot details, `onConflictDoUpdate` verification), `ARCHITECTURE.md` (Patterns 1/2/3, schema/query examples, build order), `PITFALLS.md` (pitfalls 1/5/7/8/9/11 + security table + recovery), `FEATURES.md` (anti-features, `/config/providers` key-leak) — all read in full
- **Locked decisions:** `15-CONTEXT.md` (D-01..D-08), `15-DISCUSSION-LOG.md` (audit trail), `.planning/STATE.md`, `.planning/PROJECT.md` (D-14/D-15/D-16 key decisions)
- **Codebase (on-disk reads):** `src/lib/db/schema.ts` (recentlyViewed:136-154, agentRun:233-246, techStack:61 text[] precedent, jsonb precedents), `src/lib/db/queries/recentlyViewed.ts` (verified onConflictDoUpdate), `src/lib/db/queries/runs.ts` (createRun explicit values map), `src/lib/db/index.ts` (drizzle schema config), `src/lib/env.ts` (optional-key degrade pattern), `src/lib/agents/runAgent.ts` (FAST_MODEL_ID), `src/lib/agents/runAgent.test.ts` + `vitest.config.ts` (D-16 harness), `src/scripts/seed.ts` (dotenv-first tsx pattern), `src/lib/db/queries/enrichment.integration.test.ts` (TEST_DATABASE_URL-gated describe.skip pattern), `drizzle.config.ts`, `drizzle/meta/_journal.json` (empty entries — D-01 confirmed), `package.json`, `tsconfig.json` (resolveJsonModule)
- **Live verification executed 2026-08-02:** `opencode models --verbose` (opencode 1.18.10 — 1130 JSON records, header-line-per-record shape, `claude-sonnet-4-6` record with `url:""`/`npm:"@ai-sdk/anthropic"`); `GET /v1/models` (11 models; `claude-sonnet-4-6` present, `claude-haiku-4-5` **absent**, dated `claude-haiku-4-5-20251001` present)

### Secondary (MEDIUM confidence)
- `@opencode-ai/sdk@1.18.11` / `@opencode-ai/plugin@1.18.11` npm existence — from research STACK.md (rejected for this app; not installed locally)

### Tertiary (LOW confidence)
- None — every claim used by the planner is either research-file-verified, on-disk-verified, or live-executed. The two discretionary naming choices (snapshot path, module names) are recommendations with rationale, not external-source claims.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — zero new packages; every tool verified installed + live-executed
- Architecture: **HIGH** — all integration points read from on-disk source; migration apply flow confirmed (D-01); upsert pattern verified against installed drizzle-orm 0.45.2
- Pitfalls: **HIGH** — milestone PITFALLS.md is SDK-source-verified; the D-02 roster finding was live-verified in this research
- **One flagged correction:** CONTEXT.md's "first text[] column in the repo" is factually wrong (`company.techStack` precedent exists) — planner must not propagate it into code comments

**Research date:** 2026-08-02
**Valid until:** 2026-08-09 (roster/CLI drift risk — opencode CLI surface and Anthropic roster can shift; re-verify `models:fetch` after any opencode upgrade per STACK.md)
