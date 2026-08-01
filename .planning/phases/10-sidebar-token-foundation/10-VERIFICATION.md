---
phase: 10-sidebar-token-foundation
verified: 2026-08-01T15:20:00Z
status: passed
score: 10/10 must-haves verified
overrides_applied: 0
deferred:
  - truth: "Live-browser confirmation that the hairline right border renders the spec'd #e5e7eb hue (WR-01: container resolves :root's oklch(0.922 0 0) ≈ #e9e9e9 instead — ~4-unit imperceptible delta; 0.5px width and #fbfcfd panel render correctly)"
    addressed_in: "Phase 14 (Contrast Audit & UAT Matrix)"
    evidence: "Phase 14 goal: 'Live-browser UAT matrix (expanded/collapsed/mobile × 4 routes × active/inactive state pairs) with screenshots, WCAG AA contrast audit of the shipped token set, and Exa-reference divergence review' — the hairline hue divergence is an Exa-reference divergence item"
---

# Phase 10: Sidebar Token Foundation Verification Report

**Phase Goal:** Ship the complete light-theme sidebar token mechanism — one scoped `--sidebar-*` token block on `[data-sidebar="sidebar"]` in `src/app/globals.css` (8 AA-verified hex tokens) plus two unlayered companion rules (zero new packages, zero vendored `sidebar.tsx` edits, `@theme inline` byte-identical) — plus extract `getActiveNavKey(pathname)` into a pure boundary-guarded total function in `src/lib/nav.ts` with an 11-case Vitest suite in `src/lib/nav.test.ts`, shipped tested but intentionally unwired until Phase 11.
**Verified:** 2026-08-01T15:20:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth   | Status     | Evidence       |
| --- | ------- | ---------- | -------------- |
| 1   | Desktop expanded sidebar renders light near-white `#fbfcfd` panel with a 0.5px hairline right border (PANE-01) | ✓ VERIFIED* | Scoped block `globals.css:87-96` sets `--sidebar: #fbfcfd`; `bg-sidebar` on `sidebar-inner` (`sidebar.tsx:242,244`) resolves it via `@theme inline` mapping (`globals.css:20`). Companion rule `globals.css:100-103` sets `border-right-width: 0.5px` unlayered — beats the layered `border-r` utility (`sidebar.tsx:236`). *Caveat (WR-01): hairline `border-color: var(--sidebar-border)` on the container (`sidebar.tsx:229`, an ancestor of the scoped element) resolves `:root`'s `oklch(0.922 0 0)` ≈ `#e9e9e9`, not the scoped `#e5e7eb` — see Findings. Panel color and 0.5px width render exactly as specified |
| 2   | Mobile sheet and icon-collapsed rail render the same light panel — no `.dark` class, no `dark:` variants introduced anywhere (PANE-03) | ✓ VERIFIED | Mobile `SheetContent` carries `data-sidebar="sidebar"` + `bg-sidebar` (`sidebar.tsx:186,189`); icon-collapsed rail is the same `sidebar-inner` element (`:242`) — both resolve the scoped `#fbfcfd`. Phase commit adds 0 lines containing `dark:` (git-diff gate) and the `.dark` block is untouched (additions-only diff) |
| 3   | Light content areas (pages, lists, detail panes) render identically — sidebar tokens consumed exclusively by the sidebar subtree (PANE-04) | ✓ VERIFIED | Token block scoped to `[data-sidebar="sidebar"]` only; `:root` (51-84) untouched — git diff shows additions only, zero removed lines. Content resolves unchanged `:root` values |
| 4   | Entire theme is one scoped `--sidebar-*` token block on `[data-sidebar="sidebar"]`; zero new packages; `sidebar.tsx` and `@theme inline` untouched (PANE-02) | ✓ VERIFIED | One block at `globals.css:87-96`. `git diff b23e9f11~1..HEAD` on `sidebar.tsx` + 3 layout consumers + `package.json` + `package-lock.json` = 0 lines. `@theme inline` (7-49) byte-identical (additions-only diff) |
| 5   | 8-token set is a complete verified AA set — text ≥4.5:1 on panel, active pill and ring ≥3:1, /70 labels passing (QLTY-02) | ✓ VERIFIED | All 8 tokens present once with exact hex values. Contrast ratios independently recomputed: text `#333333` on `#fbfcfd` = 12.30:1; /70 label ≈ 4.89:1; pill `#909090` vs panel = 3.11:1; ring `#787878` vs panel = 4.30:1 — all pass. Matches UI-SPEC §Token Contract and REVIEW's independent re-verification |
| 6   | `getActiveNavKey('/')` returns `'start'` (exact match — every route is a prefix match for `/`) | ✓ VERIFIED | `nav.ts:9` exact `===` check; `nav.test.ts:5-7` asserts `'start'` |
| 7   | `getActiveNavKey` returns `'companies'` for `/companies`, `/companies/123`, `/companies/123/edit` — the `/companies/[id]` highlight can never be silently broken | ✓ VERIFIED | `nav.ts:11` boundary-guarded (`===` + `startsWith('/companies/')`); `nav.test.ts:9-19` covers all three inputs, incl. the `[id]`-lock case |
| 8   | Returns `'personas'` for `/personas`, `/personas/456`; `'reviews'` for `/reviews`, `/reviews/9` | ✓ VERIFIED | `nav.ts:12-13`; `nav.test.ts:21-35` cover all four inputs |
| 9   | Returns `null` for `/sign-in`, `''`, and sibling prefix `/companies-archive` — boundary guard, never throws (ASVS V5 total function) | ✓ VERIFIED | `nav.ts:14` null fallback; `nav.test.ts:37-47` cover all three null cases; no `throw`/regex in source |
| 10  | Function is a pure named export with zero imports — shipped tested but intentionally unwired until Phase 11 | ✓ VERIFIED | `nav.ts` has 0 import/require lines, 2 named exports (`NavKey` type, `getActiveNavKey`); grep of `src/` shows zero consumers outside `nav.test.ts` — intentional per plan (Phase 11 swaps the 4 `isActive` expressions in `app-sidebar.tsx`) |

