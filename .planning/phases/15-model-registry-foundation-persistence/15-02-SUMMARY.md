---
phase: 15-model-registry-foundation-persistence
plan: 02
subsystem: api
tags: [opencode, models, catalog, allowlist, vitest, tsx, anthropic]

# Dependency graph
requires:
  - phase: 15-model-registry-foundation-persistence
    provides: 15-01's user_model_settings/agent_run schema + query modules (this plan is file-disjoint; shares only the phase)
provides:
  - Dev-time `scripts/refresh-model-catalog.ts` → committed `src/lib/models/catalog.json` snapshot (1131 models, trimmed, generatedAt)
  - `npm run models:fetch` (and `db:push`) npm scripts
  - Pure `src/lib/models/catalog.ts`: ANTHROPIC_ALLOWLIST + opencodeSlugToModelId + getAllowlistedServableIds
  - Mock-free 6-case Vitest coverage (D-16)
  - Live D-02 roster verdict (2026-08-02): sonnet-4-6 verified, haiku-4-5 absent → sonnet-only allowlist
affects: [15-model-registry-foundation-persistence (Phase 16 failover orchestration), 17-settings-ui-list-source, 18-verification-gate]

# Tech tracking
tech-stack:
  added: [tsx 4.23.1 (already installed, new usage), opencode CLI 1.18.10 (dev-time only)]
  patterns:
    - "Repo-root scripts/ for child_process-carrying dev scripts (Pitfall 4 — keeps exec out of src/ for the Phase 18 grep gate)"
    - "Committed JSON snapshot as the production model-list source (no runtime opencode — Pitfall 8)"
    - "Allowlist ∩ snapshot filtering: hand-curated roster-verified code constant (D-03) gates the servable set"
    - "JSON type import via resolveJsonModule (tsconfig.json:12) for typed accessor derivation"

key-files:
  created:
    - scripts/refresh-model-catalog.ts
    - src/lib/models/catalog.json
    - src/lib/models/catalog.ts
    - src/lib/models/catalog.test.ts
  modified:
    - package.json

key-decisions:
  - "Allowlist ships ['claude-sonnet-4-6'] only — live GET /v1/models on 2026-08-02 verified sonnet-4-6 and confirmed undated claude-haiku-4-5 ABSENT (only dated claude-haiku-4-5-20251001 exists); per D-02's gate haiku-4-5 is deferred, no invented/dated IDs"
  - "Snapshot at src/lib/models/catalog.json (D-08 discretion) — co-located with its typed accessor; src/data/ has no precedent"
  - "Added both models:fetch and db:push npm scripts in one package.json edit (db:push nicety rides this plan's package.json ownership per plan Task 2)"

patterns-established:
  - "Pattern: dev-time snapshot script at repo-root scripts/ (node builtins only, no src/ imports, no dotenv) writing a committed JSON deliverable"
  - "Pattern: pure filter module importing only the JSON type — zero mocks in tests (D-16)"
  - "Pattern: strip-after-filter slug mapping (filter prefix BEFORE slicing — Pitfall 1)"

requirements-completed: [CAT-01, CAT-02, CAT-03, CAT-04]

# Metrics
duration: 10min
completed: 2026-08-02
---

# Phase 15 Plan 2: Model Catalog Snapshot + Pure Allowlist Filters Summary

**Dev-time `opencode models --verbose` snapshot script (repo-root scripts/, node-builtins only) producing a committed 1131-model catalog.json, plus a pure, mock-free catalog module whose roster-verified (2026-08-02) sonnet-only allowlist gates the servable set — zero runtime opencode dependency, src/ stays exec-free.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-08-02T08:57:00Z
- **Completed:** 2026-08-02T09:07:11Z
- **Tasks:** 3
- **Files modified:** 5 (4 created, 1 modified)

## Roster Verdict (Task 1 — D-02 gate, executed live 2026-08-02)

`GET https://api.anthropic.com/v1/models` (x-api-key from `.env.local`, anthropic-version 2023-06-01) returned **11 models**:

