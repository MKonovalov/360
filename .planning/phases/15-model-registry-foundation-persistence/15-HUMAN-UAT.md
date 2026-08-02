---
status: resolved
phase: 15-model-registry-foundation-persistence
source: [15-VERIFICATION.md]
started: 2026-08-02T11:30:00Z
updated: 2026-08-02T11:33:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Integration test against a writable test database
expected: 4/4 integration cases pass against a real Postgres (TEST_DATABASE_URL set): create-with-full-chain (REG-01/02), full-value overwrite with a different chain (REG-03), Promise.all concurrent upserts never half-merge (atomicity, Pitfall 9), absence → undefined (REG-05). Concurrent upserts leave exactly one complete chain, never a mix.
result: passed — 4/4 green via `set -a; source .env.local; set +a; npx vitest run src/lib/db/queries/userModelSettings.integration.test.ts` (2026-08-02, TEST_DATABASE_URL = Neon test branch)

### 2. Regenerate the model catalog snapshot
expected: `npm run models:fetch` exits 0 with local opencode CLI present; rewrites src/lib/models/catalog.json with a fresh generatedAt and a non-empty models array; git diff shows only generatedAt drift (no field-shape change); claude-sonnet-4-6/anthropic anchor retained.
result: passed — exit 0, 1131 models, generatedAt 2026-08-02T09:33:54.568Z; git diff = 1 line (generatedAt only); anchor retained (2026-08-02)

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
