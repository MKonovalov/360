---
phase: 5
slug: layout-consolidation-rework
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-29
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None installed — no Jest/Vitest/Playwright/Cypress config or test files exist anywhere in the repo (confirmed via 05-RESEARCH.md; matches STATE.md's carried-forward note) |
| **Config file** | none — see Wave 0 |
| **Quick run command** | `npx tsc --noEmit` (type-check only, ~5-15s) |
| **Full suite command** | `npm run lint && npx tsc --noEmit && npm run build` (matches this project's established manual-verification convention — no `npm test` script exists) |
| **Estimated runtime** | ~30-60s (build-dominated) |

---

## Sampling Rate

- **After every task commit:** `npx tsc --noEmit` (catches prop/type mismatches in the new shared component's generic API immediately)
- **After every plan wave:** `npm run lint && npx tsc --noEmit && npm run build`
- **Before `/gsd-verify-work`:** Full suite green, plus manual UAT walk-through of all 5 success criteria (single-expand behavior, layout stacking on both explorers, URL deep-link + back button, scroll + close control, keyboard nav)
- **Max feedback latency:** ~60s (build step)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | LAYT-01 | — | Single-expand accordion — opening a row closes any previously-open row | manual (UAT) + type-check | `npx tsc --noEmit` | ❌ Wave 0 | ⬜ pending |
| TBD | TBD | TBD | LAYT-02 | — | Both `/companies` and `/personas` render stacked list-on-top/detail-below; old side-by-side split removed on both | manual (UAT) | — | ❌ Wave 0 | ⬜ pending |
| TBD | TBD | TBD | LAYT-03 | T-5-01 (V5 Input Validation) | `selected` query param URL-synced with `history: 'push'`; reload and browser back re-open same row; invalid/non-numeric `selected` value never reaches `getCompanyById`/`getPersonaById` unvalidated | manual (UAT) + source assertion | grep for `Number.isNaN` guard on `selected` parse | ❌ Wave 0 | ⬜ pending |
| TBD | TBD | TBD | LAYT-04 | — | Opening a row scrolls it to top of viewport; explicit close control collapses detail back to list-only | manual (UAT) | — | ❌ Wave 0 | ⬜ pending |
| TBD | TBD | TBD | LAYT-05 | — | Arrow keys move focus between list rows (roving tabindex); Enter expands/toggles the focused row | manual (UAT) | — | ❌ Wave 0 | ⬜ pending |
| TBD | TBD | TBD | all `/companies/*`, `/personas/*` routes (incl. redirect-only old routes) | T-5-02 (V4 Access Control) | `requireStaffAccess()` enforced on every consolidated + redirect-only route — never skipped just because layout already gates the subtree | manual (UAT) + source assertion | grep for `requireStaffAccess()` in each route | ❌ Wave 0 | ⬜ pending |

*Planner fills in Plan/Wave/Task ID columns when PLAN.md files are created.*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — no test framework installed this phase (recommendation: do not introduce one). This phase's own goal is a UI/interaction rework, not the introduction of a test framework; every LAYT requirement is a visual/interaction behavior best suited to human UAT, consistent with Phase 1-4 precedent. If a future phase wants automated coverage of the keyboard-nav logic specifically, isolating it into a small pure function (e.g., `getNextFocusableRowId(currentId, rowIds, direction)`) would make it unit-testable without any DOM/jsdom dependency — the cheapest possible entry point into test coverage for this codebase (per 05-RESEARCH.md), but is out of scope unless separately requested.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Single-expand accordion behavior | LAYT-01 | Interaction behavior best judged by a human clicking through rows | Open a row, open a different row, confirm the first auto-closes; never two rows open at once |
| Stacked layout on both explorers | LAYT-02 | Visual verification | Visit `/companies` and `/personas`, confirm list-on-top/detail-below on both, no side-by-side split remains |
| URL deep-link + back-button round-trip | LAYT-03 | Browser URL/navigation behavior, not a pure function | Expand a row, copy URL, reload — same row re-opens; navigate away, use browser back — same row re-opens |
| Scroll-into-view + close control | LAYT-04 | Visual/interaction verification | Expand a row far down the list, confirm it scrolls to top of viewport; use close control, confirm collapse to list-only |
| Keyboard navigation | LAYT-05 | Interaction behavior requiring a human at a keyboard | Tab into the list, use arrow keys to move focus between rows, press Enter to expand the focused row |
| `requireStaffAccess()` on redirect-only old routes | V4 Access Control (ASVS L1) | Requires an unauthenticated browser session to verify | Log out, attempt direct navigation to `/companies/42` and `/personas/42`, confirm redirect/block before reaching the new param-based URL |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (manual UAT is the phase's automated-equivalent per established Phase 1-4 precedent)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (n/a — phase is manual-only by design)
- [x] Wave 0 covers all MISSING references (none required — no test framework to install)
- [x] No watch-mode flags
- [x] Feedback latency < 60s (build step)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-29
