---
phase: 30
slug: shared-data-model-seed
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-04
---

# Phase 30 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 |
| **Config file** | `vitest.config.ts` (repo root) — `environment: 'node'`, includes `src/**/*.test.ts`, `@/*` alias resolved |
| **Quick run command** | `npx vitest run <path-to-file>.test.ts` |
| **Full suite command** | `npm test` (= `vitest run`) |
| **Estimated runtime** | ~30-60s full suite (per prior phase trend) |

Two test-file naming conventions in active use, both required:
- `*.test.ts` — unit tests, no live DB, always run in CI
- `*.integration.test.ts` — live-DB tests, gated behind `describe.skip` unless `process.env.TEST_DATABASE_URL` is set (exact pattern in `src/lib/db/queries/userModelSettings.integration.test.ts`)

---

## Sampling Rate

- **After every task commit:** `npx vitest run <touched-file>.test.ts` (unit-level, no live DB needed)
- **After every plan wave:** `npm test` (full suite) — integration tests skip without `TEST_DATABASE_URL`; also manually confirm `npm run db:push` + the GBS seed script succeed against the real dev DB
- **Before `/gsd-verify-work`:** Full suite green + a manual row-count verification against the live seeded data (11 offerings, ~24 company signals, ~9 persona signals, 8 links, etc.)
- **Max feedback latency:** ~60s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 30-01-0x | 01 | 0 | DATA-01 | — | N/A | integration | `npx vitest run src/lib/db/queries/practiceAreas.integration.test.ts` | ❌ W0 | ⬜ pending |
| 30-01-0x | 01 | 0 | DATA-01 | — | N/A | integration | `npx vitest run src/lib/db/queries/domains.integration.test.ts` | ❌ W0 | ⬜ pending |
| 30-01-0x | 01 | 0 | DATA-01 | — | N/A | integration | `npx vitest run src/lib/db/queries/offerings.integration.test.ts` | ❌ W0 | ⬜ pending |
| 30-01-0x | 01 | 0 | DATA-01 | — | N/A | integration | `npx vitest run src/lib/db/queries/buyerRoles.integration.test.ts` | ❌ W0 | ⬜ pending |
| 30-01-0x | 01 | 0 | DATA-02 | — | N/A | integration | `npx vitest run src/lib/db/queries/companySignals.integration.test.ts` | ❌ W0 | ⬜ pending |
| 30-01-0x | 01 | 0 | DATA-02 | — | N/A | integration | `npx vitest run src/lib/db/queries/personaSignals.integration.test.ts` | ❌ W0 | ⬜ pending |
| 30-0x-0x | TBD | TBD | DATA-03..08 | — | N/A | integration | `npx vitest run src/scripts/seedGbs.integration.test.ts` (or equivalent count-check) | ❌ W0 | ⬜ pending |
| 30-0x-0x | TBD | TBD | DATA-09 | T-30-01 | Every write records `created_by`/`updated_by`, never null | unit + integration | `npx vitest run src/lib/db/queries/offerings.test.ts` | ❌ W0 | ⬜ pending |
| 30-0x-0x | TBD | TBD | DATA-10 | T-30-02 | Delete blocked/confirmed when dependents exist, never silent cascade | integration | `npx vitest run src/lib/db/queries/buyerRoles.integration.test.ts` — asserts `deleteBuyerRole()` returns `{ok:false, reason:'has_dependents'}` when referenced, `{ok:true}` when not | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/db/queries/practiceAreas.integration.test.ts` — covers DATA-01, DATA-10 (practice_area leg)
- [ ] `src/lib/db/queries/domains.integration.test.ts` — covers DATA-01, DATA-10 (domain leg)
- [ ] `src/lib/db/queries/offerings.integration.test.ts` — covers DATA-01, DATA-10 (offering leg), active/all picker split
- [ ] `src/lib/db/queries/buyerRoles.integration.test.ts` — covers DATA-01, DATA-10 (buyer_role leg)
- [ ] `src/lib/db/queries/companySignals.integration.test.ts` — covers DATA-02
- [ ] `src/lib/db/queries/personaSignals.integration.test.ts` — covers DATA-02
- [ ] `src/scripts/seedGbs.integration.test.ts` (or equivalent count-check) — covers DATA-03..08
- [ ] No shared test-fixture/factory file exists yet for these tables — plan decides whether to add one; matching `userModelSettings.integration.test.ts`'s inline `randomUUID()`-per-test-row pattern requires no new fixture file

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| Live seed row counts against real Neon dev DB | DATA-03..08 | `TEST_DATABASE_URL` may be unset in CI/agent sandboxes; the phase gate requires confirming against the actual dev database, not just a test DB | Run `npm run db:push` then the seed script against `.env.local`'s real `DATABASE_URL`, then query row counts: 1 practice_area, 3 domains, 5 buyer_roles, 11 offerings, ~24 company_signals, ~9 persona_signals, 8 signal_offering_link rows |
| `trigger`/`domain` as live Postgres table/column names push cleanly | DATA-01 | Reserved-word safety was reasoned (MEDIUM confidence) in research but not live-verified — no DB credentials in the research sandbox | Run `npm run db:push` and confirm no syntax error or unexpected quoting requirement for the `trigger` and `domain` tables |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (7 test files above)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
