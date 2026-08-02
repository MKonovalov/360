---
phase: 15
slug: model-registry-foundation-persistence
status: secured
threats_open: 0
asvs_level: 1
created: 2026-08-02
---

# SECURITY.md — Phase 15: Model Registry Foundation + Persistence

**Audit:** retroactive verification of the plan-time threat register against the implemented code.
**Date:** 2026-08-02
**ASVS Level:** 1
**Verdict:** SECURED — 8/8 threats closed (6 mitigate verified, 2 accept verified).
**Files modified by audit:** none (implementation files read-only; this document is the only artifact written).

## Threat Verification

| Threat ID | Category | Disposition | Evidence (file:line) |
|-----------|----------|-------------|----------------------|
| T-15-01 | DoS / Tampering (RCE-adjacent) | mitigate | CLOSED — `scripts/refresh-model-catalog.ts` (repo-root, not `src/`); imports only node builtins (`node:child_process` L10, `node:fs` L11, `node:path` L12); no `src/` import of the script (grep `refresh-model-catalog` in `src/` → 0 hits); CAT-02 gate re-run: `grep -rE "node:child_process\|execFileSync(\|execSync(\|spawnSync(\|spawn(" src/` → 0 hits |
| T-15-02 | Information Disclosure | mitigate | CLOSED — only subprocess calls are `execFileSync(bin, ['models','--verbose'], …)` (L116) and `execFileSync('which', ['opencode'], …)` binary resolution (L20); never `/config/providers`; no dotenv, no `src/` imports, no `.env` read (only `OPENCODE_BIN`/`HOME` path envs); no key material logged (L134 logs write path + count + generatedAt only). Secret scan `sk-|pk_|x-api-key|api_key|ANTHROPIC_API_KEY|PRIVATE KEY|password` over `scripts/ src/lib/models/ src/lib/db/queries/` → only `pk_test_placeholder`/`sk_test_placeholder` literals in DB-gated integration test bootstrap (userModelSettings.integration.test.ts:15-16, enrichment.integration.test.ts:17) — explicit placeholders, not secrets |
| T-15-03 | Information Disclosure | mitigate | CLOSED — `src/lib/models/catalog.ts:1` `import type catalogJson from './catalog.json'` is type-only (erased at compile); module is pure (no db/env/ai imports, no side effects — D-16); only consumer is `catalog.test.ts`; no `use client` in `src/lib/models/`; snapshot intact (1131 models, `generatedAt` present, `claude-sonnet-4-6`/`anthropic` anchor active with `api.url: ""` servable) |
| T-15-04 | Elevation / Spoofing | mitigate | CLOSED — `src/lib/db/schema.ts:288-296` `userModelSettings` stores only `user_id` (text PK), `primary_model` (text), `fallback_models` (text[]), `created_at`, `updated_at` — raw-ID text/text[] only; no key/secret/encrypted column exists on the table |
| T-15-05 | Tampering | mitigate | CLOSED — upsert writes raw IDs typed `string`/`string[]` with no transformation (`src/lib/db/queries/userModelSettings.ts:18-33`); `opencodeSlugToModelId` gates on `startsWith('anthropic/')` BEFORE `slice` (strip-after-filter, `src/lib/models/catalog.ts:17-20`); `getAllowlistedServableIds` = providerID∩status∩allowlist intersection (`catalog.ts:24-28`); `ANTHROPIC_ALLOWLIST = ['claude-sonnet-4-6']` — zero dated IDs (dated forms appear only in the comment as the excluded class, `catalog.ts:9`) |
| T-15-06 | Repudiation | mitigate | CLOSED — `agentRun.modelUsed: text('model_used')` (schema.ts:247) + `modelChain: jsonb('model_chain').$type<string[]>()` (schema.ts:248); `CreateRunInput` carries `modelUsed?`/`modelChain?` (`runs.ts:13-14`) AND explicit `.values()` map carries both keys (`runs.ts:33-34`) |
| T-15-SC (15-01) | Tampering — npm installs | accept | CLOSED (accepted risk documented in 15-01-PLAN.md L193) — zero new packages: git log shows no 15-01 commit (89cc521a, b5c0c366) touched package.json |
| T-15-SC (15-02) | Tampering — npm installs | accept | CLOSED (accepted risk documented in 15-02-PLAN.md L212) — commit 78949d1b diff on package.json adds ONLY `models:fetch` + `db:push` scripts; dependencies block untouched. `tsx`/`drizzle-kit`/`dotenv` pre-date the phase (added in scaffold 79bf5399 and phase-9 f94449f4) |

**Closed: 8/8 | Open: 0/8**

## Advisory cross-check (15-REVIEW.md findings — not register threats)

Cross-checked per audit instructions; both confirmed in code but neither opens a declared register threat:

- **WR-01** (refresh script can silently overwrite the committed snapshot when opencode yields no parseable records): confirmed — `scripts/refresh-model-catalog.ts:126-134` has no post-parse empty guard. This is a robustness gap against snapshot availability, not against the declared T-15-01 mitigation (placement + grep gate), which is fully intact. Recommended fix stands per 15-REVIEW.md (empty-models + anchor abort before `writeFileSync`).
- **WR-02** (committed snapshot lists undated `claude-haiku-4-5` while the D-02 roster verdict in `catalog.ts:7-9` says absent): confirmed — the allowlist∩snapshot filter (`catalog.ts:24-28`) intersects the dated/undated haiku out regardless, so no servable-ID leakage reaches consumers and the T-15-05 mitigation holds. Source-of-truth annotation (opencode registry = menu, live GET /v1/models = gate) recommended per 15-REVIEW.md before Phase 17 consumes the snapshot.

## Unregistered flags

None — neither 15-01-SUMMARY.md nor 15-02-SUMMARY.md carries a `## Threat Flags` section.

## Notes

- Executable gates re-run during this audit: CAT-02 grep gate (0 hits), secret scan (placeholders only), snapshot integrity check (1131 models, anchor present), package.json phase-15 diff (scripts only).
- No source files modified.
