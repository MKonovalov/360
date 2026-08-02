---
phase: 15
slug: model-registry-foundation-persistence
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-02
updated: 2026-08-02
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 (installed) |
| **Config file** | `vitest.config.ts` (node env, `include: ['src/**/*.test.ts']`, `@` → `./src`) |
| **Quick run command** | `npx vitest run src/lib/models/catalog.test.ts` |
| **Full suite command** | `npm test` (existing 245-test suite must stay green) |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/lib/models/catalog.test.ts` (fast, pure)
- **After every plan wave:** Run `npm test` (full suite)
- **Before `/gsd-verify-work`:** Full suite green + `drizzle-kit push` applied + `models:fetch` snapshot regenerated + `grep -rE "node:child_process|execFileSync\(|execSync\(|spawnSync\(|spawn\(" src/` clean (call-site/import pattern — the naive `grep exec|spawn|child_process` variant is unsatisfiable: 11 baseline false positives on `execute`/`executive`/`executes`, and word-boundary variants miss `execFileSync(`/`spawnSync(`)
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | REG-01/02/03 | T-15-03 / T-15-05 | Model IDs only (no keys); allowlist gate | integration + contract | `npx vitest run src/lib/db/queries/userModelSettings.integration.test.ts` (4/4 pass w/ TEST_DATABASE_URL); `npx drizzle-kit push` applied | ✅ | ✅ green |
| 15-01-02 | 01 | 1 | REG-04 | T-15-06 | Durable model_used/model_chain columns | integration | `npx vitest run src/lib/db/queries/runs.test.ts` (extended — 3 modelUsed/modelChain refs) | ✅ | ✅ green |
| 15-01-03 | 01 | 1 | REG-05 | — | Missing row → undefined, default preserved | integration | `getModelSettingsForUser('no-such-user')` → undefined (integration test, 1 ref) | ✅ | ✅ green |
| 15-02-01 | 02 | 1 | CAT-01/CAT-02 | T-15-01 | No exec/spawn in src/ (grep gate) | smoke | `npm run models:fetch` → catalog.json (1131 models, generatedAt 2026-08-02T09:33:54Z); grep gate 0 hits | ✅ | ✅ green |
| 15-02-02 | 02 | 1 | CAT-03/CAT-04 | T-15-02 / T-15-03 | Server-side only, no client leakage | unit + contract | `npx vitest run src/lib/models/catalog.test.ts` (10 tests pass); `npm run build` exit 0 | ✅ | ✅ green |
| — | — | 2 | ALL | — | — | — | `npm test` (full suite — 294 passed at v1.3 close) | — | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/lib/models/catalog.test.ts` — pure CAT-03 tests: `opencodeSlugToModelId` (anthropic→raw, `opencode/*`→null, non-anthropic→null); filter (anthropic-only, no dated IDs, allowlist intersect, no `opencode/` leakage) — 10 tests, green
- [x] `src/lib/db/queries/userModelSettings.integration.test.ts` — TEST_DATABASE_URL-gated (describe.skip without it): insert → upsert-update → full-value overwrite; concurrent upserts never half-merge; absence → undefined — 4/4 pass with TEST_DATABASE_URL
- [x] Extend `src/lib/db/queries/runs.test.ts` — `createRun` persists `modelUsed`/`modelChain` when provided (3 refs)
- [x] No framework gaps — vitest.config.ts, tsconfig paths, drizzle-orm 0.45.2, drizzle-kit 0.31.10, tsx 4.23.1, vitest 4.1.10 all already installed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `drizzle-kit push` applies schema to live Neon DB | REG-01 | Requires live DATABASE_URL | Run `npx drizzle-kit push`; verify exit 0 and `user_model_settings` + `agent_run.model_used`/`model_chain` present in DB |
| Roster re-verify gate | D-02 | Requires live Anthropic API | `curl https://api.anthropic.com/v1/models` (with key) — confirm `claude-haiku-4-5` before adding to allowlist; else ship sonnet-only |
| Snapshot regenerated and committed | CAT-01 | Requires local opencode CLI | Run `npm run models:fetch`; confirm `catalog.json` valid, non-empty, `generatedAt` present; commit |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** verified 2026-08-02

---

## Validation Audit 2026-08-02

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 5/5 rows ✅ green |
| Escalated | 0 |

**Audit evidence:** catalog.test.ts 10/10 pass; userModelSettings.integration.test.ts 4/4 pass (real TEST_DATABASE_URL); runs.test.ts extended (createRun persists modelUsed/modelChain); catalog.json committed (1131 models, generatedAt 2026-08-02T09:33:54Z); grep gate 0 hits; `npx drizzle-kit push` applied during execution (schema verified in 15-VERIFICATION.md); full suite 294 passed at v1.3 close. No Nyquist gaps — all planned validation outputs delivered and green.
