---
phase: 08-enrichment-api
plan: 06
status: complete
requirements-completed: ["ENRC-01", "ENRC-02", "ENRC-04", "ENRC-05"]
---

# Plan 08-06 Summary — Review dialog + Enrich menu wiring

## What was done
- `src/components/enrichment/enrichment-review-dialog.tsx` (new, `'use client'`): `EnrichMenu` — a self-contained detail-panel dropdown (live **Enrich** item + still-disabled **Analyze**) plus the enrichment review Dialog. On Enrich it calls `runEnrichment`; renders loading / error(reason copy) / "already up to date" / a review table (Field | Current | Incoming | Confidence | ✓). `fill` rows pre-checked, `conflict` rows unchecked + amber "conflict" badge. Confidence renders `%` or `—`. Commit calls `commitEnrichment` with only checked fields; Cancel/close writes nothing. Commit disabled while pending or zero checked.
- `src/components/companies/company-detail.tsx`: replaced the `ExplorerMenu variant="icon"` (Analyze-disabled) with `<EnrichMenu entityType="company" recordId={company.id} />`.
- `src/components/personas/persona-detail.tsx`: same with `entityType="persona"`.

## Final verification
- Isolated Neon schema push and database integration tests completed.
- `npm test` with `TEST_DATABASE_URL` passed 12 files and 139/139 tests.
- `npx tsc --noEmit --incremental false`, `npm run build`, targeted ESLint over the four responsive files, and `git diff --check` passed.
- Full `npm run lint` retains only two unrelated pre-existing errors in `src/components/layout/sidebar-resize-handle.tsx:33` and `src/hooks/use-mobile.ts:14`.
- Authenticated production Playwright passed on company and persona routes at 375/768/1280, including responsive geometry, Menu/Escape/Close, ArrowDown/Enter, and no console errors.
- Two independent visual reviews returned PASS.

## Pending — blocking human gate (Task 3)
- **Live Apollo smoke test** is NOT yet run. `APOLLO_API_KEY` and an independent 32+ character `ENRICHMENT_REVIEW_SECRET` remain unset; no values are recorded here. Steps: enrich a real company by domain and a persona by email; confirm review dialog populates, empty pre-checked, conflicts unchecked, confidence `—`; commit writes only checked fields; `field_sources` marks them `apollo`, `last_enriched_at` set; re-enrich no longer offers filled fields; blank-domain/email record shows the "add a domain/email first" message.
- This gate is surfaced to the user (autonomous workflow pause-at-boundary).

## Files changed
- `src/components/enrichment/enrichment-review-dialog.tsx` (new)
- `src/components/companies/company-detail.tsx` (edited)
- `src/components/personas/persona-detail.tsx` (edited)
