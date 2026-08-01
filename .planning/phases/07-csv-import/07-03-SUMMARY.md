---
phase: 07-csv-import
plan: 03
status: complete
requirements-completed: ["IMPT-02", "IMPT-06"]
---

# Phase 7 Plan 03 — Column Mapping & CSV Template

**Completed:** 2026-07-31
**Plan:** Implement `src/lib/import/columnMapping.ts` and `src/lib/import/csvTemplate.ts` with tests

## What Was Built

### `src/lib/import/columnMapping.ts`
- `COMPANY_FIELD_ALIASES`: Record<string, string[]> — maps 8 schema field names to arrays of CSV header aliases (name, domain, industry, employee_count_band, hq_location, revenue_band, ownership_type, tech_stack)
- `PERSONA_FIELD_ALIASES`: Record<string, string[]> — maps 5 schema field names to aliases (name, title, seniority, email, linkedin_url)
- `REVENUE_BAND_ALIASES`: Record<string, string> — 19 alias entries covering common phrasings of revenue bands
- `OWNERSHIP_TYPE_ALIASES`: Record<string, string> — 14 alias entries covering private/public/pe_backed/family_owned/subsidiary phrasings
- `SENIORITY_ALIASES`: Record<string, string> — 20 alias entries covering IC through C-level phrasings
- `normalizeHeader(raw: string): string` — trim, lowercase, collapse underscores/hyphens to single space, collapse repeated whitespace
- `suggestColumnMapping(headers, aliases)` — exact alias match only after normalization, null for unmatched
- `suggestValueMapping(rawValues, aliases)` — normalize (trim+lowercase) and look up alias dict, null if unmatched

### `src/lib/import/columnMapping.test.ts`
- 46 tests covering: normalizeHeader equivalence (underscore/hyphen/space all resolve identically), suggestColumnMapping with COMPANY_FIELD_ALIASES and PERSONA_FIELD_ALIASES, suggestValueMapping with all three enum alias dicts, edge cases (empty arrays, typos → null, whitespace trimming)

### `src/lib/import/csvTemplate.ts`
- `generateCompanyTemplate()` — header: name,domain,industry,employee_count_band,hq_location,revenue_band,ownership_type,tech_stack (exact order), one example row with `revenueBandEnum.enumValues[0]` and `ownershipTypeEnum.enumValues[0]`
- `generatePersonaTemplate()` — header: name,title,seniority,email,linkedin_url, one example row with `seniorityEnum.enumValues[0]`
- `enumHelpText()` — returns `{ revenue_band, ownership_type, seniority }` each listing all enum values joined with ', '
- Enum values read directly from `schema.ts` — never hardcoded

### `src/lib/import/csvTemplate.test.ts`
- 25 tests covering: header order, example row enum values match schema, enumHelpText contains every value from each enum, all 5 values per enum verified

## Key Decisions

- **No fuzzy matching** — exact alias match only after `normalizeHeader`, consistent with D-08 (manual override is the safety net) and the project's anti-fuzzy-dedup stance
- **`normalizeHeader` exported** — makes it testable and reusable by the Server Action layer when normalizing incoming CSV headers before alias lookup
- **`@/` path alias added to `vitest.config.ts`** — `csvTemplate.ts` imports from `@/lib/db/schema`; vitest's default config doesn't resolve Next.js path aliases. Added `resolve.alias: { '@': path.resolve(__dirname, './src') }` to `vitest.config.ts`. This is a one-time fix that unblocks all future test files that import from `@/lib/db/schema` or other `@/` paths.
- **`parseRows` helper in test** — `csv-parse` with `columns: true` returns `unknown[]` in strict TypeScript. Added a typed helper `parseRows(csv): Record<string, string>[]` with a cast to avoid `as` casts scattered across every test assertion.

## Verification

```
npx vitest run src/lib/import/columnMapping.test.ts  → 46/46 passed
npx vitest run src/lib/import/csvTemplate.test.ts    → 25/25 passed
npx tsc --noEmit                                      → clean (no errors)
```

## Files Created/Modified

| File | Action |
|------|--------|
| `src/lib/import/columnMapping.ts` | Created |
| `src/lib/import/columnMapping.test.ts` | Created |
| `src/lib/import/csvTemplate.ts` | Created |
| `src/lib/import/csvTemplate.test.ts` | Created |
| `vitest.config.ts` | Modified — added `resolve.alias` for `@/` path |
