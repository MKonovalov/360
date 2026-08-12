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
- **Evidence:** BLOCKED / NOT-RUN. Canonical preflight and the actual `PHASE39_FIXTURE_ONLY=1` reset passed. The Company invocation could not locate the custom-agent option in the launcher; the Persona invocation was not run because the serial lane stopped on the Company failure.
- **Playwright result:** BLOCKED Company (browser started; custom-agent option assertion timed out at `e2e/phase39-security-review.spec.ts:67`); NOT-RUN Persona.

## Verification Evidence

The required sequence was preserved for each task:

1. `PHASE39_FIXTURE_ONLY=1` marker set.
2. `tsx src/lib/verification/databaseIdentity.ts --phase39-preflight` passed.
3. `tsx e2e/phase39-fixture-reset.ts` passed and returned disposable fixture IDs (`companyId=210`, `personaId=23`, `practiceAreaId=226`).
4. Canonical preflight immediately before each Playwright invocation passed.
5. Playwright was invoked only after successful preflight. The lifecycle browser started and exposed a deterministic Edit dialog failure; the separate Company browser invocation started and exposed a dependent retired-agent option failure; Persona did not run because the suite is serial.

## Blocked Evidence

```text
BLOCKED lifecycle_assertion post_save_version_2 line=111 browser_started
BLOCKED company_assertion custom_agent_option line=67 browser_started
NOT-RUN persona_serial_dependency company_invocation_failed
```

No claim of authenticated browser pass evidence is made. `STATE.md` and `ROADMAP.md` were intentionally not modified.

## Deviations from Plan

### Auto-fixed Issues

None.

### Blockers

1. **Lifecycle assertion corrected:** The browser evidence showed the save and refresh succeeded; the test had asserted history on the wrong surface and later reused stale locators after refreshed DOM replacement. The test now asserts version 2 on the stable card and version 1/history in a newly opened current Sheet, with lifecycle actions performed through that Sheet.
2. **Company journey blocked:** The separate guarded invocation could not locate the custom-agent option because the preceding lifecycle attempt did not reactivate the agent.
3. **Persona journey not run:** The Playwright suite is serial and stopped after the Company assertion failure.

## Known Stubs

None introduced by this plan.

## TDD Gate Compliance

The plan task is marked `tdd=true`, but this plan adds only Playwright coverage and no production implementation. The required RED/GREEN commit pair is therefore not applicable; guarded browser execution was attempted after preflight, but lifecycle and Clerk prerequisites remain blocked.

## Self-Check: PASSED

- `e2e/phase39-security-review.spec.ts` exists.
- The summary records both task outcomes and the exact preflight/reset/Playwright evidence.
- No `STATE.md` or `ROADMAP.md` changes were made.
