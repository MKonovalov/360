---
phase: 35-company-persona-analysis-experiences
uat_status: passed_via_phase36_superset
uat_date: 2026-08-08
blocking_prerequisites:
  - TEST_DATABASE_URL
  - PHASE35_COMPANY_ID
  - PHASE35_PERSONA_ID
  - PHASE35_FIXTURE_RUN_ID
---

# Phase 35 User Acceptance Testing (UAT)

## Summary

Phase 35 implementation is **code-complete and verified** across all four Final Wave reviewers (F1-F4 APPROVE). The dedicated Phase 35 fixture harness was initially blocked by missing environment prerequisites. The later guarded Phase 36 authenticated run exercised the same Company/Persona preview, launch, reload/history, source/result, review, and confirmed-candidate acceptance surface and passed **5/5 originally in 31.2s and again after ship-review remediation in 36.9s**, closing UX-01/UX-02 without claiming the dedicated Phase 35 command itself was rerun.

## Automated Evidence Collected

### Wave 1: Contracts & Subject-Scoped Queries
- ✅ `npm test -- src/lib/analysis/experienceContracts.test.ts` — PASS
- ✅ `npm test -- src/lib/db/queries/analysisRuns.test.ts` — PASS
- ✅ `npm test -- src/lib/db/queries/confirmedCandidates.test.ts` — PASS
- ✅ Route Handler tests: `src/app/api/analysis-preview/route.test.ts` — PASS
- ✅ Route Handler tests: `src/app/api/analysis-runs/route.test.ts` — PASS

**Result:** 53 tests passed. Pure contract and unit tests; no external services.

### Wave 2: Launcher, Polling, History, Candidates
- ✅ `npm test -- src/components/analysis/analysis-run-launcher.test.tsx` — PASS
- ✅ `npm test -- src/components/analysis/analysis-run-status.test.tsx` — PASS
- ✅ `npm test -- src/components/reviews/run-review-card.test.tsx` — PASS
- ✅ `npm test -- src/components/analysis/analysis-history.test.tsx` — PASS
- ✅ `npm test -- src/components/analysis/confirmed-candidate-offerings.test.tsx` — PASS
- ✅ `npx tsc --noEmit` — PASS (TypeScript strict mode)

**Result:** 35 tests passed. Component contracts verified; read-only controls confirmed absent.

### Wave 3: Scope Audit & Build
- ✅ `npm exec tsx -- scripts/phase35-scope-audit.ts` — PASS (0 findings)
  - No Phase 36 leakage
  - No provider/Firecrawl execution
  - No legacy proposal writes
  - No Signal/Offering writes
  - No packet mutation
  - No package/schema changes
- ✅ `npm run build` — PASS (TypeScript compilation successful)
- ✅ Fixture spec discovery: `npm exec playwright test e2e/35-analysis-experiences.spec.ts --list` — PASS (4 Phase 35 tests discovered)

**Result:** Scope audit passed with zero violations. Production build successful.

## Blocking Prerequisites for Authenticated UAT

The fixture-only browser tests require:

1. **`TEST_DATABASE_URL`** — Neon Postgres connection string
   - Required for: seeding fixture data, validating database-backed queries
   - Status: ❌ Not provided in environment

2. **`PHASE35_COMPANY_ID`** — Numeric ID of seeded Company fixture
   - Required for: Company preview/history/candidates tests
   - Status: ❌ Not provided in environment

3. **`PHASE35_PERSONA_ID`** — Numeric ID of seeded Persona fixture
   - Required for: Persona preview/history/candidates tests
   - Status: ❌ Not provided in environment

4. **`PHASE35_FIXTURE_RUN_ID`** — Numeric ID of seeded analysis run
   - Required for: history/status/results tests
   - Status: ❌ Not provided in environment

5. **Clerk storage state** — `e2e/.clerk/user.json`
   - Status: ✅ Present and configured

## Test Cases (Blocked)

When prerequisites are available, the following tests will execute:

### UX-01: Company Analysis Preview
- **Test:** Company Menu → Analyze opens Dialog
- **Expected:** Preview shows resolved instruction, Practice Area, full active checklist, effort, and immediately enabled Start button
- **Status:** ⏳ Blocked (requires `PHASE35_COMPANY_ID`, `TEST_DATABASE_URL`)

### UX-01: Persona Analysis Preview
- **Test:** Persona Menu → Analyze opens Dialog
- **Expected:** Preview shows resolved instruction, Practice Area, full active checklist, effort, and immediately enabled Start button
- **Status:** ⏳ Blocked (requires `PHASE35_PERSONA_ID`, `TEST_DATABASE_URL`)

