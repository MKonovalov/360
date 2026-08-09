# Phase 35 Wave 2 Plan 03 Summary

## Delivered

- Added an all-status, newest-first `AnalysisHistory` composition with explicit
  empty/error states, active-run status mounting, terminal lifecycle copy, and
  retention-safe result fallbacks.
- Extended the shared Phase 34 `RunReviewCard` with a backwards-compatible
  `mode="readonly"`; pending-review detail cards link to `/reviews` and never
  render Confirm/Dismiss controls.
- Added confirmed candidate offering presentation with offering name, signal,
  evidence strength, and persisted canonical source links while preserving
  duplicate provenance rows.
- Composed subject-scoped run/candidate reads and retention-aware packet
  projection into Company and Persona detail components. Persona result and
  candidate reads remain empty when the retention boundary hides expired data.

## Verification

- Targeted component tests: **30 passed**.
- `npx tsc --noEmit`: blocked by pre-existing `analysisProposalDerivation.ts`
  and related test type errors outside this plan.
- `npm run build`: production compilation succeeded; type-check stage remains
  blocked by the same pre-existing `analysisProposalDerivation.ts` error.
- `lsp_diagnostics`: unavailable because the TypeScript LSP server is not
  installed and installation was previously declined.
- No provider or Firecrawl calls were added.