| Roster fact | Result |
|---|---|
| `claude-sonnet-4-6` (undated) | ✅ **VERIFIED present** — the REG-05 no-settings default is on the live roster |
| `claude-haiku-4-5` (undated) | ❌ **ABSENT** — only the dated `claude-haiku-4-5-20251001` form exists |
| Dated IDs (`-20\d{6}`) | `claude-haiku-4-5-20251001`, `claude-opus-4-1-20250805`, `claude-opus-4-5-20251101`, `claude-sonnet-4-5-20250929` present on roster but **never allowlist-eligible** (Pitfall 6 — the 404 class) |

**Verdict:** `ANTHROPIC_ALLOWLIST` ships `['claude-sonnet-4-6']` only. Haiku 4.5 is **deferred** (per D-02's gate: no invented IDs; a future undated alias would require a code change + deploy + roster re-verify). Verdict is cited in `src/lib/models/catalog.ts`'s allowlist comment for auditability.

## Accomplishments

- **CAT-01/CAT-02:** `scripts/refresh-model-catalog.ts` shells `opencode models --verbose`, parses the multi-line pretty-JSON records defensively (balanced-brace accumulator with string-aware brace delta — ignores braces inside quoted strings), trims to EXACTLY `{id, providerID, name, family, status, api{npm,url}, cost{input,output}, limit{context,output}}`, writes `src/lib/models/catalog.json` (1131 models, `generatedAt`), and exits via the seed.ts pattern. `npm run models:fetch` exits 0. **CAT-02 grep gate: 0 hits** on `grep -rE "node:child_process|execFileSync\(|execSync\(|spawnSync\(|spawn\(" src/` — the only subprocess call lives in repo-root `scripts/`.
- **CAT-03:** Pure `catalog.ts` — `opencodeSlugToModelId` (strip-after-filter, Pitfall 1), `getAllowlistedServableIds` (providerID==='anthropic' ∩ status!=='deprecated' ∩ allowlist), `ANTHROPIC_ALLOWLIST` (sonnet-only, D-02 gate). Against the real 1131-model snapshot it returns exactly `['claude-sonnet-4-6']` — no dated-ID leakage, no opencode/ leakage, no `/` in output.
- **CAT-04:** `npm run build` exits 0 — catalog.ts imports catalog.json server-side via `resolveJsonModule`; the catalog ships with the build.
- **Tests (D-16):** 6 behavior cases, zero mocks, inline fixture decoupled from the snapshot. RED→GREEN proven: 6/6 failed on missing module, 6/6 pass after implementation.
- **Full suite:** `npm test` — 250 passed, 6 skipped (DB-gated integration tests); `npx tsc --noEmit` clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: D-02 roster re-verify (live API check)** — no source files; verdict above feeds Task 3's allowlist constant
2. **Task 2: refresh-model-catalog script + models:fetch + committed snapshot** — `78949d1b` (feat)
3. **Task 3: catalog.ts pure module + catalog.test.ts + build/grep gates** — `8e0f1b69` (feat; RED→GREEN in one commit — test-first order followed, separate RED commit not required by this plan)

**Plan metadata:** `358c169f` (docs: complete model catalog snapshot plan)

## Files Created/Modified

- `scripts/refresh-model-catalog.ts` - Dev-time snapshot generator (node:child_process/fs/path only; resolveOpencodeBin OPENCODE_BIN→which→~/.opencode/bin/opencode; balanced-brace parser; trim-to-field-set; seed.ts exit pattern)
- `src/lib/models/catalog.json` - Committed 1131-model snapshot: `{generatedAt, models[]}` trimmed to UI-needed fields (generated, ~470KB)
- `src/lib/models/catalog.ts` - Pure module: `ANTHROPIC_ALLOWLIST`, `opencodeSlugToModelId`, `getAllowlistedServableIds`; `CatalogModel`/`ModelCatalog` types derived from the JSON import
- `src/lib/models/catalog.test.ts` - 6 mock-free Vitest cases (slug mapping ×4, allowlist∩filter, allowlist shape)
- `package.json` - `"models:fetch": "tsx scripts/refresh-model-catalog.ts"` + `"db:push": "drizzle-kit push"` (mirrors seed tsx convention)

## Decisions Made

- Allowlist ships `['claude-sonnet-4-6']` only, per the live roster verdict (Task 1); haiku-4-5 deferred. This matches the research expectation (A1) — the re-verify executed and confirmed the finding rather than changing it.
- Snapshot at `src/lib/models/catalog.json` (D-08 discretion), co-located with its typed accessor; no `src/data/` precedent.
- Added `db:push` alongside `models:fetch` in one package.json edit (D-01 nicety, plan Task 2's explicit option).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] execFileSync maxBuffer ENOBUFS on the verbose registry**
- **Found during:** Task 2 (first `npm run models:fetch` run)
- **Issue:** `opencode models --verbose` emits ~65,301 lines / several MB — beyond `execFileSync`'s default 1MB `maxBuffer`, which throws a cryptic `spawnSync ... ENOBUFS`. The research/PATTERNS core snippet did not set maxBuffer (the research run apparently consumed output differently).
- **Fix:** Added `maxBuffer: 64 * 1024 * 1024` to the execFileSync options, with a why-comment documenting the ENOBUFS failure mode (per CLAUDE.md comment convention).
- **Files modified:** scripts/refresh-model-catalog.ts
- **Verification:** `npm run models:fetch` exits 0, snapshot written with 1131 models
- **Committed in:** 78949d1b (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Single correctness fix required for the script to function at all; no scope creep, no package changes.

## Issues Encountered

- **`.env.local` `source` parse error (Task 1):** `set -a; source .env.local` failed with `parse error near '&'` (line 22 of `.env.local` contains an unquoted `&` — a zsh-specific quirk when sourcing dotenv files). Worked around by extracting only the `ANTHROPIC_API_KEY=` line directly (`grep | cut -d= -f2-`) into the curl — the key value was never printed or committed. This is an environment quirk, not a code defect; the app's own env loading (src/lib/env.ts via Next.js/seed.ts dotenv) is unaffected.
- **TDD commit shape:** RED and GREEN landed in one commit (`8e0f1b69`). The plan's success criteria explicitly permits this ("RED commit may be optional if the plan doesn't demand a separate RED commit"); the test-first order was proven by the 6/6-failing run before `catalog.ts` existed.

## Stub Scan

None — no placeholder values, empty arrays flowing to UI, or unwired components. `catalog.json` contains real fetched data; `ANTHROPIC_ALLOWLIST` is intentionally sonnet-only per the roster gate (documented, not a stub).

## Threat Surface Scan

No new security-relevant surface beyond the plan's threat model. The one subprocess call (`scripts/refresh-model-catalog.ts` → opencode, T-15-01) is dev-time only, never imported by `src/`, reads no key material (T-15-02: `opencode models` is secret-free; the anti-feature `/config/providers` is never called), and the snapshot is imported server-side only (T-15-03). CAT-02 grep gate re-verified 0 hits after all files landed.

## User Setup Required

None - no external service configuration required. `npm run models:fetch` requires a local opencode CLI (present at `~/.opencode/bin/opencode`), but the committed snapshot keeps the app fully operational without it.

## Next Phase Readiness

- **Phase 16 (Failover Orchestration):** consumes `getModelSettingsForUser` (15-01) and populates `agent_run.model_used`/`model_chain`; the catalog module is not a Phase 16 dependency but the raw-ID invariant it encodes (Pitfall 1) is the storage contract Phase 16 writes against.
- **Phase 17 (Settings UI):** consumes `getAllowlistedServableIds` + `catalog.json`'s `generatedAt` (the "last synced" display) for the model pickers — must keep the catalog server-side only (D-07).
- **Phase 18 (Verification Gate):** re-runs the corrected CAT-02 grep pattern `grep -rE "node:child_process|execFileSync\(|execSync\(|spawnSync\(|spawn\(" src/` (baseline 0) as the Vercel no-opencode proof; allowlist roster re-verify is standing maintenance.
- **Deferred:** undated `claude-haiku-4-5` (one-line allowlist change + roster re-verify when Anthropic exposes an undated alias — D-02 gate).

---
*Phase: 15-model-registry-foundation-persistence*
*Completed: 2026-08-02*

## Self-Check: PASSED

All 5 deliverable files exist (script, catalog.json, catalog.ts, catalog.test.ts, SUMMARY.md); both task commits verified in git log (`78949d1b`, `8e0f1b69`).
