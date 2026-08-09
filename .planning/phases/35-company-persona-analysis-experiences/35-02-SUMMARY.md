# Phase 35 Wave 2 Plan 02 Summary

## Delivered

- Added the fixed-template `AnalysisLauncher` Menu→Dialog flow for Company and
  Persona records.
- Added server preview loading from `POST /api/analysis-preview`, Practice Area
  selection, read-only instruction/checklist/effort rendering, authoritative
  `POST /api/analysis-runs`, duplicate/error copy, and refresh after launch.
- Added `pollingClient` with Zod response parsing, stale-response suppression,
  abort-safe cleanup, network failure handling, and terminal detection for
  completed, failed, cancelled, pending_review, confirmed, and dismissed.
- Updated `AnalysisRunStatus` to use terminal-aware polling and refresh after a
  terminal response.
- Replaced the legacy Company-only proposal Analyze event with the shared
  Menu→Dialog action for both target types. In this repository the detail
  integration lives in `company-detail.tsx` and `persona-detail.tsx`; there are
  no `src/app/company/[id]/page.tsx` or `src/app/persona/[id]/page.tsx` files.

## Verification

- Targeted launcher/polling tests: **10 passed**.
- `npx tsc --noEmit` and `npm run build` remain blocked by the pre-existing
  `analysisProposalDerivation.ts` / test type errors outside Wave 2.
- `lsp_diagnostics` unavailable because the TypeScript LSP server is not
  installed and installation was previously declined.
- No provider, Firecrawl, Phase 36, history composition, or scope-audit code
  was added.
