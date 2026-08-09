# Phase 35 Plan Checker Verdict

**Phase:** Company & Persona Analysis Experiences
**Plans checked:** 35-01, 35-02, 35-03, 35-04
**Verdict:** **PASS**
**Blocking issues:** 0
**Warnings:** 0

## Requirement and roadmap coverage

| Requirement / success criterion | Covering plans/tasks | Planned evidence | Status |
|---|---|---|---|
| UX-01: preview resolved instruction, Practice Area, active checklist, effort for Company and Persona | 35-01 T1/T3; 35-02 T1/T2; 35-04 T1/T3 | Strict preview contracts, Route Handler tests, launcher/Menu tests, Playwright UAT | Covered |
| UX-02: durable history/current status after navigation or reload | 35-01 T1/T2; 35-02 T2; 35-03 T1/T2; 35-04 T1/T3 | All-status subject query, polling tests, detail composition, reload UAT | Covered |
| Settled results, findings, sources, provenance, review state | 35-01 T1/T2; 35-03 T1/T2; 35-04 T2/T3 | Retention-aware packet projection, read-only `RunReviewCard`, source/provenance tests and UAT | Covered |
| Confirmed candidate offerings only, on both target types, with provenance | 35-01 T1/T2; 35-03 T1/T2; 35-04 T2/T3 | Confirmed-only SQL projection, discriminator/retention fixtures, placement and UAT checks | Covered |

All Phase 35 roadmap success criteria and UX-01/UX-02 appear in plan `requirements` frontmatter and map to concrete tasks. UX-03 and VER-01 remain Phase 36. No deferred EXA/dynamic-agent work is included.

## Plan, dependency, and ownership audit

| Plan | Tasks | Files / structure | Wave / dependency | Scope |
|---|---:|---|---|---|
| 35-01 | 3 | `verify.plan-structure`: valid; all fields present | Wave 1, none | 8 unique files; safe |
| 35-02 | 2 | Valid; all fields present | Wave 2, after 35-01 | 5 unique files; safe |
| 35-03 | 2 | Valid; all fields present | Wave 2, after 35-01 | 8 unique files; safe |
| 35-04 | 3 (one checkpoint) | Valid; checkpoint has blocking resume signal | Wave 3, after 35-02 and 35-03 | 8 unique files; safe |

The graph is acyclic and file-conflict safe. Wave 1 owns contracts/API/query seams; Wave 2 splits launcher/polling from history/card/detail composition; Wave 3 owns fixtures, scope audit, validation/verification, and UAT. The new 35-04 intra-plan chain is explicit and ordered:

1. **Task 1** creates the disposable fixture helper and `e2e/35-analysis-experiences.spec.ts`, plus the validation contract.
2. **Task 2** runs after the scaffold and performs the automated/scope/database/build gate.
3. **Task 3** runs after Tasks 1 and 2 and is the blocking authenticated fixture-only checkpoint.

Task 1's exact discoverability command is concrete and runnable:
`test -s scripts/seed-phase35-fixtures.ts && test -s e2e/35-analysis-fixtures.ts && test -s e2e/35-analysis-experiences.spec.ts && npm exec playwright test e2e/35-analysis-experiences.spec.ts --list`.
It verifies the scaffold exists and Playwright can discover the exact UAT spec before the human checkpoint. No same-wave application-file conflict was found.

## Goal-backward boundary checks

