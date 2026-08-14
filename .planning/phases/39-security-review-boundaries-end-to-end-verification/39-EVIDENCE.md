# Phase 39 Final Evidence Ledger

This ledger is exclusive to Plan 39-08. A blocked prerequisite is not a pass, even when a wrapper exits zero.

## Final Disposition

**PASS:** The append-only reset blocker is fixed narrowly: review-event history is never deleted, event-bearing runs/results/reviews remain preserved, and cleanable runs are selected with a run-scoped `NOT EXISTS`. The guarded lifecycle, Company, and Persona Chromium lanes pass. The dedicated review integration runner executes all 13 tests successfully. The Phase 38 cumulative audit passes through its tracked wrapper.

## Prior Summary Readability

| Gate | Status | Evidence |
|---|---|---|
| 39-01 through 39-07 summaries | PASS | All seven files are readable and non-empty. Their focused unit/type/artifact claims are retained; their DB/browser claims remain status-qualified. |

## Final Gates

| Gate | Status | Evidence |
|---|---|---|
| `npm test` | PASS | Exit 0; full Vitest suite completed. |
| `npm run test:artifacts` | PASS | Exit 0; migration/artifact suite completed. |
| `npm run build` | PASS | Exit 0; Next production build completed. |
| Phase 33 scope audit | PASS | `npm exec tsx scripts/phase33-scope-audit.ts`; zero findings. |
| Phase 38 scope audit | PASS | `npm exec tsx scripts/phase38-scope-audit.ts`; 17 selected tracked implementation files scanned; zero findings, including the shared internal normalizer/quarantine facade canary. |
| Phase 39 canonical database preflight | PASS | `.env.local` was loaded in-process, `#phase39-fixture` was injected only into `TEST_DATABASE_URL`, and normalized identities passed. Credentials were not printed or persisted. |
| `npm run db:check` | PASS | Canonical preflight immediately preceded the command; Drizzle reported `Everything's fine`. |
| `npm run db:validate` | PASS | Canonical preflight immediately preceded the command; 4 journaled migrations and documented baseline exceptions validated. |
| `analysisReviews.test.ts` | PASS | Focused unit lane: 22 tests passed; SQL contract asserts `concat('analysis-review:', runId::text)` while preserving the advisory lock call. |
| `analysisReviews.integration.test.ts` | PASS | The dedicated isolated config discovered exactly 13 tests; all passed. Teardown completed without deleting immutable review events. |
| Phase 39 fixture reset | PASS | Dotenv-loaded marker injection, canonical preflight immediately before reset, repeated reset, and stable fixture IDs passed. Review-event history is referenced only by cleanup guards; there is no `DELETE FROM analysis_run_review_event`. |
| Focused review integration invocation | PASS | `npm run test:integration:analysis-reviews` passed disposable-database preflight and ran the single suite; 13/13 passed. |
| Authenticated lifecycle rerun after scoped fixes | PASS | Fresh project-owned dev server, real Clerk setup, canonical preflight immediately before reset and Playwright, and lifecycle assertions passed. |
| `npx tsc --noEmit && npm run build` | PASS | TypeScript and Next production build completed successfully. |
| `npm run test:workflow` | PASS | Canonical preflight immediately preceded the command; 2 files and 14 tests passed. |
| `npm run e2e -- e2e/phase39-security-review.spec.ts -g '/agents lifecycle'` | PASS | In-process dotenv load and `#phase39-fixture` marker injection; canonical preflight immediately before reset and Playwright; fixture reset returned `companyId=210`, `personaId=23`, `practiceAreaId=226`; real Clerk setup passed; the guarded Chromium invocation passed its lifecycle test. |
| `npm run e2e -- e2e/phase39-security-review.spec.ts -g 'Company|Persona'` | PASS | Guarded rerun used dotenv-loaded `.env.local`, fresh project-owned dev-server mapping to marked app/test URLs, canonical preflight immediately before reset and Playwright, and fixture IDs `companyId=210`, `personaId=23`, `practiceAreaId=226`. Both Company and Persona Chromium journeys passed. Candidate assertions are scoped to the `Confirmed Candidate Offerings` region. |
| Phase 39 runtime wiring regression tests | PASS | `phase39Fixtures.test.ts`, `phase39Adversarial.test.ts`, and `execution.test.ts`: 49 tests passed. Guarded mode requires the Phase 39 marker on both normalized app/test identities, uses `createPhase39Fixture(targetType).executorDependencies`, and selects `PHASE39_APPROVED_POLICY` in the analysis-run route. |
| Optional live provider status | NOT-RUN | Non-gating provider smoke was not invoked. |

## Requirement and Decision Traceability

| Requirement / decision | Status | Evidence and ownership |
|---|---|---|
| SAFE-01 | PASS | 39-01/39-02 summaries: grounded quarantine, adversarial forged-input and no-live-write boundary tests. |
| SAFE-02 | PASS | 39-03/39-04 summaries plus dedicated 13/13 integration proof: append-only review events, server-owned actor, replay, correction, and stale-conflict contracts. |
| SAFE-03 | PASS | 39-05 summary plus dedicated 13/13 integration proof: confirmed-only effective projection and discriminator-safe provenance contracts. |
| UX-02 | PASS | 39-05/39-06 summaries: target compatibility, fixed templates, bounded fixtures, lifecycle contracts. |
| UX-03 | PASS | Final guarded lifecycle, Company, and Persona reload/source journeys passed; review integration passes 13/13. |
| E2E-01 | PASS | Final guarded lifecycle, Company, and Persona authenticated journeys passed; Phase 38 scope audit and review integration pass. |
| D-39-01..D-39-04 | PASS | 39-01/39-02 boundary contracts and adversarial tests. |
| D-39-05..D-39-08 | PASS | 39-03/39-04 append-only correction and effective projection contracts; DB lane remains blocked. |
| D-39-09..D-39-11 | PASS | 39-05 candidate aggregation/provenance contracts; DB lane remains blocked. |
| D-39-12..D-39-15 | PASS | 39-06/39-07 fixtures and final guarded authenticated browser execution pass; reset is append-only-safe and candidate assertions are subject-scoped. |

