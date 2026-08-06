---
phase: 28-shared-data-model-seed
verified: 2026-08-05T00:20:43Z
status: human_needed
score: 19/19 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Spot-check the Claude-authored offering description + commercial_model_text copy for several offerings (e.g. GBS Maturity & Readiness Assessment, Managed Procurement, Interim Management) against the team's actual service catalogue"
    expected: "Copy reads as a faithful 1-2 sentence summary of each offering's stated entry trigger and buyer intent; no invented claims or numeric pricing figures"
    why_human: "The catalogue .docx is not in the repo; fidelity to the business source can only be judged by someone who knows the catalogue. Treatment was pre-approved in CONTEXT.md ('write a reasonable one-line mechanism description per offering consistent with its offer_type rather than leaving it null'), and flagged plan-mandated for human review in 30-06-SUMMARY.md:89."
  - test: "Review whether signal description = name verbatim (all 27 company + 12 persona signals) is acceptable, or whether distinct descriptions should be authored"
    expected: "Acceptable for v1.4 schema (spec Section 7.4/7.5 supplies exactly ONE string per signal; schema requires NOT NULL name AND description) or a decision to enrich descriptions in a later phase"
    why_human: "Writing distinct descriptions is business-content authorship requiring source material; programmatic verification can only confirm the redundancy exists (it does, deliberately)"
---

# Phase 28: Shared Data Model + GBS Seed Verification Report

**Phase Goal:** Every Offerings and Signals table exists with the correct shape (audit columns, status enums, join tables); the GBS practice area is fully seeded end-to-end (domains, offerings, triggers, ranked buyer roles, company signals, persona signals, and representative signal-offering links); the delete-guard business rule blocks destructive deletes at the query layer; all writes reuse the existing staff-auth gate with created_by/updated_by recorded. This phase ships no UI.

