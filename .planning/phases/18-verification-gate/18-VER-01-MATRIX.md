---
status: complete
phase: 18-verification-gate
source: [18-CONTEXT.md, 18-RESEARCH.md]
started: 2026-08-02T15:42:45Z
updated: 2026-08-02T15:47:00Z
---

# Phase 18: VER-01 Traceability Matrix

**Purpose:** Map every Phase 18 requirement (VER-01..04) to its real proof surface — test file, describe block, test name, and assertion — and dispose of all 13 items in the PITFALLS.md "Looks Done But Isn't" checklist onto exactly one proof surface each (D-18-01/D-18-04).

## Requirement → Test → Assertion Map

### VER-01

Failover taxonomy + loop behavior: 401/403/output/schema never advance; RetryError-wrapped 404 advances; exhaustion rethrows; budgets clamp.

| requirement | test file | describe block | test name | assertion |
|-------------|-----------|----------------|-----------|-----------|
| 401 never advances | `src/lib/agents/runAgent.test.ts` | `describe('runAgent failover loop (FAL-03/04)')` | `401 never advances — single attempt, throws (Pitfall 2)` | `rejects.toThrow()`; `generateText` called exactly 1x — 2-model chain never attempted |
| 403 never advances | `src/lib/agents/runAgent.test.ts` | `describe('runAgent failover loop (FAL-03/04)')` | `403 never advances — single attempt, throws (Pitfall 2)` | `rejects.toThrow()`; `generateText` called exactly 1x |
| output/schema errors never advance | `src/lib/agents/runAgent.test.ts` | `describe('runAgent failover loop (FAL-03/04)')` | `output/schema errors never advance — single attempt, throws (D-01)` | `rejects.toThrow()` on `new InvalidResponseDataError({ data: {} })`; called exactly 1x |
| RetryError-wrapped 404 advances | `src/lib/agents/runAgent.test.ts` | `describe('runAgent failover loop (FAL-03/04)')` | `RetryError-wrapped 404 unwraps to model_not_found and still advances (Pitfall 3)` | `generateText` called 2x; result `{ ...resolvedRun, modelUsed: 'claude-sonnet-4-6', usedFallback: true }` |
| 404 advances (existing) | `src/lib/agents/runAgent.test.ts` | `describe('runAgent failover loop (FAL-03/04)')` | `primary 404 advances to the fallback with the fallback budget on attempt 2` | called 2x; attempt-2 timeout `{ totalMs: 50000 }`; `usedFallback: true` |
| 400 never advances (existing) | `src/lib/agents/runAgent.test.ts` | `describe('runAgent failover loop (FAL-03/04)')` | `400 never advances — single attempt, throws (Pitfall 2)` | `rejects.toThrow()`; called exactly 1x |
| 429 never advances (existing) | `src/lib/agents/runAgent.test.ts` | `describe('runAgent failover loop (FAL-03/04)')` | `429 never advances — single attempt, throws (D-01)` | `rejects.toThrow()`; called exactly 1x |
| exhaustion rethrows last error (existing) | `src/lib/agents/runAgent.test.ts` | `describe('runAgent failover loop (FAL-03/04)')` | `chain exhaustion rethrows the LAST error — never a silent switch (D-06)` | `rejects.toThrow(lastErr)`; called 2x |
| per-attempt budgets (existing) | `src/lib/agents/runAgent.test.ts` | `describe('runAgent failover loop (FAL-03/04)')` | `per-attempt { totalMs } budgets: 54s primary, 50s fallback, clamped to loop wall (FAL-04)` | timeouts `{ totalMs: 54000 }` then `{ totalMs: 50000 }` |
| loop-wall clamp (existing) | `src/lib/agents/runAgent.test.ts` | `describe('runAgent failover loop (FAL-03/04)')` | `every attempt is clamped to the remaining loop budget — chain length cannot blow the 60s wall (WR-03)` | 3 timeouts monotonically non-increasing, first ≤ 54000 |
| RetryError-wrapped 5xx (existing) | `src/lib/agents/runAgent.test.ts` | `describe('runAgent failover loop (FAL-03/04)')` | `RetryError-wrapped 5xx unwraps and still advances (Pitfall 3)` | called 2x; `usedFallback: true` |
| taxonomy never-eligible set | `src/lib/agents/modelConfig.test.ts` | `describe('classifyModelError')` | 7 tests (400/401/403/422/429/output/config never eligible; 404/5xx/connection/NoSuchModel eligible) | `classifyModelError(...)` + `isFailoverEligible(...)` pair assertions per code |

### VER-02

