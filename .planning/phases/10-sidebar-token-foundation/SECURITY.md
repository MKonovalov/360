---
phase: 10
slug: sidebar-token-foundation
status: secured
threats_open: 0
asvs_level: 3
created: 2026-08-01
---

# SECURITY.md — Phase 10: Sidebar Token Foundation

**Audit date:** 2026-08-01
**Auditor:** gsd-security-auditor (adversarial mitigation verification)
**ASVS Level:** 3
**Verdict:** SECURED — 9/9 threats closed, 0 open, 0 unregistered flags
**Block-on:** high — no blockers

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-10-01 | Tampering | mitigate | CLOSED | `src/app/globals.css:86-96` — token block placed between `:root`(51) and `.dark`(108); all 8 hex values present exactly once (`--sidebar: #fbfcfd` … `--sidebar-ring: #787878`); phase diff is additions-only (0 removed lines — `git diff b23e9f11~1 HEAD -- src/app/globals.css` shows 22 added, 0 removed); global `--popover`/`--background`/`--ring`/`--border` at `:root` byte-identical |
| T-10-02 | Tampering | mitigate | CLOSED | `src/app/globals.css:100-103` (`[data-slot="sidebar-container"]`) and `:104-106` (`[data-sidebar="sidebar"] *`) — both companion rules unlayered (no `@layer` wrapper in diff; 0 added `@layer` lines); unlayered author CSS beats `@layer base * { @apply border-border outline-ring/50 }` per cascade; build exit 0 |
| T-10-03 | Integrity | mitigate | CLOSED | `git diff b23e9f11~1 HEAD -- src/components/ui/sidebar.tsx src/components/layout/app-sidebar.tsx src/components/layout/app-shell-layout.tsx src/components/layout/sidebar-resize-handle.tsx` = 0 lines; `package.json`/`package-lock.json` diff = 0 lines (zero new packages) |
| T-10-04 | Spoofing | accept | CLOSED | Accepted-risk rationale verified: all 8 tokens are hardcoded build-time hex literals (`globals.css:88-95`); no user input path, no `var(--user-input)`, no dynamic CSS generation anywhere in the phase. Documented in Accepted Risks log below (ASVS V8) |
| T-10-05 | Tampering | mitigate | CLOSED | `src/lib/nav.ts:9-14` — `===` exact match for `/`; boundary-guarded `startsWith('/companies/')`/`('/personas/')`/`('/reviews/')` (trailing slash prevents `/companies-archive` false-positive); explicit union allowlist `NavKey` (`nav.ts:6`); zero regex (`grep -cE "\.match\(|new RegExp"` = 0); 11-case suite (`nav.test.ts`, 11 `it` blocks) includes `/companies/123`→'companies' (highlight lock) and `/companies-archive`→null (boundary lock) |
| T-10-06 | DoS | mitigate | CLOSED | `src/lib/nav.ts` — total function: any string → fixed union or null, no throw paths, no try/catch, no regex (no ReDoS surface), linear-time string ops only; null path covers `/sign-in`, `''`, unknown; unit-tested |
| T-10-07 | Spoofing | mitigate | CLOSED | Nav key is route segment `'personas'`; `'key-personas'` count = 0 in both `nav.ts` and `nav.test.ts` (grep verified); why-comment at `nav.ts:1-4` documents the ROUTE-segment-not-label rule; test assertions use `'personas'` only |
| T-10-08 | Integrity | mitigate | CLOSED | Scope fence verified: `app-sidebar.tsx`, `sidebar.tsx`, `package.json`, `vitest.config.ts` all diff = 0 lines; phase diff (`b23e9f11~1..HEAD`) = exactly 3 files: `src/app/globals.css` (+22), `src/lib/nav.ts` (+15), `src/lib/nav.test.ts` (+48); function intentionally unwired (IN-01, per UI-SPEC line 178) |
| T-10-SC | Tampering | N/A | CLOSED | Zero packages installed this phase: `package.json`/`package-lock.json` diff = 0 lines; vitest `^4.1.10` pre-existing (ran 11/11 tests); no executor-initiated install occurred — no checkpoint trigger |

## Accepted Risks Log

| ID | Risk | Rationale | Accepted By |
|----|------|-----------|-------------|
| T-10-04 | CSS token values are static (no injection surface) | Values are committed build-time hex constants; no user input reaches the CSS block; no `var(--user-input)` paths exist (ASVS V8). Theming surface is fixed at build; runtime changes would require a source edit + redeploy, which is the intended governance boundary. | Phase plan (10-01-PLAN.md threat model) |

## Unregistered Flags

None. Neither `10-01-SUMMARY.md` nor `10-02-SUMMARY.md` contains a `## Threat Flags` section. The sole recorded deviation (`-x` → `--bail=1` CLI substitution in 10-02) is command-line-only, zero file delta, no new attack surface. No `unregistered_flag` findings.

## Advisory Findings (from 10-REVIEW.md) — disposition

Both WR-01 and WR-02 were judged by the verifier as non-blocking. This audit concurs: neither materially undermines any mitigate disposition in this register, because both concern the *functional fidelity* of already-present mitigations, not the absence of a declared control.

- **WR-01 (hairline `border-color` resolves `:root` value, not scoped `#e5e7eb`):** The declared T-10-02 mitigation (unlayered placement to beat `@layer base`) is present and effective — the `border-right-width: 0.5px` half demonstrably works. The `border-color` half resolves `:root`'s `--sidebar-border` (`oklch(0.922 0 0)` ≈#e9e9e9) because `data-slot="sidebar-container"` (sidebar.tsx:229) is the *ancestor* of the `data-sidebar="sidebar"` inner wrapper (sidebar.tsx:242) that carries the scoped block, and custom properties only inherit downward. **Security impact: none** — in light mode (the only mode Phase 10 ships), the resolved value is byte-identical to what `@layer base`'s `border-border` applies anyway, so no token misdirection, no contrast failure on a decorative 0.5px line. This is a PANE-01 visual-fidelity gap (tracked in 10-REVIEW.md with a fix for a future phase), not a security-control absence.
- **WR-02 (unlayered `[data-sidebar="sidebar"] *` outline rule traps future `outline-*` utilities):** The declared T-10-02 mitigation *requires* unlayered placement. The hazard is latent (all current sidebar focusables use `outline-hidden` + `focus-visible:ring-2`) and only materializes if a future phase introduces a non-ring outline color inside the sidebar. This is a forward maintainability risk for Phases 12/13, not current attack surface. Fix (relocate to `@layer components`) is a Phase 11+ concern and must keep `border-right-width` unlayered (per WR-01's own note).

## Notes

- Phase gate evidence: `npm run build` exit 0 (10-01 SUMMARY); `npm test` 224 passed, 0 failures (10-02 SUMMARY); targeted `nav.test.ts` run reports exactly 11 tests.
- The `getActiveNavKey` consumer swap is deferred to Phase 11 by design (UI-SPEC line 178); the function being unwired (IN-01) is a documented stub, not a security gap — the QLTY-01 lock is the test suite, which is wired.
- IN-02 (boundary-guard test coverage) and IN-03 (side-agnostic 0.5px width) are non-security coverage/robustness infos from code review; recommended follow-ups for Phase 11, not blockers.
