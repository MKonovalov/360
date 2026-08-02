---
phase: 15
slug: model-registry-foundation-persistence
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-02
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
| 15-01-01 | 01 | 1 | REG-01/02/03 | T-15-03 / T-15-05 | Model IDs only (no keys); allowlist gate | integration + contract | `npx vitest run src/lib/db/queries/userModelSettings.integration.test.ts`; `npx drizzle-kit push` | ❌ W0 | ⬜ pending |
| 15-01-02 | 01 | 1 | REG-04 | T-15-06 | Durable model_used/model_chain columns | integration | `npx vitest run src/lib/db/queries/runs.test.ts` (extended) | ❌ extend | ⬜ pending |
| 15-01-03 | 01 | 1 | REG-05 | — | Missing row → undefined, default preserved | integration | `getModelSettingsForUser('no-such-user')` → undefined (in integration test) | ❌ W0 | ⬜ pending |
| 15-02-01 | 02 | 1 | CAT-01/CAT-02 | T-15-01 | No exec/spawn in src/ (grep gate) | smoke | `npm run models:fetch` → valid JSON snapshot | ❌ (script is W0) | ⬜ pending |
| 15-02-02 | 02 | 1 | CAT-03/CAT-04 | T-15-02 / T-15-03 | Server-side only, no client leakage | unit + contract | `npx vitest run src/lib/models/catalog.test.ts`; `npm run build` | ❌ W0 | ⬜ pending |
| — | — | 2 | ALL | — | — | — | `npm test` (full suite) | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/models/catalog.test.ts` — pure CAT-03 tests: `opencodeSlugToModelId` (anthropic→raw, `opencode/*`→null, non-anthropic→null); filter (anthropic-only, no dated IDs, allowlist intersect, no `opencode/` leakage)
- [ ] `src/lib/db/queries/userModelSettings.integration.test.ts` — TEST_DATABASE_URL-gated (describe.skip without it, per `enrichment.integration.test.ts`): insert → upsert-update → full-value overwrite; concurrent upserts never half-merge; absence → undefined
- [ ] Extend `src/lib/db/queries/runs.test.ts` — `createRun` persists `modelUsed`/`modelChain` when provided
- [ ] No framework gaps — vitest.config.ts, tsconfig paths, drizzle-orm 0.45.2, drizzle-kit 0.31.10, tsx 4.23.1, vitest 4.1.10 all already installed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `drizzle-kit push` applies schema to live Neon DB | REG-01 | Requires live DATABASE_URL | Run `npx drizzle-kit push`; verify exit 0 and `user_model_settings` + `agent_run.model_used`/`model_chain` present in DB |
| Roster re-verify gate | D-02 | Requires live Anthropic API | `curl https://api.anthropic.com/v1/models` (with key) — confirm `claude-haiku-4-5` before adding to allowlist; else ship sonnet-only |
| Snapshot regenerated and committed | CAT-01 | Requires local opencode CLI | Run `npm run models:fetch`; confirm `catalog.json` valid, non-empty, `generatedAt` present; commit |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** {pending / approved YYYY-MM-DD}
