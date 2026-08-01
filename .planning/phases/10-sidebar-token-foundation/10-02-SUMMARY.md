---
phase: 10-sidebar-token-foundation
plan: 02
subsystem: testing
tags: [vitest, nav, active-route, pure-function, boundary-guard, qlty-01]

# Dependency graph
requires:
  - phase: 03
    provides: routes /companies/[id], /personas/[id] whose active highlighting this function hardens
provides:
  - "getActiveNavKey(pathname): NavKey | null — pure, boundary-guarded active-route detection"
  - "NavKey union type ('start' | 'companies' | 'personas' | 'reviews')"
  - "11-case Vitest regression suite locking the /companies/[id] detail highlight and /companies-archive sibling-prefix guard"
affects: [11-consumer-restyle, phase-11, phase-14-contrast-audit]

# Tech tracking
tech-stack:
  added: []  # zero new packages — vitest ^4.1.10 already installed
  patterns:
    - "Pure named-export lib module with 3-4 line why-comment (dedupKeys.ts analog)"
    - "Total-function discipline: any string -> fixed union | null, never throws (ASVS V5 explicit allowlist)"
    - "Boundary-guarded prefix matching (=== + startsWith('/x/')) instead of bare startsWith('/x')"

key-files:
  created:
    - "src/lib/nav.ts — NavKey union + getActiveNavKey total function (15 lines)"
    - "src/lib/nav.test.ts — 11-case Vitest suite (48 lines)"
  modified: []

key-decisions:
  - "Function-first task order (not TDD RED): next build type-checks test files, so a RED nav.test.ts would spuriously fail the parallel 10-01 build gate — both Wave-1 plans never expose a red tree"
  - "Nav key is the ROUTE segment 'personas' (route /personas), never the label 'Key Personas' — enforced by grep gate (count 0) and test assertions"
  - "Function shipped tested but intentionally UNWIRED — Phase 11 swaps the four app-sidebar.tsx isActive expressions (UI-SPEC line 178)"

patterns-established:
  - "Pattern: boundary-guarded prefix matching for active nav — 'pathname === /x || pathname.startsWith(/x/)' so sibling prefixes like /companies-archive cannot false-positive"
  - "Pattern: one it block per enumerated input pair (11 literal tests), mirroring dedupKeys.test.ts conventions (named vitest imports, single quotes, semicolons)"

requirements-completed: [QLTY-01]

# Metrics
duration: 2min
completed: 2026-08-01
---

# Phase 10 Plan 02: Active-Route Detection Function + Test Suite Summary

**`getActiveNavKey(pathname)` — a pure, boundary-guarded, total-function active-route detector (`NavKey` union) shipped with an 11-case Vitest regression suite that permanently locks the `/companies/[id]` detail highlight and the `/companies-archive` sibling-prefix null case; function unwired by design until Phase 11's consumer swap.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-08-01T14:06:57Z
- **Completed:** 2026-08-01T14:08:27Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `src/lib/nav.ts` (15 lines): `export type NavKey = 'start' | 'companies' | 'personas' | 'reviews';` + `export function getActiveNavKey(pathname: string): NavKey | null` — exact `'/'` → `'start'`, boundary-guarded prefix matching for companies/personas/reviews, `null` for `/sign-in` / `''` / sibling prefixes. Zero imports, zero regex, zero throw paths, no default export, no `@ts-ignore` (ASVS V5 total-function discipline; QLTY-01).
- Created `src/lib/nav.test.ts` (48 lines): **11 individual `it` blocks** (one per UI-SPEC §QLTY-01 enumerated input) — targeted run reports literally 11 tests, all passing. The `/companies/123` case locks the `[id]`-detail highlight regression; the `/companies-archive` case locks the boundary guard (T-10-05 mitigation).
- Full suite regression gate: `npm test` green — 23 test files (22 existing + nav.test.ts), 224 passed, 2 skipped, 0 failures.
- Scope fence honored: `app-sidebar.tsx`, `sidebar.tsx`, `vitest.config.ts`, `package.json` all untouched; zero new packages (T-10-08, T-10-SC). `git diff` for this plan shows exactly the two planned files.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create src/lib/nav.ts — NavKey union + getActiveNavKey pure function** - `3ccda904` (feat)
2. **Task 2: Create src/lib/nav.test.ts (11 cases) + run targeted and full regression gates** - `3fc09196` (test)

**Plan metadata:** `docs(10-02): complete active-route detection plan` (final commit)

## Files Created/Modified

- `src/lib/nav.ts` - NavKey union type + `getActiveNavKey` pure total function (named exports, why-comment, boundary-guarded prefix matching)
- `src/lib/nav.test.ts` - 11-case Vitest regression suite (one `it` per input→output pair, `describe`/`it`/`expect` from vitest)

