---
phase: 20-cross-provider-run-path
plan: 04
subsystem: api
tags: [route-handler, status-map, billing, rate-limit, not-configured, audit, fal-05, fal-02, fal-04]

# Dependency graph
requires:
  - phase: 20-cross-provider-run-path plan 03
    provides: AnalyzeResult union with 'billing' reason + missingKey?/message? payload fields; FIRECRAWL-only fast gate + chain-aware missingProviderKey (FAL-04); diagnostics-split rate_limited message
  - phase: 20-cross-provider-run-path plan 02
    provides: modelUsed: modelIdOf(models[i]) verbatim loop return + isOpenRouterPlatformRateLimit diagnostics helper (FAL-05 audit identity)
provides:
  - Route status map completing D-20-09/10/11: not_configured → 400 naming the missing key (was 503/D-15), billing → 402 'provider credits exhausted' (FAL-02), rate_limited → 429 with the platform/upstream reason; gate_failed 422 / company_not_found 404 / db_error 502 / default 502 / l.61 analysis_failed 502 catch-all byte-identical (D-20-11 minimal blast radius)
  - FAL-05 audit wiring VERIFIED end-to-end (loop → analyzeCompany → createRun): modelUsed/modelChain flow as raw ids verbatim incl. ~latest aliases; provider identity resolution smoke-locked for concrete slug + slashed slug + ~latest alias
  - Full gate green: 335 tests / 6 skipped, tsc 0 errors, next build exit 0
affects: [Phase 21 Settings UI missing-key hints (D-20-04), Phase 22 UAT error matrix + openrouter-only-chain UAT, phase verification gate (aggregate/security/code review/regression/drift)]

# Tech tracking
tech-stack:
  added: []
  patterns: [route switch extends exactly the three NEW classes, rest byte-identical (D-20-11), why-comments updated on the changed cases only; audit wiring verified by grep + tsx identity smoke (no new plumbing, RESEARCH caveat 6)]

key-files:
  created: []
  modified:
    - src/app/api/companies/[id]/analyze/route.ts

key-decisions:
  - "D-20-09/10/11 execution: not_configured → 400 with message naming the missing key (undefined on the bare FIRECRAWL fast-gate path — JSON drops it); billing → 402 'provider credits exhausted'; rate_limited → 429 with result.message; the 502 family untouched"
  - "FAL-05 is verification-only (RESEARCH caveat 6): Phase 19/20-02 already wired modelUsed/modelChain; proven by 3 greps + a tsx identity smoke rather than new code"
  - "The catalog stores ~latest aliases with a LEADING ~ ('~anthropic/claude-sonnet-latest'), not 'anthropic/claude-sonnet-latest' — the plan's smoke literal would fail; corrected smoke uses the real alias and still proves the FAL-05 intent (ids resolve to providers, flow verbatim)"

patterns-established:
  - "Pattern: status-map extension with minimal blast radius — only the NEWLY-distinct classes get statuses; the D-20-11 invariant is grep-verifiable (503 count 0, 502 family count stable)"

requirements-completed: [FAL-02, FAL-04, FAL-05]

# Metrics
duration: 2min
completed: 2026-08-02
---

# Phase 20 Plan 4: Route Status Map + FAL-05 Audit Verification Summary

**The analyze route now surfaces the three NEWLY-distinct AnalyzeResult classes with their own HTTP statuses — not_configured → 400 naming the missing key (was 503), billing → 402 "provider credits exhausted", rate_limited → 429 with the platform/upstream reason — while the entire 502 family stays byte-identical (D-20-11), and the FAL-05 model_used/model_chain audit wiring is proven provider-accurate end-to-end (loop → analyzeCompany → createRun) by grep + a tsx identity smoke, closing the final wave of Phase 20 with a green full-suite/typecheck/build gate**

## Performance

- **Duration:** 2 min
- **Started:** 2026-08-02T21:20:50Z
- **Completed:** 2026-08-02T21:22:56Z
- **Tasks:** 2 (both `type="auto"`, no checkpoints)
- **Files modified:** 1 (Task 2 is verification-only — zero code changes, per RESEARCH caveat 6)

