# Phase 28 (reconciled 30-shared-data-model-seed) — Security Audit

**Audit:** Final Wave F3 (approval gate)
**Date:** 2026-08-05
**ASVS Level:** 1 (per `.planning/config.json` — `security_asvs_level: 1`, `security_block_on: "high"`)
**Scope:** Schema (`src/lib/db/schema.ts`), all 7 query modules (`src/lib/db/queries/`), seed script (`src/scripts/seedGbs.ts`), seed integration test, live Neon data paths.
**Verdict:** **APPROVE** — 0 current exploitable blockers; all 10 declared threats CLOSED (5 mitigated + 5 documented accepted); 3 future-hardening warnings carried forward; 1 info item.

---

## 1. Threat Verification

Source: `<threat_model>` blocks in 30-01..30-06-PLAN.md. Verification by disposition (mitigate = grep + live check; accept = accepted-risks log below).

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-30-01 | Tampering / Information Disclosure | mitigate | **CLOSED** | `src/lib/db/queries/signalOfferingLinks.ts:32-51` — discriminator branch reads signal `practiceAreaId` from `companySignal`/`personaSignal`, reads offering `practiceAreaId`, rejects `{ ok:false, reason:'practice_area_mismatch' }` before any write when missing or mismatched. Single enforcement point: seed routes all 10 links through it (`seedGbs.ts:442-467`, throws on mismatch). Live: 0 practice-area mismatches, 0 dangling `signal_id` across 10 links. |
| T-30-02 | Tampering / Repudiation | mitigate | **CLOSED** | `hasPracticeAreaDependents` (4 tables, practiceAreas.ts:68-93), `hasDomainDependents` (1, domains.ts:57-64), `hasBuyerRoleDependents` (2, buyerRoles.ts:51-64), `hasOfferingDependents` (3, offerings.ts:139-158). All four deletes return `{ ok:false, reason:'has_dependents' }` and never issue the DELETE. Backstop: all 11 live FKs on the new tables are `NO ACTION` (information_schema), no `onDelete` anywhere in schema.ts. |
| T-30-03 | Repudiation | mitigate (schema) / accept (query layer) | **CLOSED** | All 9 tables: `created_by`/`updated_by`/`created_at`/`updated_at` `NOT NULL` (schema.ts:328-331, 341-344, 359-362, 372-375, 387-390, 405-408, 421-424, 437-440, 457-460). Live: 4/4 NOT NULL per table, 0 NULL audit values across all 9 tables. Insert helpers require `createdBy` and set `updatedBy = createdBy`; all 6 update helpers force-stamp `updatedAt`/`updatedBy` (Pitfall 3). |
| T-30-04 | Tampering | mitigate (process) | **CLOSED** | Schema diff across the phase is purely additive (0 deleted lines in `src/lib/db/schema.ts`); no existing table/enum altered, no destructive DDL possible. `drizzle-kit push` ran non-interactively with no destructive prompt (30-01 learnings + 30-01-SUMMARY); second push reports no further plan-owned changes. `drizzle.config.ts` targets `DATABASE_URL` only, no hardcoded creds. |
| T-30-05 | Tampering | mitigate | **CLOSED** | `signal_offering_link.signal_type` uses `recordTypeEnum('signal_type')` → PG type `record_type` (schema.ts:453), NOT a new `signal_type` enum. Exactly 1 `pgEnum('signal_type', ...)` declaration (pre-existing D-07 buying-signal enum, schema.ts:6). Live: `udt_name = record_type`; `pg_type` contains exactly 1 `signal_type` type. |
| T-30-06 | Information Disclosure | accept | **CLOSED** (documented) | Accepted-risks log §2.1. |
| T-30-07 | Tampering | accept | **CLOSED** (documented) | Accepted-risks log §2.2. |
| T-30-08 | Tampering | accept | **CLOSED** (documented) | Accepted-risks log §2.3. |
| T-30-09 | Repudiation | accept | **CLOSED** (documented) | Accepted-risks log §2.4. Live: `practice_area.created_by = 'seed-script'` sentinel confirmed. |
| T-30-09b | Tampering | accept | **CLOSED** (documented) | Accepted-risks log §2.5. Delete-then-insert scoped to the 9 Phase 30 tables only (`seedGbs.ts:312-320`), never `company`/`persona`/`signal` or any other pre-existing entity. |

**Closed: 10/10**

---

## 2. Accepted Risks Log

Entries below document the `accept`-disposition threats plus carried-forward warnings from the F2 code review. Entries marked *future hardening* are **not exploitable in the current shipped scope** (this phase ships no UI, no Server Actions, no public write surface).

