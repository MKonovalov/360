---
phase: 3
slug: persona-explorer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-23
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None installed (no `vitest.config.*`, `jest.config.*`, `playwright.config.*`, or `*.test.*`/`*.spec.*` files anywhere in the repo; `package.json` has no `test` script) |
| **Config file** | none — see Wave 0 |
| **Quick run command** | none |
| **Full suite command** | none |
| **Estimated runtime** | n/a |

Phase 1 and Phase 2 both shipped with zero automated tests, relying entirely on human-UAT checklists (`01-HUMAN-UAT.md`, `02-HUMAN-UAT.md`) per this project's `human_verify_mode: "end-of-phase"` config setting. Phase 3 follows this established precedent.

---

## Sampling Rate

- **After every task commit:** n/a — no automated quick-run command exists.
- **After every plan wave:** n/a.
- **Before `/gsd-verify-work`:** Human UAT checklist must be complete (matching Phase 1/2's `*-HUMAN-UAT.md` precedent).
- **Max feedback latency:** n/a (manual verification only).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | PERS-01 | — | Role/title/seniority render correctly on Persona detail | manual | — | ❌ | ⬜ pending |
| TBD | TBD | TBD | PERS-02 | — | Career History shows previous companies with correct date ranges | manual | — | ❌ | ⬜ pending |
| TBD | TBD | TBD | PERS-03 | — | Current Company block shows correct linked company | manual | — | ❌ | ⬜ pending |
| TBD | TBD | TBD | PERS-04 | — | Contact info (email/LinkedIn) renders; LinkedIn is a working external link | manual | — | ❌ | ⬜ pending |
| TBD | TBD | TBD | DATA-01 | — | Full seed dataset loads via `npm run seed`; both explorers browse it end-to-end | manual (exit-code check + click-through) | `npm run seed` | ⚠️ script exists, no automated assertion beyond exit code | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs to be filled in by the planner once PLAN.md files exist.*

---

## Wave 0 Requirements

*None — no test framework will be introduced this phase, consistent with Phase 1/2 precedent. Existing infrastructure (human UAT) covers all phase requirements.*

Optional (non-blocking) recommendation for the planner: the two-hop EXISTS subquery (`persona → companyPersonaRole(isCurrent) → company → signal`) flagged as the phase's one structurally novel piece in RESEARCH.md is the single highest-value candidate for an isolated Vitest unit test, if the planner chooses to introduce one. Not required for Nyquist compliance given the manual-verification precedent.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Persona detail renders role/title/seniority | PERS-01 | Visual/data-shape verification; no test framework in repo | Open a Persona's detail pane, confirm role, title, and seniority display correctly for a known seed record |
| Career History section shows previous companies with dates | PERS-02 | Visual verification of rendered date ranges | Open a Persona with multiple historical roles (e.g. Sydney Placeholdt), confirm each prior company and date range is listed correctly |
| Current Company block shows correct linked company | PERS-03 | Visual verification of FK-derived display | Open a Persona's detail pane, confirm the Current Company shown matches the `isCurrent` role in seed data |
| Contact info renders with working LinkedIn link | PERS-04 | Visual + external-link verification | Open a Persona's detail pane, confirm email displays and LinkedIn link opens the correct external URL |
| Full seed dataset loads and both explorers browse it end-to-end | DATA-01 | Requires running seed script and manually clicking through both explorers | Run `npm run seed`, confirm exit code 0 and expected row counts in console output, then browse `/companies` and `/personas` end-to-end |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies — N/A, manual-only phase
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify — N/A, manual-only phase
- [ ] Wave 0 covers all MISSING references — N/A, no Wave 0 gaps
- [ ] No watch-mode flags — N/A
- [ ] Feedback latency < N/A
- [ ] `nyquist_compliant: true` set in frontmatter — pending human UAT sign-off at phase gate

**Approval:** pending