Allowlist ∩ snapshot → servable IDs (no dated/opencode leakage); chain resolution default/partial/full; save-side allowlist gate.

| requirement | test file | describe block | test name | assertion |
|-------------|-----------|----------------|-----------|-----------|
| allowlist ∩ snapshot → servable IDs (9 tests — corrected count, not 11; RESEARCH Pitfall 2) | `src/lib/models/catalog.test.ts` | `describe('getAllowlistedServableIds')` | `returns exactly the allowlisted, non-deprecated anthropic raw IDs — no dated-ID leakage, no opencode/ leakage (CAT-03)` + `committed 1131-model snapshot yields exactly the servable allowlist — zero leakage (CAT-03)` | fixture and committed `catalog.json` both yield `['claude-sonnet-4-6']`; `.some((id) => id.includes('/'))` is `false` |
| chain resolution default/partial/full | `src/lib/agents/modelConfig.test.ts` | `describe('resolveModelChain')` | `defaults to [FAST_MODEL_ID] when settings are absent (REG-05)`, `dedupes a repeated model before attempting (D-08)`, `caps at primary + 1 fallback AFTER dedupe (D-10)`, `drops non-allowlisted ids (Pitfall 1/7 — the allowlist gate)`, `falls back to [FAST_MODEL_ID] when every id is filtered out`, `a partial chain (primary + one fallback) passes through intact when allowlisted` | default/partial/full matrix cell-for-cell: `['a','b']`, cap `['a','b']`, allowlist-drop, full-default |
| save-side allowlist gate | `src/app/actions/settings.test.ts` | `describe('saveSettingsAction security matrix (T-17-02..06)')` | 7 tests: valid chain saves; malformed input rejected before write; >2 fallbacks rejected; non-servable id rejected; primary-in-fallbacks rejected (D-08); duplicate fallback rejected (D-09); upsert throw → `action_failed` | gate-first ordering + server-computed servable-set check + never-thrown error mapping |

### VER-03

Settings → Analyze → `agent_run.model_used` loop (Pitfall 10). Proven by live-browser UAT — see `18-UAT.md` test 1 (executed in plan 18-03).

| requirement | test file | describe block | test name | assertion |
|-------------|-----------|----------------|-----------|-----------|
| `agent_run.model_used` equals the saved primary (Pitfall-10 wording) | `18-UAT.md` test 1 (live run, `npm run dev` + staff account) | — (manual) | Settings → pick primary → save → run Analyze | `SELECT model_used, model_chain FROM agent_run ORDER BY id DESC LIMIT 1;` → `model_used` == saved primary |

> **NOTE (RESEARCH Pitfall 5):** `usedFallback` is response-only (`src/app/api/companies/[id]/analyze/route.ts:111`), never a DB column — assert on `model_used` / `model_chain` only.

### VER-04

No subprocess surface in `src/`; preview renders from the committed snapshot.

| requirement | test file | describe block | test name | assertion |
|-------------|-----------|----------------|-----------|-----------|
| zero subprocess in `src/` (ASVS V7) | grep gate (exact command from 15-VERIFICATION Truth 8) | — | `grep -rE "node:child_process\|execFileSync(\|execSync(\|spawnSync(\|spawn(" src/` | 0 hits (re-verified in plan 18-03) |
| preview renders from committed snapshot | preview-URL render check (executed in plan 18-03) | — | open Settings on preview URL | no 500, no empty state, no `opencode/` rows — list renders from allowlist/cached source |

## Looks Done But Isn't Checklist Map (D-18-04)

All 13 items copied verbatim from `.planning/research/PITFALLS.md:347-359` (13 items — not 12; RESEARCH Pitfall 1). Each item lands on exactly one proof surface.

