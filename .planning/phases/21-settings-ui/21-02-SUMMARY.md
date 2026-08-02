---
phase: 21-settings-ui
plan: 02
subsystem: ui
tags: [vitest, tdd, pure-logic, client-safe, model-picker, sett3, sett4, sett6, sett7, sett8]

# Dependency graph
requires:
  - phase: 19-provider-registry
    provides: catalog.ts type-only import source (ModelProviderId) — erased at compile; no value import, no snapshot in the client bundle
provides:
  - src/components/settings/model-picker-logic.ts — client-safe pure decision module: ServableModel prop type, providerName, searchValue, suffixLabel, isHighCost, primaryAfterProviderSwitch, staleIds, groupByProvider, optionsForSlot
  - src/components/settings/model-picker-logic.test.ts — 21-test Vitest suite (node env) locking SET-03/04/06/07/08 semantics, inline fixture decoupled from catalog.json
  - The unit-testable Wave 0 gap closed: pickers/form decision logic now testable under the repo's node-env Vitest (no component test infra — VALIDATION.md §Wave 0)
affects: [Plan 21-03 page.tsx widening (ServableModel import), Plan 21-04 model-picker.tsx wrapper (searchValue/suffixLabel/isHighCost/groupByProvider/providerName), Plan 21-05 form swap (primaryAfterProviderSwitch/staleIds/optionsForSlot), Phase 22 verification gate, SET-03/04/06/07/08]

# Tech tracking
tech-stack:
  added: [] (no new dependencies — reuses existing vitest 4.1.10)
  patterns: [pure client-safe decision module (explorer-format.tsx precedent): named exports only, single type-only import, zero snapshot references, why-comments; TDD RED/GREEN commit pairing (test commit strictly precedes feat commit); inline test fixture decoupled from catalog.json (catalog.test.ts convention)]

key-files:
  created:
    - src/components/settings/model-picker-logic.ts
    - src/components/settings/model-picker-logic.test.ts

key-decisions:
  - "ServableModel six-field shape { id, name, family, providerID, costInput, costOutput } defined once in model-picker-logic.ts — the shared prop type page.tsx (21-03), the wrapper (21-04), and the form (21-05) all import"
  - "The module's ONLY import is `import type { ModelProviderId } from '@/lib/models/catalog'` — erased at compile (isolatedModules); a value import would drag the 1131-row snapshot into the client bundle (T-17-09)"
  - "Task 1/2 executed as one TDD cycle per the plan's tdd=true flag on Task 1: the full suite was authored in Task 1's RED phase (failing, committed test) and the module implemented in GREEN — Task 2's deliverable is the RED test commit; its acceptance criteria verified post-GREEN"
  - "The module's why-comment names the client-safety rationale without the literal string 'catalog.json' — the acceptance-criteria grep canary (catalog.json → 0) must stay clean while the reasoning stays documented"

patterns-established:
  - "Pattern: client-safety grep canary — `grep -c \"catalog.json\" <client module>` must be 0; keep the T-17-09 why-comment but phrase it so the canary never trips"
  - "Pattern: optionsForSlot slotIndex convention — fallback slot index excludes primary + other fallbacks but keeps the slot's own id; slotIndex = -1 (primary picker) excludes primary AND all fallbacks so Save can never hit duplicate_model (RESEARCH Open Question 3)"

# NOTE: requirements-completed is deliberately [] — this plan delivers the unit-testable
# logic layer only; SET-03/04/06/07/08 acceptance is UI-visible behavior (hint, grouped
# pickers, search UX, rendered labels, form staleness gate + captions) landing in
# 21-03/21-04/21-05. Same rationale as 21-01 leaving SET-06 open. requirements-completed: []

# Metrics
duration: 3min
completed: 2026-08-02
---

# Phase 21 Plan 2: Client-Safe Picker Decision Module + Vitest Suite Summary

