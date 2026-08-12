# Phase 39 Final Evidence Ledger

This ledger is exclusive to Plan 39-08. A blocked prerequisite is not a pass, even when a wrapper exits zero.

## Final Disposition

**BLOCKED:** The Phase 39 lifecycle E2E is independently evidenced as PASS in the latest 39-07 rerun, and the deterministic/DB/Workflow gates below remain PASS. Final Phase 39 sign-off remains BLOCKED because Company execution persisted `failed` after provider rate limiting and the Persona-target journey did not start because no compatible persona-target custom agent was offered. The final disposition does not promote either follow-on lane to PASS.

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
| `npm run test:workflow` | PASS | Canonical preflight immediately preceded the command; 2 files and 14 tests passed. |
| `npm run e2e -- e2e/phase39-security-review.spec.ts -g '/agents lifecycle'` | PASS | In-process dotenv load and `#phase39-fixture` marker injection; canonical preflight immediately before reset and Playwright; fixture reset returned `companyId=210`, `personaId=23`, `practiceAreaId=226`; real Clerk setup passed; Playwright Chromium passed `3 passed (29.2s)`. Instrumented diagnostic run observed `POST 200 http://localhost:3000/agents`, `GET 200 http://localhost:3000/agents?_rsc=...`, card text `Current version 2`, and no page error. |
| `npm run e2e -- e2e/phase39-security-review.spec.ts -g 'Company|Persona'` | BLOCKED | Latest guarded rerun: canonical preflight and fixture reset passed after applying the existing journaled `0010_phase39_review_corrections` migration. Company reached durable launch but provider rate limiting persisted run status `failed`; Persona was blocked because the Company-targeted custom agent was not offered for a Persona target. |
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

## Commands and Boundary Notes

- Non-DB gates were run directly as authorized by the plan.
- Every attempted DB/Workflow/E2E lane had the exact canonical preflight immediately before it with `PHASE39_FIXTURE_ONLY=1` inherited.
- The canonical preflight passed immediately before every executed DB/Workflow/E2E lane. The fixture reset blocker was disposable-database drift: the repository already contained the intended append-only relation in migration `0010`, schema, and snapshot, but the fixture database had not applied that journaled migration. Applying it restored reset compatibility; no migration/schema/reset source change was made.
- `STATE.md` and `ROADMAP.md` were not modified.

## Save-new-version Root Cause Evidence

- **Confirmed mechanism:** `Save new version` was not failing. The browser observed a successful `POST 200` to `/agents`, followed by the `router.refresh()` RSC `GET 200` for `/agents`; the refreshed card displayed `Current version 2`.
- **Original test defect:** the test asserted historical `Version 1` and `Read-only` text on the card, but `CustomAgentCard` renders only the latest version. History is rendered by `CustomAgentEditor` inside the `Edit custom agent` Sheet.
- **Secondary stale-locator defect:** after refresh/lifecycle actions, the original card locator could resolve an old detached card or stale action surface. The test now captures the created card's `data-custom-agent-id`, reopens the current Sheet after reload, and performs lifecycle actions through that Sheet.
- **Console evidence:** no page error was emitted. A non-failing React warning remains: `Select is changing from controlled to uncontrolled.` It is unrelated to the save/version assertion and was not changed.
- **Final guarded rerun:** PASS — `3 passed (29.2s)` for auth setup, Clerk authentication, and the lifecycle browser test.
- **Latest follow-on reruns:** Company is BLOCKED after real durable launch and persisted `failed` status caused by provider rate limiting; Persona is BLOCKED because no persona-compatible custom agent was offered. Fixture reset is PASS. Neither browser lane has a false PASS.
