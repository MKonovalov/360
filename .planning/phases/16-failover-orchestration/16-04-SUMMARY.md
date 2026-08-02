---
phase: 16-failover-orchestration
plan: 04
subsystem: ui
tags: [failover, rate-limit, status-strip, error-copy, client-component, react]

# Dependency graph
requires:
  - phase: 16-01
    provides: classifyModelError rate_limited reason + getModelDisplayName (D-06 display-name helper)
  - phase: 16-03
    provides: flat { modelUsed, modelUsedName, usedFallback } fields on the 201 analyze response (soft coupling — typed optional, absent-safe)
provides:
  - AnalyzeRunStatus rate_limited ERROR_COPY row (D-04 staff copy)
  - Success-after-fallback note appended to the success line (D-06), driven by usedFallback + modelUsedName
  - RunState success variant extended with modelUsed/modelUsedName/usedFallback (flat shape)
affects: [Phase 17 model settings UI (display-name consumption pattern), Phase 18 VER-03 live-browser UAT]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Flat optional API-response fields typed into client RunState — defensive rendering via modelUsedName ?? modelUsed, never imports the server-only catalog (D-07)"
    - "ERROR_COPY reason→copy table extension — one new row for a distinct structured reason (D-04), non-failover classes keep the generic analysis_failed row"

key-files:
  created: []
  modified: [src/components/agents/analyze-run-status.tsx]

key-decisions:
  - "Rate-limited runs render 'Rate limited — try again in a moment' via the existing errorMessage() lookup — failure render untouched (D-04)"
  - "Fallback note appends ONLY when usedFallback is truthy; normal success stays exactly 'Analysis complete' (D-06)"
  - "Display name is server-computed (modelUsedName from catalog via the route, D-07); the component falls back to the raw modelUsed id when the name is absent"

patterns-established:
  - "Pattern: optional response fields flow through fetch-cast → setState → template-literal render with a ?? fallback to the raw id (no nested-object assumptions — flat shape per OQ-2)"

requirements-completed: [FAL-05]

# Metrics
duration: 5min
completed: 2026-08-02
---

# Phase 16 Plan 4: Failover Result Surface in the Analyze Status Strip Summary

**D-04 `rate_limited` staff copy row ('Rate limited — try again in a moment') + D-06 success-after-fallback note (' — ran on {display name} (fallback)') in AnalyzeRunStatus, driven by the flat optional { modelUsed, modelUsedName, usedFallback } API response fields, with zero new dependencies**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-02T10:59:00Z
- **Completed:** 2026-08-02T11:04:12Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- ERROR_COPY gains exactly one new row — `rate_limited: 'Rate limited — try again in a moment'` (D-04, the ONLY new reason row). It flows through the existing `errorMessage()` lookup automatically, so the failure render (L142-158) needed zero changes.
- RunState success variant extended with `modelUsed?: string; modelUsedName?: string; usedFallback?: boolean` — flat shape per the locked API contract; all three typed optional so 16-03's absence cannot break this build (soft coupling honored).
- Success render appends the D-06 fallback note ONLY when `usedFallback` is truthy: `Analysis complete — ran on {modelUsedName ?? modelUsed} (fallback)`. Normal success stays exactly `Analysis complete`. The `Review N proposals` Link and surrounding chrome are unchanged.
- `run()`'s fetch json cast now includes the three fields and passes them through into `setState`; `router.refresh()` retained.
- No imports added/removed; no new dependencies; catalog never imported into the client bundle (D-07).

## Task Commits

Each task was committed atomically:

1. **Task 1: analyze-run-status.tsx — rate_limited copy row + success-line fallback note** - `4a11f3df` (feat)

**Plan metadata:** No metadata-only commit — orchestrator owns STATE.md/ROADMAP.md writes in this run.

## Files Created/Modified
- `src/components/agents/analyze-run-status.tsx` - MODIFIED. ERROR_COPY `rate_limited` row (D-04); RunState success variant extended with modelUsed/modelUsedName/usedFallback; `run()` fetch-cast + setState passthrough of the three flat fields; success render appends the fallback note when `usedFallback` is truthy (D-06).

## Decisions Made
- Followed the plan exactly — no decisions deviated from the locked D-04/D-06/D-07 contract.
- Display name comes from the server-computed `modelUsedName` (catalog `name` via the 16-03 route); the component's `?? modelUsed` fallback covers a missing name without ever importing the server-only catalog (D-07).

## Deviations from Plan

None - plan executed exactly as written. All four edits match the PLAN.md action spec verbatim; acceptance criteria and verification gates pass.

## Issues Encountered
- Pre-existing `react-hooks/immutability` lint error on `src/components/agents/analyze-run-status.tsx` (L69 `void run()` referenced before the `run` declaration at L76). Verified present in HEAD before this plan's diff — the effect/declaration region was untouched. Logged to `deferred-items.md` per scope-boundary rules (same rule already tracked repo-wide, e.g. Phase 02's `sidebar-resize-handle.tsx`). `npx tsc --noEmit` exits 0, and Next 16 does not run ESLint during builds, so this does not block the build.

## User Setup Required

None - no external service configuration required. Zero new packages (T-16-SC: no install surface).

## Next Phase Readiness
- **Phase 17 (model settings UI):** `getModelDisplayName` consumption pattern established (server-computed name, raw-id fallback) — the pickers can reuse the same display-name helper.
- **Phase 18 (verification gate):** VER-03 live-browser UAT now has its target behavior defined: rate-limited run → "Rate limited — try again in a moment"; fallback run → "Analysis complete — ran on {name} (fallback)"; normal success → exactly "Analysis complete". Needs 16-03's route emitting the flat fields to be observable end-to-end.

---

*Phase: 16-failover-orchestration*
*Completed: 2026-08-02*
