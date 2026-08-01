# Phase 8: Enrichment API - Pattern Map

**Mapped:** 2026-07-31
**Analogs:** most files extend Phase 7 / v1.0 precedents; 2 genuinely new (paid external client, review dialog)

## File Classification

| New/Modified File | Role | Closest Analog | Match Quality |
|-------------------|------|----------------|----------------|
| `src/lib/db/schema.ts` (modify: `fieldSources` jsonb + `lastEnrichedAt` on `company` & `persona`) | model | itself — `import_batch`'s jsonb `.$type<>()` columns | exact (self-extension) |
| `src/lib/env.ts` (modify: `APOLLO_API_KEY` optional) | config | itself — `ARCPEDIA_*` optional-degrade block | exact (self-extension) |
| `.env.example` (modify: add `APOLLO_API_KEY=`) | config | itself | exact |
| `src/lib/enrichment/apolloMap.ts` (new: `apolloMapCompany`, `apolloMapPersona`, bucketers) | utility | `src/lib/import/rowMapper.ts` (snake→camel field mapping, pure) | role-match |
| `src/lib/enrichment/apolloMap.test.ts` (new) | test | `src/lib/import/rowMapper.test.ts` | exact |
| `src/lib/enrichment/mergePlan.ts` (new: `buildEnrichmentPlan`) | utility | `src/lib/import/dedupKeys.ts` `buildUpdatePatch` (blank-vs-populated decision) | role-match |
| `src/lib/enrichment/mergePlan.test.ts` (new) | test | `src/lib/import/dedupKeys.test.ts` | exact |
| `src/lib/enrichment/apollo.ts` (new: `enrichOrganization`, `enrichPerson`) | integration client | `src/lib/arcpedia.ts` (env-guard + timeout + Zod safeParse) — DIVERGE on failure/log policy | partial-match (new: discriminated result, metadata log) |
| `src/lib/db/queries/companies.ts` (modify: `applyCompanyEnrichment`) | model/query | itself — `upsertCompanyByDomain` (targeted UPDATE + returning) | role-match (no insert path) |
| `src/lib/db/queries/personas.ts` (modify: `applyPersonaEnrichment`) | model/query | itself — `upsertPersonaByEmail` | role-match |
| `src/app/actions/enrichment.ts` (new, `'use server'`: `runEnrichment`, `commitEnrichment`) | controller | `src/app/actions.ts` (`requireStaffAccess()`-first) + `src/app/actions/import.ts` | exact (auth), partial (vendor call) |
| `src/components/enrichment/enrichment-review-dialog.tsx` (new, `'use client'`) | component | `src/components/import/import-wizard.tsx` (client state + Server Action round-trip) + shadcn `dialog.tsx` | partial-match |
| `src/components/companies/company-detail.tsx` (modify: Enrich menu item) | component | itself (existing `ExplorerMenu` Analyze item) | exact (self-extension) |
| `src/components/personas/persona-detail.tsx` (modify: Enrich menu item) | component | itself | exact (self-extension) |

## Key pattern notes

- **Discriminated result (D-02):** `type EnrichmentResult = { ok: true; fields: EnrichedField[] } | { ok: false; reason: string }`. `enrichOrganization`/`enrichPerson` never throw; they return this. Callers (Server Action) branch on `.ok` and surface `reason` to the UI. This DIVERGES from `arcpedia.ts`'s `catch → []`.
- **Metadata-only logging (D-13):** `console.info({ event: 'enrichment', entityType, recordId, ok, status, credits })` — never the response body / PII.
- **Provenance merge (D-07):** on commit, `fieldSources = { ...existing, ...Object.fromEntries(acceptedFields.map(f => [f, 'apollo'])) }`.
- **Confidence (ENRC-05):** `EnrichedField.confidence?: number` stays `undefined` for Apollo (no score in enrich response) — column renders `—`.
- **No new npm deps** — Apollo via built-in `fetch`, Zod already present, shadcn `dialog` already installed (Phase 7).
