---
phase: 35-company-persona-analysis-experiences
plan: 04
status: blocked
requirements: [UX-01, UX-02]
scope_audit: pass
fixture_uat: blocked
database_evidence: unavailable
live_provider_smoke: not_run
live_provider_smoke_reason: policy_or_credentials_unavailable
---

# Phase 35 Wave 3 Plan 04 Summary

## Delivered

- Added `scripts/phase35-scope-audit.ts`, a fail-fast working-tree audit covering
  Phase 35 preview/history/detail paths, providers/Firecrawl, legacy proposal
  paths and writes, live Signal/Offering writes, packet mutation, Phase 36
  lifecycle/dynamic-agent leakage, subject-isolation regressions, agent routes,
  package changes, and schema/migration changes.
- Added `e2e/35-analysis-experiences.spec.ts` with an in-file disposable,
  fixture-only route helper. It uses the existing Clerk storage state, blocks
  forbidden provider/legacy requests, mocks preview/start/status boundaries,
  and declares Company and Persona UX-01/UX-02 tests without live execution.
- No application source, schema migration, package, provider, Firecrawl,
  Signal, Offering, link, or packet mutation was added by this plan.

## Automated evidence

| Check | Result | Sanitized evidence |
|---|---|---|
| Scope audit | PASS | 329 files scanned; 0 findings |
| Playwright discovery | PASS | 4 Phase 35 tests discovered (6 total including auth setup) |
| Focused Vitest suites | PASS | 10 files, 108 tests passed |
| Typecheck | BLOCKED | Pre-existing `analysisProposalDerivation.ts` / test errors outside this plan |
| Production build | BLOCKED | Compiled successfully; same pre-existing TypeScript error stopped the build gate |
| Neon integration | BLOCKED | `TEST_DATABASE_URL` absent in the gate shell; command failed closed |

The focused suite did not execute providers or Firecrawl. No database evidence
is claimed because the guarded integration command failed closed without
`TEST_DATABASE_URL`.

## Scope result

The audit passed with zero findings for:

- Phase 36 template lifecycle, dynamic-agent builder, and provider/model
  control leakage;
- provider/Firecrawl imports or execution in Phase 35 paths;
- legacy proposal execution or `agent_run`/`signal_proposal` writes;
- live Signal, Offering, or `signal_offering_link` writes;
- immutable packet mutation;
- global subject reads followed by client-side filtering;
- package or schema/migration changes.

## Blocking human checkpoint

Authenticated fixture-only UAT was attempted with `PHASE35_FIXTURE_ONLY=1`.
The existing Clerk setup completed, but the browser tests failed closed before
navigation because `PHASE35_COMPANY_ID` and `PHASE35_PERSONA_ID` were not
provided. The checkpoint is **not approved** and UX-01/UX-02 are not marked
passed. Resume with disposable seeded fixture IDs, `TEST_DATABASE_URL`,
`PHASE35_FIXTURE_ONLY=1`, and the existing `e2e/.clerk/user.json`, then run:

```text
npm exec -- playwright test e2e/35-analysis-experiences.spec.ts
```

Live provider/Firecrawl execution remains prohibited; deferred live smoke
remains `policy_or_credentials_unavailable`.
