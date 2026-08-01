# Plan 06 Summary: Server Actions + rowMapper

**Completed:** 2026-07-31
**Plan:** 07-06 — Implement `src/app/actions/import.ts` (6 Server Actions) + `src/lib/import/rowMapper.ts`

## What Was Built

### `src/lib/import/rowMapper.ts` (new)
Pure mapping functions — no DB, no `'use server'`. Two named exports:
- `mapCompanyRowToUpsertInput(row: CompanyRow): UpsertCompanyInput` — renames snake_case CSV fields to camelCase DB fields; splits `tech_stack` pipe-delimited string into `string[]`, returns `undefined` (never empty array) when `tech_stack` is absent.
- `mapPersonaRowToUpsertInput(row: PersonaRow): UpsertPersonaInput` — renames `linkedin_url` → `linkedinUrl`, passes other fields through.

### `src/lib/import/rowMapper.test.ts` (new)
12 tests, all passing. Covers:
- Full snake_case → camelCase rename for both entity types
- `tech_stack` pipe-split: `'React|Node|AWS'` → `['React', 'Node', 'AWS']`
- Whitespace trimming per segment
- Blank segment filtering (`'React||AWS'` → `['React', 'AWS']`)
- `undefined` tech_stack → `techStack: undefined` (never empty array, never original string)
- Single-entry tech_stack → one-element array
- All optional fields pass through as `undefined` when absent

### `src/app/actions/import.ts` (new, `'use server'`)
Six Server Actions, all gated by `requireStaffAccess()` first:

| Action | Purpose |
|--------|---------|
| `uploadImportFile(entityType, formData)` | Parse CSV, auto-suggest mappings, persist raw CSV in `import_batch`, return `batchId` + UI data |
| `downloadImportTemplate(entityType)` | Return pre-built CSV template from schema enums |
| `validateImportBatch(batchId, mapping, valueMapping)` | Apply mapping, Zod-validate rows, predict created/updated, persist to batch |
| `commitImportBatch(batchId)` | Upsert valid rows, insert `import_log` per row, tally actual counts |
| `previewRollback(batchId)` | Dry-run: count deletable vs. skipped rows |
| `executeRollback(batchId)` | Delete created rows, catch `23503` FK violations per-row as race-skipped |

## Key Decisions

- **`UNMAPPED_ENUM_SENTINEL = '__unmapped_enum_value__'`** — placed into mapped rows when an enum field's raw CSV value has no mapping entry (neither auto-suggested nor manually overridden). Zod's enum validator rejects it, surfacing the row in the error report with a clear message rather than silently passing a bad value.
- **`ENUM_FIELD_NAMES = new Set(['revenue_band', 'ownership_type', 'seniority'])`** — module-level constant used in both `uploadImportFile` (to decide which columns get `suggestValueMapping`) and `validateImportBatch` (to decide which columns need sentinel substitution).
- **`mappedValue != null` (not `!== undefined`)** — `suggestValueMapping` returns `null` for unrecognized values and `undefined` when the key is absent from `valueMapping` entirely. Both cases should trigger the sentinel; `!= null` catches both in one check.
- **`commitImportBatch` tallies actual counts from upsert results** — never reads `batch.predictedCreated`/`batch.predictedUpdated` for the return value (Pitfall 5: predicted counts are a best-effort estimate, actual counts come from what really happened).
- **`executeRollback` re-calls `findRollbackableRows`** — race-safe re-check; a dependent row could have been added between `previewRollback` and `executeRollback`. FK `23503` errors caught per-row and folded into `raceSkipped`.
- **`src/app/actions/` directory created** — the existing `src/app/actions.ts` is a flat file; the new import actions live in `src/app/actions/import.ts` as a sibling directory.

## TypeScript Gotcha

`CompanyRow`/`PersonaRow` (Zod inferred types) have optional fields typed as `field | undefined`, not as truly optional TypeScript properties. Object literals in tests must include all fields explicitly (even as `undefined`) or TypeScript reports missing required properties. Fixed by adding explicit `domain: undefined, industry: undefined, ...` to all partial test fixtures.

## Verification Results

```
npx vitest run src/lib/import/rowMapper.test.ts  → 12/12 passed
npx tsc --noEmit                                  → clean (no errors)
npm run build                                     → ✓ Compiled successfully
```

All 14 grep verification checks pass.
