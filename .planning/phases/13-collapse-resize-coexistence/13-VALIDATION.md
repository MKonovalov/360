---
phase: 13
slug: collapse-resize-coexistence
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-01
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Adapted from the inherited Phase 10-12 validation architecture (12-VALIDATION.md) — same Vitest infra, same grep-gate + fence-gate + build-gate pattern, consumer of Phase 11-12's pre-wired dormant collapsed-rail classes and the frozen drag-resize/cookie contract.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.1.10` (already installed, `package.json`) |
| **Config file** | `vitest.config.ts` (exists — environment `node`, include `src/**/*.test.ts`, alias `@` → `./src`) |
| **Quick run command** | `npx vitest run src/lib/sidebar-collapse.test.ts --bail=1` (targeted — the D-08 copy lock, if the pure helper is extracted) |
| **Full suite command** | `npm test` (= `vitest run`; Phase 12 verified clean across 24 files / 232 passed / 2 skipped) |
| **Estimated runtime** | ~3–5 seconds (existing suite + build type-check) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/lib/nav.test.ts --bail=1` (nav regression lock) + `npx vitest run src/lib/user.test.ts --bail=1` (user-zone lock) + `npx tsc --noEmit` (type gate)
- **After every plan wave:** Run `npm test` (full suite must stay green) + `npm run build` (SSR build must pass)
- **Before `/gsd-verify-work`:** Full suite green, build green, sweep gates pass (`indigo`/`amber`/hex/`dark:` = 0 in `src/components/layout/`), fence gate clean
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | COLR-01 | T-13-01 / — | `collapsible="icon"` wired on the single `<Sidebar>` instantiation (app-sidebar.tsx); the 4 nav `SidebarMenuButton`s carry `tooltip=` (D-07/D-08 copy); Reviews tooltip `Reviews (N)` when `pendingCount > 0` else `Reviews` | source + grep | `grep -c 'collapsible="icon"' src/components/layout/app-sidebar.tsx` = 1; `grep -c 'tooltip=' src/components/layout/app-sidebar.tsx` ≥ 5; `npx tsc --noEmit` | app-sidebar.tsx ✅ | ⬜ pending |
| 13-01-02 | 01 | 1 | COLR-01, COLR-03 | T-13-02 | Collapse button in SidebarHeader: `PanelLeftClose`/`PanelLeftOpen` swap by `useSidebar()` state, `size="icon"` 32px, always visible (no rail self-hide), `aria-label` Collapse/Expand sidebar, manual `<Tooltip>` pair (Collapse/Expand copy) | source + grep | `grep -cE 'PanelLeft(Close\|Open)' src/components/layout/app-sidebar.tsx` ≥ 1 each; `grep -c 'useSidebar' src/components/layout/app-sidebar.tsx` ≥ 1; `npx tsc --noEmit` | app-sidebar.tsx ✅ | ⬜ pending |
| 13-01-03 | 01 | 1 | COLR-03 | T-13-03 | Letter-mark (D-11) in the header slot: 28px `size-7` `rounded-md` `bg-sidebar-primary text-sidebar-primary-foreground`, white "A", `text-[13px] font-semibold`, `hidden group-data-[collapsible=icon]:flex`; Q4 wordmark fade class verbatim; `TooltipProvider delayDuration={200}` mounted (D-09) | source + grep | `grep -c 'bg-sidebar-primary text-sidebar-primary-foreground' src/components/layout/app-sidebar.tsx` ≥ 1; `grep -c 'group-data-\[collapsible=icon\]:flex' src/components/layout/app-sidebar.tsx` ≥ 1; `grep -c 'delayDuration' src/components/layout/app-sidebar.tsx` = 1; `npx tsc --noEmit` | app-sidebar.tsx ✅ | ⬜ pending |
| 13-01-04 | 01 | 1 | COLR-02 | T-13-04 | Resize-handle hides when collapsed: `useSidebar()` early return `if (state === 'collapsed') return null;` — 200-400 clamp, `sidebar_width` cookie, MIN/MAX constants untouched | source + fence | `grep -c 'collapsed' src/components/layout/sidebar-resize-handle.tsx` ≥ 1; `git diff <base> HEAD -- src/components/layout/sidebar-resize-handle.tsx` shows ONLY the hide lines (no clamp/cookie changes); `npx tsc --noEmit` | sidebar-resize-handle.tsx ✅ | ⬜ pending |
| 13-02-01 | 02 | 2 | COLR-01..03 (regression) | T-13-01..04 | Full phase regression: rail activates end-to-end (all dormant classes live), ⌘B + sidebar_state cookie + drag-resize byte-identical, sweep + fence + full suite + build green | sweep + fence + unit | `test -z "$(grep -rnE 'indigo|amber|#[0-9a-fA-F]{3,8}|\bdark:' src/components/layout/)"` → `sweep-clean`; `git diff <base> HEAD -- src/components/ui/sidebar.tsx src/components/ui/tooltip.tsx src/components/ui/dropdown-menu.tsx src/components/ui/button.tsx src/app/globals.css src/app/(dashboard)/layout.tsx src/components/layout/app-shell-layout.tsx package.json package-lock.json` = empty; `npm test`; `npx vitest run src/lib/nav.test.ts --bail=1` (11/11); `npm run build` | nav.test.ts ✅ (Phase 10) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/sidebar-collapse.ts` + `src/lib/sidebar-collapse.test.ts` — ONLY if the pure tooltip-label helper is extracted (research Recommendation Q2; mirrors `nav.ts`/`user.ts` convention). If the planner inlines the ternaries, no Wave 0 gap.
- [x] Framework install: **none needed** — vitest already installed and configured (Phase 12 verified: 232 passed / 2 skipped)
- [x] Shared fixtures: **none needed** — minimal structural objects in the test file itself

*Existing infrastructure covers all phase requirements — the only possible Wave 0 addition is the optional `sidebar-collapse.*` pair created inside plan 13-01.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live-browser collapse animation (expanded → 48px rail, labels fade, icons stay) | COLR-01 | Visual/interaction fidelity — needs a browser, not a unit test | `npm run dev`, sign in, click the header collapse button: verify width animation, label fade, icon retention |
| Collapse ↔ resize coexistence (drag in expanded, collapse, re-expand restores width) | COLR-02 | Interaction — needs real pointer/cookie behavior | Drag to 320px, collapse (⌘B or button), re-expand: verify 320px restored; verify ⌘B still works from topbar |
| Rail tooltips (hover + focus, right side, ~200ms) | COLR-03 | Interaction + timing — visual | Collapse the rail, hover/focus each icon: verify tooltips incl. `Reviews (N)` count |
| Collapsed header anatomy (button + letter-mark) | COLR-03 | Visual fidelity | Collapse: verify 32px button top-right + 28px letter-mark centered below, no overlap |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
