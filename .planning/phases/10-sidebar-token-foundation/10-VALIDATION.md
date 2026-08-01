---
phase: 10
slug: sidebar-token-foundation
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-01
updated: 2026-08-01
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.1.10` (already installed, `package.json:54`) |
| **Config file** | `vitest.config.ts` (exists — environment `node`, include `src/**/*.test.ts`, alias `@` → `./src`) |
| **Quick run command** | `npx vitest run src/lib/nav.test.ts --bail=1` (targeted — this phase's test file; `--bail=1` is the vitest 4.1.10 fail-fast equivalent of the plan's `-x` flag) |
| **Full suite command** | `npm test` (= `vitest run`; verified clean across 22 test files) |
| **Estimated runtime** | ~1 second (pure function, single test file) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/lib/nav.test.ts -x`
- **After every plan wave:** Run `npm test` (full suite must stay green)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | PANE-01..04 | T-10-01 / — | tokens scoped to sidebar subtree only (no global `:root` drift) | diff-rule | `git diff --stat` — only `globals.css` modified | globals.css ✅ | ✅ green |
| 10-01-02 | 01 | 1 | QLTY-02 | T-10-01 / — | 8-token AA set (hex, values per UI-SPEC) | manual (design-time) + Phase 14 live audit | contrast recomputation per RESEARCH.md | n/a (CSS constants) | ✅ green |
| 10-02-01 | 02 | 1 | QLTY-01 | T-10-02 / — | `getActiveNavKey` total function: `/` → start; prefix-boundary companies/personas/reviews; null for sign-in/''/siblings | unit | `npx vitest run src/lib/nav.test.ts --bail=1` | ✅ (created in-phase) | ✅ green |
| 10-02-02 | 02 | 1 | PANE-04 | T-10-03 / — | content area unchanged; `@theme inline`, `.dark`, `sidebar.tsx` byte-identical | diff-rule | `git diff --stat` + `git diff globals.css` review | n/a (regression guardrail) | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/lib/nav.test.ts` — created in-phase (11 UI-SPEC cases: exact `/`, prefix-boundary ×3, null ×4, `/companies/[id]` highlight, siblings)
- [x] Framework install: **none needed** — vitest already installed and configured (verified live: 16 tests / 155ms)
- [x] Shared fixtures: **none needed** — pure function, no fixtures

*Existing infrastructure covers all phase requirements except the test file itself, which the phase creates.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 8-token AA contrast set | QLTY-02 | CSS constants — design-time verification; automated contrast math is a build script, not a unit test | Recompute the 14 ratios via WCAG relative-luminance (values in RESEARCH.md §Validation Architecture); full live audit deferred to Phase 14 |
| Scoped-render / zero-drift guardrails | PANE-01..04 | Regression guardrails — verified via diff review, not runtime | `git diff` shows only `globals.css` (+30 lines), `src/lib/nav.ts`, `src/lib/nav.test.ts`; `@theme inline` & `.dark` & `sidebar.tsx` byte-identical; `npm run build` passes with the sidebar rendering light tokens |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (`nav.test.ts`)
- [x] No watch-mode flags
- [x] Feedback latency < 2s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-08-01 (validate-phase audit)

---

## Validation Audit 2026-08-01

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

**Audit notes (State A — existing VALIDATION.md):**
- Full-suite gate re-run live: `npm test` → 23 files, 224 passed / 2 skipped / 0 failures, exit 0.
- Targeted gate re-run live: `npx vitest run src/lib/nav.test.ts --bail=1` → 11/11 passed.
- Diff-rule gates re-verified against commits `b23e9f11..6015ff5a`: change-set is exactly `globals.css` (+22), `nav.ts`, `nav.test.ts`; vendored `sidebar.tsx` + 3 layout consumers + `package.json`/`package-lock.json` byte-identical (empty diff); globals.css commit is additions-only (0 removed lines, 0 added `@layer`, 0 added `dark:`); token block placement between `:root` (51) and `.dark` (108) confirmed (`placement-ok`).
- Manual-only item QLTY-02 (8-token AA contrast) retains design-time evidence: RESEARCH.md §Validation Architecture independently recomputed all 14 ratios (12.30 / 4.89 / 12.63 / 3.11 / 5.91 / 18.38 / 4.30); live browser audit deferred to Phase 14 per plan contract.
- Test file `src/lib/nav.test.ts` confirmed present with exactly 11 `it` blocks covering all 11 UI-SPEC §QLTY-01 inputs (exact `/`, 3 prefix families, `/companies/123` highlight, `/companies-archive` boundary, `/sign-in`, `''`).
- No gaps found → no `gsd-nyquist-auditor` spawn required; all requirements have automated or documented manual verification.