**Pure client-safe picker decision module (search composite, suffix labels, high-cost predicate, provider-switch reset reducer, union staleIds, provider grouping, slot dedupe, provider-name map) with a 21-test node-env Vitest suite — the Wave 0 gap that makes SET-03/04/06/07/08 unit-testable for the 21-03/21-04/21-05 consumers**

## Performance

- **Duration:** 3 min
- **Started:** 2026-08-02T23:09:46Z
- **Completed:** 2026-08-02T23:12:11Z
- **Tasks:** 2 (both `type="auto"`, no checkpoints; Task 1 `tdd="true"`)
- **Files modified:** 2 (both created)

## Accomplishments
- `src/components/settings/model-picker-logic.ts` ships the full pinned export set exactly per RESEARCH Pattern 2 / PATTERNS §model-picker-logic.ts: `ServableModel` (six-field prop shape — the shared type for 21-03/21-04/21-05), `providerName` (D-21-09), `searchValue` (D-21-07 id-first composite), `suffixLabel` (D-21-12 `~`/`:free` order lock), `isHighCost` (D-21-13, inclusive `>= 50`), `primaryAfterProviderSwitch` (D-21-01 keep-if-valid → reset-to-provider-default, draft-only by design), `staleIds` (D-21-14 union-wide, `''` never stale), `groupByProvider` (D-21-08, insertion-order keys, no family subgroups), `optionsForSlot` (D-08/D-09 widened to the union; `slotIndex = -1` primary-direction dedupe — Open Question 3)
- **Client-safe (T-17-09):** the ONLY import is `import type { ModelProviderId } from '@/lib/models/catalog'` (erased at compile under isolatedModules); zero `catalog.json` references (grep canary = 0); no `'use client'` directive needed — pure functions, `explorer-format.tsx` precedent
- `model-picker-logic.test.ts` locks every locked semantics with 21 passing tests across 8 Given/When/Then describe blocks: search composite round-trip uniqueness (the Pitfall 3 reverse-lookup precondition), suffix-label order lock, high-cost threshold inclusive at 50, keep-if-valid→reset matrix, union staleness with `''` immunity, provider grouping with first-seen key order, both-direction slot dedupe, and the provider-name map
- Full repo suite regression-checked: 30 files / 356 tests pass (2 files / 6 tests skipped, pre-existing); `npx tsc --noEmit` exits 0
- TDD gate compliance: `test(...)` commit (`35617605`) strictly precedes `feat(...)` commit (`0c69783f`) in git history

## Task Commits

Each task was committed atomically:

1. **Task 1: model-picker-logic.ts — pure client-safe picker decision module** - `0c69783f` (feat)
   - **Task 1 RED phase (tdd=true, test-first):** `35617605` (test) — the full failing suite authored before any implementation
2. **Task 2: model-picker-logic.test.ts — Vitest suite locking SET-03/04/06/07/08** - `35617605` (test)

**Plan metadata:** (final docs commit follows)

_Note: Task 1's tdd=true flag makes the Task 1/2 pair a single RED/GREEN cycle — Task 2's deliverable (the test suite) was authored as Task 1's RED commit, which is also the TDD RED gate. Task 2's acceptance criteria were verified post-GREEN (all 8 describe blocks present, suite green)._

## Files Created/Modified
- `src/components/settings/model-picker-logic.ts` - Pure client-safe decision module: `ServableModel` type + 8 functions (providerName, searchValue, suffixLabel, isHighCost, primaryAfterProviderSwitch, staleIds, groupByProvider, optionsForSlot). Single type-only import; zero snapshot references; why-comments at every non-obvious decision (D-locked)
- `src/components/settings/model-picker-logic.test.ts` - 21-test Vitest suite (node env) over the pure module: 8 describe blocks mirroring the plan's required blocks; inline 5-row fixture (dup-name pair, o1-pro high-cost row, `~` alias, `:free` row) decoupled from catalog.json; Given/When/Then comments

