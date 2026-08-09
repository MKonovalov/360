---
status: partial
phase: 36-agent-management-end-to-end-verification
source: [36-01-SUMMARY.md, 36-02-SUMMARY.md, 36-03-SUMMARY.md, 36-04-SUMMARY.md, 36-05-SUMMARY.md, 36-06-SUMMARY.md, 36-07-SUMMARY.md]
started: 2026-08-08T22:53:57Z
updated: 2026-08-09T00:35:30Z
---

## Current Test

[testing complete — authenticated Playwright passed; the separate Workflow/database matrix remains prerequisite-gated]

## Tests

### 1. Authenticated `/agents` route and Manage sidebar smoke
expected: An authenticated staff user reaches `/agents` without a sign-in redirect; exactly two template cards render; Agents is active and appears before Reviews; collapsing the sidebar exposes the expand control.
result: pass
evidence: Guarded `npm exec playwright test e2e/36-agent-management.spec.ts` passed all 5 tests originally in 31.2s and again after ship-review remediation in 36.9s, including auth setup (2 tests). The authenticated run covered `/agents` access, UX-03 management, and both Company/Persona VER-01 target flows. Evidence is sanitized: no fixture IDs, credentials, or private data are recorded.

### 2. Manage fixed templates: edit, immutable version history, retire, and reactivate
expected: Staff can edit instruction/default effort, save a new immutable version, see prior history as read-only, retire a template, and reactivate it without changing the current version.
result: pass
evidence: The user-confirmed authenticated Playwright run passed UX-03: fixed templates were exercised through edit/save, immutable history, retire, and reactivate behavior. No fixture IDs or mutation details are recorded here.

### 3. Company analysis: preview, launch, reload, result/source, review, and confirmed-only candidates
expected: A Company record shows the resolved Company template preview, launches a deterministic run, retains status after navigation/reload, exposes settled findings and sources, permits one whole-run decision, and shows only confirmed candidate offerings.
result: pass
evidence: The user-confirmed authenticated Playwright run passed the Company VER-01 preview, launch, reload/status, result/source, review, confirmed-only candidate, and count-based live Signal/link assertion. The independent row-hash matrix remains blocked.

### 4. Persona analysis: preview, launch, reload, result/source, review, and confirmed-only candidates
expected: A Persona record shows the resolved Persona template preview, launches a deterministic run, retains status after navigation/reload, exposes settled findings and sources, permits one whole-run decision, and shows only confirmed candidate offerings.
result: pass
evidence: The user-confirmed authenticated Playwright run passed the Persona VER-01 preview, launch, reload/status, result/source, review, confirmed-only candidate, and count-based live Signal/link assertion. The independent row-hash matrix remains blocked.

### 5. Database/Workflow verification matrix: recovery, grounding, duplicate-run, review idempotency, aggregation, and no-live-write boundary
expected: Disposable Neon-backed verification proves durable lifecycle/recovery, source-grounded persistence, duplicate active-run protection, one-winner review decisions, confirmed-only aggregation, and unchanged live Signal/offering/link rows.
result: blocked
blocked_by: server
reason: "The separate guarded Workflow/database matrix was not rerun as part of the confirmed browser result. Keep lifecycle/recovery, grounding, duplicate-run, review-race, aggregation, and no-live-write matrix status blocked until `npm run test:workflow` and the DB integration suites complete against a disposable database. No success is inferred from the Playwright pass alone."

## Summary

total: 5
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 1

## Available deterministic evidence

These are recorded as supporting evidence; the remaining blocked Workflow/database matrix is not replaced by browser evidence:

- Expanded Phase 36 Vitest gate: 74 passed and 32 guarded database tests skipped; contracts, actions, UI, navigation, fixture validation, fixture-reset safety, Workflow lifecycle, and fixture-only adversarial checks passed.
- Final combined Phase 35/36 shipping gate after review remediation: 184 passed and 32 guarded tests skipped.
- `npm run build`: passed and emitted the dynamic `/agents` route.
- `npm exec tsx -- scripts/phase36-scope-audit.ts`: 0 findings; `npm test -- scripts/phase36-scope-audit.test.ts`: 1 passed.
- Guarded `npm exec playwright test e2e/36-agent-management.spec.ts`: **5 passed (31.2s)** originally and **5 passed (36.9s)** after ship-review remediation, including auth setup, UX-03, Company VER-01, and Persona VER-01. Its browser no-live-write assertion compares Company signals, Persona signals, and links by count; the independent row-hash database matrix remains blocked. No credentials, fixture IDs, or private data are included.
- Full repository/typecheck baseline failures and optional provider smoke remain outside this UAT pass; no new Phase 36 code defect was diagnosed and no application code was modified.

## Exact prerequisites to unblock

Use a disposable database, never production, to unblock the separate Workflow/database matrix:

```text
export TEST_DATABASE_URL='postgresql://<disposable-test-db>'
env -u DATABASE_URL TEST_DATABASE_URL="$TEST_DATABASE_URL" npm exec tsx e2e/phase36-fixture-reset.ts --check
env -u DATABASE_URL TEST_DATABASE_URL="$TEST_DATABASE_URL" npm exec tsx e2e/phase36-fixture-reset.ts
export PHASE36_COMPANY_ID='<sanitized numeric id from reset>'
export PHASE36_PERSONA_ID='<sanitized numeric id from reset>'
export PHASE36_FIXTURE_ONLY=1
```

Then rerun the guarded workflow and DB integration tests. The authenticated browser gate is already recorded as passed above; rerun it only if refreshed evidence is required:

```text
npm run test:workflow
TEST_DATABASE_URL="$TEST_DATABASE_URL" npm test -- src/lib/db/queries/analysisTemplates.integration.test.ts src/lib/db/queries/analysisRuns.integration.test.ts src/lib/db/queries/analysisReviews.integration.test.ts src/lib/db/queries/confirmedCandidates.integration.test.ts src/lib/verification/phase36Adversarial.integration.test.ts
TEST_DATABASE_URL="$TEST_DATABASE_URL" PHASE36_FIXTURE_ONLY=1 npm exec playwright test e2e/36-agent-management.spec.ts
```

## Gaps

<!-- No code gaps were discovered by the completed browser test. The remaining blocked entry is a separate prerequisite-gated Workflow/database verification matrix, not a diagnosed product defect. -->
