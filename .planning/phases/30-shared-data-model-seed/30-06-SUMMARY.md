---
phase: 30-shared-data-model-seed
plan: 06
subsystem: database
tags: [drizzle, postgres, neon, seed-script, idempotent, query-modules, gbs-data]

# Dependency graph
requires:
  - phase: 30
    plan: 01
    provides: the 9 Phase 30 tables (practice_area, domain, offering, buyer_role, offering_buyer_role, trigger, company_signal, persona_signal, signal_offering_link) live in Neon
  - phase: 30
    plan: 02
    provides: practiceAreas.ts / domains.ts / buyerRoles.ts query modules (insertPracticeArea, insertDomain, insertBuyerRole)
  - phase: 30
    plan: 03
    provides: offerings.ts query module (insertOffering, insertOfferingBuyerRole, insertTrigger)
  - phase: 30
    plan: 04
    provides: companySignals.ts / personaSignals.ts query modules (insertCompanySignal, insertPersonaSignal)
  - phase: 30
    plan: 05
    provides: signalOfferingLinks.ts query module (insertSignalOfferingLink with the cross-practice-area guard)
provides:
  - src/scripts/seedGbs.ts — idempotent CLI seed for the full spec Section 7 GBS dataset (1 practice area, 3 domains, 5 buyer roles, 11 offerings, 11 triggers, 22 offering_buyer_role rows, 27 company signals, 12 persona signals, 10 signal-offering links), routing every insert through the query modules built in Plans 02-05 (NOT raw db.insert)
  - "seed:gbs" npm script (tsx src/scripts/seedGbs.ts), separate from the existing seed script
  - src/scripts/seedGbs.integration.test.ts — TEST_DATABASE_URL-gated exact-count assertions (9 tables) + idempotency re-run check, calling the exported seedGbs() directly
  - The live seeded data itself — DATA-03..DATA-08 are now satisfied in the real Neon dev database
affects: [29, 30, 31, 32]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Idempotent CLI seed: children→parents delete sequence across all 9 tables (signalOfferingLink → trigger → offeringBuyerRole → offering → domain → personaSignal → companySignal → buyerRole → practiceArea) before insert, so re-running never duplicates — neon-http has no transactions, ordering is the mechanism"
    - "dotenv-before-dynamic-import boilerplate (seed.ts precedent): config({ path: '.env.local' }) at the very top, then Clerk ??= placeholders, then dynamic imports of anything transitively touching src/lib/env.ts inside the async body"
    - "Export + VITEST-guarded auto-run: the seed body is `export async function seedGbs()` so tests call it directly; auto-run is wrapped in `if (process.env.VITEST !== 'true')` so vitest's import-time evaluation never triggers process.exit"
    - "Seed data as typed literals + name→id Maps: DOMAINS/BUYER_ROLES/OFFERINGS/COMPANY_SIGNALS/PERSONA_SIGNALS/SIGNAL_OFFERING_LINKS const arrays drive for-loop inserts; every Map lookup throws a descriptive resolve-or-throw error (seed.ts signals.csv precedent)"

key-files:
  created:
    - src/scripts/seedGbs.ts
    - src/scripts/seedGbs.integration.test.ts
  modified:
    - package.json

key-decisions:
  - "description = name verbatim for all 27 company + 12 persona signals — spec Section 7.4/7.5 supplies exactly ONE string per signal while the schema requires distinct name AND description (NOT NULL); using the same literal avoids inventing unreviewed business content. Flagged for human review below."
  - "Head of GBS/COO joint bucket → all to Head of GBS — spec Section 7.5 groups the two roles but persona_signal.buyer_role_id is a single required FK; every signal in that bucket assigns to Head of GBS (first-listed, more GBS-specific), never COO, never duplicated across both."
  - "CFO row 'Content engagement/org' → category 'Org/hiring signal' — spec's ambiguous label resolved to the concrete defined category (the content describes a hiring pattern, not content engagement); the literal 'Content engagement/org' is never seeded."
  - "Offering description + commercial_model_text are Claude-authored 1-2 sentence faithful summaries of each offering's stated entry trigger and buyer intent — the catalogue .docx is unavailable; mirrors CONTEXT.md's pre-approved treatment of this exact gap. Flagged for human review below."
  - "Full literal counts, never the spec's approximations — '~24' company and '~9' persona undercount the literal Section 7.4/7.5 lists; the full 27 and 12 are seeded."
  - "Task-3 sanctioned refactor: main() → exported seedGbs() with a VITEST-guarded auto-run — the plan explicitly allowed refactoring main()'s body into an exported function so the test's beforeAll calls it directly (no execSync double-seed)."