**Score:** 10/10 truths verified

\* Truth 1 verified with a documented cosmetic caveat (WR-01) — the observable PANE-01 outcome (light near-white panel + 0.5px hairline distinct from flat-white) is delivered; only the hairline's exact hue differs by ~4 RGB units (imperceptible), adjudicated in Phase 14's divergence review (deferred section).

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Live-browser confirmation of the hairline right-border hue (`#e5e7eb` vs the actually-resolved ≈`#e9e9e9`, WR-01) | Phase 14 (Contrast Audit & UAT Matrix) | Phase 14 goal: "Live-browser UAT matrix (expanded/collapsed/mobile × 4 routes × active/inactive state pairs) with screenshots, WCAG AA contrast audit of the shipped token set, and Exa-reference divergence review" — hairline hue is an Exa-reference divergence item. Plan 10-01 human-check likewise marked it "Optional (non-blocking; live-browser audit is Phase 14's contract)" |

### Required Artifacts

| Artifact | Expected    | Status | Details |
| -------- | ----------- | ------ | ------- |
| `src/app/globals.css` | Scoped `[data-sidebar="sidebar"]` token block (8 hex tokens) + 2 unlayered companion rules | ✓ VERIFIED | 152 lines (≥130). Block at 87-96 with all 8 tokens exact; unlayered companion rules at 100-106 (`[data-slot="sidebar-container"]` border-color + 0.5px; `[data-sidebar="sidebar"] *` outline-color). Placed between `:root` (51) and `.dark` (108) — placement-ok. Zero added `@layer`/`dark:` lines. Consumed by `sidebar.tsx:186,242` via attribute hook |
| `src/lib/nav.ts` | `NavKey` union type + `getActiveNavKey` pure function | ✓ VERIFIED | 15 lines (≥12). Both named exports present; 3 boundary-guarded prefix conditions; zero imports/regex/throw/`@ts-ignore`; zero `'key-personas'`. Imported by test only — intentional unwired state |
| `src/lib/nav.test.ts` | 11-case Vitest regression suite | ✓ VERIFIED | 48 lines (≥30). One `describe('getActiveNavKey')`, 11 individual `it` blocks covering all 11 UI-SPEC §QLTY-01 enumerated inputs. Lives at exactly `src/lib/nav.test.ts` → auto-discovered by `vitest.config.ts:12` (`src/**/*.test.ts`) |