## Decisions Made
- `ServableModel` defined once here with all six fields — the shared prop type the 21-03/21-04/21-05 consumers import (avoids three drifting local copies)
- Type-only `ModelProviderId` import chosen over redeclaring the union locally (plan offered both) — the union cannot drift from catalog.ts, and the import is erased at compile so client-safety holds
- `suffixLabel` check order locked as written: `startsWith('~')` wins over `endsWith(':free')` — verified zero overlap in production (11 `~latest` + 14 `:free`), so the null case is the else and the order-lock test pins it
- Task 1/2 executed as one TDD cycle (RED suite commit → GREEN module commit) rather than module-then-suite, honoring the plan's `tdd="true"` flag on Task 1

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Why-comment tripped the client-safety grep canary**
- **Found during:** Task 1 GREEN verification (the plan's own verify chain)
- **Issue:** The module header why-comment literally named `catalog.json` ("a value import of catalog.ts would drag catalog.json into the client bundle") — the acceptance-criteria grep `catalog.json` → 0 counted it and the verify chain failed
- **Fix:** Rephrased the comment to "the committed model snapshot (1131 rows incl. costs)" — the T-17-09 rationale stays documented, the canary stays clean
- **Files modified:** src/components/settings/model-picker-logic.ts (comment only)
- **Verification:** Full verify chain green — all 6 acceptance greps + `npx tsc --noEmit` + suite green
- **Committed in:** `0c69783f` (Task 1 GREEN commit)

### Process note (not a deviation — execution ordering)

The plan lists Task 1 (module) before Task 2 (suite), but Task 1 carries `tdd="true"`. Per the TDD contract (RED test commit must precede GREEN feat commit — and the tdd_execution flow requires the test commit to be the RED gate), the suite was authored in Task 1's RED phase. Task 2 therefore has no separate commit: its deliverable is the RED `test(...)` commit `35617605`, and all its acceptance criteria (8 describe blocks, both reducer branches, both labels + null, isHighCost true+false, `''` not stale, slotIndex -1 dedupe, suite exit 0) were verified after GREEN. This is the same test-first intent the plan's must_haves truth states ("Every pure decision … is unit-testable in the node-env Vitest").

---

**Total deviations:** 1 auto-fixed (1 Rule 1 — comment-only fix, zero behavior change)
**Impact on plan:** Minimal. The fix was required for the plan's own acceptance grep to pass; no scope creep, no architectural change.

## Issues Encountered
- The plan's `verify` grep chain for Task 1 uses `grep -v '^#'` to exclude comment lines before counting `^import ` — this only filters `#`-prefixed lines, not `//` comments; it worked because the module's import is the only `^import ` line regardless. No action needed beyond the comment rephrase above.

## User Setup Required
None - no external service configuration required (no env changes, no new npm dependencies — vitest was already present).

## Next Phase Readiness
- Plan 21-03 (`settings/page.tsx` widening) imports `ServableModel` from `model-picker-logic` and builds the `servableByProvider`/`unionServableModels`/`defaults`/`savedChain` props per PATTERNS §page.tsx — the prop types it needs are now defined and locked here
- Plan 21-04 (`model-picker.tsx` wrapper) consumes `searchValue`/`suffixLabel`/`isHighCost`/`groupByProvider`/`providerName` with verified semantics; the wrapper must still pass `data-checked={value === m.id}` per `CommandItem` (cmdk 1.1.1 never emits `data-checked` — PATTERNS Pitfall 1)
- Plan 21-05 (form swap) consumes `primaryAfterProviderSwitch` (D-21-01 keep-if-valid → reset, draft-only) and `optionsForSlot` (both directions) — the dup-chain prevention is now test-locked so Save can never hit `duplicate_model`
- SET-03/04/06/07/08 unit coverage is complete at the pure-logic level; the visible requirement behavior (picker UX, provider selector, badges, reset hint) completes in 21-04/21-05 — those requirements should only be marked complete once the UI lands

---

*Phase: 21-settings-ui*
*Completed: 2026-08-02*
