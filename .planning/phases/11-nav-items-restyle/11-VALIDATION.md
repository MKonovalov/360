---
phase: 11
slug: nav-items-restyle
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-01
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Adapted from the inherited Phase 10 validation architecture (10-RESEARCH.md §Validation Architecture) — same test infra, same repo, consumer of Phase 10's shipped `getActiveNavKey`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.1.10` (already installed, `package.json:54`) |
| **Config file** | `vitest.config.ts` (exists — environment `node`, include `src/**/*.test.ts`, alias `@` → `./src`) |
| **Quick run command** | `npx vitest run src/lib/nav.test.ts --bail=1` (targeted — the Phase 10 regression lock: `/companies/[id]` highlight must survive the restyle) |
| **Full suite command** | `npm test` (= `vitest run`; Phase 10 verified clean across 23 files / 224 passed) |
| **Estimated runtime** | ~3–5 seconds (existing suite + build type-check) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/lib/nav.test.ts --bail=1` (nav regression lock) + `npx tsc --noEmit` (type gate)
- **After every plan wave:** Run `npm test` (full suite must stay green) + `npm run build` (SSR build must pass)
- **Before `/gsd-verify-work`:** Full suite green, build green, indigo/amber sweep gates pass (grep = 0)
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | NAV-01 | T-11-01 | 4 routes unchanged, no new routes; `SidebarGroupLabel` Explore/Manage groups; lucide icons added | source | `grep` group labels + hrefs + icon imports in `app-sidebar.tsx`; `npx tsc --noEmit` | app-sidebar.tsx ✅ | ⬜ pending |
| 11-01-02 | 01 | 1 | NAV-02, NAV-03 | T-11-01 | 30px rows (`h-[30px]`), 16px lucide icons, 15px/400 labels, 10px gap (`gap-2.5`), 8px padding (`p-0 px-2`); active fill via primitive `data-active:bg-sidebar-accent` — indigo overrides deleted; `getActiveNavKey` consumed | source + unit | class grep in `app-sidebar.tsx` (`h-\[30px\]`/`gap-2.5`/`text-\[15px\]`/`p-0 px-2` = 4 each; `indigo` = 0; `pathname.startsWith` = 0); `npx vitest run src/lib/nav.test.ts --bail=1`; `npx tsc --noEmit` | app-sidebar.tsx ✅ | ⬜ pending |
| 11-01-03 | 01 | 1 | NAV-04 | T-11-01 | badge = mono 10px/600 accent chip (`bg-sidebar-accent text-sidebar-accent-foreground font-mono text-[10px] font-semibold`), `"{n} pending"` + aria-label, right-aligned; collapsed-rail dot (`group-data-[collapsible=icon]:block`); count gating unchanged | source + unit | class/copy grep in `app-sidebar.tsx` (`amber` = 0; `bg-sidebar-accent` = 2; `pending reviews` = 1); `npx vitest run src/lib/nav.test.ts --bail=1`; `npx tsc --noEmit` | app-sidebar.tsx ✅ | ⬜ pending |
| 11-02-01 | 02 | 2 | QLTY-04 | T-11-04, T-11-05 | resize-handle indigo hover → `hover:bg-foreground/10` (token-derived; handle is outside the sidebar subtree); `border-r` → `border-sidebar-border` companion rule verified in place (no redo) | source + grep gate | `grep -c "indigo" src/components/layout/sidebar-resize-handle.tsx` = 0; `grep -c "border-color: var(--sidebar-border)" src/app/globals.css` = 1; `grep "border-r" src/components/ui/sidebar.tsx | grep -c "border-sidebar-border"` = 0; `npx tsc --noEmit` | sidebar-resize-handle.tsx ✅ | ⬜ pending |
| 11-02-02 | 02 | 2 | QLTY-04 (+NAV-01..04, QLTY-01 exercised) | T-11-04 | full sweep gate clean repo-wide in sidebar subtree; `/companies/[id]` highlight persists (nav.ts consumption); full suite + build green; scope fence | sweep gate + unit (regression) | `test -z "$(grep -rn "indigo\|amber" src/components/layout/)"` → `sweep-clean`; `npm test`; `npx vitest run src/lib/nav.test.ts --bail=1`; `npm run build` | nav.test.ts ✅ (Phase 10) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/lib/nav.test.ts` — **exists** (shipped Phase 10, 11 cases) — the regression lock for the active-route restyle; no new test file needed unless the restyle touches `nav.ts` (it must not — Phase 10 froze the contract)
- [x] Framework install: **none needed** — vitest already installed and configured (Phase 10 verified: 224 passed / 2 skipped)
- [x] Shared fixtures: **none needed** — UI-restyle phase, no new data fixtures

*Existing infrastructure covers all phase requirements — no Wave 0 gaps.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live-browser rendering of the restyled sidebar (expanded) | NAV-01..04 | Visual/interaction fidelity — needs a browser, not a unit test | `npm run dev`, sign in, expand sidebar: verify Explore/Manage groups, 30px rows, gray active fill on each route, badge chip on Reviews |
| Collapsed-rail dot + tooltip behavior | NAV-04 | Collapsed-state interaction — visual | Collapse the sidebar (⌘B / collapse button if present): Reviews shows dot; tooltip includes pending count |
| Active-fill AA contrast in the live app | NAV-03, QLTY-02 | WCAG live audit — deferred to Phase 14 by plan contract | Phase 14 live contrast audit covers the shipped token set; Phase 11 verifies the classes consume `--sidebar-accent` (not hardcoded rgba) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (none — infra exists)
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