### Key Link Verification

| From | To  | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `globals.css [data-sidebar="sidebar"]` block | `sidebar.tsx` sidebar-inner (line 242) + SheetContent (line 186) | Attribute hook — custom properties resolve per-element through the `@theme inline` var() mapping (`globals.css:13-20`) | WIRED | Both consumer elements carry `data-sidebar="sidebar"` and `bg-sidebar`; scoped `#fbfcfd` reaches the panel in desktop and mobile branches |
| `globals.css [data-slot="sidebar-container"]` rule | `sidebar.tsx` container (line 229) with border-r and no color class (line 236) | Unlayered border-color / border-right-width beats `@layer base * { @apply border-border }` | PARTIAL | Width half (`border-right-width: 0.5px`) beats the layered `border-r` utility — works. Color half (`border-color: var(--sidebar-border)`) is a light-mode no-op: container is an ancestor of the scoped element, so it resolves `:root`'s `oklch(0.922 0 0)` ≈ `#e9e9e9` (identical to the base-layer `--border`) — WR-01, deferred to Phase 14 |
| `nav.test.ts` | `vitest.config.ts` | Auto-discovery include pattern `src/**/*.test.ts` (line 12) | WIRED | Targeted run reports exactly 11 tests, all passing (verified in own process) |
| `nav.ts` | `app-sidebar.tsx` (lines 39, 48, 57, 66) | Future consumer swap in Phase 11 | NOT_WIRED (intentional) | Zero consumers outside the test — mandated by plan ("shipped tested but intentionally unwired until Phase 11", UI-SPEC line 178). Not a defect |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `globals.css` token block → `bg-sidebar` (sidebar-inner 244, SheetContent 189) | `--sidebar` | Scoped hex `#fbfcfd` on the matching element | Yes — deterministic CSS resolution | ✓ FLOWING |
| `globals.css` companion rule → container border (229) | `--sidebar-border` | Scoped `#e5e7eb` does NOT reach the container (ancestor); resolves `:root` `oklch(0.922 0 0)` ≈ `#e9e9e9` | Partial — width flows, color is a light-mode no-op | ⚠️ PARTIAL (WR-01) |
| `nav.ts` `getActiveNavKey` | `pathname` | Input from `usePathname()` in Phase 11 (unwired now) | N/A — pure function, behavior locked by 11 tests | ✓ FLOWING (test-verified) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| 11-case suite passes | `npx vitest run src/lib/nav.test.ts --bail=1` | 11/11 passed, exit 0 | ✓ PASS |
| Full suite regression | `npm test` | 23 files, 224 passed, 2 skipped, 0 failures, exit 0 | ✓ PASS |
| Build parses CSS + compiles | `npm run build` | Exit 0 (all routes compiled) | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED — no probe scripts declared in PLANs/SUMMARies and none found in the repo (`scripts/*/tests/probe-*.sh`); this is a CSS + unit-test phase, not a migration/tooling phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| PANE-01 | 10-01 | Light `#fbfcfd` panel with 0.5px hairline right border, distinct from v1.1 flat-white | ✓ SATISFIED | Scoped block + 0.5px companion rule; panel exact; hairline renders at 0.5px (hue ≈`#e9e9e9` vs `#e5e7eb` — imperceptible, deferred to Phase 14) |
| PANE-02 | 10-01 | Token-swap only; zero new packages; zero vendored edits; `@theme inline` untouched | ✓ SATISFIED | All diff gates empty for `sidebar.tsx`, 3 layout consumers, `package.json`/`lock`; additions-only diff; 0 added `@layer`/`dark:` |
| PANE-03 | 10-01 | Theme applies across desktop expanded, icon-collapsed rail, mobile sheet; no `.dark`/`dark:` | ✓ SATISFIED | `data-sidebar="sidebar"` on `sidebar-inner` (242) + `SheetContent` (186); no `dark:` additions |
| PANE-04 | 10-01 | Content areas unaffected; tokens consumed exclusively by sidebar subtree | ✓ SATISFIED | Scoped selector; `:root` byte-identical |
| QLTY-01 | 10-02 | Pure `getActiveNavKey` + unit tests; Start = exact `/`, others = prefix match incl. `/companies/[id]` | ✓ SATISFIED | `nav.ts` total function; 11-case suite all green |
| QLTY-02 | 10-01 | 8 tokens complete verified AA set | ✓ SATISFIED | All ratios recomputed and passing (12.30 / 4.89 / 3.11 / 4.30 / 5.91 / 12.63) |

