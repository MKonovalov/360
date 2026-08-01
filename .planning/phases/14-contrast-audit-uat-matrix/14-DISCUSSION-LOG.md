# Phase 14: Contrast Audit & UAT Matrix - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-01
**Phase:** 14-contrast-audit-uat-matrix
**Areas discussed:** UAT matrix method & scope, Contrast audit method, Exa divergence review, Artifacts & completion bar

---

## UAT matrix method & scope

| Option | Description | Selected |
|--------|-------------|----------|
| Playwright-automated | I drive the live app via Playwright MCP (dev server + Clerk sign-in, screenshots, state assertions); produces verifiable evidence artifacts | ✓ |
| User-run checklist | Structured checklist the user executes by hand; zero automation, no machine-verifiable evidence | |
| Hybrid auto + spot-check | Playwright covers expanded/collapsed/mobile + 4 routes; user spot-checks interactive states (drag-resize, ⌘B, tooltip timing) | |

**User's choice:** Playwright-automated

**Follow-up: matrix cells**

| Option | Description | Selected |
|--------|-------------|----------|
| Full 12-cell + interactions | 3 viewport states × 4 routes with active/inactive asserted, PLUS targeted interaction micro-tests (collapse/expand, ⌘B, drag-resize, tooltips, badge count) | ✓ |
| 8-cell core only | Expanded + collapsed across 4 routes, mobile spot-check; under-tests mobile | |

**User's choice:** Full 12-cell + interactions

**Follow-up: screenshot location**

| Option | Description | Selected |
|--------|-------------|----------|
| In phase artifacts dir | `.planning/phases/14-contrast-audit-uat-matrix/artifacts/` with `cell-{state}-{route}.png`, referenced from 14-UAT.md; evidence persists in-repo for milestone audit | ✓ |
| External temp storage | URLs in UAT doc, files outside the repo; lean repo but non-durable evidence | |

**User's choice:** In phase artifacts dir

---

## Contrast audit method

| Option | Description | Selected |
|--------|-------------|----------|
| Live computed-style audit | Sample rendered computed styles per token pair in the browser, assert each ratio ≥ AA threshold — grounds the audit in real rendered values | ✓ |
| Token-math table only | Static table from globals.css values — proves declared values, not rendered result | |
| Both computed + table | Computed-style sampling + token-math table as exhaustive record | |

**User's choice:** Live computed-style audit

**Follow-up: audit scope**

| Option | Description | Selected |
|--------|-------------|----------|
| All 6 shipped pairs | text-on-panel ≥4.5:1, /70 label ≥4.5:1, active pill ≥3:1, focus ring ≥3:1, badge chip ≥3:1, letter-mark ≥4.5:1 — verify every pair Phases 10-13 claimed AA | ✓ |
| Roadmap's 3 pairs only | text ≥4.5:1 on panel, active pill ≥3:1, /70 opacity — faster but leaves ring/badge/letter-mark unproven | |

**User's choice:** All 6 shipped pairs

---

## Exa divergence review

| Option | Description | Selected |
|--------|-------------|----------|
| Live reference fetch | Fetch live dashboard.exa.ai during the phase, sample actual rendered styles as reference evidence | ✓ |
| Use Phase 10 research snapshot | Use the documented Exa values from Phase 10 RESEARCH/FEATURES — cheaper but a dated snapshot | |

**User's choice:** Live reference fetch

**Follow-up: divergence bar**

| Option | Description | Selected |
|--------|-------------|----------|
| Element-wise pass + divergence list | Explicit pass/fail per matched element (panel, hairline, active gray, mono badge) + documented deliberate-divergences list (items/assets not copied, incl. the ~1.05:1 contrast trap) with rationale each | ✓ |
| Narrative verdict only | Single "visually consistent" verdict, no per-element evidence | |

**User's choice:** Element-wise pass + divergence list

---

## Artifacts & completion bar

| Option | Description | Selected |
|--------|-------------|----------|
| UAT + VERIFICATION + SUMMARY | `14-UAT.md` (matrix + interaction checks, complete), `14-VERIFICATION.md` (contrast audit + Exa review + regression evidence), `14-SUMMARY.md` | ✓ |
| Single combined UAT doc | One file mixing matrix, audit, review — blurs audit evidence away from its canonical artifact | |

**User's choice:** UAT + VERIFICATION + SUMMARY

**Follow-up: v1.1 gaps**

| Option | Description | Selected |
|--------|-------------|----------|
| Leave for milestone close | The 8 deferred v1.1 verification/uat gaps stay open, handled at v1.2 milestone close (complete-milestone audit) | ✓ |
| Fold v1.1 gaps in | Phase 14 also re-runs v1.1 Phase-5 matrix over pre-existing pages and closes deferred gaps — significantly widens scope | |

**User's choice:** Leave for milestone close

---

## Claude's Discretion

- Playwright script structure / helper layout for driving the matrix
- Screenshot dimensions / device emulation for mobile cells
- How the dev Clerk sign-in is scripted (existing test user / email-password flow)
- Whether a discovered defect gets a minimal in-phase fix commit or a follow-up note (fix minimally, keep diff scoped)

## Deferred Ideas

- The 8 deferred v1.1 verification/uat gap items — v1.2 milestone close scope
- Any new UI polish the audit surfaces — follow-up phase or backlog
- Persona-side Arcpedia "Related Knowledge" seed-data gap — milestone close

---

*Phase: 14-contrast-audit-uat-matrix*
*Discussion log generated: 2026-08-01*
