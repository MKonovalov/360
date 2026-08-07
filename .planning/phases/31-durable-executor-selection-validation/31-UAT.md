---
phase: 31
started: 2026-08-07
status: in_progress
---

# Phase 31 User Acceptance Test

## Scope

Validate the synthetic durable-executor proof from a staff user's perspective:
authenticated start, navigation away, independent terminal completion, bounded
retry, recovery evidence, and database-authoritative status in Preview and
Production.

## Tests

### Test 1 — Production authenticated proof

- **Status:** passed
- **Steps:**
  1. Open `https://360-arclumen.vercel.app`.
  2. Sign in with the provisioned staff account.
  3. Run the existing smoke command:
     `E2E_BASE_URL=https://360-arclumen.vercel.app npm run e2e -- e2e/workflow-proof-runs.spec.ts`
  4. Confirm the result reports `3 passed`.
- **Expected:** A real Clerk-authenticated proof starts, leaves the initiating
  page, and reaches a terminal database-backed status with bounded audit events.

### Test 2 — Preview authenticated proof

- **Status:** passed
- **Evidence:** application run `5`; terminal `completed`; two synthetic attempts;
  full audit sequence recorded in `31-VERIFICATION.md`.

### Test 3 — Scope and lifecycle safety

- **Status:** passed
- **Expected:** Only synthetic proof routes run; no Analyze, AI, Firecrawl,
  provider, prospect, review, candidate, or Phase 32/33 work occurs.

## Session State

- **Current test:** complete
- **Next action:** None

## Result

**PASSED — 3/3 UAT tests confirmed.**

Phase 31 user acceptance complete. No fix plan required.