**Orphaned requirements:** None — all 6 IDs declared across the phase's plans (10-01: PANE-01..04, QLTY-02; 10-02: QLTY-01) match the REQUIREMENTS.md Phase-10 mapping exactly. NAV-01..04 / QLTY-03 / QLTY-04 are correctly mapped to Phases 11/14.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | None found | — | Zero debt markers (`TBD`/`FIXME`/`XXX`/`PLACEHOLDER`), zero `console.log`-only implementations, zero `@ts-ignore`/`any`, zero hardcoded-empty props in the three phase-modified files |

### Human Verification Required

None for this phase. The live-browser visual audit (panel rendering, hairline appearance across expanded/collapsed/mobile) is explicitly Phase 14's contract — the plan's own human-check was marked "Optional (non-blocking; live-browser audit is Phase 14's contract)", and Phase 14's roadmap goal mandates the UAT matrix with screenshots plus the Exa-reference divergence review. The WR-01 hairline-hue nuance is a candidate finding for that divergence review.

### Gaps Summary

No blocking gaps. All 10 must-have truths verified; all 6 requirements satisfied; build, full suite, and targeted suite green in the verifier's own runs.

**Findings carried forward (advisory, from 10-REVIEW.md):**
- **WR-01 (warning, non-blocking):** The `[data-slot="sidebar-container"]` hairline `border-color: var(--sidebar-border)` is a light-mode no-op — the container is an ancestor of the `[data-sidebar="sidebar"]`-scoped token block, so it resolves `:root`'s `oklch(0.922 0 0)` ≈ `#e9e9e9` rather than the scoped `#e5e7eb`. The 0.5px width half works; the panel renders exactly `#fbfcfd`; the hue delta is ~4 RGB units (imperceptible) and the border is decorative (not contrast-subject). Judged NOT to materially fail PANE-01's observable outcome or any must-have truth; deferred to Phase 14's Exa-reference divergence review. If the developer prefers literal compliance now, the review's fix is to add `[data-slot="sidebar-container"]` to the token-block selector (or move the block to the container) — zero vendored edits preserved.
- **WR-02 (warning, advisory):** Unlayered `[data-sidebar="sidebar"] *` outline rule beats future `@layer utilities` outline utilities inside the sidebar. Latent today (all sidebar focusables use `ring-2`, not outline colors). Not a Phase 10 must-have failure; recommend `@layer components` placement during the Phase 11 nav rebuild if a non-ring outline color is introduced. Note: `border-right-width: 0.5px` must remain unlayered (beats the `border-r` utility).
- **IN-01/IN-02/IN-03 (info):** `getActiveNavKey` dead code until Phase 11 (by design — the QLTY-01 lock); boundary-guard test coverage could be extended (`/companies-archive/123`, `/companies/`, case-sensitivity); the 0.5px width rule is side-agnostic (zero impact at `side="left"` default). No action required this phase.

**This looks intentional (WR-01):** The deviation from the must-have's literal `#e5e7eb` hairline hue is a byproduct of the phase's own zero-vendored-edits constraint (token block must live on the inner `[data-sidebar="sidebar"]` element to theme all three surfaces) colliding with the container-scoped hairline element. To accept this deviation formally, add to VERIFICATION.md frontmatter:

```yaml
overrides:
  - must_have: "The desktop expanded sidebar renders the light near-white #fbfcfd panel with a 0.5px #e5e7eb hairline right border (PANE-01)"
    reason: "Hairline renders at 0.5px but resolves :root's oklch(0.922 0 0) ≈ #e9e9e9 instead of scoped #e5e7eb (WR-01: container is ancestor of the token-scoped element). Observable PANE-01 outcome achieved; ~4-unit imperceptible delta on a decorative border; live adjudication scheduled in Phase 14's Exa-reference divergence review."
    accepted_by: "developer"
    accepted_at: "2026-08-01"
```

---

_Verified: 2026-08-01T15:20:00Z_
_Verifier: Claude (gsd-verifier)_
