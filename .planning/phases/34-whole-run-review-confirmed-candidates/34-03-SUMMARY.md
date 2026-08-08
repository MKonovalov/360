---
phase: 34-whole-run-review-confirmed-candidates
plan: 03
subsystem: analysis-reviews-ui
tags: [typescript, nextjs, react, vitest, server-actions, reviews, confirm-dismiss, read-only, provenance]

# Dependency graph
requires:
  - phase: 34-whole-run-review-confirmed-candidates (34-01)
    provides: Closed review/candidate contracts (decideRunInputSchema, WholeRunDecision, ReviewDecisionOutcome)
  - phase: 34-whole-run-review-confirmed-candidates (34-02)
    provides: Atomic winner-preserving decideAnalysisRun, listRunReviewItems, reconciliation, retention-aware packet visibility
  - phase: 33-grounded-analysis-execution-evidence
    provides: Immutable packet ledger (analysis_run/result/finding/source/link)
provides:
  - Additive v1.7 run-level review section on /reviews beside the unchanged legacy proposal queue
  - Staff-gated whole-run Confirm/Dismiss Server Actions that call only decideAnalysisRun
  - Retention-safe packet/provenance projection (summary, counts, packet hash, strong/weak findings, persisted source links, provenance IDs, audit/review state)
  - Retry-safe client action state machine with pending/terminal/error/replay presentation and no per-finding action
  - Component + action tests (42 total) proving additive coexistence, sensitive-field absence, and boundary semantics
affects: [34-04, 34-05, 35-01, 35-02]

# Tech tracking
tech-stack:
  added: []
  patterns: [additive page composition (legacy queue untouched), client/server component split, server-action state machine reducer, retention-safe server projection, SSR-escaping-aware test assertions]

key-files:
  created:
    - src/components/reviews/run-review-section.tsx
    - src/components/reviews/run-review-card.tsx
    - src/components/reviews/run-review-actions.tsx
    - src/components/reviews/run-review-card.test.tsx
  modified:
    - src/app/actions/reviews.ts
    - src/app/actions/reviews.test.ts
    - src/app/(dashboard)/reviews/page.tsx
    - vitest.config.ts (Rule 3 deviation — include widened to .test.tsx)

key-decisions:
  - "RunReviewSection is composed additively beside ReviewQueue; the legacy proposal fetch and component are untouched."
  - "Every packet field on the run card is server-projected retention-safe data; findings filtered to strong/weak, sources rendered as https-only canonical links, and reasoning/claim/narrative/buyer_role/excerpt never reach the UI."
  - "The client reducer maps thrown errors to a retryable action_failed state and decision outcomes to decided with a replayed flag; replay copy preserves the original actor ('Already confirmed by user_first — original decision preserved.') and never claims a loser won."
  - "RunReviewSection dedupes items by runId via a Map and renders explicit empty, DB-error, and missing-packet states; no live provider or Analyze launch is offered."

patterns-established:
  - "Additive composition: extend the page with a new section, never touch the legacy queue component or its fetch."
  - "Retention-safe projection: the server projects only closed-contract fields onto RunReviewCardData (packetMissing for a missing packet)."
  - "Server-action reducer: reduceRunActionState(_state, event, attempted) with retryable vs non-retryable error classification; RunReviewActions uses useTransition + useRouter."
  - "SSR-aware test assertions: React escapes apostrophes (&#x27;) and Tailwind base classes contain variant prefixes, so tests assert rendered attributes (disabled=\"\") and apostrophe-free substrings, plus Extract narrows for decided-state unions."

requirements-completed: [REV-01, REV-02, REV-03, REV-04]

# Metrics
duration: 17min
completed: 2026-08-08
---

# Phase 34 Plan 3: Additive Packet Review UI & Whole-Run Confirm/Dismiss Actions Summary

**Staff-gated whole-run Confirm/Dismiss Server Actions plus an additive v1.7 run-level packet review section on /reviews — retention-safe provenance inspection beside an untouched legacy proposal queue**

## Performance

- **Duration:** 17 min (commit span 03:00Z–03:17Z; Task 1 commits 03:00Z–03:01Z, Task 2 RED 03:02Z, Task 2 GREEN 03:17Z)
- **Started:** 2026-08-08T03:00:50Z (Task 1 RED commit)
- **Completed:** 2026-08-08T03:17:18Z (Task 2 GREEN commit)
- **Tasks:** 2 (both TDD, RED+GREEN)
- **Files modified:** 7 plan-listed files (4 created, 3 modified) + 1 deviation file (vitest.config.ts)

