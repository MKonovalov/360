# Phase 39 Final Evidence Ledger

This ledger is exclusive to Plan 39-08. A blocked prerequisite is not a pass, even when a wrapper exits zero.

## Final Disposition

**BLOCKED:** The proven review SQL defects are fixed narrowly: the advisory-lock run ID remains text-cast, and absent effective review events now use sentinel `0`. The lifecycle browser lane still passes. The guarded Company journey reaches the durable review surface and remains blocked by a review-action/UI refresh failure; Persona was not run because the suite is serial. No lock semantics, candidate joins, or broad SQL were changed.

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
| Phase 38 scope audit | BLOCKED | The planned `scripts/phase38-scope-audit.ts` entrypoint does not exist; the existing cumulative packet-path canary remains unresolved and is not silently passed. |
| Phase 39 canonical database preflight | PASS | `.env.local` was loaded in-process, `#phase39-fixture` was injected only into `TEST_DATABASE_URL`, and normalized identities passed. Credentials were not printed or persisted. |
| `npm run db:check` | PASS | Canonical preflight immediately preceded the command; Drizzle reported `Everything's fine`. |
| `npm run db:validate` | PASS | Canonical preflight immediately preceded the command; 4 journaled migrations and documented baseline exceptions validated. |
| `analysisReviews.test.ts` | PASS | Focused unit lane: 22 tests passed; SQL contract asserts `concat('analysis-review:', runId::text)` while preserving the advisory lock call. |
| `analysisReviews.integration.test.ts` | BLOCKED | Guarded `.env.local`/marker preflight passed. 10/13 Neon tests passed; three failures are outside the requested cast: correction transitions returned `not_eligible`, the rich fixture lacked `signal_name`, and the mixed review race had no winner. |
| Phase 39 fixture reset | PASS | Canonical preflight immediately preceded reset; deterministic disposable offering and company signal link were recreated and reset returned stable fixture IDs. |
| Focused review integration invocation | NOT-RUN | Default Vitest excludes `*.integration.test.ts`; no missing audit script or alternate runner was invented. |
| Authenticated lifecycle rerun after scoped fixes | BLOCKED | Canonical preflight and reset passed; Clerk setup passed; Playwright stopped before the lifecycle test because `PHASE39_COMPANY_ID` was not inherited. |
| `npx tsc --noEmit && npm run build` | PASS | TypeScript and Next production build completed successfully. |
| `npm run test:workflow` | PASS | Canonical preflight immediately preceded the command; 2 files and 14 tests passed. |
| `npm run e2e -- e2e/phase39-security-review.spec.ts -g '/agents lifecycle'` | PASS | In-process dotenv load and `#phase39-fixture` marker injection; canonical preflight immediately before reset and Playwright; fixture reset returned `companyId=210`, `personaId=23`, `practiceAreaId=226`; real Clerk setup passed; the guarded Chromium invocation passed its lifecycle test. |
| `npm run e2e -- e2e/phase39-security-review.spec.ts -g 'Company|Persona'` | BLOCKED | Guarded rerun used dotenv-loaded `.env.local`, fresh project-owned dev-server mapping to marked app/test URLs, canonical preflight immediately before reset and Playwright, and fixture IDs `companyId=210`, `personaId=23`, `practiceAreaId=226`. Company reached the review card with one finding/source and the SQL `42P18` failure did not recur, but the Confirm action remained pending/reloaded to `This run is no longer pending review` without `Confirmed by` evidence; Persona was not run because the suite is serial. |
| Phase 39 runtime wiring regression tests | PASS | `phase39Fixtures.test.ts`, `phase39Adversarial.test.ts`, and `execution.test.ts`: 49 tests passed. Guarded mode requires the Phase 39 marker on both normalized app/test identities, uses `createPhase39Fixture(targetType).executorDependencies`, and selects `PHASE39_APPROVED_POLICY` in the analysis-run route. |
| Optional live provider status | NOT-RUN | Non-gating provider smoke was not invoked. |

## Requirement and Decision Traceability

