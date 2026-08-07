---
phase: 31-durable-executor-selection-validation
plan: 03
subsystem: testing
tags: [playwright, clerk, workflow, vercel, run-03, evidence]

# Dependency graph
requires:
  - phase: 31-durable-executor-selection-validation
    provides: Staff-gated synthetic proof routes, database-authoritative lifecycle, and Local World gates from Plans 31-01/31-02
provides:
  - Authenticated, navigation-independent deployed smoke automation
  - Automated Preview and Production RUN-03 evidence ledger
affects: [RUN-03, Phase 31 release gate, future durable analysis verification]

# Tech tracking
tech-stack:
  added: []
  patterns: [deployed-origin Playwright auth, bounded database-status polling, database-authoritative deployment evidence]

key-files:
  created:
    - .planning/phases/31-durable-executor-selection-validation/31-03-SUMMARY.md
  modified:
    - e2e/auth.setup.ts
    - playwright.config.ts
    - .planning/phases/31-durable-executor-selection-validation/31-VERIFICATION.md

key-decisions:
  - "When E2E_BASE_URL targets a deployed host, Playwright signs in on that host and skips the localhost web server so Clerk cookies are domain-correct."
  - "Use application database status and audit events as product truth; retain Workflow run IDs only as diagnostic evidence."

requirements-completed: [RUN-03]

# Metrics
duration: 20min
completed: 2026-08-07
tasks: 2
---

# Phase 31 Plan 03 Summary

**Preview and Production now have authenticated, synthetic, navigation-independent proof that the durable executor reaches an auditable database terminal state.**

## Accomplishments

- Added a real Clerk-authenticated Playwright smoke that calls only the synthetic proof POST/GET routes.
- Enforced an exact `{ applicationRunId }` start response, immediate navigation away, bounded polling, terminal audit assertions, and diagnostic Workflow ID presence without using Workflow state as product truth.
- Fixed deployed-origin Clerk authentication by installing the Clerk testing-token route handler before navigation and selecting non-localhost `E2E_BASE_URL` as the Playwright base URL.
- Verified Preview smoke passed 3/3 with application run `5`, terminal `completed`, two bounded synthetic attempts, and the full audited lifecycle sequence.
- Built and deployed Production, then verified the Production smoke passed 3/3 against `https://360-arclumen.vercel.app`.
- Captured a browser-context Production proof with application run `11`, terminal `completed`, failure reason `null`, two synthetic attempts, and diagnostic Workflow ID prefix `wrun_01KZCSRCF4Q...`.
- Confirmed no Analyze, AI, Firecrawl, provider, prospect, review, candidate, or Phase 32/33 flow was invoked.

## Verification

```text
E2E_BASE_URL=http://localhost:3000 VERCEL_URL=http://localhost:3000 npm run e2e -- e2e/workflow-proof-runs.spec.ts
3 passed

E2E_BASE_URL=https://360-arclumen-ldireowkt-mkonovalovs-projects.vercel.app npm run e2e -- e2e/workflow-proof-runs.spec.ts
3 passed

vercel build --prod
vercel deploy --prebuilt --prod

E2E_BASE_URL=https://360-arclumen.vercel.app npm run e2e -- e2e/workflow-proof-runs.spec.ts
3 passed (23.9s)
```

Production diagnostic event sequence:

```text
queued -> claimed -> workflow_metadata_mismatch -> workflow_metadata_reconciled
-> synthetic_attempt -> synthetic_attempt -> completed
```

The production browser navigated away before status polling. The database status
reached `completed`; the diagnostic Workflow ID was not used as product truth.

## Deployment Evidence

- Preview: `https://360-arclumen-ldireowkt-mkonovalovs-projects.vercel.app`; run `5`; completed.
- Production: `https://360-arclumen.vercel.app`; latest deployment artifact `https://360-arclumen-1ofi3s7du-mkonovalovs-projects.vercel.app`; run `11`; completed.
- Both environments recorded at most two unique synthetic attempts and the complete append-only audit sequence.

## Scope and Caveats

- No application route, database behavior, package dependency, or product feature was added in this plan.
- The existing unrelated full-suite failures documented by Plan 31-02 remain outside this plan's scope; the dedicated Workflow and deployed smoke gates are the applicable RUN-03 evidence.

## Self-Check: PASSED

- Summary file exists at `.planning/phases/31-durable-executor-selection-validation/31-03-SUMMARY.md`.
- Verification ledger records both Preview and Production observed evidence.
- RUN-03 and all three Phase 31 success criteria are satisfied by automated and deployed evidence.

---
*Phase: 31-durable-executor-selection-validation*
*Plan: 03*
*Completed: 2026-08-07*