## Accomplishments
- `case 'not_configured':` returns `{ error: 'not_configured', message: result.missingKey ? \`${result.missingKey} not configured\` : undefined }` with `status: 400` — the D-15 503 is gone (grep count 0); the bare FIRECRAWL fast-gate path (no missingKey) intentionally yields `undefined` (JSON drops it), staff see which provider key to configure (D-20-01/04)
- NEW `case 'billing':` returns `{ error: 'billing', message: result.message ?? 'provider credits exhausted' }` with `status: 402` (FAL-02/D-20-10) — distinct status so the UI can branch on billing vs a generic 502
- `case 'rate_limited':` returns `{ error: 'rate_limited', message: result.message }` with `status: 429` — the D-04 502 carve-out is re-mapped to a true 429 carrying the platform-vs-upstream reason produced by the runAgent diagnostics helper (D-20-07/09)
- Untouched per D-20-11 (verified by grep): `gate_failed` 422, `company_not_found` 404, `db_error` 502, `default` 502, the l.61 `analysis_failed` catch-all (String(err)) 502, and the persist-failure 502 — all byte-identical
- FAL-05 audit wiring verified (NOT re-plumbed): `modelUsed: modelIdOf(models[i])` in the runAgent loop return → `modelUsed: run.modelUsed` + `modelChain` in analyzeCompany's ok:true → `modelUsed: result.modelUsed, modelChain: result.modelChain` into `createRun` (the durable agent_run columns, D-14) — three greps match 1/1/1
- tsx identity smoke proves provider resolution for all three id shapes: concrete slug `claude-sonnet-4-6` → anthropic, slashed slug `anthropic/claude-sonnet-4.6` → openrouter, and the real `~latest` alias `~anthropic/claude-sonnet-latest` → openrouter (prints `OK audit identity resolves`) — raw ids flow verbatim, no transformation (D-04/FAL-05)
- Deferred boundaries hold (D-20-05/06): `mid-stream` appears only in the 4 comment-only documentation sites (modelConfig.ts:65 output-branch note, runAgent.ts:48/104/121 loop + helper notes); `stream_aborted` has ZERO matches in non-test source — no detection/reclassification path was added
- Full gate: `npx vitest run` 335 passed / 6 skipped, `npx tsc --noEmit` 0 errors, `npm run build` exit 0 (env.local present; no installs, no package.json changes — T-20-SC accept)

## Task Commits

Each task was committed atomically:

1. **Task 1: route.ts — D-20-09/10/11 status map (not_configured→400, billing→402, rate_limited→429)** - `57637751` (feat)
2. **Task 2: FAL-05 audit wiring verification + full-suite/typecheck/build gate** - no commit (verification-only task per RESEARCH caveat 6 — zero code changes; all evidence recorded in this SUMMARY)

**Plan metadata:** `(pending — committed with state updates after this file)`

## Files Created/Modified
- `src/app/api/companies/[id]/analyze/route.ts` - The `if (!result.ok) switch` gains the `billing` case and re-maps `not_configured` (503→400 with missingKey message) and `rate_limited` (502→429 with result.message); why-comments updated on exactly those three cases (D-20-01/09/10/07); everything else in the file byte-identical

## Decisions Made
None beyond the plan's locked decisions (D-20-01/04/07/09/10/11, FAL-02/FAL-04/FAL-05, D-04 verbatim ids, D-14 durable audit) — the plan was executed as written, with two plan-documentation discrepancies resolved in favor of the plan's own intent (see Issues Encountered).

## Deviations from Plan

None requiring deviation-rule action — the two adjustments below are plan-documentation inconsistencies (verify-grep/smoke vs reality), resolved inline without changing plan intent or behavior.

## Issues Encountered
1. **Plan Task-2 smoke literal `anthropic/claude-sonnet-latest` is not in the catalog (Task 2):** the committed snapshot stores `~latest` aliases with a LEADING `~` (`~anthropic/claude-sonnet-latest`); the plan's literal `anthropic/claude-sonnet-latest` returns `null` from `getProviderForModelId` and the smoke throws `Error: alias resolution`. Resolved by running the corrected smoke against the REAL alias id — `getProviderForModelId(catalogJson, '~anthropic/claude-sonnet-latest')` → `'openrouter'` — plus the concrete `claude-sonnet-4-6` → anthropic and slashed `anthropic/claude-sonnet-4.6` → openrouter. The FAL-05 acceptance criterion (ids resolve to providers; flow verbatim) is satisfied exactly.
2. **Plan Task-1 verify-grep `status: 400` count is 2, not 1 (Task 1):** the plan's automated verify expects exactly one `status: 400` in route.ts, but the pre-existing `invalid_id` case at l.33 also returns 400 (untouched, out of scope per D-20-11). Actual count after the change: 2 (`invalid_id` + `not_configured`). The acceptance criterion — `case 'not_configured':` returns `{ error: 'not_configured', message: ..., status: 400 }` referencing `result.missingKey` — is met (verified by the precise case-pattern grep). Documented rather than contorting the code to satisfy a count-based grep.

## User Setup Required

None - no external service configuration required (no installs, no env additions; both provider keys already declared and the local `.env.local` exists for the build gate).

## Next Phase Readiness
- Phase 20 is complete (4/4 plans): the cross-provider run path now classifies, gates, hops, and surfaces every new failure mode distinctly — Phase 21 (Settings UI) consumes the named `missingKey` for provider-scoped pickers/hints (D-20-04), and Phase 22's UAT asserts the error matrix (billing 402 / rate_limited 429 / bare-not_configured 400, openrouter-only chains) plus the FAL-05 audit columns (`agent_run.model_used`/`model_chain` hold raw ids verbatim, `~latest` aliases included)
- The orchestrator's post-execution gates (aggregate, security, code review, regression, drift, phase verification) run next; threat register T-20-10/11/12 mitigations are all satisfied (constants-only message surfacing, no client input reaches the switch, audit ids flow only from the run's actual return)

---

*Phase: 20-cross-provider-run-path*
*Completed: 2026-08-02*

## Self-Check: PASSED

- Files: `src/app/api/companies/[id]/analyze/route.ts` (modified), `.planning/phases/20-cross-provider-run-path/20-04-SUMMARY.md` (created) — FOUND
- Commits: `57637751` (Task 1) — present in git log
- Full suite: 335 passed / 6 skipped; `npx tsc --noEmit` exit 0; `npm run build` exit 0