**Verified:** 2026-08-05T00:20:43Z
**Status:** human_needed (all automated truths VERIFIED; two plan-mandated content-review items await human judgment — pre-approved treatment, no corrective requirements)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All 9 tables (practice_area, domain, offering, buyer_role, offering_buyer_role, trigger, company_signal, persona_signal, signal_offering_link) exist in live Neon with exact spec shapes, audit columns, status enums, and NO ACTION FKs | ✓ VERIFIED | information_schema: 9/9 tables; column shapes match `src/lib/db/schema.ts`; enums `catalog_status`/`practice_area_status`/`offer_type` live; all FKs NO ACTION (no silent cascade) |
| 2 | signal_offering_link polymorphic discriminator reuses the existing record_type PG enum | ✓ VERIFIED | `udt_name = record_type` for signal_type column; no new enum created (plan 30-01 must-have) |
| 3 | Second db:push reports no further changes for plan-owned objects (idempotent) | ✓ VERIFIED | 30-01-SUMMARY documents idempotent push; sole pending statement is pre-existing unrelated `user_model_settings.fallback_models` drift (Phase 15, NOT this phase); live schema comparison confirms sync |
| 4 | practice_area/domain/buyer_role CRUD functions take userId/createdBy/updatedBy as plain params; never call requireStaffAccess | ✓ VERIFIED | Source-read: query modules are pure DB access; `requireStaffAccess` referenced 0 times; auth gate per plan lives at Server Action boundary (30-02 must-have) |
| 5 | Deleting a record with dependents is rejected via discriminated union `{ok:false, reason:'has_dependents'}` (practice_area: 4 dependents; domain: 1; buyer_role: 2) | ✓ VERIFIED | Source-read union returns; unit tests assert `{ok:false, reason:'has_dependents'}` (5 assertion sites across 4 test files); live FK backstop blocks raw deletes |
| 6 | Every insert/update populates created_by/updated_by/updated_at (Pitfall 3) | ✓ VERIFIED | Source-read: createX passes all audit params; updateX stamps updatedAt/updatedBy explicitly; live counts: 100% populated on all 9 tables (no "MISSING" rows); created_by = 'seed-script' sentinel |
| 7 | Offering CRUD plus offering_buyer_role/trigger helper functions | ✓ VERIFIED | `src/lib/db/queries/offerings.ts` (CRUD + listOfferingBuyerRolesByOffering + listTriggersByOffering + listActiveOfferingsForPracticeArea) |
| 8 | Active-only picker query separate from all-offerings admin query | ✓ VERIFIED | `listActiveOfferingsForPracticeArea` (status='active') vs `listAllOfferings`; distinct functions |
| 9 | Deleting an offering with dependents (offering_buyer_role, trigger, signal_offering_link — 3 tables) is rejected | ✓ VERIFIED | offerings.ts delete guard checks 3 dependents; unit test asserts rejection; FK backstop NO ACTION live |
| 10 | company_signal and persona_signal CRUD modules, distinct from existing signals.ts | ✓ VERIFIED | `companySignals.ts` + `personaSignals.ts` exist; `src/lib/db/queries/signals.ts` untouched; 8 test files |
| 11 | Every persona_signal references a real buyer_role_id | ✓ VERIFIED | Type-level buyerRoleId required; live: 12/12 persona_signals have non-null buyer_role_id, 0 dangling |
| 12 | Signal category is free text with a distinct-values query | ✓ VERIFIED | category: text column; `listCompanySignalCategories` distinct query; live 8/8 GBS categories |
| 13 | Cross-practice-area rule enforced in insertSignalOfferingLink, single enforcement point | ✓ VERIFIED | `{ok:true,id} | {ok:false,reason:'practice_area_mismatch'}`; unit tests reject mismatched PA (3 assertion sites); all 10 live links pass (0 mismatches) |
| 14 | Seed produces exactly 1 practice area, 3 domains, 5 buyer roles, 11 offerings, 22 offering_buyer_role rows, 11 triggers | ✓ VERIFIED | Live run: "Inserted: 1 practice area, 3 domains, 5 buyer roles, 11 offerings, 11 triggers, 22 offering-buyer-role links..." — counts 1/3/5/11/22/11 |
| 15 | 27 company signals across 8 categories; 12 persona signals with real roles | ✓ VERIFIED | Live: company_signal=27 (8 categories), persona_signal=12 (CFO 4 / Head of GBS 5 / Transformation Sponsor 3), all buyer_role_id real |
| 16 | Exactly 10 signal_offering_link rows, all passing the practice-area guard | ✓ VERIFIED | Live: 10 rows; 0 practice-area mismatches; links match spec Section 7.6 (8 table entries + 2 double-linked) |
| 17 | Re-running the seed is idempotent (no duplicates) | ✓ VERIFIED | Ran `npm run seed:gbs` a 3rd time live: exit 0, exact same insert message, post-run counts identical |
| 18 | Artifacts: seedGbs.ts ≥150 lines substantive, package.json seed:gbs script | ✓ VERIFIED | `src/scripts/seedGbs.ts` = 484 lines, exported `seedGbs()` (Task-3 sanctioned refactor), VITEST-guarded auto-run; `"seed:gbs": "tsx src/scripts/seedGbs.ts"` |
| 19 | All CRUD writes reuse staff-auth path with created_by/updated_by; no new role/approval system | ✓ VERIFIED | Query layer auth-free by design (plan-documented); `requireStaffAccess` gate (`src/lib/auth/requireStaffAccess`) at Server Action boundary per plan; created_by/updated_by 100% populated live |

