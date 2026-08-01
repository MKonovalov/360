---
phase: 14
slug: contrast-audit-uat-matrix
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-01
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Phase 14 adds the LIVE-BROWSER validation layer on top of the inherited Phases 10-13 grep/vitest/build gates — the v1.1 Phase-5 UAT matrix pattern, driven via the Playwright MCP skill against the dev server.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.1.10` (unit lock for the optional `contrast.ts` helper) + **Playwright MCP** (live-browser layer via `skill_mcp`, `mcp_name="playwright"`) |
| **Config file** | `vitest.config.ts` (exists — environment `node`, include `src/**/*.test.ts`, alias `@` → `./src`) |
| **Quick run command** | `npx vitest run src/lib/contrast.test.ts --bail=1` (targeted — the WCAG-math lock, if the helper is extracted) |
| **Full suite command** | `npm test` (= `vitest run`; Phase 13 verified clean across 25 files / 239 passed / 2 skipped) |
| **Live layer** | `npm run dev` → `http://localhost:3000`, driven via Playwright MCP `browser_*` tools; screenshots → `artifacts/` |
| **Estimated runtime** | live matrix ~10-20 min; unit + build gates ~3-5 min |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit` + the task's targeted gates (grep/fence for evidence tasks; the live cell batch just run for matrix tasks)
- **After every plan wave:** Run `npm test` (full suite must stay green) + fence gates (`git diff <base> HEAD -- <9 frozen files>` = empty) + sweep gate
- **Before `/gsd-verify-work`:** Full suite green, build green, sweep-clean, fence-clean, all 12 cells recorded in `14-UAT.md`, all artifacts committed
- **Max feedback latency:** ~10 seconds (unit/grep gates); live cells run as committed batches

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | QLTY-03 (SC #1 matrix) | T-14-01 | 12-cell live matrix: expanded/collapsed/mobile × 4 routes with per-route active-pill assertion (`data-active` on `[data-sidebar="menu-button"]`) + screenshot to artifacts/ | live-browser | Playwright MCP per-cell: navigate → assert `data-active` → screenshot → `artifacts/cell-{state}-{route}.png`; all 12 cells recorded in 14-UAT.md | target files ✅ (README-only) | ⬜ pending |
| 14-01-02 | 01 | 1 | QLTY-03 (SC #1 interactions) | T-14-01 | Interaction micro-tests: collapse/expand via header button + ⌘B, drag-resize 200-400 clamp + `sidebar_width` cookie, rail tooltips incl `Reviews (N)`, badge/dot gating (fixture or two-branch) | live-browser | Playwright MCP sequences; `browser_press_key("Meta+b")`; `browser_drag` handle; hover rail icons → tooltip text; fixture insert + cleanup (SHA-256 dev-DB check per 08-06-UAT precedent) | target files ✅ | ⬜ pending |
| 14-01-03 | 01 | 1 | QLTY-03 (SC #2 contrast) | T-14-02 | Live computed-style contrast audit of all 6 shipped token pairs (alpha compositing for the /70 label) — each ratio ≥ its AA threshold | live + unit (if helper) | `browser_evaluate` getComputedStyle sampling (Pattern 2); optional `npx vitest run src/lib/contrast.test.ts --bail=1`; results → 14-VERIFICATION.md | globals.css ✅ | ⬜ pending |
| 14-01-04 | 01 | 1 | QLTY-03 (SC #3 Exa) | T-14-03 | Exa divergence review: live dashboard.exa.ai fetch (real-browser attempt; FEATURES.md fallback documented) + element-wise pass/fail + deliberate-divergences list | live-browser + doc | Playwright MCP navigate to dashboard.exa.ai (fallback: FEATURES.md values, dated); element-wise compare; divergence list → 14-VERIFICATION.md | FEATURES.md ✅ | ⬜ pending |
| 14-02-01 | 02 | 2 | QLTY-03 (SC #4 regression) | T-14-04 | Hard-constraint regression: routes unchanged, drag-resize + cookies, ⌘B, `pendingCount` gating — live + grep/fence/build evidence | live + grep + fence + build | live rows; `test -z "$(grep -rnE 'indigo\|amber\|#[0-9a-fA-F]{3,8}\|\bdark:' src/components/layout/)"` → `sweep-clean`; `git diff <base> HEAD -- <9 frozen files>` = empty; `npm test`; `npm run build`; `npx tsc --noEmit` | nav/contrast tests ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `artifacts/` directory created under `.planning/phases/14-contrast-audit-uat-matrix/` — screenshots need it before any cell runs
- [ ] Clerk dev test-user credential resolution (checkpoint:human-verify or operator-provided session) — the driver cannot sign in without it
- [ ] Pending-proposal fixture decision (seed script + cleanup, or assert the count=0 branch only)
- [ ] `src/lib/contrast.ts` + `src/lib/contrast.test.ts` — ONLY if the pure WCAG-math helper is extracted (Open Question 3)

*Framework install: none needed — Vitest + Playwright MCP both already available.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Clerk dev sign-in | Matrix entry | The dev credentials live in the operator's Clerk dashboard, not the repo | Operator provides test-user credentials or establishes a session the driver reuses |
| If the live Exa fetch is 429-challenge-gated in the real browser too | SC #3 | Browser challenge may still need human interaction | Operator either completes the challenge manually or accepts the dated FEATURES.md fallback |

*All matrix cells, contrast pairs, and regression checks are automated via Playwright MCP; the two items above are the only human-touch points.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s (unit/grep); live cells batch-verified
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