| Requirement / decision | Status | Evidence and ownership |
|---|---|---|
| SAFE-01 | PASS | 39-01/39-02 summaries: grounded quarantine, adversarial forged-input and no-live-write boundary tests. |
| SAFE-02 | PASS | 39-03/39-04 summaries: append-only review events, server-owned actor, replay and stale-conflict contracts. DB integration remains blocked. |
| SAFE-03 | PASS | 39-05 summary: confirmed-only effective projection and discriminator-safe provenance contracts. DB integration remains blocked. |
| UX-02 | PASS | 39-05/39-06 summaries: target compatibility, fixed templates, bounded fixtures, lifecycle contracts. |
| UX-03 | BLOCKED | 39-07 authenticated Company/Persona reload/source journey was not run to browser assertions. |
| E2E-01 | BLOCKED | Lifecycle browser lane now passes, but the required Company/Persona authenticated journeys remain blocked/not-run from the prior serial lane and were not reclassified by this scoped rerun. |
| D-39-01..D-39-04 | PASS | 39-01/39-02 boundary contracts and adversarial tests. |
| D-39-05..D-39-08 | PASS | 39-03/39-04 append-only correction and effective projection contracts; DB lane remains blocked. |
| D-39-09..D-39-11 | PASS | 39-05 candidate aggregation/provenance contracts; DB lane remains blocked. |
| D-39-12..D-39-15 | BLOCKED | 39-06/39-07 fixtures and E2E implementation exist, but authenticated browser execution is not evidenced as PASS. |

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
- **BLOCKED:** Fresh-server authenticated lifecycle rerun did not receive fixture IDs in the Playwright environment; no browser pass was claimed.

## Commands and Boundary Notes

- Non-DB gates were run directly as authorized by the plan.
- Every attempted DB/Workflow/E2E lane had the exact canonical preflight immediately before it with `PHASE39_FIXTURE_ONLY=1` inherited.
- The canonical preflight passed immediately before every executed DB/Workflow/E2E lane. The fixture reset blocker was disposable-database drift: the repository already contained the intended append-only relation in migration `0010`, schema, and snapshot, but the fixture database had not applied that journaled migration. Applying it restored reset compatibility; no migration/schema/reset source change was made.
- The runtime wiring defect was the Phase 36-only selection in the grounded adapter and analysis-run policy route. Phase 39 now has an explicit marker-plus-normalized-identity guard, fixture executor selection, and server-owned approved policy selection; the real authenticated app/API/Workflow path remains intact.
- The proven review-path parameter inference defect is fixed in `analysisReviews.ts` by casting only the interpolated `runId` inside `concat('analysis-review:', ...)` to text. Advisory lock semantics and surrounding SQL are unchanged. Focused unit, typecheck, and build gates pass; the focused Neon integration lane remains status-qualified because three unrelated fixture/eligibility failures remain.
- The first-review correction blocker is fixed in `analysisReviews.ts` by coalescing only the effective event/sequence projection to sentinel `0`; positive correction/concurrency semantics remain guarded by the expected-event predicate.
- `STATE.md` and `ROADMAP.md` were not modified.

## Save-new-version Root Cause Evidence

- **Confirmed mechanism:** `Save new version` was not failing. The browser observed a successful `POST 200` to `/agents`, followed by the `router.refresh()` RSC `GET 200` for `/agents`; the refreshed card displayed `Current version 2`.
- **Original test defect:** the test asserted historical `Version 1` and `Read-only` text on the card, but `CustomAgentCard` renders only the latest version. History is rendered by `CustomAgentEditor` inside the `Edit custom agent` Sheet.
- **Secondary stale-locator defect:** after refresh/lifecycle actions, the original card locator could resolve an old detached card or stale action surface. The test now captures the created card's `data-custom-agent-id`, reopens the current Sheet after reload, and performs lifecycle actions through that Sheet.
- **Console evidence:** no page error was emitted. A non-failing React warning remains: `Select is changing from controlled to uncontrolled.` It is unrelated to the save/version assertion and was not changed.
- **Final guarded rerun:** PASS — `3 passed (29.2s)` for auth setup, Clerk authentication, and the lifecycle browser test.
- **Latest follow-on reruns:** Fixture reset is PASS. Company reached the review card after the SQL fix but the Confirm action did not produce the expected confirmed projection; Persona was not run because the suite is serial. Neither browser lane has a false PASS.

## Scoped Fixture Lifecycle Fix

- **Root cause:** the reset deleted matching Phase 39 custom-agent rows but never recreated them, so the authenticated analysis picker had no deterministic Company/Persona custom options.
- **Fix:** `e2e/phase39-fixture-reset.ts` now deletes only matching Phase 39 fixture rows and recreates active Company/Persona templates plus version 1 rows with exact stable names/descriptions, correct `target_type`, `kind = custom`, and bounded standard fields.
- **Collision prevention:** the lifecycle journey uses per-run names distinct from the reset fixture names and remains free to create/edit/activate its own agents.
- **Idempotence evidence:** preflight → reset → reset → preflight passed; both resets returned `companyId=210`, `personaId=23`, `practiceAreaId=226`.
- **Final authenticated Chromium result:** lifecycle PASS (`1` lifecycle test; auth setup also passed). Company/Persona lane remains BLOCKED by the review-action/UI refresh failure above; no production filtering or broad SQL changes were made.
