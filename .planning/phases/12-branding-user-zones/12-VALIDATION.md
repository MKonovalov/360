---
phase: 12
slug: branding-user-zones
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-01
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Adapted from the inherited Phase 10/11 validation architecture (11-VALIDATION.md) — same Vitest infra, same grep-gate + build-gate pattern, consumer of Phase 10's shipped `--sidebar-*` token block and Phase 11's committed sidebar restyle.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.1.10` (already installed, `package.json`) |
| **Config file** | `vitest.config.ts` (exists — environment `node`, include `src/**/*.test.ts`, alias `@` → `./src`) |
| **Quick run command** | `npx vitest run src/lib/user.test.ts -x` (targeted — the BRND-02 nullability lock, if `user.ts` extraction is adopted) |
| **Full suite command** | `npm test` (= `vitest run`; Phase 11 verified clean across 23 files / 224 passed / 2 skipped) |
| **Estimated runtime** | ~3–5 seconds (existing suite + build type-check) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/lib/nav.test.ts --bail=1` (nav regression lock) + `npx tsc --noEmit` (type gate)
- **After every plan wave:** Run `npm test` (full suite must stay green) + `npm run build` (SSR build must pass)
- **Before `/gsd-verify-work`:** Full suite green, build green, sweep gates pass (`indigo`/`amber`/hex/`dark:` = 0 in `src/components/layout/`), fence gate clean
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | BRND-01 | T-12-01 / — | Wordmark "ArcLumen 360" (15px/600, `text-sidebar-foreground`) + org label "ArcLumen Partners" (12px/400, `text-sidebar-foreground/70`) in `SidebarHeader`; D1 copy verbatim; no new assets | source | grep `ArcLumen 360` / `ArcLumen Partners` / `text-[15px] font-semibold` / `text-sidebar-foreground/70` in `app-sidebar.tsx`; `npx tsc --noEmit` | app-sidebar.tsx ✅ | ⬜ pending |
| 12-01-02 | 01 | 1 | BRND-02 | T-12-02 | `useUser()` consumed with discriminated-union guard (`isLoaded`/`isSignedIn`); avatar (image if `hasImage` else initials circle) + display name; nullability locked by `user.ts` pure functions | unit + source | `npx vitest run src/lib/user.test.ts -x`; grep `useUser` + `hasImage` in `app-sidebar.tsx`; `npx tsc --noEmit` | user.ts + user.test.ts ❌ W0 (in-phase) | ⬜ pending |
| 12-01-03 | 01 | 1 | BRND-03 | T-12-03 | Feedback pill is an `<a>` with D2 static mailto constant, full-width, above user zone; copy "Give us feedback" verbatim | source | grep `mailto:hello@arclumenpartners.com?subject=360%20sidebar%20feedback` = 1; grep `Give us feedback` = 2 (visible span + aria-label, per Q3); `npx tsc --noEmit` | app-sidebar.tsx ✅ | ⬜ pending |
| 12-01-04 | 01 | 1 | BRND-04 | T-12-04 | Branding + user zones use sidebar tokens only; no hardcoded palette/hex/`dark:` classes; dormant collapsed-rail classes pre-wired (`group-data-[collapsible=icon]:`) | grep gate | `test -z "$(grep -rnE 'indigo|amber|#[0-9a-fA-F]{3,8}|\bdark:' src/components/layout/)"` → clean; fence gate on `sidebar.tsx`/`dropdown-menu.tsx`/`tooltip.tsx`/`globals.css`/`app-shell-layout.tsx`/`package.json`/`package-lock.json` | n/a (guardrail) | ⬜ pending |
| 12-02-01 | 02 | 2 | BRND-01..04 (regression) | T-12-01..04 | Full phase sweep: nav regression lock green (11/11), full suite green, build green, diff scope exactly `app-sidebar.tsx` + `src/lib/user.ts` + `src/lib/user.test.ts` | sweep + unit (regression) | `test -z "$(grep -rnE 'indigo|amber|#[0-9a-fA-F]{3,8}|\bdark:' src/components/layout/)"` → `sweep-clean`; `npm test`; `npx vitest run src/lib/nav.test.ts --bail=1`; `npm run build` | nav.test.ts ✅ (Phase 10) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/user.ts` — pure display-name/initials functions (extract per research Recommendation R2; mirrors `nav.ts` convention). Created in-phase by plan 12-01 Task 1.
- [ ] `src/lib/user.test.ts` — Vitest nullability lock (auto-discovered by `src/**/*.test.ts`). Created in-phase by plan 12-01 Task 1.
- [x] Framework install: **none needed** — vitest already installed and configured (Phase 11 verified: 224 passed / 2 skipped)
- [x] Shared fixtures: **none needed** — minimal structural user objects in the test file itself

*Existing infrastructure covers all phase requirements — the only Wave 0 additions are the two `src/lib/user.*` files created inside plan 12-01.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live-browser rendering of the branding + user zones (expanded) | BRND-01..04 | Visual/interaction fidelity — needs a browser, not a unit test | `npm run dev`, sign in, expand sidebar: verify wordmark + org label at top, feedback pill + avatar + display name at bottom |
| Avatar rendering (image vs initials fallback) | BRND-02 | Depends on live Clerk user profile data | Sign in as a user with and without an uploaded avatar image; verify image circle vs initials circle |
| User-menu dropdown (D4 app-theme portal) | BRND-02, D4 | Interaction + portal rendering — visual | Click the user zone trigger: verify dropdown renders light `bg-popover` over the panel with zero flash |
| Mobile sheet branding/user zones | BRND-04 | Responsive state — visual | Open the mobile sheet (narrow viewport): verify both zones theme correctly via `data-sidebar="sidebar"` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
