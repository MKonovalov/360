---
phase: 08-enrichment-api
plan: 02
status: complete
requirements-completed: ["ENRC-02", "ENRC-03", "ENRC-05"]
---

# Plan 08-02 Summary — Pure core (apolloMap + mergePlan)

## What was done
- `src/lib/enrichment/apolloMap.ts`: pure Apollo-response → `EnrichedField[]` mappers.
  - `apolloMapCompany` (industry, employeeCountBand, hqLocation, revenueBand, techStack) — excludes `domain` match key; `ownershipType` unmapped (no Apollo equivalent).
  - `apolloMapPersona` (title, seniority, linkedinUrl) — excludes `email`/`name`.
  - Helpers: `bucketRevenue` (enum boundaries), `parsePrintedRevenue`, `bucketEmployees` (band text), `mapSeniority` (c_suite→c_level, entry/intern→ic, unknown→omit). Defensive on `unknown` input (never throws). `confidence` always undefined for Apollo (ENRC-05 resolution).
- `src/lib/enrichment/mergePlan.ts`: `buildEnrichmentPlan(current, incoming)` → `EnrichmentPlanRow[]`. Empty target → `fill`+preAccepted; populated & differs → `conflict`+opt-in; identical → skipped. Order-insensitive array equality.
- Tests: `apolloMap.test.ts` (bucketing boundaries, dedupe, seniority, match-key exclusion, junk input) + `mergePlan.test.ts` (fill/conflict/skip, array set-equality, mixed split, confidence passthrough).

## Verification
- `npx vitest run src/lib/enrichment` → 18/18 pass (2 files)
- `npx tsc --noEmit` → clean

## Files changed
- `src/lib/enrichment/apolloMap.ts` (new)
- `src/lib/enrichment/apolloMap.test.ts` (new)
- `src/lib/enrichment/mergePlan.ts` (new)
- `src/lib/enrichment/mergePlan.test.ts` (new)
