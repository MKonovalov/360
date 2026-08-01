---
phase: 08
slug: enrichment-api
status: passed
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-31
---

# Phase 08 — Validation Strategy

Vitest harness already exists (Phase 7). No Wave 0 bootstrap needed.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.1.10` (installed Phase 7) |
| **Quick run** | `npx vitest run src/lib/enrichment` |
| **Full suite** | `npx vitest run` |
| **Type check** | `npx tsc --noEmit` |
| **Build** | `npm run build` |

## Sampling Rate
- After every task touching pure functions: `npx vitest run src/lib/enrichment` + `npx tsc --noEmit`.
- After every wave: full `npx vitest run` + `npm run build`.
- Before phase verify: full suite green, build green, + manual UAT (live Apollo key: enrich a real company by domain and a real persona by email, confirm review screen, commit, provenance markers, re-enrich no-ops).

## Per-Requirement Verification Map

| Requirement | Behavior | Test Type | Command |
|-------------|----------|-----------|---------|
| ENRC-01 | Apollo client returns discriminated result; org/people endpoints reached | unit (mapper) + manual (live call) | `vitest run src/lib/enrichment` + browser UAT |
| ENRC-02 | `buildEnrichmentPlan` marks empty-target fields `fill` (pre-accepted), populated-differing as `conflict` (opt-in) | unit | `vitest run src/lib/enrichment/mergePlan.test.ts` |
| ENRC-03 | `fieldSources` jsonb set to `apollo` only for committed accepted fields; rejected fields unchanged | unit (plan) + manual (DB round-trip) | `vitest run` + SQL check |
| ENRC-04 | Review dialog lists current-vs-incoming, per-field accept/reject; nothing writes until Commit | manual | browser UAT |
| ENRC-05 | Confidence column renders `—` when Apollo returns no score (documented no-score resolution) | tsc + manual | `tsc --noEmit` + browser UAT |

## Manual-Only Verifications
| Behavior | Why Manual | Instructions |
|----------|-----------|--------------|
| Live Apollo call (org + people) | Needs real key + network; response-shape confidence | Enrich a real company by domain and persona by email; confirm fields populate the review screen |
| Auto-fill-empty vs conflict UX | Visual/interactive | Enrich a record with some empty + some populated fields; confirm empty pre-checked, populated shown as unchecked conflict |
| Provenance + `lastEnrichedAt` live-vendor write | Requires live vendor result | After live Apollo commit, inspect row: accepted fields marked `apollo` in `field_sources`, `last_enriched_at` set; rejected fields still `manual` |
| Re-enrich idempotency / blank-key guard | DB + vendor state | Re-enrich same record → previously-filled fields no longer offered as empty; a record with blank domain/email shows Enrich disabled |

## Validation Sign-Off
- [x] All requirements have an automated or explicitly-manual verification
- [x] No new npm deps → no package-legitimacy gate
- [x] Harness pre-exists (Phase 7) → `nyquist_compliant: true`, `wave_0_complete: true`

## Review Remediation Evidence — 2026-07-31

### Automated boundaries

| Boundary | Evidence |
|----------|----------|
| Signed proposal integrity, expiry, Clerk-user binding, selected-field subset, runtime field-value parsing | `npx vitest run src/lib/enrichment/reviewProposal.test.ts` → 6 passed |
| Apollo malformed envelope/JSON and valid-person mapping | `npx vitest run src/lib/enrichment/apollo.test.ts` → 3 passed |
| Action input parsing, one Apollo call, no commit refetch, unproposed-field rejection, stale update result | `npx vitest run src/app/actions/enrichment.test.ts` → 4 passed |
| Visible Manual/Apollo field provenance primitive | `npx vitest run src/components/explorer/explorer-format.test.ts` → 2 passed |
| Versioned conditional write, proposal replay rejection, CSV manual reset, enriched-record rollback skip | Isolated Neon schema pushed; `src/lib/db/queries/enrichment.integration.test.ts` ran with `TEST_DATABASE_URL` and passed |
| Full regression suite | `npm test` with `TEST_DATABASE_URL` → 12 files, 139 passed, 0 failed |
| Type and production build | `npx tsc --noEmit --incremental false` → pass; `npm run build` → pass |
| Responsive remediation lint scope | targeted ESLint over the four responsive files → 0 errors, 0 warnings |
| Patch hygiene | `git diff --check` → pass |

### Live UAT evidence — 2026-07-31

- Company `apollo.io` review -> commit -> provenance -> re-enrich passed in isolated QA; see `08-06-UAT.md`.
- Blank company domain and blank persona email guards passed without opening the review.
- Persona live UAT passed via Prospeo (Apollo's `people_match` scope is unavailable on the configured key): persona id `11` (`brian@airbnb.com`) review -> commit -> provenance -> re-enrich idempotency, plus the `NO_MATCH` error branch on persona id `7` (`mark@sumware.com`). Full evidence in `08-06-UAT.md`.
- Full suite after the provider swap: 162 passed / 2 skipped; `tsc --noEmit` and `npm run build` clean.

### Database/schema evidence

- An isolated Neon schema was pushed and the database integration suite completed through `TEST_DATABASE_URL`; no production database was used.
- `APOLLO_API_KEY` and an independent 32+ character `ENRICHMENT_REVIEW_SECRET` remain unset. No secret values are printed in this evidence.
- The repository still has no reconciled migration baseline. Do not generate a speculative migration until deployed schema history is reconciled; this phase continues the existing `drizzle-kit push` workflow.

### Accepted/deferred risk

- D-04/D-05 remain deliberate: one explicit click makes one per-record Apollo call. Phase 8 does not add bulk loops, rate limiting, batch caps, retry queues, backoff, or circuit breakers. Those controls become mandatory if bulk enrichment is introduced.
- Commit uses the reviewed signed proposal and never performs a second paid Apollo call.

### Remaining human gates

- Live company (Apollo) and live persona (Prospeo) UAT both passed in isolated QA; see `08-06-UAT.md`.
- Authenticated production Playwright passed on `/companies` and `/personas` at 375, 768, and 1280 px. Document width equaled viewport width, each detail wrapper equaled its scrollport, and Menu/Close stayed visible at both horizontal scroll extremes.
- Company layout rendered 2/2/4 columns at 375/768/1280. The LinkedIn link and badge stayed in bounds on the same row. Menu, Escape, Close, ArrowDown, and Enter interactions passed with no console errors.
- Two independent visual reviews returned PASS.
- Full `npm run lint` still reports only two unrelated pre-existing errors: `src/components/layout/sidebar-resize-handle.tsx:33` and `src/hooks/use-mobile.ts:14`.