**Score:** 19/19 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `src/lib/db/schema.ts` | 9 new tables + enums, existing record_type reused | ✓ VERIFIED | 22.6KB; catalogStatusEnum, practiceAreaStatusEnum, offerTypeEnum (7 values); record_type reused as signal_type discriminator |
| `src/lib/db/queries/practiceAreas.ts` | CRUD + delete guard (4 dependents) | ✓ VERIFIED | 461-line schema; guards return discriminated union; no auth calls |
| `src/lib/db/queries/domains.ts` | CRUD + delete guard (1 dependent) | ✓ VERIFIED | Guard asserted in unit tests |
| `src/lib/db/queries/buyerRoles.ts` | CRUD + delete guard (2 dependents) | ✓ VERIFIED | Guard asserted in unit tests |
| `src/lib/db/queries/offerings.ts` | CRUD + buyer_role/trigger helpers + 3-table delete guard | ✓ VERIFIED | Guard asserted in unit tests; active/all picker split |
| `src/lib/db/queries/companySignals.ts` | CRUD + category distinct query | ✓ VERIFIED | Distinct from signals.ts |
| `src/lib/db/queries/personaSignals.ts` | CRUD, buyerRoleId required | ✓ VERIFIED | Type + live 12/12 real |
| `src/lib/db/queries/signalOfferingLinks.ts` | CRUD + practice-area guard (single enforcement point) | ✓ VERIFIED | `practice_area_mismatch` union; 3 rejection tests |
| `src/scripts/seedGbs.ts` | ≥150-line seed; 6 typed data literals; query-module inserts; idempotent | ✓ VERIFIED | 484 lines; SEEDED_BY='seed-script'; all inserts via query modules (no raw db.insert); idempotency proven live |
| `src/scripts/seedGbs.integration.test.ts` | Gated exact-count + idempotency test | ✓ VERIFIED | Gated on TEST_DATABASE_URL; calls exported seedGbs() directly; asserts 1/3/5/11/22/11/27/12/10 + re-run |
| `package.json` | `seed:gbs` script | ✓ VERIFIED | `"seed:gbs": "tsx src/scripts/seedGbs.ts"` |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `signalOfferingLinks.ts` | practice-area rule | `insertSignalOfferingLink` compares signal.practiceAreaId vs offering.practiceAreaId | ✓ WIRED | Single enforcement point; unit tests reject mismatch; 10/10 live links pass |
| Query modules | DB | `src/lib/db/index.ts` drizzle instance | ✓ WIRED | All imports from ../index; no direct client duplication |
| Query modules | auth boundary | plan-documented Server Action gate via requireStaffAccess | ✓ WIRED (by design) | Query layer pure DB; gate at action layer per plan; requireStaffAccess exists and is used by personas routes |
| `seedGbs.ts` | query modules | `await insert...` calls in seedGbs | ✓ WIRED | Seed routes through query modules — verified by source read; no db.insert bypass |
| Unit tests | guards | mock db with from/where/returning | ✓ WIRED | 482 passed; guard rejections asserted in practiceAreas/domains/buyerRoles/offerings/signalOfferingLinks tests |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| Live DB tables | seed data | `seedGbs.ts` via query modules | ✓ FLOWING | Live counts exact: 1/3/5/11/22/11/27/12/10 |
| offering.commercial_model_text | 11/11 offerings | seedGbs typed literals | ✓ FLOWING | All populated (never null); mechanism language (no pricing figures) |
| offering_buyer_role.rank | 22 rows | seedGbs literal rank 1/2 per offering | ✓ FLOWING | Live: every offering has exactly 2 ranked buyer links |
| signal_offering_link | 10 links | seedGbs links matching PA | ✓ FLOWING | 0 mismatches; names match spec Section 7.6 |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Type check clean | `npx tsc --noEmit` | exit 0, no errors | ✓ PASS |
| Full test suite | `npm test` | 38 files passed, 482 passed, 38 skipped (gated), 0 failed | ✓ PASS |
| Seed idempotency (live) | `npm run seed:gbs` (3rd run) | exit 0; "Inserted: 1 practice area, 3 domains, 5 buyer roles, 11 offerings, 11 triggers, 22 offering-buyer-role links, 27 company signals, 12 persona signals, 10 signal-offering links"; post-run counts identical | ✓ PASS |
| Live row counts | read-only Neon queries via DATABASE_URL | 1/3/11/5/22/11/27/12/10 matching expected 1/3/5/11/22/11/27/12/10 | ✓ PASS |
| Audit completeness | `count(created_at)=count(updated_at)=count(created_by)=count(updated_by)=total` per table | 100% on all 9 tables | ✓ PASS |
| Practice-area guard live | compare signal PA vs offering PA per link | 0 mismatches across 10 links | ✓ PASS |

### Probe Execution

