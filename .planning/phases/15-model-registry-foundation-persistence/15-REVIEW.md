---
phase: 15-model-registry-foundation-persistence
reviewed: 2026-08-02T11:20:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/lib/db/schema.ts
  - src/lib/db/queries/userModelSettings.ts
  - src/lib/db/queries/userModelSettings.integration.test.ts
  - src/lib/db/queries/runs.ts
  - src/lib/db/queries/runs.test.ts
  - scripts/refresh-model-catalog.ts
  - package.json
  - src/lib/models/catalog.ts
  - src/lib/models/catalog.test.ts
  - src/lib/models/catalog.json
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 15: Code Review Report

**Reviewed:** 2026-08-02T11:20:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Reviewed both phase-15 plans' deliverables: the `user_model_settings` table + `agentRun` audit columns (15-01), the `userModelSettings` query module with atomic full-value upsert (15-01), the `createRun` model-audit seam (15-01), and the model catalog snapshot pipeline — `scripts/refresh-model-catalog.ts`, `src/lib/models/catalog.json`, and the pure `catalog.ts` allowlist filters (15-02).

Overall the implementation is faithful to the plans and the house patterns: the upsert is a single-statement full-value `onConflictDoUpdate`, absence is falsy, the insert seam enumerates both audit columns, the catalog module is pure (zero mocks in tests — verified 10/10 tests green), the exec gate is clean, and no secrets are committed. The two warnings are: (1) the refresh script can silently overwrite the committed 1131-model snapshot with an empty one, and (2) the committed snapshot and the recorded D-02 roster verdict contradict each other on `claude-haiku-4-5` — a trap for Phase 16/17. Neither breaks shipped behavior today, but both should be fixed before the next phase consumes the catalog.

## Security Gate Checks (explicitly recorded as executed)

| Check | Result |
|---|---|
| **T-15-01 exec gate** — `grep -rE "node:child_process\|execFileSync(\|execSync(\|spawnSync(\|spawn(" src/` | ✅ 0 hits — the only subprocess call lives in repo-root `scripts/refresh-model-catalog.ts`; `src/` is exec-free |
| **T-15-02 information disclosure** — script must read only `opencode models`, never `/config/providers` | ✅ Script runs only `opencode models --verbose` (L116); no key-material env reads; no dotenv, no `src/` imports |
| **Secret/PII scan** — `sk-`, `pk_`, `x-api-key`, `api_key=`, `ANTHROPIC_API_KEY`, `BEGIN PRIVATE KEY`, `password=` patterns across all phase files incl. catalog.json | ✅ 0 matches — no API keys, secrets, or PII committed; `user_model_settings` stores only the opaque Clerk userId + raw model IDs |
| **T-15-04/05 raw-ID invariant (Pitfall 1/6)** — registry stores raw provider IDs only | ✅ All 1131 snapshot records trimmed to exactly the 8-field set (verified: 0 records with unexpected keys); 0 anthropic-provider IDs contain `/`; `getAllowlistedServableIds(snapshot)` returns exactly `['claude-sonnet-4-6']` (executed) — no dated-ID leakage, no opencode/ leakage |
| **T-15-06 repudiation** — durable model audit columns | ✅ `agent_run.model_used`/`model_chain` (nullable, no backfill per D-05) + `createRun` seam carries both fields (runs.ts:33-34) |
| **Full-value upsert, no read-modify-write (Pitfall 9)** | ✅ Single `insert ... onConflictDoUpdate` writing the complete chain; concurrent-upsert integration test asserts one complete chain, never a mix |

## Warnings

### WR-01: Refresh script silently overwrites the committed snapshot when opencode yields no parseable records

**File:** `scripts/refresh-model-catalog.ts:126-133`
**Issue:** `main()` parses stdout, then unconditionally `mkdirSync`/`writeFileSync` and exits 0 — there is no post-parse guard. If `opencode models --verbose` exits 0 with empty or non-JSON output (e.g. an auth banner or error text on stdout, a temporarily empty registry), `parseModels` returns `[]`, and the script overwrites the committed 1131-model `src/lib/models/catalog.json` with `{"generatedAt": ..., "models": []}` and exits 0. This contradicts the plan's own Task-2 verify requirement ("non-empty models array" / anchor record `claude-sonnet-4-6` present) and Pitfall 3's "fail loudly" intent — the failure mode is silent and destroys the good deliverable (recoverable only via git). The `catch` at L120-124 only handles a thrown `execFileSync` (non-zero exit), not empty output.
**Fix:**
```typescript
const models = parseModels(raw).map(trimRecord);
if (models.length === 0) {
  throw new Error(
    'opencode produced no parseable model records — snapshot NOT written (stale committed catalog.json kept)'
  );
}
if (!models.some((m) => m.id === 'claude-sonnet-4-6' && m.providerID === 'anthropic')) {
  throw new Error('snapshot missing the claude-sonnet-4-6 / anthropic anchor — aborting');
}
```