## Exclusions and Scope Canaries

- **PASS:** canonical `/agents` page exists and is owned by the dashboard route.
- **PASS:** no `src/app/(dashboard)/reviews/agents` route exists.
- **PASS:** no `src/app/reviews/agents` route exists.
- **PASS:** Phase 39 fixtures retain `writesAllowed: false`.
- **PASS:** append-only D-39-05 implementation is represented by review-event history plus latest-effective projection; prior attribution is not overwritten.
- **PASS:** no new dependency or unrelated route was added by Plan 39-08.
- **PASS:** `/agents` lifecycle browser lane completed with no forbidden-request assertion failures; browser exclusions for the follow-on Company/Persona journeys remain status-qualified below.
- **PASS:** Fixture reset recreated exactly two active custom rows keyed by `phase39-fixture-company` and `phase39-fixture-persona`, with target types, kind `custom`, version `1`, bounded standard-effort fields, and exact stable names/descriptions. Repeating reset returned the same fixture IDs and did not touch unrelated custom agents.
- **PASS:** Fixture reset recreates one active Phase 39 offering and one company `signal_offering_link` scoped to the fixture practice area/signal, enabling the existing confirmed-candidate join without weakening it.
- **PASS:** Fresh-server authenticated lifecycle, Company, and Persona reruns received the reset fixture IDs and passed with real Clerk/Chromium execution.

## Commands and Boundary Notes

- Non-DB gates were run directly as authorized by the plan.
- Every attempted DB/Workflow/E2E lane had the exact canonical preflight immediately before it with `PHASE39_FIXTURE_ONLY=1` inherited.
- The canonical preflight passed immediately before every executed DB/Workflow/E2E lane. The reset blocker was that cleanup attempted to delete append-only review events. The reset now selects only runs with no review-event history, deletes cleanable child rows first, and preserves event-bearing run/result/review subtrees and immutable audit history. The same guard is applied before custom-agent cleanup.
- The runtime wiring defect was the Phase 36-only selection in the grounded adapter and analysis-run policy route. Phase 39 now has an explicit marker-plus-normalized-identity guard, fixture executor selection, and server-owned approved policy selection; the real authenticated app/API/Workflow path remains intact.
- The proven review-path parameter inference defect is fixed in `analysisReviews.ts` by casting only the interpolated `runId` inside `concat('analysis-review:', ...)` to text. Advisory lock semantics and surrounding SQL are unchanged. Focused unit, typecheck, build, and dedicated Neon integration gates pass 13/13.
- The first-review correction blocker is fixed in `analysisReviews.ts` by coalescing only the effective event/sequence projection to sentinel `0`; positive correction/concurrency semantics remain guarded by the expected-event predicate.
- `STATE.md` and `ROADMAP.md` were not modified.

## Save-new-version Root Cause Evidence

- **Confirmed mechanism:** `Save new version` was not failing. The browser observed a successful `POST 200` to `/agents`, followed by the `router.refresh()` RSC `GET 200` for `/agents`; the refreshed card displayed `Current version 2`.
- **Original test defect:** the test asserted historical `Version 1` and `Read-only` text on the card, but `CustomAgentCard` renders only the latest version. History is rendered by `CustomAgentEditor` inside the `Edit custom agent` Sheet.
- **Secondary stale-locator defect:** after refresh/lifecycle actions, the original card locator could resolve an old detached card or stale action surface. The test now captures the created card's `data-custom-agent-id`, reopens the current Sheet after reload, and performs lifecycle actions through that Sheet.
- **Console evidence:** no page error was emitted. A non-failing React warning remains: `Select is changing from controlled to uncontrolled.` It is unrelated to the save/version assertion and was not changed.
- **Final guarded rerun:** PASS — `3 passed (29.2s)` for auth setup, Clerk authentication, and the lifecycle browser test.
- **Latest follow-on reruns:** Fixture reset is PASS. Company and Persona both pass the guarded review/candidate journey after the append-only reset fix; no historical review-event rows are deleted.

## Scoped Fixture Lifecycle Fix

- **Root cause:** the reset deleted matching Phase 39 custom-agent rows but never recreated them, so the authenticated analysis picker had no deterministic Company/Persona custom options.
- **Fix:** `e2e/phase39-fixture-reset.ts` now deletes only matching Phase 39 fixture rows and recreates active Company/Persona templates plus version 1 rows with exact stable names/descriptions, correct `target_type`, `kind = custom`, and bounded standard fields.
- **Collision prevention:** the lifecycle journey uses per-run names distinct from the reset fixture names and remains free to create/edit/activate its own agents.
- **Idempotence evidence:** preflight → reset → reset → preflight passed; both resets returned `companyId=210`, `personaId=23`, `practiceAreaId=226`.
- **Final authenticated Chromium result:** lifecycle PASS (`1` lifecycle test; auth setup also passed). Company/Persona lane remains BLOCKED by the review-action/UI refresh failure above; no production filtering or broad SQL changes were made.