| # | Checklist item (verbatim) | Disposition | Proof |
|---|---------------------------|-------------|-------|
| 1 | **Settings actually consumed:** change primary → run Analyze → `agent_run.model_used` equals the new primary (the milestone's core acceptance test; Pitfall 10). | new-work | `18-UAT.md` test 1 (VER-03 live run) + `SELECT model_used, model_chain FROM agent_run ORDER BY id DESC LIMIT 1;` |
| 2 | **Chain stored as raw provider IDs:** no `/` in any saved model value; DB values are directly usable by `anthropic(...)` (Pitfall 1). | covered-by-existing-test | `catalog.test.ts` `committed 1131-model snapshot yields exactly the servable allowlist — zero leakage (CAT-03)` — zero-`/` guard |
| 3 | **Only usable models offered:** the settings response contains zero `opencode/`, `gpt-*`, `gemini-*` rows while only Anthropic is configured (Pitfall 7). | covered-by-existing-test | `catalog.test.ts` `returns exactly the allowlisted, non-deprecated anthropic raw IDs — no dated-ID leakage, no opencode/ leakage (CAT-03)` (fixture) + real-snapshot test |
| 4 | **List works without opencode:** deploy a Vercel preview, open Settings — list renders from the allowlist/cached source, no 500, no empty state (Pitfall 8). | new-work | VER-04 preview-URL render check (executed in plan 18-03) |
| 5 | **404 triggers fallback:** mock/force a dead primary → fallback runs → audit records `model_used` = fallback + the 404 attempt (Pitfall 2, 3, 5). | covered-by-existing-test | `runAgent.test.ts` `primary 404 advances to the fallback with the fallback budget on attempt 2` + `RetryError-wrapped 404 unwraps to model_not_found and still advances (Pitfall 3)` |
| 6 | **400/401/429 never chain-switch:** force each — run fails loud in one attempt with the right structured reason (Pitfall 2, 3). | covered-by-existing-test | `runAgent.test.ts` `400 never advances`, `401 never advances`, `429 never advances — single attempt, throws (D-01)` |
| 7 | **Budget holds:** with a slow-but-working primary and one fallback, the run completes under 60s — no new 504s (Pitfall 4, 6). | covered-by-existing-test | `runAgent.test.ts` `per-attempt { totalMs } budgets: 54s primary, 50s fallback, clamped to loop wall (FAL-04)` + `every attempt is clamped to the remaining loop budget — chain length cannot blow the 60s wall (WR-03)` |
| 8 | **Mid-run edit is inert:** start Analyze, change Settings mid-run — the run's audit row reflects the snapshot, not the new config (Pitfall 9). | covered-by-existing-test | `analyzeCompany.test.ts` `resolves the user chain snapshot-at-entry and passes LanguageModel[] to runAgent (FAL-01/Pitfall 11)` |
| 9 | **Concurrent saves don't lose updates:** two tabs saving different chains → last write wins wholesale, no half-merged chain (Pitfall 9). | covered-by-existing-test | 15-VERIFICATION executed run (4/4, 2026-08-02 — `userModelSettings.integration.test.ts` concurrent-upsert case). Integration suite self-skips without `TEST_DATABASE_URL` (RESEARCH Pitfall 3) — do not claim plain `npm test` proves it |
| 10 | **Audit survives Langfuse absence:** with Langfuse keys unset (D-15), `agent_run.model_used`/`model_chain` are still recorded (Pitfall 5). | covered-by-existing-test | `src/lib/db/queries/runs.test.ts` `persists modelUsed + modelChain when provided (REG-04)` |
| 11 | **No subprocess calls in `src/`:** grep for `exec|spawn|child_process` returns nothing (Pitfall 8). | new-work | grep gate `grep -rE "node:child_process\|execFileSync(\|execSync(\|spawnSync(\|spawn(" src/` → 0 hits (plan 18-03) |
| 12 | **Existing tests still pass:** `runAgent`'s default-model test (`anthropic('claude-sonnet-4-6')`) is updated deliberately, not deleted — the default is "no settings configured," not a shadow (Pitfall 10). | covered-by-existing-test | `runAgent.test.ts` `defaults to the fast Anthropic model (T-09-SC model-string re-verify)` — pins `anthropic('claude-sonnet-4-6')`; full `npm test` green at wave gate |
| 13 | **Failover is observable in the trace:** a failed-primary run shows two inference spans (each with `ai.model.id`) under one Langfuse trace with telemetry metadata (Pitfall 5). | new-work | `18-UAT.md` (absorbs 16-HUMAN-UAT item 2 — Langfuse per-attempt span check, live run) |

## Dispositions

1. **SC-3 forced-fail clause (ROADMAP:146):** recorded as `satisfied-by-extension via runAgent.test.ts RetryError-404 + exhaustion tests (D-18-02)` — there is no browser-level forced-fail mechanism this milestone (zero production code changes, D-18-02); the loop-level Vitest tests are the reproducible forced-fail proof (RESEARCH Pitfall 6).
2. **Count corrections (RESEARCH Pitfalls 1-2):** the checklist is **13 items, not 12** (verified by direct line count, PITFALLS.md:347-359); `catalog.test.ts` has **9 tests, not 11** (verified count: 4 slug-filter + 1 allowlist∩snapshot + 1 allowlist + 1 FAST_MODEL_ID + 2 displayName — grows to 10 with the additive real-snapshot test).

_Verified:_ 2026-08-02
_Artifact:_ 18-VER-01-MATRIX.md (plan 18-01, task 18-01-03)