No probes declared in plans; not a probe-based phase. N/A.

### Requirements Coverage

| Requirement | Description | Status | Evidence |
| ----------- | ----------- | ------ | -------- |
| DATA-01 | Signals model with status enums, polymorphic signal_offering_link, source (catalog/detected) | ✓ SATISFIED | record_type discriminator; catalog_status enum; signal source field |
| DATA-02 | Polymorphic join (or 2 tables); category free text | ✓ SATISFIED | signal_offering_link.signal_type=record_type; category text + distinct query |
| DATA-03 | signals seeded; company + persona dimensions (ids, names, dates) | ✓ SATISFIED | 27 company + 12 persona signals; id/name/category/description/firstSeenAt |
| DATA-04 | Commercial signals real (not demo) | ✓ SATISFIED | SEEDED_BY='seed-script' sentinel; seed data from spec Section 7 |
| DATA-05 | Offering has description + commercial-model mechanism text (never numeric price; no pricing field) | ✓ SATISFIED | 11/11 populated; mechanism language ("≈3–5 weeks", "day-rate"); no price figures; no pricing column |
| DATA-06 | Persona/role model with named roles + capability tags | ✓ SATISFIED | buyer_role 5 rows; persona_signal buyerRoleId; role taxonomy spec Section 2.2 |
| DATA-07 | Signal→role association | ✓ SATISFIED | persona_signal.buyer_role_id NOT NULL; 12/12 live references |
| DATA-08 | Signal→offering association with business rule (same practice area) | ✓ SATISFIED | insertSignalOfferingLink guard; 0 mismatches live |
| DATA-09 | created_by/updated_by on all writes (audit) | ✓ SATISFIED | 100% populated live; query modules enforce |
| DATA-10 | No destructive cascades; delete-guard rule | ✓ SATISFIED | Query-layer discriminated unions + DB NO ACTION FKs |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | - | - | - | No TBD/FIXME/XXX/PLACEHOLDER debt markers; no stub returns; no empty handlers; no hardcoded empty data; no console.log-only implementations. 38 skipped integration tests are environment-gated (TEST_DATABASE_URL unset), not stubs. |

### Human Verification Required

1. **Offering content fidelity** — Spot-check Claude-authored `description` + `commercial_model_text` for several offerings against the team's actual service catalogue. Expected: faithful 1-2 sentence summaries of entry trigger and buyer intent, no invented claims, no numeric pricing. Why human: catalogue .docx not in repo; treatment pre-approved in CONTEXT.md and flagged plan-mandated in 30-06-SUMMARY.md:89.
2. **Signal description = name verbatim** — Review whether 27 company + 12 persona signals with `description` duplicated from `name` is acceptable for v1.4 or whether distinct descriptions should be authored later. Why human: enriching descriptions is business-content authorship requiring source material; programmatic verification can only confirm the redundancy.

### Gaps Summary

No gaps found. All 19 must-have truths verified — 17 by live execution/evidence (tsc exit 0; 482 tests passed; live Neon counts 1/3/5/11/22/11/27/12/10; audit columns 100%; enums exact; FK NO ACTION; seed idempotency proven by a live 3rd run; 0 practice-area mismatches), 2 by source-read + unit tests + live backstop confirmation (db:push idempotency per 30-01-SUMMARY with pre-existing unrelated Phase 15 drift noted; delete-guard behavior asserted in 482 passing unit tests with live FK backstop). The 38 skipped tests are integration tests gated on TEST_DATABASE_URL (unset in this environment) — not treated as live proof; direct live-DB checks were substituted and are strictly stronger evidence for current state. No debt markers, no stubs, no wiring gaps.

**Note (tracking, non-blocking):** The milestone is queued and shares STATE/ROADMAP/REQUIREMENTS tracking with live v1.5 (Phase 28 listed as "Planned (queued)"). Implementation correctness is unaffected by the label; per instruction, STATE.md/ROADMAP.md/REQUIREMENTS.md were not modified.

---

_Verified: 2026-08-05T00:20:43Z_
_Verifier: Claude (gsd-verifier)_