patterns-established:
  - "Seed scripts route through the query modules (single enforcement point): every signal_offering_link goes through insertSignalOfferingLink's practice-area guard, so a mismatch throws loudly instead of silently seeding a broken link (T-30-01)"
  - "SEEDED_BY = 'seed-script' sentinel on every inserted row — no Clerk session exists in a CLI context (30-RESEARCH.md Assumption A2 / T-30-09 accepted)"

requirements-completed: [DATA-03, DATA-04, DATA-05, DATA-06, DATA-07, DATA-08, DATA-09]

# Metrics
duration: 17min
completed: 2026-08-05
---

# Phase 30 (shared-data-model-seed) Plan 06: GBS Seed Script Summary

**Idempotent GBS seed script (seedGbs.ts) loading the full spec Section 7 dataset into live Neon through the Plans 02-05 query modules — 1 practice area, 3 domains, 5 buyer roles, 11 offerings, 11 triggers, 22 offering-buyer-role rows, 27 company signals, 12 persona signals, 10 signal-offering links — verified twice against the real dev database (idempotent second run) with a TEST_DATABASE_URL-gated exact-count integration test; full suite 482 passed | 38 skipped, tsc clean**

## Performance

- **Duration:** 17 min
- **Started:** 2026-08-05T01:43:00Z (+0200) — immediately after 30-05's docs commit (0a40221d at 01:42:00)
- **Completed:** 2026-08-05T01:59:41Z (+0200)
- **Tasks:** 3 (Task 1: skeleton + offerings-side data; Task 2: signals-side data + main() wiring; Task 3: live run + integration test)
- **Files created:** 3 (seedGbs.ts, seedGbs.integration.test.ts, SUMMARY.md) + package.json modified

