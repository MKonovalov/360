# Phase 7 Plan 02 — Summary

**Completed:** 2026-07-31
**Plan:** Bootstrap Vitest test harness, fix csv-parse dependency tier, add csv-stringify, raise Server Action body limit, implement `dedupKeys.ts` with tests.

## What Was Done

### 1. `package.json` — dependency tier fixes + new packages
- Moved `"csv-parse": "^7.0.1"` from `devDependencies` → `dependencies` (required for production Server Action use — it runs at runtime, not just in local scripts)
- Added `"csv-stringify": "^6.8.1"` to `dependencies` (sibling package from the same `node-csv` project; needed for CSV template generation in IMPT-06)
- Added `"vitest": "^4.1.10"` to `devDependencies`
- Added `"test": "vitest run"` to `scripts`
- Ran `npm install` — 38 packages added, 2 changed

### 2. `vitest.config.ts` — created (first test-infra file in repo)
- `environment: 'node'` — no jsdom, no React/browser plugins
- `include: ['src/**/*.test.ts']` — co-located test files alongside source

### 3. `next.config.ts` — raised Server Action body limit
- Added `experimental.serverActions.bodySizeLimit: '5mb'` as a top-level key
- Preserved the existing VERCEL conditional-spread block for turbopack root config exactly unchanged
- Note: this is a global config change (affects all Server Actions, not just Import) — documented per RESEARCH.md Pitfall 3

### 4. `src/lib/import/dedupKeys.ts` — created (pure utility, no analog in codebase)
Three named exports:
- `normalizeDomain(raw: string): string` — trim, lowercase, strip `http(s)://`, strip `www.`, strip trailing slash (implements D-02)
- `normalizeEmail(raw: string): string` — trim and lowercase only (implements D-04)
- `buildUpdatePatch<T>(row: T): Partial<T>` — returns only entries where value is neither `undefined` nor `''` (implements D-10's blank-cell-untouched merge semantics as a pure, testable function)

### 5. `src/lib/import/dedupKeys.test.ts` — created (first test file in repo)
16 tests across 3 `describe` blocks, all passing:
- `normalizeDomain`: 6 cases (protocol+www+slash, no-op, https, www-only, whitespace, uppercase)
- `normalizeEmail`: 4 cases (full normalization, no-op, leading whitespace, uppercase)
- `buildUpdatePatch`: 6 cases (mixed blank/non-blank, empty input, all non-blank, empty string drop, undefined drop, falsy-but-non-blank value `0` kept)

## Verification Results

```
npx vitest run src/lib/import/dedupKeys.test.ts
→ Test Files  1 passed (1)
→ Tests       16 passed (16)

npx tsc --noEmit
→ (no output — clean)
```

All grep checks pass:
- `"csv-stringify"` present in `package.json` ✓
- `"vitest"` present in `package.json` ✓
- `bodySizeLimit: '5mb'` present in `next.config.ts` ✓
- `environment: 'node'` present in `vitest.config.ts` ✓

## Key Decisions

- `buildUpdatePatch` extracted as its own named export (not inlined in the query-layer upsert) so D-10's blank-cell-untouched logic is unit-testable without a DB round-trip — per PATTERNS.md's explicit instruction.
- Test convention established: co-located `*.test.ts`, plain Vitest `describe`/`it`/`expect`, no mocking library, pure functions only (no DB or React code in tests).
- Vitest config uses `import` syntax (ESM) — produces a harmless `configLoader: 'native'` warning about CommonJS detection; suppressed with `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` if needed, but does not affect test execution.

## Files Created/Modified

| File | Action |
|------|--------|
| `package.json` | Modified — csv-parse tier, csv-stringify, vitest, test script |
| `vitest.config.ts` | Created |
| `next.config.ts` | Modified — added experimental.serverActions.bodySizeLimit |
| `src/lib/import/dedupKeys.ts` | Created |
| `src/lib/import/dedupKeys.test.ts` | Created |

## Unblocks

Wave 2 plans (03 columnMapping/csvTemplate, 04 validation, 05 queries) are now unblocked — they depend on both Plan 01 (schema, already complete) and Plan 02 (this plan).