### 2.1 T-30-06 — `listAll` vs `listActive` picker distinction
Both queries are internal staff-only reads; no public endpoint exists yet. The all-vs-active split exists to prevent a *future* picker misuse (SIG-09), not to gate current access. Accepted per plan.

### 2.2 T-30-07 — free-text `category` on `company_signal`/`persona_signal`
Spec-mandated non-enum. No public write surface exists yet (no Server Actions); Drizzle parameterizes all values, so this is a data-hygiene concern (spelling drift), not injection. Phase 31/32 Server Actions must add zod validation at the action boundary per 30-RESEARCH.md V5 (rejectInputSchema precedent in `src/app/actions/reviews.ts`).

### 2.3 T-30-08 — race window in `insertSignalOfferingLink`
Two reads (signal PA, offering PA) then one write with no `db.transaction()` — neon-http has none (matches `importBatches.ts` precedent). Negligible for a 3-partner internal tool with no concurrent write load; a raced mismatched link is a data-quality issue correctable via `deleteSignalOfferingLink`, not a security breach. Accepted per plan.

### 2.4 T-30-09 — `SEEDED_BY = 'seed-script'` sentinel
No Clerk session exists in a CLI context; sentinel is a plain string with no FK, correctable via bulk UPDATE. Accepted per plan; live-confirmed as the only `created_by` value in Phase 30 tables.

### 2.5 T-30-09b — idempotent delete-then-insert against live Neon
Intended, documented dev-tool workflow (matches `seed.ts` precedent); delete step targets only the 9 Phase 30 tables. Accepted per plan.

### 2.6 [future hardening, F2-warning 1] Seed deletes ALL rows in the 9 tables, not just its own
`seedGbs.ts:312-320` deletes every row in the 9 Phase 30 tables before insert. Safe today (tables contain only seed data — verified live: `created_by` is uniformly `'seed-script'`; no UI writes exist yet). **Risk:** a future Phase 31/32 admin UI re-running `npm run seed:gbs` would silently destroy user-created rows. **Remediation:** scope deletes to `created_by = 'seed-script'` (or the GBS practice_area id) before any UI write path ships.

### 2.7 [future hardening, F2-warning 2] No unique index on `signal_offering_link`
`offering_buyer_role` has `uniqueIndex('offering_buyer_role_unique_idx')` (schema.ts:394) but `signal_offering_link` has none, and `insertSignalOfferingLink` performs no existing-link check. Double-call from future Server Actions creates duplicate rows. **Current state:** 0 duplicate link groups live (probe §8). **Remediation:** `uniqueIndex` on `(signal_type, signal_id, offering_id)` or pre-insert existence query, before the Phase 31/32 link UI ships.

### 2.8 [future hardening, F2-warning 3] Gated integration-suite parallelism
`seedGbs.integration.test.ts` beforeAll unconditionally deletes all rows in the 9 tables; with `TEST_DATABASE_URL` set, vitest `fileParallelism=true` runs all 9 gated integration files concurrently → the seed test wipes other files' in-flight fixtures. Not exercised by the 482/38 run (gate unset). **Remediation:** scope seed deletes to own rows, or run gated suite with `--no-file-parallelism` / per-file DBs.

### 2.9 [info] `update*` signatures accept `Partial<$inferInsert>` including audit columns
All 6 update helpers (`updatePracticeArea`, `updateDomain`, `updateBuyerRole`, `updateOffering`, `updateCompanySignal`, `updatePersonaSignal`) take `patch: Partial<typeof X.$inferInsert>`, so a caller-supplied `createdBy`/`createdAt` in the patch would be written (only `updatedAt`/`updatedBy` are force-stamped). **Current state:** unreachable — no caller exists outside unit tests; the query layer is auth-free by design and only the seed script (which never calls update) exercises it. **Remediation:** type-level `Omit<..., 'id'|'createdAt'|'createdBy'|'updatedAt'|'updatedBy'>` at the future Server Action boundary, plus zod input validation (2.2).

### 2.10 [resolved] Hardcoded seed log count
F2 flagged a hardcoded "Deleted 115 rows" log; current `seedGbs.ts:469-471` logs computed insert counts only ("Inserted: 1 practice area, 3 domains, …") — no hardcoded deletion count remains. No action needed.

---

## 3. Audit Scope Verification (must-do items)

