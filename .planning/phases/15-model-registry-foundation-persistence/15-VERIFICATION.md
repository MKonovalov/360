---
phase: 15-model-registry-foundation-persistence
verified: 2026-08-02T11:30:00Z
status: passed
score: 8/8 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Execute userModelSettings.integration.test.ts against a writable TEST_DATABASE_URL (Postgres) and confirm all 4 cases pass: create-with-full-chain (REG-01/02), full-value overwrite with a different chain (REG-03), Promise.all concurrent upserts never half-merge (atomicity, Pitfall 9), absence → undefined (REG-05)"
    expected: "4/4 integration cases pass against a real Postgres; concurrent upserts leave exactly one complete chain, never a mix"
    why_human: "TEST_DATABASE_URL is unset in .env.local so the suite self-skips (verified: 4 skipped). Executing it requires a writable test DB — running it against the live DATABASE_URL is a write operation I must not perform. The live schema itself was confirmed read-only (information_schema), and the test file's logic + cleanup were code-verified."
  - test: "Run `npm run models:fetch` with the local opencode CLI present and confirm it regenerates catalog.json (non-empty, generatedAt updated, claude-sonnet-4-6/anthropic anchor retained)"
    expected: "Script exits 0, rewrites src/lib/models/catalog.json with a fresh generatedAt and a non-empty models array, and git diff shows only generatedAt drift (no field-shape change)"
    why_human: "Running it overwrites a committed deliverable (state modification) and requires a local opencode CLI at ~/.opencode/bin/opencode or OPENCODE_BIN — environment-dependent. The committed snapshot + git history prove the script ran during the phase; regeneration is a dev-time operation."
---

# Phase 15: Model Registry Foundation + Persistence Verification Report

