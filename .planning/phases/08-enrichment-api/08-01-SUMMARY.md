# Plan 08-01 Summary — Schema + env foundation

## What was done
- `src/lib/db/schema.ts`: added `fieldSources jsonb ($type<Record<string,'manual'|'apollo'>>, default {})` and `lastEnrichedAt timestamp` (nullable) to both `company` and `persona` (D-07/D-08, ENRC-03). Existing rows need no backfill — default `{}` + absent-marker-means-manual.
- `src/lib/env.ts`: added `APOLLO_API_KEY: z.string().optional()` following the Arcpedia optional-degrade pattern (D-14). Server-only, unset never crashes the app.
- `.env.example`: documented `APOLLO_API_KEY` (server-only, disables Enrich when unset).
- `npx drizzle-kit push` applied the ALTER TABLE.

## Verification
- `npx tsc --noEmit` → clean
- `drizzle-kit push` → "Changes applied"
- DB introspection confirms `field_sources` + `last_enriched_at` present on both `company` and `persona`.

## Files changed
- `src/lib/db/schema.ts` (edited)
- `src/lib/env.ts` (edited)
- `.env.example` (edited)
