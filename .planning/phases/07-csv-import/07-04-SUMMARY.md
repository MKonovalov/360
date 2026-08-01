---
phase: 07-csv-import
plan: 04
status: complete
requirements-completed: ["IMPT-03", "IMPT-04"]
---

# Plan 04 Summary — Validation Layer (seed.ts + csvImport.ts)

**Completed:** 2026-07-31
**Plan:** Phase 7, Plan 04

## What Was Done

### 1. `src/lib/validation/seed.ts` — `domain` field added

Added `domain: optionalSafeCsvString` to `companyRowSchema` immediately after the `name` field, before `industry`. Reused the existing `optionalSafeCsvString` validator (blank-to-undefined transform + formula-injection guard) — no new validator needed. `validateRows` in `src/scripts/seed.ts` was not touched.

### 2. `src/lib/validation/csvImport.ts` — new file

Exports:
- `RowResult<T>` interface: `{ validRows: { row: number; data: T }[]; invalidRows: { row: number; errors: string[] }[] }`
- `partitionRows<T extends z.ZodTypeAny>(rows, schema): RowResult<z.infer<T>>`

Key properties:
- Uses `schema.safeParse` exclusively — never throws
- Row numbering: `index + 2` (header = row 1, first data row = row 2) — mirrors `seed.ts`'s `validateRows` exactly
- Error format: `${issue.path.join('.')}: ${issue.message}` — same as `validateRows`'s `reasons` format
- No `console.log`/`console.error`
- Named exports only, no default export

### 3. `src/lib/validation/csvImport.test.ts` — new file

5 tests covering:
1. Mixed valid/invalid split with correct row numbers (row 2 valid, row 3 invalid)
2. Never throws even when every row is invalid
3. Each `invalidRows` entry's `errors` array contains human-readable `"path: message"` strings
4. Fully-valid multi-row input → zero `invalidRows`
5. Mixed valid/invalid → correct row numbers for both valid and invalid entries

## Verification Results

| Check | Result |
|-------|--------|
| `npx vitest run src/lib/validation/csvImport.test.ts` | ✅ 5/5 passed |
| `npx tsc --noEmit` | ✅ clean |
| `grep -q "domain: optionalSafeCsvString" src/lib/validation/seed.ts` | ✅ passes |
| `! grep -q "throw new Error" src/lib/validation/csvImport.ts` | ✅ passes |

## TypeScript Fix Applied

Initial test file used object literals with optional properties (`{ name: 'Beta Ltd', domain: 'beta.com' }` alongside `{ name: 'Acme Corp' }`), which TypeScript inferred as a union type incompatible with `Record<string, string>[]`. Fixed by adding an explicit `Record<string, string>[]` type annotation on the array — the runtime behavior was always correct, only the type annotation needed tightening.

## Files Changed

| File | Action |
|------|--------|
| `src/lib/validation/seed.ts` | Modified — added `domain: optionalSafeCsvString` to `companyRowSchema` |
| `src/lib/validation/csvImport.ts` | Created — `RowResult<T>` + `partitionRows<T>` |
| `src/lib/validation/csvImport.test.ts` | Created — 5 behavior tests |