## Decisions Made

- **Function-first task order instead of test-first RED** — mandated by the plan: `tsconfig.json` includes `**/*.ts` and `next build` type-checks test files, so a RED-state `nav.test.ts` importing a not-yet-existing `./nav` would spuriously fail the parallel Plan 10-01 build gate in Wave 1. The 11-case test contract was fully enumerated upfront regardless (UI-SPEC §QLTY-01).
- **Nav key = route segment `'personas'`**, not label `'Key Personas'` (RESEARCH Pitfall 4) — grep gate (`'key-personas'` count = 0 in nav.ts and nav.test.ts) plus test assertions prevent Phase 11's consumer swap from breaking.
- **Function intentionally unwired** — shipped tested but not imported anywhere; Phase 11 replaces the four inline `isActive` expressions in `app-sidebar.tsx:39,48,57,66` (UI-SPEC line 178, roadmap SC #5).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `-x` flag invalid in vitest 4.1.10; substituted `--bail=1`**
- **Found during:** Task 2 (targeted regression gate)
- **Issue:** `npx vitest run src/lib/nav.test.ts -x` failed with `CACError: Unknown option '-x'` — vitest 4.1.10 does not define the `-x` short flag used in the plan's verify command.
- **Fix:** Used the vitest-native fail-fast equivalent `--bail=1` (`Stop test execution when given number of tests have failed`). The acceptance contract — exit 0 and exactly 11 tests reported — is unchanged.
- **Files modified:** none (command-line only)
- **Verification:** `npx vitest run src/lib/nav.test.ts --bail=1` → `Test Files 1 passed (1) / Tests 11 passed (11)`, exit 0.
- **Committed in:** 3fc09196 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** No scope creep, no file changes beyond the plan's two files. The `-x` flag was a CLI convenience; `--bail=1` preserves its fail-fast intent on the installed vitest version.

## Issues Encountered

- `-x` flag unknown to vitest 4.1.10 (resolved via `--bail=1`, see deviation above).
- Pre-existing `configLoader: 'native'` warning about ESM syntax in `vitest.config.ts` (loaded as CommonJS) — informational only; all runs pass. Out of scope per the plan's file fence.

## Known Stubs

- `getActiveNavKey` is exported and tested but **not imported by any consumer** — this is intentional per plan (UI-SPEC line 178: "this phase ships the function + tests only"). Phase 11 (`11-consumer-restyle`) swaps the four `isActive` expressions in `app-sidebar.tsx` to consume it. Not a defect; documented as the required Phase 11 wiring.

## User Setup Required

None - no external service configuration required. Zero packages installed; vitest `^4.1.10` already present.

## Next Phase Readiness

- `getActiveNavKey` + `NavKey` are ready for Phase 11's consumer swap: replace `pathname === '/'` (app-sidebar.tsx:39) with `getActiveNavKey(pathname) === 'start'`, and the three `pathname.startsWith('/companies'|'/personas'|'/reviews')` expressions (lines 48/57/66) with the corresponding `=== 'companies'|'personas'|'reviews'` comparisons — the hardened boundary-guard semantics are already locked by the 11-case suite.
- Full suite green at plan close (224 passed) — no regressions to the 22 pre-existing test files.
- No blockers. Phase gate diff rule: this plan's `git diff --stat` contribution is exactly `src/lib/nav.ts` + `src/lib/nav.test.ts`.

---

## Self-Check: PASSED

- [x] `src/lib/nav.ts` exists (15 lines, both named exports, three boundary-guarded conditions, zero `'key-personas'`)
- [x] `src/lib/nav.test.ts` exists (48 lines, 11 `it` blocks, grep spot-checks for `/companies/123` and `/companies-archive` each = 1)
- [x] `10-02-SUMMARY.md` exists
- [x] Commit `3ccda904` exists (`feat(10-02): add NavKey union + boundary-guarded getActiveNavKey`)
- [x] Commit `3fc09196` exists (`test(10-02): add 11-case Vitest suite for getActiveNavKey`)
- [x] Targeted gate: `npx vitest run src/lib/nav.test.ts --bail=1` → 11/11 passed, exit 0
- [x] Full suite: `npm test` → 23 files, 224 passed, 2 skipped, 0 failures, exit 0
- [x] Scope fence: `git diff HEAD~2 HEAD` shows exactly `src/lib/nav.ts` + `src/lib/nav.test.ts`; `app-sidebar.tsx` diff = 0 lines

---

*Phase: 10-sidebar-token-foundation*
*Completed: 2026-08-01*