## Accomplishments
- **seedGbs.ts (484 lines — plan bar was 150)** — typed literal data tables + for-loop inserts routed through the query modules built in Plans 02-05, never raw `db.insert()`. Structure: dotenv-before-dynamic-import boilerplate (seed.ts precedent, comment at lines 5-12) → Clerk `??=` placeholders (line 19-21, `.env.local` carries no Clerk keys but `env.ts` fail-fast-validates at module evaluation) → `SEEDED_BY = 'seed-script'` sentinel (line 27, T-30-09) → 6 data literals (`DOMAINS` 3, `BUYER_ROLES` 5, `OFFERINGS` 11 with per-offering trigger text + ranked buyer list, `COMPANY_SIGNALS` 27 across all 8 categories, `PERSONA_SIGNALS` 12, `SIGNAL_OFFERING_LINKS` 10).
- **Idempotent delete sequence** — children → parents across all 9 tables before insert (`delete(signalOfferingLink) → trigger → offeringBuyerRole → offering → domain → personaSignal → companySignal → buyerRole → practiceArea`), so a re-run clears its own previously-seeded rows first. Verified: a second `npm run seed:gbs` produced byte-identical counts.
- **Every insert routes through the Plan 02-05 query modules** — `insertPracticeArea`, `insertDomain`, `insertBuyerRole`, `insertOffering`, `insertTrigger`, `insertOfferingBuyerRole`, `insertCompanySignal`, `insertPersonaSignal`, and crucially `insertSignalOfferingLink` (the T-30-01 single cross-practice-area guard). Each of the 10 link calls checks its `{ ok }` result and throws `` `Signal-offering link seed data inconsistency: "${name}" and "${offeringName}" are in different practice areas` `` on any `practice_area_mismatch` — none fired, proving the seed data's practice-area consistency live.
- **Resolve-or-throw Map lookups** — `domainNameToId` / `buyerRoleNameToId` / `offeringNameToId` / `companySignalNameToId` / `personaSignalNameToId` throw descriptive errors on unknown names (seed.ts `signals.csv references unknown company_name` precedent).
- **Exact-count closing log** — `` `Inserted: 1 practice area, 3 domains, 5 buyer roles, 11 offerings, 11 triggers, 22 offering-buyer-role links, 27 company signals, 12 persona signals, 10 signal-offering links` `` (mirrors seed.ts's closing convention).
- **Task-3 sanctioned refactor** — `main()` body extracted to `export async function seedGbs()`, auto-run wrapped in `if (process.env.VITEST !== 'true')` so importing the module for tests never triggers `process.exit` (vitest sets VITEST=true); the integration test's `beforeAll` calls `seedGbs()` directly — no third copy of the data, no execSync double-seed.
- **Live verification (Task 3)** — `npm run seed:gbs` against the real `DATABASE_URL` in `.env.local` exited 0 with the exact closing counts; a direct `db.select().from(table)` + `.length` count query confirmed 1/3/5/11/22/11/27/12/10 across the 9 tables; a second run was idempotent (same counts).
- **Integration test** — `seedGbs.integration.test.ts` gated on `process.env.TEST_DATABASE_URL` (`describe.skip` fallback when unset, userModelSettings pattern): 2 tests — (1) exact counts on all 9 tables after `seedGbs()` via `db.select().from(table)` + `.length`, (2) idempotent re-run produces the same counts. Passed 2/2 with `TEST_DATABASE_URL` set (piped from `.env.local`'s `DATABASE_URL` with surrounding quotes stripped); 2 skipped cleanly when unset.
- Full suite: **482 passed | 38 skipped (520)** — no regressions; `npx tsc --noEmit` exit 0 after each task.

## Content-Authorship Flags (plan-mandated, for human review)

These three assumptions were explicitly required to be surfaced in this SUMMARY:

1. **Offering `description` + `commercial_model_text` are Claude-authored** — spec Section 7.3 tabulates only Name/Offer type/Entry trigger/Buyers. The `description` values are faithful 1-2 sentence summaries of each offering's stated entry trigger and buyer intent, and `commercial_model_text` values (e.g. "Fixed fee, short, ≈3–5 weeks", "Retainer, ongoing") describe the engagement mechanism only — **no numeric price figure** (the blocked "no pricing field" concern from STATE.md was honored). Neither field is sourced from the (unavailable) catalogue `.docx`. This mirrors the treatment CONTEXT.md already pre-approved for `commercial_model_text`.
2. **Company/persona signal `description` = `name` verbatim** — spec Section 7.4/7.5 gives exactly ONE string per signal; the schema requires distinct `name` and `description` (NOT NULL) columns. Setting them equal avoids inventing new business-content sentences the firm hasn't reviewed. Applies to all 27 company + 12 persona signals.
3. **Two disambiguation decisions from ambiguous spec buckets** — (a) the "Head of GBS / COO" joint bucket assigns every signal to **Head of GBS** only (single required FK; first-listed, more GBS-specific role); (b) the CFO row spec labels "Content engagement/org" uses category **"Org/hiring signal"** (a hiring pattern, not content engagement).

## Task Commits

Each task was committed atomically:

1. **Task 1: seedGbs.ts skeleton + offerings-side data (practice area, domains, buyer roles, offerings, triggers, buyer-role links) + seed:gbs script** - `aa5b527a` (feat)
2. **Task 2: signals-side data (27 company signals, 12 persona signals, 10 signal-offering links) + main() wiring** - `f5fe8a6c` (feat)
3. **Task 3: live seed run + row-count integration test (+ main() → exported seedGbs() refactor)** - `f877d447` (test)

## Files Created/Modified
- `src/scripts/seedGbs.ts` - 484-line idempotent GBS seed script: 6 typed data literals, 9-table children-first delete, 9 query-module insert functions via name→id Maps, resolve-or-throw lookups, practice-area-mismatch throw on links, exact-count closing log, VITEST-guarded auto-run
- `src/scripts/seedGbs.integration.test.ts` - TEST_DATABASE_URL-gated exact-count + idempotency tests calling the exported seedGbs()
- `package.json` - added `"seed:gbs": "tsx src/scripts/seedGbs.ts"` alongside the existing `seed` entry (new script, existing untouched)

No files modified outside the plan's scope. `schema.ts`, query modules, UI, Server Actions, and auth middleware untouched.

## Decisions Made
- **description = name** for all signals (content-authorship flag 2 above) — satisfies the NOT NULL column faithfully to the single string the source provides.
- **Head of GBS wins the joint bucket** — single FK, no duplication, no COO assignment.
- **CFO ambiguous category resolved to "Org/hiring signal"** — never the literal "Content engagement/org".
- **Full literal counts** — 27 company + 12 persona, never the spec's ~24/~9 approximations.
- **main() → exported seedGbs()** — plan-sanctioned refactor enabling the test to call the seed directly without duplicating data a third time.

## Deviations from Plan

### Auto-fixed Issues
None — no Rule 1/2/3 fixes were needed. The Clerk `??=` placeholders and the `.env.local` double-quote stripping were environment quirks handled inline during implementation, not defects in plan-mandated code.

### Sanctioned Structural Deviation (documented, per plan text)
- **Task-2 acceptance grep `main().then` = 1 became `seedGbs().then` (VITEST-guarded)** — the Task-3 action text explicitly sanctioned this: *"if refactoring `main()`'s body into an exported `seedGbs(databaseUrl?: string)` function is cleaner, do that and call it directly from the test's `beforeAll`"*. The auto-run invocation exists with the same intent (single invocation + exit-code convention, verbatim structure from seed.ts's closing block) but under the VITEST guard and with the renamed function; the literal `main().then` token no longer matches post-refactor. Verified equivalent via greps for `seedGbs()` + `.then(() => process.exit(0))` + `.catch`.

## Issues Encountered
- None. Plan executed cleanly: 3/3 tasks, all acceptance greps at expected values (`SEEDED_BY` = 1, `insertPracticeArea`/`insertOfferingBuyerRole`/`insertSignalOfferingLink` ≥ 1, `db.transaction` = 0, `practice_area_mismatch` = 1, `"seed:gbs"` script = 1), live seed ran twice with exact counts (idempotent), 2/2 integration tests green with TEST_DATABASE_URL / 2 skipped unset, full suite green, tsc clean after each task, no scope creep.

## User Setup Required
- **No action required.** The seed already ran against the real dev database (`.env.local` `DATABASE_URL`), and the exact counts are live in Neon.
- Future re-seeds: `npm run seed:gbs` (idempotent — safe to re-run any time).
- The integration test remains dormant until `TEST_DATABASE_URL` is provided; it can be pointed at the same dev DB via `TEST_DATABASE_URL="$(grep -E '^DATABASE_URL=' .env.local | head -1 | sed 's/^DATABASE_URL=//; s/^"//; s/"$//')" npx vitest run src/scripts/seedGbs.integration.test.ts`.

## Next Phase Readiness
- **Phase 29 (Signals UI) and Phase 30 (Offerings UI) can now be demoed** — the pickers have real buyer roles, 27 company signals, 12 persona signals, 11 active offerings, and 10 guard-validated signal-offering links to consume. DATA-03..DATA-08 are satisfied.
- The delete-guard business rule (DATA-10) is testable against real seeded data — e.g. deleting the GBS practice area now blocks on 27+12 signals + 11 offerings via the Plan 02-05 guards.
- Content-authorship flags above should be reviewed by the firm before Phase 29/30 UI copy references the offering descriptions or signal names as reviewed content.
- No UI, Server Actions, auth logic, transactions, or new dependencies added — matches scope.

---

*Phase: 30-shared-data-model-seed*
*Completed: 2026-08-05*

## Self-Check: PASSED

- All 3 created/modified files exist on disk (seedGbs.ts, seedGbs.integration.test.ts, package.json `seed:gbs` entry) + SUMMARY.md
- All 3 commits verified in `git log`: `aa5b527a` (feat Task 1), `f5fe8a6c` (feat Task 2), `f877d447` (test Task 3)
- Live DB counts verified twice (1/3/5/11/22/11/27/12/10) — idempotent second run
- Full suite: 482 passed | 38 skipped (520); `npx tsc --noEmit` exit 0 after each task; no deletions in any commit