### WR-02: Committed snapshot contradicts the recorded D-02 roster verdict on `claude-haiku-4-5`

**File:** `src/lib/models/catalog.json:1487-1489` (and `src/lib/models/catalog.ts:8-9`)
**Issue:** The committed snapshot contains an undated `claude-haiku-4-5` record with `providerID: "anthropic"`, `status: "active"`, `api.url: ""` (vendor-default servable), named "Claude Haiku 4.5 (latest)". Yet the D-02 roster verdict — recorded in `catalog.ts:8-9` ("claude-haiku-4-5 NOT on roster (only the dated claude-haiku-4-5-20251001 form exists)") and in 15-02-SUMMARY (❌ ABSENT) — says the undated form does not exist on the live Anthropic API. The opencode registry (the snapshot's source) and the live Anthropic roster disagree, and the phase's deliverables never acknowledge this. A Phase 16/17 consumer reading the snapshot — the actual data source for pickers — would reasonably conclude haiku-4-5 is servable and allowlist it, then hit the 404 class at runtime (the exact Pitfall-6 trap the gate exists to prevent). The allowlist intersects it out today, so no shipped behavior is wrong — but the recorded truth is provably inconsistent.
**Fix:** Annotate the source-of-truth hierarchy in the `ANTHROPIC_ALLOWLIST` comment, e.g.: "NOTE: the opencode snapshot (catalog.json) lists an anthropic-provider undated claude-haiku-4-5 — opencode's registry is the MENU, not the roster; the live GET /v1/models (D-02) is the gate. Snapshot presence is NOT roster proof." Optionally add a snapshot-consistency assertion to the refresh script (see WR-01's anchor check).

## Info

### IN-01: `catalog.json` is never loaded at runtime by `catalog.ts`

**File:** `src/lib/models/catalog.ts:1`
**Issue:** `import type catalogJson from './catalog.json'` is a type-only import — erased at compile time. The module derives types from it but never reads the data; `getAllowlistedServableIds` takes the catalog as a parameter. CAT-04's "the catalog ships with the build" is therefore satisfied only as a repo file, not as a bundled/runtime import. Phase 17's pickers must value-import `./catalog.json` themselves (or the module must add a value import) — plan for that so the "last synced"/generatedAt display and model list actually load.

### IN-02: Snapshot has 342 model IDs duplicated across providers; 987 of 1131 IDs contain `/`

**File:** `src/lib/models/catalog.json` (structure)
**Issue:** The same raw ID appears under both `providerID: "opencode"` and `providerID: "anthropic"` for 342 models (e.g. `claude-haiku-4-5` at L43 vs L1487, `claude-sonnet-4-6` at L214 vs L1753); 987 IDs contain a `/` (gateway slugs). Harmless to `getAllowlistedServableIds` (providerID + allowlist filters), but Phase 17 pickers must key rows on `(providerID, id)` and filter by `providerID === 'anthropic'` before display — iterating by `id` alone will show duplicates.

### IN-03: `db:push` script and opencode-failure message are dev-experience rough edges

**File:** `package.json:16`, `scripts/refresh-model-catalog.ts:120-124`
**Issue:** (a) `"db:push": "drizzle-kit push"` without `--force` prompts interactively and will hang/fail in a non-TTY (the plan itself used `--force`). (b) The `execFileSync` catch rethrows "opencode CLI not found at ..." for ANY failure — including a present binary that errors (auth/network) — misdirecting diagnosis. Suggested: `"db:push": "drizzle-kit push --force"` (additive applies only, per the phase's own analysis) and include the original error in the thrown message.

### IN-04: `runs.test.ts` REG-04 case does not assert the undefined-omission behavior

**File:** `src/lib/db/queries/runs.test.ts:44-61`
**Issue:** The new case asserts `values` was called with an input containing `modelUsed`/`modelChain` — good — but Vitest/Jest object equality ignores `undefined`-valued extra keys, so the pre-existing case (L20-42) passes even though `createRun` passes `modelUsed: undefined`/`modelChain: undefined` into `.values()` when the fields are absent. Drizzle drops undefined keys, so runtime behavior is correct (columns get NULL); the test just doesn't pin that contract. Optional hardening: assert the exact values-map key set in the REG-04 case.

---

_Reviewed: 2026-08-02T11:20:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
