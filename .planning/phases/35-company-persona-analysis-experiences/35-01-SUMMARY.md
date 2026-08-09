# Phase 35 Wave 1 Plan 01 Summary

## Delivered

- Added strict preview input/response, all-status history, subject identity, and
  confirmed-candidate display contracts in `experienceContracts.ts`.
- Added read-only `listAnalysisRunsForSubject()` history projection ordered by
  creation time and run ID descending, with review and packet markers.
- Added `listConfirmedCandidateOfferingsForSubject()` with SQL predicates for
  both target discriminator and subject ID, offering names, source provenance,
  confirmed-only evidence, and Persona retention visibility.
- Kept the existing global candidate reader on the Phase 34 evidence contract;
  only the new subject-scoped display reader adds `offeringName`.
- Added staff-first `POST /api/analysis-preview` resolution for the single
  compatible fixed template, active Practice Area, and target checklist.
- Added Company/Persona ID-collision, lifecycle, evidence, retention, and
  server-authority coverage without provider or legacy proposal writes.

## Verification

- Focused tests: **52 passed**; guarded Neon integration file: **8 skipped**
  because `TEST_DATABASE_URL` is absent.
- Guard command correctly failed closed with:
  `MISSING — TEST_DATABASE_URL required for subject/discriminator/retention database evidence`.
- `lsp_diagnostics`: unavailable because the TypeScript LSP server is not
  installed and installation was previously declined.
- `npx tsc --noEmit` and `npm run build` remain blocked by pre-existing
  `analysisProposalDerivation.ts` / test type errors outside this Wave 1 scope;
  the production build compiled successfully before that existing type-check
  failure.
