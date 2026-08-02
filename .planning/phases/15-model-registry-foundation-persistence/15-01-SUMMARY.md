---
phase: 15-model-registry-foundation-persistence
plan: 01
subsystem: database
tags: [drizzle, neon, postgres, upsert, clerk, agent_run]

# Dependency graph
requires:
  - phase: 14
    provides: Next.js + Neon Postgres + Drizzle ORM app shell, `drizzle-kit push` apply flow
provides:
  - user_model_settings table (Clerk-userId PK, raw provider IDs, atomic full-value upsert)
  - userModelSettings query module (getModelSettingsForUser + upsertModelSettings)
  - agent_run model_used/model_chain audit columns + createRun insert seam
  - Confirmed live-schema apply flow via drizzle-kit push (D-01 executed)
affects: [phase 16 failover orchestration, phase 17 settings UI, phase 18 verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Clerk-userId-PK no-FK table with onConflictDoUpdate full-value upsert (recentlyViewed precedent)"
    - "jsonb .$type<string[]>() for resolved model-chain snapshot (fieldSources precedent)"
    - "text[] .array() for homogeneous ordered model-ID list (company.techStack precedent)"
    - "TEST_DATABASE_URL-gated integration tests (enrichment.integration.test.ts pattern)"

key-files:
  created:
    - src/lib/db/queries/userModelSettings.ts
    - src/lib/db/queries/userModelSettings.integration.test.ts
  modified:
    - src/lib/db/schema.ts
    - src/lib/db/queries/runs.ts
    - src/lib/db/queries/runs.test.ts

key-decisions:
  - "D-06 intent honored: NO version column on user_model_settings (atomic upsert prevents lost updates); createdAt ships per repo convention (every table has it, research Open Question 2 recommendation)"
  - "fallbackModels comment cites company.techStack (schema.ts:61) as the text[] precedent — 'first text[] column' claim is factually wrong per research"
  - "Relational query API (db.query.userModelSettings.findFirst) used for get — verified enabled by src/lib/db/index.ts passing schema to drizzle()"
  - "drizzle-kit push --force used for non-interactive apply (flag verified against installed 0.31.10; apply is additive: 1 table + 2 nullable columns, no data-loss statements)"

patterns-established:
  - "Pattern 1: per-user row with Clerk-id PK + atomic full-value upsert — every save writes the COMPLETE chain, never read-modify-write (Pitfall 9)"
  - "Pattern 3: agent_run audit columns + explicit .values() map seam — interface change alone silently does nothing (insert enumerates columns)"

requirements-completed: [REG-01, REG-02, REG-03, REG-04, REG-05]

# Metrics
duration: 14min
completed: 2026-08-02
---

# Phase 15 Plan 01: Model Registry Persistence Foundation Summary

**Per-user AI model settings persisted via a Clerk-userId-keyed `user_model_settings` table with atomic full-value upsert (raw provider IDs, `text[]` fallbacks), plus `agent_run` `model_used`/`model_chain` audit columns and a `createRun` insert seam — with the D-01 `drizzle-kit push` apply flow executed against live Neon.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-08-02T10:52:00Z
- **Completed:** 2026-08-02T11:06:00Z
- **Tasks:** 3 (2 committed; Task 2 is command-only, DB side-effect)
- **Files modified:** 5 (1 modified + 2 modified + 2 created)

## Accomplishments
- `userModelSettings` pgTable added (user_id text PK, primary_model text notNull, fallback_models text[] notNull default [], created_at, updated_at) — Clerk userId opaque, no FK, mirroring `recentlyViewed.userId`; model IDs stored raw as the app instantiates them (Pitfall 1 invariant)
- `agentRun` gained `model_used` (text) + `model_chain` (jsonb `.$type<string[]>()`) — nullable per D-05 (pre-milestone rows stay NULL, no backfill), populated by Phase 16 (D-14 durable truth)
- `userModelSettings` query module: `getModelSettingsForUser` (falsy absence, REG-05) + `upsertModelSettings` (atomic full-value `onConflictDoUpdate` on user_id PK, Pitfall 9)
- `createRun` insert seam extended: `CreateRunInput` + explicit `.values()` map carry `modelUsed`/`modelChain` — Phase 16's population is a one-line call-site edit
- Schema applied to live Neon via `npx drizzle-kit push` (D-01 confirmed executed); live smoke query proved `user_model_settings` (5 columns) + `agent_run.model_used`/`model_chain` in `information_schema`
- Integration test (TEST_DATABASE_URL-gated) covers create → full-value overwrite → concurrent-upsert atomicity → absence; runs.test.ts extended with the REG-04 persistence case

## Task Commits

Each task was committed atomically:

1. **Task 1: Add userModelSettings table + agentRun audit columns to schema.ts** - `89cc521a` (feat)
2. **Task 2: [BLOCKING] Apply schema via drizzle-kit push + verify live DB** - no commit (command + smoke verification only; schema.ts change shipped in Task 1's commit)
3. **Task 3: userModelSettings query module + runs.ts insert seam + tests** - `b5c0c366` (feat)

**Plan metadata:** `(final docs commit)` (docs: complete plan)

## Files Created/Modified
- `src/lib/db/schema.ts` - Modified: `userModelSettings` pgTable (5 columns, userId PK) + `agentRun.model_used`/`model_chain` nullable audit columns with D-05/D-14 house comments
- `src/lib/db/queries/userModelSettings.ts` - Created: get + atomic full-value upsert (REG-03), falsy absence (REG-05)
- `src/lib/db/queries/userModelSettings.integration.test.ts` - Created: TEST_DATABASE_URL-gated REG-01/03/05 coverage (self-skips without the var)
- `src/lib/db/queries/runs.ts` - Modified: `CreateRunInput` + `.values()` map carry `modelUsed`/`modelChain` (REG-04)
- `src/lib/db/queries/runs.test.ts` - Modified: new persistence case for the audit fields (stubbed drizzle client)

## Decisions Made
- **D-06 intent reading (per plan output spec):** D-06's "updatedAt only" intent — **NO version column** on `user_model_settings` — is honored; `createdAt` ships per repo convention (every table in the repo has it; research Open Question 2 recommendation; ARCHITECTURE research D-06 resolves ships both columns). The atomic full-value upsert already prevents lost updates, so versioning adds schema with no v1.3 consumer.
- **fallbackModels comment cites `company.techStack` (schema.ts:61)** as the text[] precedent — the "first text[] column in the repo" claim is factually wrong per research (techStack predates it).
- **Relational query API** (`db.query.userModelSettings.findFirst`) used for `getModelSettingsForUser` — verified enabled because `src/lib/db/index.ts` passes `schema` to `drizzle()` (research Pattern 1 A3).
- **`--force` flag** used for non-interactive push (verified against installed drizzle-kit 0.31.10 help before relying on it; apply is additive — one new table + two nullable columns — so no data-loss statements were auto-approved).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- **`@neondatabase/serverless` client API constraint:** the installed client only accepts tagged-template queries (`sql\`...\``), rejecting the `sql('...')` function form. The live smoke query was rewritten to tagged-template syntax — this is a caller-side API detail, not a repo change.
- **tsx module resolution from temp dir:** running the smoke script from outside the repo failed to resolve `dotenv`/`@neondatabase/serverless`; resolved via `NODE_PATH` pointing at the repo's `node_modules` (script was a temp file, removed after; no repo files created).

## User Setup Required

None - no external service configuration required. `TEST_DATABASE_URL` remains unset in `.env.local`, so the integration test self-skips (accepted pass per plan); the live-DB proof came from Task 2's push + smoke query against `DATABASE_URL`.

## Next Phase Readiness
- **Phase 16 (failover orchestration) ready:** `getModelSettingsForUser` → resolve chain → populate `model_used`/`model_chain` at run end is now a one-line-per-step consumer; `createRun` accepts both audit fields; REG-05 default (`claude-sonnet-4-6` via `FAST_MODEL_ID` in `runAgent.ts`) preserved by falsy absence, never a throw.
- **Phase 17 (settings UI) ready:** `upsertModelSettings` is the write path (zod-validated at the Server Action boundary per plan); no allowlist gate landed here — that is 15-02's `catalog.ts`.
- **Verification evidence:** `npx drizzle-kit push` exit 0 + smoke PASS (live Neon); `runs.test.ts` 4/4 green; `userModelSettings.integration.test.ts` self-skipped (documented pass); `npm test` 244 passed / 6 skipped (incl. 4 self-skipped integration cases) — no regressions; `npx tsc --noEmit` clean; grep gate (node:child_process/execFileSync/execSync/spawnSync/spawn in `src/`) zero hits.

---
*Phase: 15-model-registry-foundation-persistence*
*Completed: 2026-08-02*

## Self-Check: PASSED

- [x] All 5 created/modified source + test files exist on disk
- [x] Task commits present: 89cc521a, b5c0c366
- [x] `npx tsc --noEmit` clean; `npm test` green (244 passed / 6 skipped); grep gate zero hits