- **Preview authority:** 35-01 T3 gates with `requireStaffAccess()` first, accepts only subject/Practice Area input, resolves the compatible active template, subject, Practice Area, checklist, and effort server-side, and excludes secrets/private/raw provider data. 35-02 sends only opaque template version, subject, and Practice Area to the existing POST. POST re-resolution remains authoritative, so stale preview data cannot define snapshots.
- **Fixed-template scope:** Exactly one target-compatible fixed template is planned; no template picker, Phase 36 lifecycle, dynamic constructor, EXA playground, provider/model controls, package, schema, or provider changes are planned.
- **History:** 35-01 T2 requires SQL-scoped `{targetType, subjectId}`, all statuses, newest-first ordering, and no reconciliation/write. 35-02 polls only queued/running, aborts stale requests, and stops at completed, failed, cancelled, pending_review, confirmed, and dismissed. 35-03 composes both target detail experiences.
- **Subject isolation:** Candidate SQL must constrain both `subject_type` and `subject_id`; global queries followed by React filtering are explicitly prohibited. Equal Company/Persona IDs are required in contract, Neon, and browser fixtures.
- **Persona retention:** Candidate reads and settled packet projection reuse the Phase 34 retention-aware boundary; expired/tombstoned Persona results and candidates are excluded.
- **Review ownership:** 35-03 adds read-only `RunReviewCard` mode, preserves default `/reviews` interaction, links pending review to `/reviews`, and keeps Confirm/Dismiss off target pages.
- **Candidate semantics:** Queries positively require confirmed run/review, strong/weak source-backed findings, polymorphic signal identity, offering name, and persisted provenance. No-evidence, inconclusive, source-less, non-confirmed, expired, and tombstoned cases are explicitly covered.
- **No side effects:** Query actions are read-only. The final scope audit scans preview/UI/detail/query/test/script/manifest sources for providers, Firecrawl, legacy proposal/live Signal/Offering/link writes, packet mutation, Phase 36 leakage, schema changes, package changes, and client-trusted authority fields.
- **Fixture-only verification:** The fixture seed is guarded by `TEST_DATABASE_URL` plus an explicit Phase 35 flag, uses disposable rows, sanitizes identifiers, cleans up, and forbids provider/Firecrawl/Signal/Offering/link/packet mutation. The browser spec uses existing `e2e/.clerk/user.json` and mock/fixture boundaries.

## Verification dimensions

1. **Requirement coverage: PASS** — UX-01/UX-02 and every roadmap success criterion are mapped.
2. **Task completeness: PASS** — all executable tasks have files, specific actions, runnable verification, and measurable done criteria; the checkpoint has a blocking resume signal.
3. **Dependency correctness: PASS** — Wave 1 → Wave 2 → Wave 3 is valid and acyclic; 35-04's three-task chain is explicit in task actions and ordering.
4. **Key links planned: PASS** — preview → resolver, launcher → preview/POST, details → subject-scoped reads, history → read-only card, and candidates → canonical source links are all named.
5. **Scope sanity: PASS** — no plan exceeds five tasks or fifteen files; ownership is separated by wave and concern.
6. **Verification derivation: PASS** — must-haves are user-observable and testable, with concrete commands and adversarial matrices.
7. **Context compliance: PASS** — locked Menu→Dialog, fixed templates, full preview, all-run history, terminal polling, read-only results, `/reviews` ownership, candidate placement, and confirmed-only provenance are honored.
8. **Nyquist compliance: PASS** — `35-VALIDATION.md` exists; every task has automated evidence or a concrete checkpoint command; no `MISSING` marker remains; scaffold discovery precedes the gate and UAT; guarded Neon evidence fails closed when `TEST_DATABASE_URL` is absent.
9. **Cross-plan data contracts: PASS** — 35-01 contracts/projections feed 35-02/03 without incompatible transforms; discriminator, retention visibility, and provenance remain intact.
10. **CLAUDE.md compliance: PASS** — existing Next.js, Neon/Drizzle, Clerk, Vitest, Playwright, strict TypeScript, server-only secret, additive/read-only, and no-package conventions are respected.
11. **Research resolution: PASS for planning** — selected Route Handler, failure-row, and target-page composition approaches are concrete; remaining research assumptions are discretionary implementation details, not unresolvable dependencies.
12. **Pattern compliance: SKIPPED** — no Phase 35 PATTERNS.md exists.
13. **Architectural tier compliance: PASS** — API owns preview/auth authority, DB owns SQL isolation/retention, Server Components own safe packet projection, and browser components only render/poll/launch.

## Final decision

**PASS — execution may proceed.** The prior blocking issues are resolved: `35-VALIDATION.md` is present, the human checkpoint has a concrete automated Playwright command, the scaffold task creates and verifies the exact discoverable UAT paths before the automated gate and checkpoint, and 35-04 line 137 now correctly names the Task 1 → Task 2 → Task 3 completion chain.
