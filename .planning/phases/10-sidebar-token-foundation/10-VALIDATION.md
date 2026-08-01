---
phase: 10
slug: sidebar-token-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-01
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.1.10` (already installed, `package.json:54`) |
| **Config file** | `vitest.config.ts` (exists — environment `node`, include `src/**/*.test.ts`, alias `@` → `./src`) |
| **Quick run command** | `npx vitest run src/lib/nav.test.ts -x` (targeted — this phase's test file) |
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
| 10-01-01 | 01 | 1 | PANE-01..04 | — | tokens scoped to sidebar subtree only (no global `:root` drift) | diff-rule | `git diff --stat` — only `globals.css` modified | globals.css ✅ | ⬜ pending |
| 10-01-02 | 01 | 1 | QLTY-02 | T-10-01 / — | 8-token AA set (hex, values per UI-SPEC) | manual (design-time) + Phase 14 live audit | contrast recomputation per RESEARCH.md | n/a (CSS constants) | ⬜ pending |
| 10-02-01 | 02 | 1 | QLTY-01 | T-10-02 / — | `getActiveNavKey` total function: `/` → start; prefix-boundary companies/personas/reviews; null for sign-in/''/siblings | unit | `npx vitest run src/lib/nav.test.ts -x` | ❌ W0 (created in-phase) | ⬜ pending |
| 10-02-02 | 02 | 1 | PANE-04 | T-10-03 / — | content area unchanged; `@theme inline`, `.dark`, `sidebar.tsx` byte-identical | diff-rule | `git diff --stat` + `git diff globals.css` review | n/a (regression guardrail) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/nav.test.ts` — created in-phase (11 UI-SPEC cases: exact `/`, prefix-boundary ×3, null ×4, `/companies/[id]` highlight, siblings)
- [ ] Framework install: **none needed** — vitest already installed and configured (verified live: 16 tests / 155ms)
- [ ] Shared fixtures: **none needed** — pure function, no fixtures

*Existing infrastructure covers all phase requirements except the test file itself, which the phase creates.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 8-token AA contrast set | QLTY-02 | CSS constants — design-time verification; automated contrast math is a build script, not a unit test | Recompute the 14 ratios via WCAG relative-luminance (values in RESEARCH.md §Validation Architecture); full live audit deferred to Phase 14 |
| Scoped-render / zero-drift guardrails | PANE-01..04 | Regression guardrails — verified via diff review, not runtime | `git diff` shows only `globals.css` (+30 lines), `src/lib/nav.ts`, `src/lib/nav.test.ts`; `@theme inline` & `.dark` & `sidebar.tsx` byte-identical; `npm run build` passes with the sidebar rendering light tokens |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (`nav.test.ts`)
- [ ] No watch-mode flags
- [ ] Feedback latency < 2s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