| Check | Result | Evidence |
|-------|--------|----------|
| Auth boundary: query modules auth-free because future Server Actions own staff gating | ✓ | `requireStaffAccess` referenced 0 times in `src/lib/db/queries/` and `src/scripts/` (grep). Trust boundary declared in 30-02-PLAN `<threat_model>`. Auth gate exists at `src/lib/auth/requireStaffAccess.ts`, used by Server Actions (`src/app/actions/*`), untouched by this phase. |
| All new writes carry createdBy/updatedBy | ✓ | Schema NOT NULL (live 4/4 per table, 0 NULLs); insert helpers require `createdBy`; update helpers force-stamp `updatedBy`+`updatedAt`. |
| Destructive deletes guarded for the 4 DATA-10 entities | ✓ | practice_area (4 dependents), domain (1), buyer_role (2), offering (3) — discriminated-union rejections; live FKs all NO ACTION. `signal_offering_link` delete is deliberately unconditional (join table, nothing references it). |
| signalOfferingLinks rejects missing/mismatched practice areas before writes | ✓ | `signalOfferingLinks.ts:49` rejects missing signal, missing offering, or PA mismatch before any insert; unit tests assert `db.insert` never called on rejection (signalOfferingLinks.test.ts:87,130,148); live 0 mismatches. |
| signal_id polymorphism handled safely by discriminator | ✓ | `signalType` branch selects PA from the correct table (signalOfferingLinks.ts:32-41); `listLinksForSignal` ANDs discriminator + id (line 76-81); live 0 dangling signal_id (all 10 links resolve to real company_signal/persona_signal rows). |
| No `NEXT_PUBLIC_*` secret leakage | ✓ | Phase adds zero env vars. `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` appears only as `pk_test_placeholder` test/seed literals (public-by-design key; placeholder values, never real). |
| No credentials committed | ✓ | `git grep` for live/secret key patterns in tracked files: only `.env.example` placeholders (`pk_test_xxxxxxxx`) and `*_placeholder` test literals. `.gitignore` excludes `.env`, `.env.*` (allows `.env.example`); no .env file in the phase diff or untracked. `DATABASE_URL`/Clerk keys live only in gitignored `.env.local`. |
| No unsafe dynamic SQL | ✓ | All new query code uses Drizzle query builder (parameterized). Only `sql\`1\`` literal probes and `sql`coalesce(...)`` in pre-existing `companies.ts` (untouched). No `sql.raw`, no string-interpolated user input. |
| No schema enum collision | ✓ | `signal_type` column → PG type `record_type`; exactly 1 `pg_type` named `signal_type` (pre-existing); schema diff purely additive. |
| Seed trust boundary (CLI, sentinel-attributed) | ✓ | `seedGbs.ts` — `SEEDED_BY='seed-script'`, all inserts via query layer (guards active), throws on link mismatch, VITEST-guarded auto-run, `process.exit` code convention. Placeholder Clerk keys `??=` after dotenv, never read. |
| No client exposure | ✓ | Phase touches no client components, no routes, no Server Actions (25-file diff: 24 new files + package.json `seed:gbs` script). Pre-existing client components import only enum constants from schema (type-level strings). |
| Typecheck / tests | ✓ | `npx tsc --noEmit` exit 0 (authoritative — LSP unavailable). Full suite: 482 passed / 38 skipped (TEST_DATABASE_URL-gated; not treated as live proof — live Neon checks substituted and passed: counts 1/3/5/11/22/11/27/12/10, audit NULLs 0, mismatches 0, dangling 0, dup links 0). |

---

## 4. Findings

### Blockers
None. No current exploitable security issue in the shipped scope (schema + query layer + CLI seed; no web-facing write surface exists).

### Warnings (future hardening — documented in §2.6–2.8)
1. Seed deletes all rows in the 9 tables (scope to `created_by='seed-script'` before UI writes ship).
2. Missing unique index on `signal_offering_link` (0 dupes live today; add index before Phase 31/32 link UI).
3. Gated integration-suite parallelism hazard (seed wipes sibling fixtures; scope deletes or disable file parallelism).

### Info
- `update*` `Partial<$inferInsert>` includes audit columns — narrow the type at the Server Action boundary (§2.9).

---

## 5. Verification Commands Run

- `npx tsc --noEmit` → exit 0
- `npx vitest run` → 38 files, 482 passed, 38 skipped (gated), 0 failed
- Read-only live-Neon probe (gitignored, removed after run): audit-column NOT NULL 4/4 × 9 tables; FK delete rules all NO ACTION; `signal_type` udt = `record_type`; `pg_type` count = 1; row counts 1/3/5/11/22/11/27/12/10; 0 dangling signal_id; 0 practice-area mismatches; 0 audit NULLs; 0 duplicate link groups; `created_by='seed-script'`
- Greps: `requireStaffAccess` (0 in query layer), `pgEnum('signal_type'` (1), `onDelete` (0), `sql.raw` (0 in phase code), secret patterns (placeholders only), client-boundary imports (none from phase)
- `git diff f5125407..HEAD` — 25 files, purely additive; schema.ts 0 deleted lines

---

*Audit: Final Wave F3 — 2026-08-05*
*Verdict: APPROVE*
