# Phase 31: Durable Executor Selection & Validation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-06
**Phase:** 31-Durable Executor Selection & Validation
**Areas discussed:** Execution platform, Retry behavior, Proof standard, Run identity

---

## Execution platform

| Decision | Selected |
|----------|----------|
| Executor: Vercel Workflow DevKit / external queue worker / custom worker | Vercel Workflow DevKit |
| Execution: Node steps / DurableAgent / workflow sandbox | Node steps |
| Start response: app run ID / workflow run ID / wait | App run ID immediately |
| Dispatch failure: fail / retry dispatch / stay queued | Mark failed; allow a new run |

## Retry behavior

| Decision | Selected |
|----------|----------|
| Automatic scope: transient steps / none / full analysis | Transient steps only |
| Retry budget: one / two / platform default | One retry |
| Interrupted claim: recover once / fail immediately / retry forever | Recover once, then fail |
| Staff retry: new run / reset same run / operator only | Create a new run |

## Proof standard

| Decision | Selected |
|----------|----------|
| Environment: preview + production smoke / preview / local | Preview plus production smoke |
| Workload: synthetic lifecycle job / real research / DB-only | Synthetic lifecycle job |
| Interruption: controlled step failure / cancel / deploy restart | Controlled step failure |
| Evidence: automated + live / automated / manual | Automated plus live check |

## Run identity

| Decision | Selected |
|----------|----------|
| Linkage: both IDs / database ID only / workflow ID only | Store both IDs |
| Product status: database / workflow / merged | Application database |
| Workflow input: database run ID / full payload / session identity | Database run ID |
| Mismatch: database wins / workflow wins / manual UI | Database wins, reconcile safely |

## Claude's Discretion

- Current Workflow DevKit package/API details, additive synthetic ledger shape, and test harness after documentation verification.

## Deferred Ideas

None.
