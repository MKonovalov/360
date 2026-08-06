---
phase: 31
slug: durable-executor-selection-validation
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-06
---

# Phase 31 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 plus `@workflow/vitest@4.0.16` |
| **Config file** | `vitest.workflow.config.ts` — Wave 0 adds the Workflow Local World plugin |
| **Quick run command** | `npm test -- src/lib/db/queries/workflowProofRuns.test.ts` |
| **Required workflow command** | `TEST_DATABASE_URL="$TEST_DATABASE_URL" npm run test:workflow` — fails non-zero when `TEST_DATABASE_URL` is absent, then runs Local World |
| **Final release-gate command** | `npm test && TEST_DATABASE_URL="$TEST_DATABASE_URL" npm run test:workflow && npm run build && npm run e2e -- e2e/workflow-proof-runs.spec.ts` |
| **Estimated runtime** | ~90 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- src/lib/db/queries/workflowProofRuns.test.ts`
- **After Plan 31-01:** Run focused `npm run test:workflow:config`, then `npm test -- src/lib/db/queries/workflowProofRuns.test.ts` and `npm run db:push`.
- **After Plan 31-02:** Run focused `npm test -- src/app/api/workflow-proof-runs/route.test.ts` and required `TEST_DATABASE_URL="$TEST_DATABASE_URL" npm run test:workflow`.
- **Before `/gsd-verify-work`:** Run the final release gate above, then preview `vercel build && vercel deploy --prebuilt` and production `vercel build --prod && vercel deploy --prebuilt --prod` only after preview approval.
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 31-01-01 | 01 | 1 | RUN-03 | T-31-01 | Workflow package/config routes are configured and proxy excludes `/.well-known/workflow/`. | config | `npm run test:workflow:config` | ❌ W0 | ⬜ pending |
| 31-01-02 | 01 | 1 | RUN-03 | T-31-02 | Application proof lifecycle transitions are conditional, idempotent, database-authoritative, and append audit events. | unit | `npm test -- src/lib/db/queries/workflowProofRuns.test.ts` | ❌ W0 | ⬜ pending |
| 31-02-01 | 02 | 2 | RUN-03 | T-31-03 | Staff-gated start creates the application record first, persists workflow metadata, and returns only the application run ID. | route | `npm test -- src/app/api/workflow-proof-runs/route.test.ts` | ❌ W0 | ⬜ pending |
| 31-02-02 | 02 | 2 | RUN-03 | T-31-04 | Workflow receives only the application ID; controlled failure retries once, expired claims recover once, and exhausted recovery fails safely. | required workflow integration | `TEST_DATABASE_URL="$TEST_DATABASE_URL" npm run test:workflow` | ❌ W0 | ⬜ pending |
| 31-03-01 | 03 | 3 | RUN-03 | T-31-05 | Preview plus production smoke proves start, navigation/reload-safe status, and terminal database state without AI/web-research work. | deployed smoke | `npm run e2e` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.workflow.config.ts` — configure the `workflow()` plugin for `*.integration.test.ts`.
- [ ] `src/lib/db/queries/workflowProofRuns.test.ts` — lock conditional lifecycle transitions, recovery ceiling, and immutable event audit.
- [ ] `src/workflows/workflowProof.integration.test.ts` — exercise create/start, controlled bounded retry, database-authoritative terminal status, and recovery exhaustion in a Workflow Local World.
- [ ] `src/app/api/workflow-proof-runs/route.test.ts` or an equivalent route test — lock staff gate, create-first dispatch, and dispatch-failure behavior.
- [ ] Install `workflow@4.8.0` and `@workflow/vitest@4.0.16`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Preview durable-executor smoke | RUN-03 | Workflow queueing and generated routes must be observed in the Vercel preview environment. | Start a synthetic proof run, navigate away or reload, then confirm the database-backed status reaches a terminal state with the application and workflow IDs retained. |
| Production safe smoke | RUN-03 | Production Vercel routing and executor configuration cannot be proven locally. | Run the same synthetic proof without Company/Persona, AI, Firecrawl, or prospect data; reload status and confirm it reaches a terminal audited state. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all missing references
- [x] No watch-mode flags
- [x] Feedback latency < 90 seconds
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
