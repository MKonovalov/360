---
phase: 29
slug: signals-ui-v1-6-queued
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-05
---

# Phase 29 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.10 (unit/integration), Playwright ^1.62.1 (e2e — optional this phase) |
| **Config file** | `vitest.config.ts` (present) |
| **Quick run command** | `npm test -- src/app/actions/signals.test.ts src/lib/params/signalFilters.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~377+ existing tests (Phase 22 baseline) + new Wave 0 files, full suite must stay green |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- <scoped file just touched>`
- **After every plan wave:** Run `npm test` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green; manual QA pass against live-seeded GBS data for SIG-02/SIG-04/SIG-05
- **Max feedback latency:** ~30 seconds (existing suite runtime class)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 29-01-nav | 01 | 0 | SIG-01 | — | `getActiveNavKey('/signals')` returns `'signals'`; sidebar renders new item | unit | `npx vitest run src/lib/nav.test.ts` | ❌ W0 (extend or create) | ⬜ pending |
| 29-01-tabs | 01 | 1 | SIG-02 | — | Both tabs render, Company Signals is default | manual QA | Playwright optional / manual navigate to `/signals` | N/A | ⬜ pending |
| 29-01-filters | 01 | 1 | SIG-03 | — | Filter params parse correctly incl. numeric coercion + NaN guard | unit | `npx vitest run src/lib/params/signalFilters.test.ts` | ❌ W0 | ⬜ pending |
| 29-01-columns | 01 | 1 | SIG-04/SIG-05 | — | Table columns render correct data from seeded GBS rows | manual QA | Manual QA against seeded 27 company / 12 persona signals | N/A | ⬜ pending |
| 29-01-crud | 01 | 1 | SIG-06/SIG-07 | T-29-01 | `requireStaffAccess()` first, zod validation rejects bad input, discriminated-union return | unit | `npx vitest run src/app/actions/signals.test.ts` | ❌ W0 | ⬜ pending |
| 29-01-archive | 01 | 1 | SIG-08 | — | Archive sets `status='retired'` via `update*` query fn, row remains visible | unit | `npx vitest run src/app/actions/signals.test.ts -t archive` | ❌ W0 (action) / ✅ (query layer) | ⬜ pending |
| 29-01-offerings | 01 | 1 | SIG-09 | T-29-02 | Picker excludes drafts, scoped to Practice Area; cross-practice-area insert rejected | integration + unit | `npx vitest run src/lib/db/queries/offerings.test.ts` (existing) + new assertion in `signals.test.ts` | ✅ query layer / ❌ action-surfacing (W0) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/app/actions/signals.test.ts` — covers SIG-06, SIG-07, SIG-08, SIG-09 (Server Action layer: `requireStaffAccess`-first ordering, zod validation rejection, discriminated-union success/failure returns, `revalidatePath`-on-success-only, practice-area-mismatch rejection surfacing)
- [ ] `src/lib/params/signalFilters.test.ts` — covers SIG-03 (filter parsing: `firstValue`, numeric `practiceAreaId` coercion + NaN guard)
- [ ] `src/lib/nav.test.ts` extension (or create if absent) — covers SIG-01's active-key regression lock (`getActiveNavKey('/signals')` → `'signals'`)
- [ ] Framework install: none — Vitest already fully configured

*No integration-test gap: every query-layer function this phase depends on already has passing integration test coverage from Phase 28 — this phase adds Server Action and filter-parsing tests only.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Two-tab layout renders correctly, Company Signals default | SIG-02 | Visual/interaction correctness, UI-SPEC governs exact copy/spacing | Navigate to `/signals`, confirm both tab labels visible, Company tab active by default, matches UI-SPEC typography/spacing contract |
| Table columns display correct spec'd data per signal type | SIG-04/SIG-05 | Visual/copy correctness not meaningfully unit-testable; UI-SPEC locks exact contract a human reviewer checks against | Manual QA against seeded GBS data (27 company / 12 persona signals): confirm Name/Category/Practice Area/Linked Offerings count/Status/Last updated columns (+ Buyer Role for Persona tab) render correctly |
| Sheet form UX for create/edit (both signal types) | SIG-06/SIG-07 | Interaction flow, field ordering, Sheet width overflow behavior are visual/UX judgments | Open create Sheet for both entity types, verify field order matches UI-SPEC ("Row Anatomy" section), verify required Buyer Role blocks Persona save when empty |

---

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies (see table above)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (manual-only tasks are visual/copy checks layered on top of automated Server Action + query-layer coverage, not a replacement for it)
- [x] Wave 0 covers all MISSING references (`signals.test.ts`, `signalFilters.test.ts`, `nav.test.ts` extension)
- [x] No watch-mode flags (all commands use `vitest run`, not `vitest watch`)
- [x] Feedback latency < 30s (existing suite runtime class, no new slow dependencies introduced)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
