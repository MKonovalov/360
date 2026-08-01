---
phase: 08-enrichment-api
plan: 04
status: complete
requirements-completed: ["ENRC-02", "ENRC-03"]
---

# Plan 08-04 Summary — Enrichment query layer

## What was done
- `src/lib/db/queries/companies.ts`: added `applyCompanyEnrichment(id, accepted)` — a targeted `UPDATE company SET <accepted>, field_sources=<merged>, last_enriched_at=now() WHERE id=?`. No insert path (record always exists; missing id throws — a caller error, never a silent create). Merges `apollo` provenance markers onto existing `fieldSources` without disturbing untouched fields.
- `src/lib/db/queries/personas.ts`: `applyPersonaEnrichment(id, accepted)` — same contract for persona (title/seniority/linkedinUrl writable).

## Verification
- `npx tsc --noEmit` → clean
- `npx vitest run` → 122/122 (no regression)

## Files changed
- `src/lib/db/queries/companies.ts` (edited — appended `applyCompanyEnrichment`)
- `src/lib/db/queries/personas.ts` (edited — appended `applyPersonaEnrichment`)