## Accomplishments
- Two independently gated whole-run Server Actions (`confirmRunAction`, `dismissRunAction`) in `src/app/actions/reviews.ts`: each calls `requireStaffAccess()` first (Clerk-derived `userId`), validates through `decideRunInputSchema` (positive run ID + closed `confirmed`/`dismissed` enum), and invokes only the Plan 34-02 `decideAnalysisRun` query. No actor/packet/source/signal/offering data is ever accepted from the browser.
- Whole-run path is structurally separate from legacy Accept/Reject: a static scope test slices `reviews.ts` below the `// ---- v1.7 whole-run review actions below this line ----` marker and rejects call-form `acceptProposal(`/`acceptProposalAction`/`db.transaction` tokens, proving no legacy mutation or live catalog write on the v1.7 path.
- Additive page composition: `/reviews` still fetches and renders the legacy `ReviewQueue` untouched, and independently renders `RunReviewSection` from the Plan 34-02 run-review list (separate try/catch so a run-list failure never breaks the legacy queue).
- Retention-safe packet card: `RunReviewCard` shows run/target summary (status, targetType, subjectId, template, practice), packet counts (findings/sources/links) and truncated hash, strong/weak normalized findings with `finding #{id} ({key})` provenance, https-only persisted source links with `source #{id} ({key})`, and the decided audit line (`Confirmed/Dismissed by {actor} at {date}`). Chain-of-thought, claim/narrative, buyer role, and raw Persona data are never rendered.
- Retry-safe action controls: `RunReviewActions` (client) drives a `RunActionState` machine (idle → pending → decided|error) with `reduceRunActionState`, disabled buttons during submission with accessible labels (`Confirm run {id}` / `Dismiss run {id}`), retryable error copy (Try again) versus non-retryable (Reload via `router.refresh()`), and replay-preserving decided copy.
- Explicit state coverage: empty run list ("No analysis runs to review"), DB-error card ("Couldn't load run reviews"), missing-packet card, already-decided presentation, and no live provider or Analyze launch affordance anywhere in the section.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add staff-gated whole-run Confirm and Dismiss actions** - `d9a36c20` (test), `699e1bec` (feat)
2. **Task 2: Compose additive packet review UI on /reviews** - `ae336926` (test, includes vitest.config.ts include widening), `fff177c4` (feat)
3. **Test hygiene follow-up:** `93365859` (test) — replace single-mock `mockReset` with `vi.clearAllMocks()` in the whole-run action `beforeEach`

**Plan metadata:** final docs commits follow in this wrap-up.

_Note: Both tasks were TDD (test → feat). The `vi.clearAllMocks()` hardening was made during Task 1 GREEN but only committed as a separate test commit during Task 2 wrap-up; it was not part of `699e1bec` as originally recorded._

## Files Created/Modified
- `src/app/actions/reviews.ts` - `confirmRunAction`, `dismissRunAction`; whole-run actions below the v1.7 marker, each requiring staff, validating the closed contract, and calling only `decideAnalysisRun`; `revalidatePath('/reviews')` on success; thrown errors propagate
- `src/app/actions/reviews.test.ts` - 22 tests: staff-gate-before-parse, input validation, first-decision success, replay/race mapping, forbidden-import/write static scope test, legacy action preservation
- `src/app/(dashboard)/reviews/page.tsx` - additive composition: `ReviewQueue` unchanged + `RunReviewSection`; `projectRunReviewItem` maps the Plan 34-02 item into `RunReviewCardData` with a local strong/weak `CANDIDATE_EVIDENCE_STATUSES` set and `packetMissing`
- `src/components/reviews/run-review-section.tsx` - server component; `aria-labelledby="run-review-heading"` + "Analysis Run Reviews" + v1.7 badge; dedupes by runId (Map); null → error card, [] → empty state
- `src/components/reviews/run-review-card.tsx` - server component; exports `RunReviewSource`, `RunReviewFinding`, `RunReviewCardData`; retention-safe packet/provenance rendering; decided audit line; missing-packet state
- `src/components/reviews/run-review-actions.tsx` - client component; exports `RunActionState`, `RunActionEvent`, `reduceRunActionState`, `runActionCopy`/`RUN_ACTION_ERROR_COPY`, `decidedCopy`, `RunDecisionButtons`, `RunReviewActions`
- `src/components/reviews/run-review-card.test.tsx` - 20 component tests: duplicate-item keys, provenance rendering, action state transitions, accessibility labels, legacy-section coexistence, sensitive-field absence

