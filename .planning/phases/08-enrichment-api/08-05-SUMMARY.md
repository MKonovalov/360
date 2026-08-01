# Plan 08-05 Summary — Enrichment Server Actions

## What was done
- `src/app/actions/enrichment.ts` (`'use server'`):
  - `runEnrichment(entityType, recordId)` — `requireStaffAccess()` first; loads record; blocks blank domain/email with `no_match_key`; calls the Apollo client; returns `{ ok:true, plan: EnrichmentPlanRow[] }` (via `buildEnrichmentPlan`) or `{ ok:false, reason }`. Writes nothing.
  - `commitEnrichment(entityType, recordId, accepted)` — `requireStaffAccess()` first; filters `accepted` against a per-entity writable allowlist (company: industry/employeeCountBand/hqLocation/revenueBand/ownershipType/techStack; persona: title/seniority/linkedinUrl) so name/domain/email are never writable (defense-in-depth); writes via the 08-04 query layer; `revalidatePath` on the detail + list routes; no-op when nothing accepted.
- Metadata-only `console.info` logging on both actions (event, entityType, recordId, ok/reason/wrote) — no PII/body.

## Verification
- `npx tsc --noEmit` → clean

## Files changed
- `src/app/actions/enrichment.ts` (new)
