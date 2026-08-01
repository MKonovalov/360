# Phase 15: Model Registry Foundation + Persistence - Context

**Gathered:** 2026-08-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Per-user AI model preferences persist durably — one `user_model_settings` row per Clerk user storing raw provider IDs via atomic full-value upsert — `agent_run` gains durable "which model served" audit columns (`model_used` + `model_chain`), and a committed, provider-filtered model catalog gives the app its servable-models source with zero runtime opencode dependency. This phase also resolves the migration-apply-flow confirmation (the one MEDIUM research flag) before any schema change lands.

Delivers: REG-01..05, CAT-01..04. Nothing about the Settings UI (Phase 17) or the failover loop (Phase 16) lands here.

</domain>

<decisions>
## Implementation Decisions

### Migration Apply Flow (flagged MEDIUM item — RESOLVED)
- **D-01:** Keep `drizzle-kit push` — `schema.ts` stays the source of truth, applied via push. No migration files or generate+commit workflow introduced (repo has zero committed migrations today; single-dev internal tool with seed-data DB; nothing to roll back that a re-seed doesn't fix). `drizzle/meta/_journal.json` stays as-is. A `db:push` npm script is a Claude-discretion nicety, not a requirement.

### Model Roster / Allowlist
- **D-02:** Curated small roster = **`claude-sonnet-4-6` + `claude-haiku-4-5`**. Both must be roster-verified against live `GET /v1/models` during Phase 15 before appearing in the catalog. Opus 4.5 explicitly deferred (user declined). `claude-sonnet-4-6` remains the no-settings default (REG-05 preserves existing behavior).
- **D-03:** The allowlist is a **hand-curated code constant** in `src/lib/models/` (explicit array of verified raw provider IDs), independent of the opencode snapshot. The snapshot is a menu; the allowlist is the gate. Adding a model = code change + deploy + roster re-verify (standing maintenance, per STATE.md).

### Schema Shape
- **D-04:** `user_model_settings.fallback_models` = **`text[]`** (`text('fallback_models').array()`), the research-recommended resolution of conflict #5. First array column in the repo — intentional; direct `string[]` typing, no JSON casting.
- **D-05:** `agent_run` audit columns (REG-04): **`model_used` = text** (raw provider ID that actually served) + **`model_chain` = jsonb** storing the **resolved ID list snapshot** captured at run start (e.g. `["claude-sonnet-4-6","claude-haiku-4-5"]`). Resolved-chain shape chosen over per-attempt detail — `model_used` + `model_chain` answer "which model ran" from the DB alone (D-14 durable-truth rule); attempts detail lives in Langfuse spans. Phase 16 populates these.
- **D-06:** `user_model_settings` carries **`updatedAt` only** (`timestamp` defaultNow, overwritten on each upsert). No version column — the atomic full-value upsert already prevents lost updates; versioning adds schema with no consumer in v1.3.

### Catalog Snapshot
- **D-07:** The committed snapshot carries **all providers, trimmed to UI-needed fields** (~100–200KB, not the 3.3MB raw registry). Keeps the multi-provider growth path (adding OpenAI later = install SDK + extend allowlist; no snapshot change) and makes CAT-03's filter function meaningful (provider filter → strip prefix → intersect allowlist). Server-side read only, never shipped to the client bundle.
- **D-08:** Snapshot file location and module naming (e.g. `src/data/opencode-models.json` vs `src/lib/models/catalog.json`; `registry.ts` vs `modelConfig.ts`; filter fn names) are **Claude's discretion** — pick one consistent set (research conflict #7), matching existing `src/lib/` conventions. Script name `scripts/refresh-model-catalog.ts` per ROADMAP.

### Claude's Discretion
- Snapshot file path + module naming (conflict #7 resolution).
- `opencodeSlugToModelId` / filter-function exact names and signatures (CAT-03) — pure, provider-filtered, tested (D-16).
- `db:push` npm script nicety; `generatedAt` field on the snapshot for the Phase 17 "last synced" display.
- Exact trimmed field set for the snapshot (name, family, cost, context/output limits, status, `api.npm`, `api.url` per research).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` — Phase 15 goal, success criteria (5 items), requirements REG-01..05 + CAT-01..04, depends-on Phase 14
- `.planning/REQUIREMENTS.md` — REG-01 through REG-05, CAT-01 through CAT-04 definitions (§ Model registry + persistence, § Model catalog from opencode)
- `.planning/STATE.md` — Blocker/Concern: migration apply flow gate; allowlist curation standing practice

### Research (the decisions above resolve its flags/conflicts)
- `.planning/research/SUMMARY.md` — Recommended Stack, Architecture Approach (Patterns 1/2/3), Conflicts/Open Decisions 1–7 (recommendations adopted), Research Flags
- `.planning/research/PITFALLS.md` — Pitfall 1 (raw provider ID invariant: saved values never contain `/`), Pitfall 5 (audit columns), Pitfall 7 (filter fn), Pitfall 8 (no runtime opencode / degradation helper), Pitfall 9 (atomic full-value upsert), Pitfall 11 (verify against installed types before coding)
- `.planning/research/ARCHITECTURE.md` — component breakdown: `user_model_settings` table, `userModelSettings` query module, vendored generated catalog, allowlist-filter approach
- `.planning/research/STACK.md` — Drizzle `userModelSettings` table shape, `onConflictDoUpdate` upsert, snapshot fetch details (`opencode models --verbose`, binary resolution)
- `.planning/research/FEATURES.md` — catalog/registry feature expectations (P1/P2 split), "last synced" display, agent-agnostic registry goal

### Codebase patterns to follow
- `src/lib/db/queries/recentlyViewed.ts` — the exact `onConflictDoUpdate` upsert + Clerk-userId-no-FK pattern to mirror
- `src/lib/db/schema.ts` — `recentlyViewed` (lines ~136-154), `agentRun` (lines ~233-246, gains model_used/model_chain), jsonb precedents (`usageTokens`, `evidenceAppendix`, `importBatch.mapping`)
- `src/lib/db/queries/runs.ts` — `createRun` input shape (Phase 15 adds model_used/model_chain to the insert; Phase 16 populates)
- `.planning/PROJECT.md` — Key Decisions table: D-14 (DB is durable truth, Langfuse mirror), D-15 (degrade gracefully), D-16 (Vitest pure functions only, zero live calls)

### Codebase maps (CAUTION — stale)
- `.planning/codebase/STACK.md`, `ARCHITECTURE.md`, `INTEGRATIONS.md` — analyzed 2026-07-22, describe the retired Astro/Sanity stack. Treat as historical; current stack is Next.js 16 + Neon Postgres + Drizzle + Clerk.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `queries/recentlyViewed.ts` — atomic `onConflictDoUpdate` upsert keyed by Clerk `userId` (no FK); the template for `userModelSettings` get + upsert (REG-03)
- `queries/runs.ts` — `createRun(input)` inserts into `agentRun`; extend `CreateRunInput` with `modelUsed`/`modelChain` so REG-04 columns are written from the same seam Phase 16 uses
- `src/lib/db/index.ts` — single `drizzle({ client: sql(neon(env.DATABASE_URL)), schema })` instance; new table auto-registers via `schema`
- `drizzle.config.ts` + `drizzle-kit push` — the confirmed apply flow (D-01); no `migrations/` folder to maintain

### Established Patterns
- Per-user rows: `userId: text` no-FK (Clerk external), unique constraint + `onConflictDoUpdate` full-value upsert — never read-modify-write (Pitfall 9)
- Query modules: named exports, **never try/catch**, no `db.transaction()` (neon-http has none); the caller owns error handling (runs.ts house comment)
- jsonb for agent-output-shaped data (`usageTokens`, `evidenceAppendix`); `text[]` now adopted for the homogeneous fallback list (D-04)
- Vitest: co-located `*.test.ts`, pure functions only, no mocking library, zero live calls (D-16) — `opencodeSlugToModelId` and the catalog filter are the natural new test targets
- Env: only `ANTHROPIC_API_KEY` + `FIRECRAWL_API_KEY`; optional keys degrade gracefully (D-15)

### Integration Points
- `src/lib/db/schema.ts` — add `userModelSettings` pgTable + extend `agentRun` with `model_used`/`model_chain` columns (D-04/D-05)
- `src/lib/db/queries/userModelSettings.ts` — new module: `getModelSettingsForUser(userId)` + `upsertModelSettings(...)` (REG-03)
- `src/scripts/` (or repo root `scripts/`) — new `refresh-model-catalog.ts` dev-time script → committed snapshot (CAT-01/CAT-02); add `models:fetch` npm script
- `src/lib/models/` — new catalog module: allowlist constant (D-03), typed snapshot accessor, pure filter/map functions (CAT-03/CAT-04)
- `package.json` — `models:fetch` script wiring (and optionally `db:push`)

</code_context>

<specifics>
## Specific Ideas

- **"First `text[]` column in the repo"** — deliberate: homogeneous ordered model-ID list, direct `string[]` typing. Flagged in code review as intentional, not drift.
- **Roster verification is a hard gate** — `claude-haiku-4-5` must pass live `GET /v1/models` in Phase 15; if it 404s, it's dropped from the allowlist and the roster ships with sonnet only (no invented IDs).
- No specific design references beyond the research files — standard approaches apply.

</specifics>

<deferred>
## Deferred Ideas

- **Opus 4.5 in the roster** — user declined for v1.3; adding later is a one-line allowlist change + roster re-verify (allowlist maintenance standing practice)
- **`updatedAt` + version column** — version guard rejected (no consumer in v1.3); atomic upsert already prevents lost updates. Revisit if multi-tab/multi-device edit-conflict UI ever lands
- **Per-attempt detail in `model_chain`** — rejected; Langfuse spans carry attempts detail, DB carries the resolved-chain snapshot (D-14 split)
- (Carried from research, not this discussion) Per-agent model assignment MRG-01, multi-provider MRG-02, per-model advanced settings MRG-03, team defaults MRG-04 — already recorded in `.planning/REQUIREMENTS.md` Future Requirements

</deferred>

---

*Phase: 15-Model Registry Foundation + Persistence*
*Context gathered: 2026-08-02*
