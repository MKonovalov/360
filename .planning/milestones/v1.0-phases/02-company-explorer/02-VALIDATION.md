---
phase: 2
slug: company-explorer
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-23
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None installed — no `vitest.config.*`, `jest.config.*`, `playwright.config.*`, or `*.test.*`/`*.spec.*` files anywhere in the repo |
| **Config file** | none — Wave 0 does not introduce one (see Wave 0 Requirements) |
| **Quick run command** | none |
| **Full suite command** | none |
| **Estimated runtime** | n/a |

Phase 1 shipped with zero automated tests and relied entirely on `01-HUMAN-UAT.md` (human verification checklist) per this project's `human_verify_mode: "end-of-phase"` config setting — established, intentional precedent for this repo, not an oversight.

---

## Sampling Rate

- **After every task commit:** n/a — no automated quick-run command exists
- **After every plan wave:** n/a
- **Before `/gsd-verify-work`:** Human UAT checklist (matching Phase 1's `01-HUMAN-UAT.md` precedent) must be complete
- **Max feedback latency:** n/a (manual verification phase)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | COMP-01..04 | — | Firmographics/tech stack/signals/personas render correctly on detail pane | manual (UAT) | — | ❌ | ⬜ pending |
| TBD | TBD | TBD | EXPL-01, EXPL-02, EXPL-09 (D-10) | T-2-01 | Search/filter narrows list correctly, AND-combines; no raw-SQL injection via filter params | manual (UAT), optionally unit-testable | `listCompanies(filters)` WHERE-building logic could be extracted as pure function and unit-tested with Vitest (optional) | ❌ Wave 0, optional | ⬜ pending |
| TBD | TBD | TBD | EXPL-04, EXPL-07 | — | Click-through to detail, URL reflects selection/filters, deep link round-trips | manual (UAT) | — | ❌ | ⬜ pending |
| TBD | TBD | TBD | EXPL-05 | — | Signal badges render on list rows | manual (UAT) | — | ❌ | ⬜ pending |
| TBD | TBD | TBD | EXPL-03 | — | Sidebar collapse/expand, Key Personas disabled | manual (UAT) | — | ❌ | ⬜ pending |
| TBD | TBD | TBD | all `/companies/*` routes | T-2-02 | `requireStaffAccess()` enforced on every new route (no unauthenticated access) | manual (UAT) + source assertion | grep for `requireStaffAccess()` in each new route/layout | ❌ | ⬜ pending |

*Planner fills in Plan/Wave/Task ID columns when PLAN.md files are created.*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — no test framework installed this phase (recommendation: do not introduce one). Every EXPL/COMP requirement is either a visual/interaction behavior (best suited to human UAT, consistent with Phase 1 precedent) or covered by TypeScript's compile-time type-checking (Drizzle's typed query builder). If the planner wants optional automated coverage, extracting `listCompanies`'s filter-condition-building logic into a standalone pure function + adding Vitest is reasonable but not required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Firmographics/tech stack/signals/personas display correctly | COMP-01..04 | Visual/data-shape verification | Open several company detail panes, confirm all fields render with source + last-updated date |
| Search/filter narrows list, filters AND-combine | EXPL-01, EXPL-02 | Interaction behavior best judged by a human trying real queries | Search by name, filter by industry/signal type in combination, confirm results narrow correctly |
| Deep link round-trips | EXPL-04, EXPL-07 | Browser URL/navigation behavior, not a pure function | Select a company + filters, copy URL, open in new tab, confirm same view restores |
| Signal badges render on list rows | EXPL-05 | Visual verification | Scan list, confirm badges appear per company without opening detail |
| Sidebar collapse/expand, Key Personas disabled | EXPL-03 | Visual/interaction verification | Toggle sidebar, confirm Key Personas section shows disabled state |
| No unauthenticated access to `/companies/*` | V4 Access Control (ASVS L1) | Requires an unauthenticated browser session to verify | Log out, attempt direct navigation to `/companies` and `/companies/[id]`, confirm redirect/block |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (manual UAT is the phase's automated-equivalent per established precedent)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (n/a — phase is manual-only by design, consistent with Phase 1)
- [x] Wave 0 covers all MISSING references (none required — no test framework to install)
- [x] No watch-mode flags
- [x] Feedback latency < n/a (manual verification phase)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-23