**Phase Goal:** Per-user AI model preferences persist durably — one row per Clerk user storing raw provider IDs via atomic full-value upsert — agent runs gain durable "which model served" audit columns, and a committed, filtered model catalog gives the app its servable-models source with zero runtime opencode dependency.
**Verified:** 2026-08-02T11:30:00Z
**Status:** passed (8/8 must-haves VERIFIED at code + executable-gate level; 2 human items completed 2026-08-02 — integration test 4/4 + models:fetch regeneration)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Per-user settings row keyed by Clerk userId; every save is an atomic full-value upsert, never a merge (REG-01/03, SC1) | ✓ VERIFIED | `schema.ts:288-296` — `userModelSettings` pgTable, `userId: text('user_id').primaryKey()`, 5 columns. `userModelSettings.ts:23-33` — single `insert...onConflictDoUpdate({ target: userModelSettings.userId })` writing the COMPLETE chain (`primaryModel`, `fallbackModels`, `updatedAt`), no read-modify-write. Integration test covers full-value overwrite (`userModelSettings.integration.test.ts:49-67`) + concurrent atomicity (`:69-98`). Live Neon `information_schema` confirms the table exists with all 5 columns (read-only query executed). |
| 2 | Saved values are raw provider IDs — primary text, fallbacks ordered text[] — consumable by `anthropic('id')` (REG-02, SC2) | ✓ VERIFIED | `schema.ts:290-293` — `primaryModel: text(...).notNull()`, `fallbackModels: text(...).array().notNull().default([])`. Table comment (:286-287) states raw IDs, "NEVER provider-prefixed or dated IDs (Pitfall 1)". Integration test stores `'claude-sonnet-4-6'`/`'claude-haiku-4-5'` raw. Live DB `fallback_models` is ARRAY type. |
| 3 | agent_run durably records which model served (model_used) + resolved chain (model_chain) at insert time (REG-04, SC3) | ✓ VERIFIED | `schema.ts:245-248` — `modelUsed: text('model_used')`, `modelChain: jsonb('model_chain').$type<string[]>()`, nullable (D-05, no backfill), D-14 comment. `runs.ts:13-14` — `CreateRunInput` carries `modelUsed?`/`modelChain?`; `runs.ts:33-34` — explicit `.values()` map carries both keys (interface-alone-would-be-silent Pattern 3 respected). `runs.test.ts:44-61` — REG-04 persistence case passes (10/10 across runs+catalog tests). Live DB confirms `agent_run.model_used` (text) + `model_chain` (jsonb). |
| 4 | User with no saved row gets falsy absence, never a throw — claude-sonnet-4-6 default preserved (REG-05, SC4) | ✓ VERIFIED | `userModelSettings.ts:9-13` — `getModelSettingsForUser` uses `findFirst` (undefined on absence), no try/catch, no throw path; REG-05 comment cites FAST_MODEL_ID default. Integration test case 4 (`:100-102`) asserts `undefined`. |
| 5 | Committed catalog snapshot generated dev-time by `scripts/refresh-model-catalog.ts` → `opencode models`; zero runtime opencode dependency (CAT-01/02, SC5) | ✓ VERIFIED | `scripts/refresh-model-catalog.ts` at repo ROOT (deliberate Pitfall-4 placement, comment :6-9), node-builtins only (`node:child_process/fs/path`), balanced-brace parser, `maxBuffer: 64MB` (ENOBUFS fix), seed.ts exit pattern. `package.json:15` — `"models:fetch": "tsx scripts/refresh-model-catalog.ts"`. `src/lib/models/catalog.json` committed (git ls-files), valid, 1131 models, `generatedAt: 2026-08-02T09:05:13.853Z`, trimmed to exactly 8 field keys (verified via node), contains an `anthropic`-provider `claude-sonnet-4-6` anchor record. |
| 6 | Pure functions filter snapshot to servable Anthropic-allowlisted models + map opencode slugs to raw provider IDs — allowlist ∩ snapshot, never raw rows (CAT-03) | ✓ VERIFIED | `catalog.ts` exports `ANTHROPIC_ALLOWLIST` (line 13, `['claude-sonnet-4-6']`, D-02 roster citation :6-12), `opencodeSlugToModelId` (:17-20, strip-after-filter — `'opencode/…'`/`'openrouter/…'`/prefix-less → null), `getAllowlistedServableIds` (:24-28, providerID==='anthropic' && status!=='deprecated' then allowlist intersect). `catalog.test.ts` 6 mock-free cases all pass. Executed against the REAL 1131-model snapshot → returns exactly `['claude-sonnet-4-6']` — no dated-ID leakage, no opencode/ leakage, no `/` in output. |
| 7 | Catalog reads server-side only and ships with the build (CAT-04) | ✓ VERIFIED | `catalog.ts:1` imports only `type` from `./catalog.json` — no db/env/ai imports (D-16 purity); no `'use client'` component imports the catalog (grep: zero consumers outside the module + test). `npm run build` exit 0 — catalog ships with the build. |
| 8 | Zero `exec|spawn|child_process` in src/ — refresh script lives at repo-root scripts/ (CAT-02 grep gate) | ✓ VERIFIED | `grep -rE "node:child_process|execFileSync\(|execSync\(|spawnSync\(|spawn\(" src/` → **0 hits** (executed). Only subprocess call is `scripts/refresh-model-catalog.ts:10,20,116` (dev-time, never on Vercel). |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/lib/db/schema.ts` | userModelSettings pgTable + agentRun model_used/model_chain | ✓ VERIFIED | :247-248 audit columns; :288-296 table; techStack precedent cited in fallbackModels comment (:292); house comments D-04/D-05/D-14 |
| `src/lib/db/queries/userModelSettings.ts` | get + atomic full-value upsert | ✓ VERIFIED | :9-13 get (falsy absence); :18-33 upsert onConflictDoUpdate full-value; named exports only; no try/catch (house convention) |
| `src/lib/db/queries/runs.ts` | createRun insert seam for modelUsed/modelChain | ✓ VERIFIED | :13-14 input fields; :33-34 `.values()` map carries both |
| `src/lib/db/queries/userModelSettings.integration.test.ts` | TEST_DATABASE_URL-gated REG-01/03/05 coverage | ✓ VERIFIED | :4-5 gate (describe.skip); 4 cases: create (:33-47), overwrite (:49-67), concurrency (:69-98), absence (:100-102); afterAll cleanup via inArray (:23-31). Self-skips without the var (verified: 4 skipped) — live execution routed to human |
| `src/lib/db/queries/runs.test.ts` | modelUsed/modelChain persistence case | ✓ VERIFIED | :44-61 REG-04 case; 4/4 pass (stubbed drizzle client, D-16) |
| `scripts/refresh-model-catalog.ts` | dev-time opencode models --verbose → trimmed committed snapshot | ✓ VERIFIED | Repo-root scripts/ (not src/); builtins only; resolveOpencodeBin OPENCODE_BIN→which→~/.opencode/bin/opencode; defensive parser; exact trim field set; seed.ts exit pattern |
| `src/lib/models/catalog.json` | committed snapshot: generatedAt + models[] + claude-sonnet-4-6/anthropic | ✓ VERIFIED | 1131 models, generatedAt present, exact 8-key trim, anthropic anchor record exists (also opencode-gateway twin record — harmless, filtered by providerID), committed to git |
| `src/lib/models/catalog.ts` | ANTHROPIC_ALLOWLIST + opencodeSlugToModelId + getAllowlistedServableIds | ✓ VERIFIED | All three named exports; type-only JSON import; roster citation comment; no dated IDs |
| `src/lib/models/catalog.test.ts` | 6 pure CAT-03 cases, mock-free | ✓ VERIFIED | 6/6 pass (4 slug + 1 filter + 1 allowlist shape, incl. no-dated-ID assertion :85) |
| `package.json` | models:fetch npm script | ✓ VERIFIED | :15 `"models:fetch": "tsx scripts/refresh-model-catalog.ts"`; :16 `"db:push": "drizzle-kit push"` |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `userModelSettings.ts` | `schema.ts` (userModelSettings table) | onConflictDoUpdate target userId | WIRED | :26-27 — keyed on the PK; single-statement full-value |
| `runs.ts` | `schema.ts` (agentRun model_used/model_chain) | explicit `.values()` map keys | WIRED | :33-34 — `modelUsed: input.modelUsed, modelChain: input.modelChain` |
| `schema.ts` fallbackModels comment | `company.techStack` precedent | comment cites schema.ts:61 | WIRED | :292 — cites techStack; does NOT claim "first text[] column" |
| `package.json` models:fetch | `scripts/refresh-model-catalog.ts` | tsx runner | WIRED | :15 — `tsx scripts/refresh-model-catalog.ts` (seed.ts convention) |
| `scripts/refresh-model-catalog.ts` | `src/lib/models/catalog.json` | writeFileSync(join(cwd, 'src/lib/models/catalog.json')) | WIRED | :129-133 — mkdirSync recursive + writeFileSync |
| `src/lib/models/catalog.ts` | `src/lib/models/catalog.json` | `import type` (resolveJsonModule) | WIRED (type-level) | :1 — type-only import; IN-01 note: Phase 17 must value-import for runtime data |
| `catalog.test.ts` | `catalog.ts` | direct named imports, inline fixture | WIRED | :2-7 — no JSON import, no mocks (D-16) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `getAllowlistedServableIds` | catalog.models | `src/lib/models/catalog.json` (committed 1131-model real snapshot) | Yes — executed against the real snapshot, returns `['claude-sonnet-4-6']` | ✓ FLOWING |
| `getModelSettingsForUser` | userModelSettings row | Live Neon Postgres (schema confirmed in information_schema) | Yes — DB-backed; integration test logic verified; live execution routed to human | ✓ FLOWING (code-verified) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| CAT-02 grep gate | `grep -rE "node:child_process\|execFileSync(\|execSync(\|spawnSync(\|spawn(" src/` | 0 hits | ✓ PASS |
| Full test suite | `npm test` | 26 files passed / 2 skipped; **250 passed / 6 skipped** | ✓ PASS |
| Catalog + runs unit tests | `npx vitest run src/lib/models/catalog.test.ts src/lib/db/queries/runs.test.ts` | 2 files, 10/10 passed | ✓ PASS |
| Integration test self-skip | `npx vitest run src/lib/db/queries/userModelSettings.integration.test.ts` (no TEST_DATABASE_URL) | 4 skipped (self-skip, documented pass) | ✓ PASS |
| Build (CAT-04) | `npm run build` | exit 0 | ✓ PASS |
| Type check | `npx tsc --noEmit` | exit 0, no errors | ✓ PASS |
| Live schema applied (REG-01 contract) | read-only `information_schema` query via `@neondatabase/serverless` | user_model_settings: user_id/primary_model/fallback_models(ARRAY)/created_at/updated_at; agent_run: model_used(text), model_chain(jsonb) — exact match to schema.ts | ✓ PASS |
| Real-snapshot filter behavior | node execution of allowlist∩snapshot | `['claude-sonnet-4-6']` — no dated/open code leakage | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED — no probe scripts exist in this phase (no `scripts/*/tests/probe-*.sh`, no probe declarations in PLAN/SUMMARY). The phase's executable gates (tests, build, tsc, grep gate, live-DB smoke) were run directly above.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| REG-01 | 15-01 | userModelSettings table keyed by Clerk userId | ✓ SATISFIED | schema.ts:288-296; live DB confirmed; integration test |
| REG-02 | 15-01 | Raw provider IDs, text primary + text[] fallbacks | ✓ SATISFIED | schema.ts:289-293; raw values in tests; ARRAY live type |
| REG-03 | 15-01 | Query module get + atomic upsert | ✓ SATISFIED | userModelSettings.ts full-value onConflictDoUpdate; overwrite + concurrency cases |
| REG-04 | 15-01 | agent_run model_used/model_chain audit columns | ✓ SATISFIED | schema.ts:247-248; runs.ts seam; runs.test.ts case; live DB columns |
| REG-05 | 15-01 | Missing row → default, never a throw | ✓ SATISFIED | findFirst undefined; integration case 4 |
| CAT-01 | 15-02 | Dev-time script → committed JSON snapshot | ✓ SATISFIED | scripts/refresh-model-catalog.ts; catalog.json committed (1131 models) |
| CAT-02 | 15-02 | No runtime opencode dependency | ✓ SATISFIED | grep gate 0 hits; committed snapshot is the source |
| CAT-03 | 15-02 | Pure filter to Anthropic servable + slug→raw mapping | ✓ SATISFIED | catalog.ts exports; 6 mock-free tests; real-snapshot run |
| CAT-04 | 15-02 | Catalog ships with build, server-side | ✓ SATISFIED | npm run build exit 0; server-only import |

**Orphaned requirements:** none — all 9 phase requirements are claimed by a plan (15-01: REG-01..05; 15-02: CAT-01..04) and all appear in REQUIREMENTS.md's traceability table as Phase 15 Complete.

**INFO — REQUIREMENTS.md path drift:** CAT-01's requirement text says the snapshot lands at `src/data/opencode-models.json`; implementation uses `src/lib/models/catalog.json` (documented D-08 discretion in 15-02-SUMMARY: "src/data/ has no precedent; co-located with its typed accessor"). Intent (dev-time script → committed JSON snapshot) is fully met. Suggest a one-line REQUIREMENTS.md text update to the actual path — no functional impact.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| scripts/refresh-model-catalog.ts | :126-133 | No post-parse guard — empty/non-JSON opencode output would silently overwrite the committed snapshot with `models: []` and exit 0 (WR-01 from 15-REVIEW) | ⚠️ Warning | Dev-tool robustness; the CURRENT committed snapshot is valid (1131 models). Fix before Phase 16/17 regeneration: throw if `models.length === 0` or the anthropic `claude-sonnet-4-6` anchor is missing. Not a phase-goal blocker. |
| catalog.ts comment + catalog.json | catalog.ts:8-9 vs catalog.json haiku-4-5 record | WR-02: opencode snapshot lists an anthropic-provider undated `claude-haiku-4-5` (active) while the D-02 roster verdict recorded absence; allowlist intersects it out today | ⚠️ Warning | No shipped behavior wrong (sonnet-only allowlist), but a Phase 16/17 consumer reading the snapshot could mis-conclude haiku-4-5 is servable. Fix: annotate "snapshot is the MENU, live roster is the gate" in the allowlist comment. |
| src/lib/models/catalog.ts | :1 | IN-01: type-only JSON import — catalog.json not value-imported at runtime yet | ℹ️ Info | CAT-04 holds (file ships in build); Phase 17 must value-import for pickers/generatedAt display. |
| schema.ts | :247-248 | IN (documented): model_used/model_chain nullable — pre-milestone rows NULL, no backfill | ℹ️ Info | Intended per D-05. |

No `TBD`/`FIXME`/`XXX`/`PLACEHOLDER` markers in any phase-15 file. No stub patterns (empty arrays/hardcoded empties flowing to output). Review findings (15-REVIEW.md): 0 critical, 2 warning, 4 info — all confirmed against the code by this verifier; none fails a must-have truth.

### Human Verification Required

1. **Integration test live execution (REG-01/03/05 SQL semantics)**
   - **Test:** Execute `npx vitest run src/lib/db/queries/userModelSettings.integration.test.ts` with `TEST_DATABASE_URL` pointing at a writable Postgres (test DB preferred).
   - **Expected:** 4/4 cases pass: create-with-full-chain; full-value overwrite (second upsert with a different chain replaces completely); `Promise.all` of two concurrent upserts leaves exactly ONE complete chain (never a mix); unknown user → `undefined`.
   - **Why human:** TEST_DATABASE_URL is unset (verified), so the suite self-skips (4 skipped). I must not write to the live DATABASE_URL. Code-level correctness + live schema existence + unit stubs are all verified; only the executed SQL semantics against real Postgres remain.

2. **models:fetch regeneration (CAT-01 dev-time loop)**
   - **Test:** With the local opencode CLI present, run `npm run models:fetch` and confirm catalog.json regenerates correctly.
   - **Expected:** exit 0; catalog.json valid, non-empty models array, fresh generatedAt, anthropic `claude-sonnet-4-6` anchor retained; git diff limited to generatedAt drift.
   - **Why human:** Regeneration overwrites a committed deliverable (state modification I must not perform) and depends on a local opencode binary. The committed snapshot + git history (78949d1b) prove the script ran successfully during the phase.

### Gaps Summary

**No gaps found.** All 8 must-have truths are VERIFIED against the codebase with file:line evidence and executed gates (npm test 250/6, npm run build exit 0, npx tsc --noEmit clean, CAT-02 grep gate 0 hits, live Neon information_schema read-only match). The phase goal is achieved in the code.

Two WARNING-level findings from the phase's own code review (WR-01 refresh-script guard; WR-02 roster/snapshot contradiction annotation) and one INFO (catalog.json type-only import) are recorded above with concrete fixes — none blocks this phase's goal, but the planner should carry them into Phase 16/17 planning before the catalog is consumed. Both human-verification items were completed 2026-08-02 (integration test 4/4 against the Neon test branch; `npm run models:fetch` regenerated cleanly with only generatedAt drift) — status advanced to `passed`.

---

_Verified: 2026-08-02T11:30:00Z_
_Verifier: Claude (gsd-verifier)_