### UX-02: Company History & Status
- **Test:** Reload Company record after fixture run
- **Expected:** Newest-first all-run history visible; queued/running rows poll; polling stops when leaving active statuses
- **Status:** ⏳ Blocked (requires `PHASE35_COMPANY_ID`, `PHASE35_FIXTURE_RUN_ID`, `TEST_DATABASE_URL`)

### UX-02: Persona History & Status
- **Test:** Reload Persona record after fixture run
- **Expected:** Newest-first all-run history visible; queued/running rows poll; polling stops when leaving active statuses
- **Status:** ⏳ Blocked (requires `PHASE35_PERSONA_ID`, `PHASE35_FIXTURE_RUN_ID`, `TEST_DATABASE_URL`)

### UX-02: Company Results & Review
- **Test:** Settled findings render with sources, provenance, pending-review navigation
- **Expected:** No target-page Confirm/Dismiss controls; `/reviews` link visible
- **Status:** ⏳ Blocked (requires `PHASE35_COMPANY_ID`, `PHASE35_FIXTURE_RUN_ID`, `TEST_DATABASE_URL`)

### UX-02: Persona Results & Review
- **Test:** Settled findings render with sources, provenance, pending-review navigation
- **Expected:** No target-page Confirm/Dismiss controls; `/reviews` link visible
- **Status:** ⏳ Blocked (requires `PHASE35_PERSONA_ID`, `PHASE35_FIXTURE_RUN_ID`, `TEST_DATABASE_URL`)

### UX-02: Company Candidates
- **Test:** Confirmed Candidate Offerings section follows Buying Signals
- **Expected:** Offering, signal, strong/weak status, and source links visible
- **Status:** ⏳ Blocked (requires `PHASE35_COMPANY_ID`, `TEST_DATABASE_URL`)

### UX-02: Persona Candidates
- **Test:** Confirmed Candidate Offerings section follows Buying Signals
- **Expected:** Offering, signal, strong/weak status, and source links visible
- **Status:** ⏳ Blocked (requires `PHASE35_PERSONA_ID`, `TEST_DATABASE_URL`)

## How to Unblock

To run authenticated fixture-only UAT:

1. **Seed fixture data** in Neon using `TEST_DATABASE_URL`:
   ```bash
   export TEST_DATABASE_URL="postgresql://user:pass@host/db"
   npm test -- src/lib/db/queries/confirmedCandidates.integration.test.ts
   ```
   Capture the seeded fixture IDs.

2. **Set environment variables**:
   ```bash
   export PHASE35_FIXTURE_ONLY=1
   export TEST_DATABASE_URL="postgresql://user:pass@host/db"
   export PHASE35_COMPANY_ID=<seeded-company-id>
   export PHASE35_PERSONA_ID=<seeded-persona-id>
   export PHASE35_FIXTURE_RUN_ID=<seeded-run-id>
   ```

3. **Run authenticated UAT**:
   ```bash
   npm exec playwright test e2e/35-analysis-experiences.spec.ts
   ```

4. **Record results** in this file under "Test Results" section.

## Test Results

### Automated Evidence
- ✅ Wave 1: 53 tests passed
- ✅ Wave 2: 35 tests passed
- ✅ Wave 3: Scope audit (0 findings), build passed, fixture spec discovered
- ✅ Authenticated acceptance: Passed via the downstream Phase 36 superset run (5/5 originally in 31.2s; refreshed in 36.9s); the dedicated Phase 35 command remains historically not rerun.

### Final Verdict

**Phase 35 Implementation: VERIFIED COMPLETE**
- ✅ F1: Goal Achievement — APPROVE (build passes, tests pass, fixture payload fixed)
- ✅ F2: Scope Containment — APPROVE (0 violations)
- ✅ F3: Data Integrity — APPROVE (subject scoping, confirmed-only candidates, read-only)
- ✅ F4: Security & Authority — APPROVE (staff-gated, server-side authority)

**Authenticated acceptance: PASSED VIA PHASE 36 SUPERSET**
- ✅ The guarded Phase 36 run covered both target types through preview, launch, reload/history, results/sources, review, and confirmed-only candidates.
- ✅ UX-01 and UX-02 are accepted from that user-confirmed 5/5 run.
- ℹ️ The dedicated Phase 35 fixture command remains a historical blocked attempt and is not represented as executed.

## Notes

- No live provider or Firecrawl execution was performed (policy: fixture-only)
- All Phase 35 code is read-only; no writes to Signals, Offerings, or proposals
- Scope audit confirmed zero Phase 36 leakage
- Build passes with TypeScript strict mode
- Clerk authentication state is configured and ready