## Decisions Made
- Additive composition is the boundary mechanism: the legacy queue fetch and component are byte-for-byte untouched; the run section is a sibling rendered from its own data fetch.
- Retention-safe fields are enforced at the projection boundary (server page → card), not by card-side filtering; `projectRunReviewItem` only forwards closed-contract fields.
- Error classification is server-driven: thrown errors (network/DB) become retryable `action_failed`; mapped decision outcomes (`invalid_input`, `missing_packet`, `not_pending_review`, `race_loser`, `not_found`) become non-retryable with actionable copy.
- Replay presentation never claims a win: `decidedCopy` for `replayed: true` reads "Already {verb} by {actor} — original decision preserved.", referencing the stored server result.
- Test assertions were hardened to the real render pipeline (React SSR escaping, Tailwind variant prefixes, `toEqual` non-narrowing) so they assert rendered semantics, not class substrings.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vitest.config.ts include pattern never collected `.test.tsx` files**
- **Found during:** Task 2 RED run
- **Issue:** The vitest `include` glob was `src/**/*.test.ts` only; the new `run-review-card.test.tsx` was silently not collected, so the component suite could not run at all (no test files found / module-not-found manifesting as a broken RED gate).
- **Fix:** Widened `include` to `['src/**/*.test.ts', 'src/**/*.test.tsx']`.
- **Files modified:** vitest.config.ts (outside plan `files_modified` — documented as deviation)
- **Verification:** Component suite then ran and failed correctly on the missing `run-review-section` module (true RED).
- **Committed in:** ae336926 (Task 2 RED commit)

**2. [Rule 1 - Bug] Component test assertions did not match the real SSR render output**
- **Found during:** Task 2 GREEN verification
- **Issue:** Three assertion mismatches: (a) React SSR escapes apostrophes (`'` → `&#x27;`), so `toContain("Couldn't load run reviews")` failed against `Couldn&#x27;t load…`; (b) the Tailwind base button class always contains `disabled:` as a variant prefix, so `includes('disabled')` was a false positive for the pending check and false negative for the idle check; (c) `toEqual` on a union-typed value did not narrow `decidedCopy(next)` / `decidedState` for TypeScript.
- **Fix:** Asserted apostrophe-free substrings (`'load run reviews'`), the rendered `disabled=""` attribute instead of the substring, and `Extract<RunActionState, { readonly status: 'decided' }>` narrows for decided-state values.
- **Files modified:** src/components/reviews/run-review-card.test.tsx
- **Verification:** Component suite 20/20; combined 42/42; tsc exit 0.
- **Committed in:** fff177c4 (Task 2 GREEN commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 3 blocking config, 1 Rule 1 test-assertion correctness)
**Impact on plan:** Both were necessary for the plan's verify commands to be meaningful. No scope creep, no architectural changes, no new dependencies.

## Issues Encountered
- The `vi.clearAllMocks()` test-isolation hardening from Task 1 GREEN was initially committed as part of the claimed Task 1 GREEN record but landed separately (`93365859`) after Task 2 RED; this is a commit-organization artifact, not a functional gap — the final test state is identical.
- Vitest prints a non-blocking configLoader warning (ESM syntax in a CJS-loaded config file); the existing `vitest.config.ts` style was preserved rather than churned.

## User Setup Required

None - no external service configuration required. Pure component/action tests run with no database or network; `TEST_DATABASE_URL`-gated integration suites are not part of this plan.

## Next Phase Readiness
- Phase 34-04 (scope/static audit) can verify the whole-run boundary: no `acceptProposal` import/call, no live Signal/link writes, read-only candidate projection, and the v1.7 marker line.
- Phase 34-05 / Phases 35-01/35-02 (Company/Persona experiences) can consume `listConfirmedCandidateOfferings` with the additive UI precedent established here (new section, untouched legacy queue).
- Blockers/concerns: none — REV-01..04 evidence is complete in this plan.

---
*Phase: 34-whole-run-review-confirmed-candidates*
*Completed: 2026-08-08*

## Self-Check: PASSED

- All 7 plan-listed files + SUMMARY exist: reviews.ts, reviews.test.ts, reviews/page.tsx, run-review-section.tsx, run-review-card.tsx, run-review-actions.tsx, run-review-card.test.tsx, 34-03-SUMMARY.md
- All 5 plan commits exist in git history: d9a36c20 (Task 1 RED), 699e1bec (Task 1 GREEN), ae336926 (Task 2 RED + vitest include widening), 93365859 (test hygiene), fff177c4 (Task 2 GREEN)
- Verification green: `npm test -- src/components/reviews/run-review-card.test.tsx src/app/actions/reviews.test.ts` → 42/42 (20 component + 22 action); `npx tsc --noEmit` → exit 0
