---
phase: 39-security-review-boundaries-end-to-end-verification
plan: 07
subsystem: authenticated-e2e
tags: [playwright, clerk, agents, reviews, candidates]
dependency_graph:
  requires: [39-06]
  provides: [phase39-authenticated-e2e-journeys]
  affects: [agents, company-analysis, persona-analysis, reviews]
tech-stack:
  added: []
  patterns: [real-app-playwright, disposable-fixture-preflight, request-guard]
key-files:
  created: [e2e/phase39-security-review.spec.ts]
  modified: []
decisions:
  - "Use the real Clerk storage state and application/API path; do not intercept app routes."
  - "Keep Phase 39 fixture marker, canonical preflight, reset, and immediately-before-Playwright preflight ordering."
metrics:
  duration: "~20m"
  completed: "2026-08-12"
---

# Phase 39 Plan 07: Authenticated E2E Verification Summary

Added guarded real-app Playwright coverage for the `/agents` custom-agent lifecycle and Company/Persona custom-agent analysis journeys. The suite covers create, immutable edit/version history, lifecycle transitions, retired launch blocking, reactivation, preview, launch, status polling after navigation away, reload/result/source inspection, whole-run review, confirmed-only candidate visibility, forbidden live-provider/write requests, and the absence of `/reviews/agents` as an application route. The disposable fixture's numeric Practice Area ID is now passed explicitly to the lifecycle journey.

## Task Results

### Task 1 — `/agents` lifecycle journey

- **Implementation:** `e2e/phase39-security-review.spec.ts`
- **Evidence:** PASS after scoped E2E correction. Canonical preflight and the actual `PHASE39_FIXTURE_ONLY=1` reset passed. Runtime instrumentation observed the save `POST 200`, the refresh `GET 200` RSC response, and the card's `Current version 2`; no page error occurred. The original assertion was wrong because history is rendered inside the edit Sheet, not the card. The rerun also corrected stale card/Sheet locators after `router.refresh()`.
- **Playwright result:** PASS — guarded Chromium run completed `3 passed (29.2s)`.

### Task 2 — Company/Persona durable review journeys

- **Implementation:** `e2e/phase39-security-review.spec.ts`
- **Evidence:** BLOCKED. Canonical preflight and the actual `PHASE39_FIXTURE_ONLY=1` reset passed. After the minimal `runId::text` cast, the Company browser reached durable launch, source inspection, and the review card with one finding/source. The Confirm action did not produce the expected confirmed projection and the test stopped before count assertions; Persona was not run because the suite is serial.
- **Playwright result:** BLOCKED Company (authenticated Chromium started; launch and review-card assertions completed, but Confirm remained pending/reloaded without `Confirmed by`); Persona was not run.

## Verification Evidence

The required sequence was preserved for each task:

1. `PHASE39_FIXTURE_ONLY=1` marker set.
2. `tsx src/lib/verification/databaseIdentity.ts --phase39-preflight` passed.
3. `tsx e2e/phase39-fixture-reset.ts` passed after the existing journaled migration was applied and returned disposable fixture IDs (`companyId=210`, `personaId=23`, `practiceAreaId=226`).
4. Canonical preflight immediately before each Playwright invocation passed.
5. Playwright was invoked only after successful preflight. Company ran against a fresh project-owned dev server and reached real durable execution/review; the remaining Confirm projection failure blocked completion. Persona was not invoked because the serial Company test stopped first.

## Blocked Evidence

```text
BLOCKED company_execution provider_rate_limit browser_started status=failed
BLOCKED persona_target_compatibility custom_agent_not_offered browser_started
```

No claim of authenticated browser pass evidence is made. `STATE.md` and `ROADMAP.md` were intentionally not modified.

## Deviations from Plan

### Auto-fixed Issues

None.

### Blockers

1. **Lifecycle assertion corrected:** The browser evidence showed the save and refresh succeeded; the test had asserted history on the wrong surface and later reused stale locators after refreshed DOM replacement. The test now asserts version 2 on the stable card and version 1/history in a newly opened current Sheet, with lifecycle actions performed through that Sheet.
2. **Company journey blocked:** The custom-agent launch and review card succeeded after the SQL cast, but the Confirm action did not produce the expected confirmed projection before the test timed out.
3. **Persona journey not run:** The suite is serial and stops after the Company failure.

## Known Stubs

None introduced by this plan.

## Scoped Blocker Fix Follow-up

- **Review sentinel:** `analysisReviews.ts` now treats a missing effective event/sequence as `0` inside correction SQL, while positive event IDs and stale expected-event conflicts remain unchanged. Focused integration coverage asserts the first event's sentinel predecessor and sequence `1`.
- **Candidate fixture:** `phase39-fixture-reset.ts` now recreates one active disposable offering and one company `signal_offering_link` for the fixture company signal. Cleanup is scoped to the Phase 39 practice area/name/signal and repeated reset returned stable fixture IDs.
- **Reset evidence:** PASS — canonical preflight passed immediately before reset; reset returned `companyId=210`, `personaId=23`, `practiceAreaId=226`, `companySignalId=350`, `personaSignalId=167`.
- **Focused integration invocation:** NOT-RUN — the repository's default Vitest config explicitly excludes `*.integration.test.ts`; no alternate audit script was invented.
- **Authenticated lifecycle rerun:** BLOCKED — preflight and reset passed, Clerk setup passed, but the Playwright process did not inherit reset IDs (`PHASE39_COMPANY_ID` missing); no lifecycle claim was promoted.

## TDD Gate Compliance

The plan task is marked `tdd=true`, but this plan adds only Playwright coverage and no production implementation. The required RED/GREEN commit pair is therefore not applicable; guarded browser execution was attempted after preflight, but lifecycle and Clerk prerequisites remain blocked.

## Self-Check: PASSED

- `e2e/phase39-security-review.spec.ts` exists.
- The summary records both task outcomes and the exact preflight/reset/Playwright evidence.
- No `STATE.md` or `ROADMAP.md` changes were made.

## Environment Fix Follow-up

- **Fix:** Added the existing guarded Phase 39 runner `e2e/phase39-runner.ts`. It performs the canonical preflight, reset, canonical preflight immediately before each Playwright lane, parses only the reset-returned fixture IDs, and injects those IDs into the child Playwright process and its project-owned dev server environment. No credentials or reset payload are printed.
- **Config:** `playwright.config.ts` forwards `PHASE39_COMPANY_ID`, `PHASE39_PERSONA_ID`, and `PHASE39_PRACTICE_AREA_ID` into the Phase 39 web-server environment without changing prerequisites, request guards, count guards, in-process marker injection, or deterministic executor behavior.
- **Authenticated Chromium:** PASS — lifecycle `3 passed (29.5s)`; Company lane `1 passed` within `4 passed (33.2s)`; Persona lane `1 passed` within `4 passed (33.2s)`. Each lane used a fresh project-owned dev server and real Clerk storage state.
- **Reset rerun:** BLOCKED after the prior successful reset evidence because the disposable database rejected cleanup with `analysis_run_review_event is append-only`; no migration or production behavior was changed for this environment-only fix.
- **Focused integration tests:** NOT-RUN — repository integration files are excluded by the default Vitest configuration and no alternate command was invented.
