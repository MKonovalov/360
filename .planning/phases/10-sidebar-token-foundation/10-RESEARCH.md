# Phase 10: Sidebar Token Foundation — Research

**Researched:** 2026-08-01
**Domain:** shadcn sidebar token theming (Tailwind v4 CSS custom properties) + pure-function active-route detection with Vitest
**Confidence:** HIGH (every mechanism verified against the actual repo files in this session; all contrast ratios independently recomputed)

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PANE-01 | Light `#fbfcfd` panel + 0.5px hairline, distinct from v1.1 flat white | Token block verified against `globals.css` structure + vendored `sidebar.tsx` border mechanics; companion rules target `[data-slot="sidebar-container"]` (desktop-only, `border-r` with no color class at `sidebar.tsx:236`) |
| PANE-02 | Token-swap only: zero new packages, zero `sidebar.tsx` edits, `@theme inline` untouched | All three verified: zero installs needed (vitest already present), `@theme inline` (globals.css:7-49) byte-identical, `sidebar.tsx` untouchable — `[data-sidebar="sidebar"]` hook requires no primitive edit |
| PANE-03 | Theme applies to expanded + icon-collapsed rail + mobile sheet, no `.dark`/`dark:` | `data-sidebar="sidebar"` appears on exactly 2 elements: mobile `SheetContent` (`sidebar.tsx:186`) and desktop `sidebar-inner` (`sidebar.tsx:242`), both `bg-sidebar`; one scoped block covers all three states; `.dark` block is dead code (verified) |
| PANE-04 | Light content area unaffected; sidebar tokens consumed only by sidebar subtree | Custom-property scoping on the attribute hook; `@theme inline` maps `--color-sidebar: var(--sidebar)` so utilities emit `var()` resolved per-element; content uses `--background`/`--popover`/`--accent` from `:root` (verified in `globals.css`) |
| QLTY-01 | Pure `getActiveNavKey(pathname)` + unit tests; Start = exact `/`, others = prefix | Extraction surface fully mapped (`app-sidebar.tsx:39,48,57,66`); boundary-guard shape per approved UI-SPEC §QLTY-01; Vitest 4.1.10 already installed + configured — zero new deps; 11 test inputs enumerated |
| QLTY-02 | 8 `--sidebar-*` tokens as complete verified AA set | All 14 UI-SPEC contrast claims **independently recomputed and confirmed** in this session (12.30 / 4.89 / 12.63 / 3.11 / 5.91 / 18.38 / 4.30 — full table below) |
</phase_requirements>

---

## Summary

Phase 10 is a two-part deliverable with a razor-thin footprint: (1) one scoped light-theme `--sidebar-*` token block plus two companion rules in `src/app/globals.css`, and (2) a new pure function `src/lib/nav.ts` with Vitest tests `src/lib/nav.test.ts`. Nothing else changes. The token mechanism is fully verified against the live repo: the vendored `sidebar.tsx` carries `data-sidebar="sidebar"` on exactly the two elements that render the panel — the desktop `sidebar-inner` (`sidebar.tsx:242`) and the mobile `SheetContent` (`sidebar.tsx:186`) — so a single scoped CSS block themes expanded, icon-collapsed, and mobile-sheet states with zero primitive edits. The load-bearing `@theme inline` block (globals.css:7-49) maps `--color-sidebar: var(--sidebar)` etc., so Tailwind utilities emit `var(--sidebar-*)` inline and resolve the scoped values at runtime.

Two research hypotheses from the task brief were **corrected by the codebase**: (a) the first token is `--sidebar` (not `--sidebar-background` — shadcn's contract, `globals.css:76`), and (b) the nav key is `'personas'` (not `'key-personas'` — the route is `/personas` and the approved UI-SPEC contract uses `'personas'`). The "one permitted new devDependency" question resolves to **zero**: `vitest@^4.1.10` is already in `package.json` devDependencies with a working `vitest.config.ts` (verified: `npm test` runs 16 tests in 155ms). Every contrast ratio in the UI-SPEC was independently recomputed and matches exactly (including the four Exa-reference failures that justify the divergences).

**Primary recommendation:** implement exactly the UI-SPEC token block (hex values, unlayered CSS, inserted after the `:root` block at line 84), ship `getActiveNavKey` per the UI-SPEC contract with the 11-case test set, touch nothing else. Record the 4 locked UI-SPEC decisions (D1–D4) as context for Phases 11–13 — Phase 10 implements only its success criteria.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Sidebar theme tokens (scoped light block) | Browser / Client (CSS presentation) | — | CSS custom properties resolve in the browser on the sidebar DOM subtree; pure presentation, no server involvement |
| Token-value verification (AA compliance) | Design / spec (pre-verified) | Verification gate (Phase 14) | Values are compile-time constants; contrast is verified at design time (this research) and audited live in Phase 14 |
| Active-route detection (`getActiveNavKey`) | Browser / Client | — | `usePathname()` is client-side; the pure function is client-tier logic extracted for testability (QLTY-01) |
| Collapse / resize / cookie contract | Browser / Client (writes) + API / Backend (reads via `next/headers`) | — | Preserved unchanged in Phase 10; server shell reads `sidebar_width` via `cookies()` (`app-shell-layout.tsx:18`) |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | `^4.1.10` (installed) | Unit tests for `getActiveNavKey` | Already installed (`package.json:54`), already configured (`vitest.config.ts`), 22 existing test files use it — the "pure functions only" repo convention (PITFALLS Pitfall 7) |
| Tailwind CSS v4 (shadcn radix-nova preset) | `^4` (installed) | The `@theme inline` var-mapping mechanism that makes the token block work | Load-bearing (globals.css:7-49); utilities emit `var(--sidebar)` inline, resolved per-element — verified against `globals.css` + `sidebar.tsx` |
| shadcn `sidebar` primitive (vendored) | via `radix-ui@^1.6.5` | The `--sidebar-*` token consumer; provides `[data-sidebar="sidebar"]` hook | Already vendored (`src/components/ui/sidebar.tsx`, 702 lines) — **not to be edited** (PANE-02) |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest/config` + `path` | bundled with vitest | `vitest.config.ts` alias `@` → `./src` | Already present — **no config change this phase**; `src/**/*.test.ts` include pattern means `src/lib/nav.test.ts` is auto-discovered |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Scoped block on `[data-sidebar="sidebar"]` | `:root` token override (STACK.md's suggestion) | Both work (token exclusivity verified); the attribute hook is the narrower, future-proof choice already locked in the UI-SPEC/STATE — narrower blast radius, no global change (SUMMARY Recommendation #2) |
| Hex values in the scoped block | oklch "for consistency" with `:root` | oklch conversion would drift the measured AA ratios and contradict the UI-SPEC's hex-verified values; custom properties accept any color format — use hex as specified |
| Unlayered companion rules | `@layer`-wrapped companion rules | Unlayered CSS beats Tailwind's `@layer utilities`/`@layer base` in the cascade — required for the `border-color`/`border-right-width`/`outline-color` overrides to win |

**Installation:**
```bash
# ZERO installs this phase. Vitest is already installed and configured.
# No package.json changes, no npm install, no npx shadcn add.
```

**Version verification:** `vitest@4.1.10` confirmed via `package.json:54` + a live `npx vitest run` (16 tests passed, 155ms). Node `v22.23.1` (matches `engines: 22.x`).

## Package Legitimacy Audit

> This phase installs **zero packages** — runtime or dev. The Package Legitimacy Gate is therefore **N/A by exemption**: no slopcheck run required, no registry verification needed. Evidence: (1) UI-SPEC §Registry Safety — "none added this phase… zero new packages"; (2) this research confirmed `vitest@^4.1.10` already in `package.json` devDependencies and `components.json` declares `"registries": {}` (no third-party registry). The plan must NOT add any dependency; a `package.json` diff should be empty.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| — (no packages installed this phase) | — | — | — | — | N/A | N/A — zero installs |

**Packages removed due to slopcheck [SLOP] verdict:** none (nothing installed)
**Packages flagged as suspicious [SUS]:** none (nothing installed)

*Note: if the executor ever adds a package during this phase, that is a plan violation — PANE-02's "zero new npm packages" is a hard constraint.*

## Architecture Patterns

### System Architecture Diagram

```text
                    ┌─────────────────────── src/app/globals.css ───────────────────────┐
                    │  @theme inline (7-49) ──LOAD-BEARING── UNTOUCHED                  │
                    │  :root (51-84)  ── 8 --sidebar-* in oklch ── UNTOUCHED            │
                    │  [data-sidebar="sidebar"] { ...8 tokens, HEX... }  ◄─ NEW (P10)   │
                    │  [data-slot="sidebar-container"] { border-color/width }  ◄─ NEW    │
                    │  [data-sidebar="sidebar"] * { outline-color }  ◄─ NEW              │
                    │  .dark (86-118) ── dead code ── UNTOUCHED                         │
                    └───────────────────────────────────────────────────────────────────┘
                                        │ var(--sidebar-*) inherited by descendants
                                        ▼
┌────────────────────────── vendored src/components/ui/sidebar.tsx (UNTOUCHED) ──────────────────────────┐
│  <div data-sidebar="sidebar" data-slot="sidebar-inner" class="... bg-sidebar ...">  (line 242, DESKTOP) │
│  <SheetContent data-sidebar="sidebar" class="... bg-sidebar ...">                    (line 186, MOBILE) │
│     └─ SidebarMenuButton: hover:bg-sidebar-accent / data-active:bg-sidebar-accent / ring-sidebar-ring │
│        SidebarGroupLabel: text-sidebar-foreground/70  (line 404)  SidebarMenuBadge: text-sidebar-foreground │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
              ┌────────── src/lib/nav.ts (NEW, pure) ──────────┐
              │  getActiveNavKey(pathname) → 'start'|'companies'│
              │  |'personas'|'reviews'|null  (boundary guard)   │
              └──────────────────────┬──────────────────────────┘
                                     ▼
              src/lib/nav.test.ts (NEW) ← vitest (installed) — 11 cases
```

### Recommended Project Structure

```
src/
├── app/globals.css      # MODIFIED — insert token block + 2 companion rules after :root (line 84)
├── lib/nav.ts           # NEW — getActiveNavKey + NavKey type (named exports, repo convention)
└── lib/nav.test.ts      # NEW — Vitest unit tests (auto-discovered by vitest.config.ts include)
```

### Pattern 1: Scoped CSS-custom-property theming on a data-attribute hook
**What:** Define the 8 raw `--sidebar-*` custom properties on the `[data-sidebar="sidebar"]` selector so the entire sidebar subtree resolves them, while content (which resolves `:root` values) is untouched. Companion rules exploit the cascade: unlayered author CSS beats Tailwind's `@layer`-wrapped utilities.
**When to use:** This is the ONE sidebar theming mechanism (PANE-02 locked). Verified mechanism: `@theme inline` (globals.css:13-20) maps `--color-sidebar: var(--sidebar)` etc.; the `bg-sidebar` utility therefore emits `background-color: var(--sidebar)` inline; a custom property set on an element is resolvable by declarations on that same element — so `--sidebar: #fbfcfd` on `sidebar-inner` (which has `bg-sidebar`) re-themes it without touching the class.
**Example:**
```css
/* After :root (globals.css:84), before .dark (globals.css:86) — per UI-SPEC "appended after the existing :root block" */
[data-sidebar="sidebar"] {
  --sidebar: #fbfcfd;                   /* 1 panel */
  --sidebar-foreground: #333333;        /* 2 base text 12.30:1; /70 labels 4.89:1 */
  --sidebar-primary: #333333;           /* 3 primary surface */
  --sidebar-primary-foreground: #ffffff;/* 4 on primary 12.63:1 */
  --sidebar-accent: #909090;            /* 5 hover/active pill — 3.11:1 (AA 1.4.11) */
  --sidebar-accent-foreground: #111111; /* 6 on pill 5.91:1; on panel 18.38:1 */
  --sidebar-border: #e5e7eb;            /* 7 hairline (decorative) */
  --sidebar-ring: #787878;              /* 8 focus ring — 4.30:1 */
}
/* Unlayered → beats @layer base * { @apply border-border } and utilities */
[data-slot="sidebar-container"] {
  border-color: var(--sidebar-border);
  border-right-width: 0.5px;
}
[data-sidebar="sidebar"] * {
  outline-color: var(--sidebar-ring);   /* neutralizes global outline-ring/50 (≈1.7:1) */
}
```

### Pattern 2: Boundary-guarded prefix matching for active nav
**What:** Active-state detection as a pure string function with an explicit boundary guard: `pathname === '/companies' || pathname.startsWith('/companies/')`. This hardens the current inline `pathname.startsWith('/companies')` (which would false-positive on a hypothetical `/companies-archive`) while keeping the `/companies/[id]` highlight.
**When to use:** QLTY-01 mandates it; the repo convention is "pure functions only" for Vitest (PITFALLS Pitfall 7); Start stays exact-`/` because every route is a prefix match for `/` (app-sidebar.tsx:36-39 comment).
**Example:** see Code Examples §getActiveNavKey.

### Anti-Patterns to Avoid
- **Editing `:root` sidebar tokens or the `.dark` block:** the whole point is the *scoped* block; `:root`/`.dark` are frozen (UI-SPEC "Do not touch" list; verified `:root` at globals.css:76-83).
- **Converting `@theme inline` to non-inline** "to simplify": it is load-bearing (SUMMARY: "do not convert to non-inline") — utilities must emit `var()` inline for per-subtree resolution.
- **Adding `dark:` variants or a `.dark` toggle:** the `.dark` block is dead code (zero JS toggles it; no `next-themes`; vendored `dark:` classes silently no-op) — Pitfall 1, PITFALLS.
- **Wiring `getActiveNavKey` into `app-sidebar.tsx` this phase:** Phase 11's job (UI-SPEC line 178, roadmap SC #5); shipping function + tests only avoids mid-milestone churn.
- **Renaming the nav key `'personas'` → `'key-personas'`:** the route is `/personas`; the approved UI-SPEC contract and PITFALLS both use `'personas'`. Drift breaks Phase 11's swap.
- **Placing the test file outside `src/` or naming it `.test.tsx`:** `vitest.config.ts:12` includes only `src/**/*.test.ts`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sidebar theming | A theme system, `.dark` toggle, `next-themes`, or per-component color classes | The 8 `--sidebar-*` custom properties scoped on `[data-sidebar="sidebar"]` | The vendored primitive is 100% tokenized (every surface uses `bg-sidebar`, `text-sidebar-foreground`, `ring-sidebar-ring`, `border-sidebar-border`); token swap restyles the entire subtree with zero primitive edits (PANE-02) |
| Active-route matching | Ad-hoc `startsWith` expressions inside each nav component | Pure `getActiveNavKey` + Vitest tests | Converts the #1 silent regression (a drive-by "simplification" of `/companies/[id]` highlight) into a permanent test (QLTY-01, PITFALLS Pitfall 7) |
| Test infrastructure | A new test runner / config | Existing Vitest (`^4.1.10`) + `vitest.config.ts` | Already installed and configured; `src/**/*.test.ts` auto-includes; 22 existing tests prove the convention |
| Contrast verification at runtime | A JS contrast-checking utility shipped with the app | Design-time verification (done here) + Phase 14 audit gate | Token values are compile-time constants; runtime checking adds code for zero user value (QLTY-02 + Phase 14) |

**Key insight:** this phase's entire "engineering" is choosing *not* to do things — the token block is 30 lines of CSS and the function is ~10 lines; the risk is entirely in scope discipline and cascade mechanics. The one subtle non-obvious piece is that the two companion rules must stay **unlayered** to win the cascade over Tailwind v4's layered base/utility rules.

## Common Pitfalls

### Pitfall 1: Touching `@theme inline` or `:root` instead of adding a scoped block
**What goes wrong:** Converting `@theme inline` to non-inline, or editing the `:root`/`.dark` sidebar tokens "for consistency," silently changes content-area behavior or breaks the per-subtree resolution mechanism.
**Why it happens:** The scoped block "looks like" a duplicate of `:root` lines 76-83; a well-meaning editor normalizes them.
**How to avoid:** Diff-rule in the plan: `@theme inline` (lines 7-49), `:root` sidebar tokens (lines 76-83), and `.dark` (lines 86-118) must be byte-identical in the final diff. `git diff` review item.
**Warning signs:** The diff touches lines 7-49 or 86-118 of globals.css.

### Pitfall 2: Companion rules wrapped in `@layer` → they lose the cascade fight
**What goes wrong:** `border-color: var(--sidebar-border)` and `border-right-width: 0.5px` get overridden by the global `@layer base * { @apply border-border }` (globals.css:121-123) and Tailwind's `border-r` utility (sidebar.tsx:236); the hairline stays light gray at 1px.
**Why it happens:** Tailwind v4 puts base styles and utilities in cascade layers; **unlayered** author CSS wins over layered rules at equal specificity. Wrapping the companion rules in any `@layer` re-loses.
**How to avoid:** Write the companion rules as plain (unlayered) rules in the same insertion as the token block; verify with a browser check that the hairline is `#e5e7eb` at 0.5px.
**Warning signs:** Desktop right edge shows a 1px light `oklch(0.922 0 0)` line instead of the 0.5px `#e5e7eb` hairline.

### Pitfall 3: oklch "consistency" drift
**What goes wrong:** Converting the UI-SPEC hex values to oklch changes measured ratios (e.g. oklch equivalents round-trip imprecisely) and contradicts the approved, hex-verified contract.
**Why it happens:** `:root` uses oklch, so the scoped block "should too."
**How to avoid:** Use the exact hex values from the UI-SPEC token block verbatim. Custom properties accept any color format — no conversion needed.
**Warning signs:** Any token value in the plan differs from the UI-SPEC table.

### Pitfall 4: Nav-key naming drift (`'key-personas'` vs `'personas'`)
**What goes wrong:** Phase 11's consumer swap breaks or the test file asserts the wrong strings.
**Why it happens:** The *label* is "Key Personas" but the *route* is `/personas`; the brief's hypothesis said `'key-personas'`.
**How to avoid:** Use `'personas'` — matches the route (`src/app/personas/`), the approved UI-SPEC QLTY-01 contract (line 175), and PITFALLS.md (line 202). The function returns the key; the label stays in Phase 11's JSX.
**Warning signs:** `'key-personas'` appears anywhere in `nav.ts` or `nav.test.ts`.

### Pitfall 5: Scope creep into app-sidebar.tsx
**What goes wrong:** "While I'm here" edits to the 4 `isActive` expressions, badge colors, or indigo classes — all Phase 11 work — contaminate the Phase 10 diff and violate PANE-02's token-only claim.
**Why it happens:** The function's natural consumer is sitting right there.
**How to avoid:** Plan explicitly fences `app-sidebar.tsx` as UNTOUCHED this phase. The function is exported + tested but intentionally unwired until Phase 11 (roadmap SC #5).
**Warning signs:** Any `app-sidebar.tsx` line in the Phase 10 diff.

### Pitfall 6: Test file outside the vitest include pattern
**What goes wrong:** `npm test` silently reports success while `nav.test.ts` never runs.
**Why it happens:** `vitest.config.ts:12` is `include: ['src/**/*.test.ts']` — files must be under `src/`, end `.test.ts`, and not `.test.tsx`.
**How to avoid:** Ship exactly `src/lib/nav.test.ts`; after adding it, run `npx vitest run src/lib/nav.test.ts` and confirm 11 tests execute.
**Warning signs:** `vitest run` reports fewer tests than the 11 UI-SPEC cases.

## Code Examples

### getActiveNavKey — `src/lib/nav.ts` (new; repo conventions: single quotes, semicolons, named export, `type` for unions)
```typescript
// Active-route detection for the sidebar nav, extracted as a pure function
// so the /companies/[id] highlight can never be silently broken by a
// drive-by "simplification" (QLTY-01; PITFALLS Pitfall 7). The key is the
// ROUTE segment ('personas'), not the visible label ('Key Personas').
export type NavKey = 'start' | 'companies' | 'personas' | 'reviews';

export function getActiveNavKey(pathname: string): NavKey | null {
  if (pathname === '/') return 'start'; // exact — every route is a prefix match for '/'
  // Boundary guard: sibling prefixes like /companies-archive must not match.
  if (pathname === '/companies' || pathname.startsWith('/companies/')) return 'companies';
  if (pathname === '/personas' || pathname.startsWith('/personas/')) return 'personas';
  if (pathname === '/reviews' || pathname.startsWith('/reviews/')) return 'reviews';
  return null; // /sign-in, '', unknown
}
```

### nav.test.ts — `src/lib/nav.test.ts` (new; mirrors `dedupKeys.test.ts` conventions)
```typescript
import { describe, it, expect } from 'vitest';
import { getActiveNavKey } from './nav';

describe('getActiveNavKey', () => {
  it("returns 'start' for the exact root path", () => {
    expect(getActiveNavKey('/')).toBe('start');
  });

  it("returns 'companies' for the index and detail pages", () => {
    expect(getActiveNavKey('/companies')).toBe('companies');
    expect(getActiveNavKey('/companies/123')).toBe('companies');
    expect(getActiveNavKey('/companies/123/edit')).toBe('companies');
  });

  it("returns 'personas' for the index and detail pages", () => {
    expect(getActiveNavKey('/personas')).toBe('personas');
    expect(getActiveNavKey('/personas/456')).toBe('personas');
  });

  it("returns 'reviews' for the index and detail pages", () => {
    expect(getActiveNavKey('/reviews')).toBe('reviews');
    expect(getActiveNavKey('/reviews/9')).toBe('reviews');
  });

  it('returns null for sign-in, empty, and sibling-prefix paths', () => {
    expect(getActiveNavKey('/sign-in')).toBeNull();
    expect(getActiveNavKey('')).toBeNull();
    expect(getActiveNavKey('/companies-archive')).toBeNull();
  });
});
```

### globals.css token block + companion rules
Verbatim in Architecture Patterns §Pattern 1. Insert after line 84 (the `:root` block's closing brace), before `.dark` at line 86. Keep unlayered.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind v3 `theme` object + config file | Tailwind v4 `@theme inline` in CSS | v4 migration (already shipped in this repo) | Utilities emit `var()` inline → per-subtree token redefinition works; the block is load-bearing |
| `.dark` class toggle theming | Scoped `--sidebar-*` custom-property block | This milestone (v1.2) | The sidebar is themed because its tokens are scoped — not because the app has a dark mode |
| Per-component hardcoded active styles (`data-active:bg-indigo-50`) | Pure `getActiveNavKey` + tokenized `data-active:bg-sidebar-accent` | Phase 10 (function) → Phase 11 (consumers) | The #1 regression (detail-page highlight) becomes unit-tested |

**Deprecated/outdated:**
- **`.dark` block (globals.css:86-118):** dead code — zero JS toggles `.dark`, no `next-themes`, vendored `dark:` classes silently no-op. Do not edit, do not "fix."
- **`--sidebar-background` token name:** never existed — shadcn's first sidebar token is `--sidebar` (globals.css:76). Use the 8 names from the UI-SPEC block verbatim.
- **Astro-era CLAUDE.md stack sections:** stale (describe the pre-migration Astro/Sanity stack); the *conventions* section (single quotes, semicolons, 2-space, named exports, `interface` for shapes, comments-explain-why) is verified against current Next.js code and remains binding.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `.dark` block is dead code (zero JS references, no theme system) | Summary / Scope | LOW — verified: no `next-themes`, no `.dark` toggle in `src/` (grep), vendored `dark:` classes have no `.dark` ancestor; even if wrong, Phase 10 never touches it |
| A2 | `collapsible="icon"` (Phase 13) renders the same `sidebar-inner` with `data-sidebar="sidebar"` | Summary | LOW — verified the desktop branch is a single element (`sidebar.tsx:242`); `data-collapsible` only decorates it (`sidebar.tsx:211`); tokens apply in every collapse mode |
| A3 | Exa reference values (from FEATURES.md live-CSS fetch 2026-08-01) are accurate | State of the Art | LOW — milestone research flagged MEDIUM; the divergences table in UI-SPEC is already locked and my recomputation confirms the failure ratios (4.12/3.45/1.09/2.46) |
| A4 | UI-SPEC placement "after the `:root` block" means between `:root` (84) and `.dark` (86) | Patterns | LOW — functionally equivalent to after `.dark` (different selectors, no cascade conflict); UI-SPEC wording is followed literally |

## Open Questions

1. **Mailto address confirmation (D2) — NOT a Phase 10 blocker**
   - What we know: UI-SPEC locks `mailto:hello@arclumenpartners.com?subject=360%20sidebar%20feedback` as the feedback destination, with "confirm/replace the address at plan time if a different team inbox is preferred."
   - What's unclear: whether `hello@` is the real team inbox.
   - Recommendation: record D2 in the Phase 10 plan as locked context; the address only matters in Phase 12's "Give us feedback" pill. No action needed this phase.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | vitest run (`npm test`) | ✓ | v22.23.1 (engines: `22.x`) | — |
| npm | package scripts | ✓ | 10.9.8 | — |
| Vitest | `src/lib/nav.test.ts` execution | ✓ | ^4.1.10 (verified running) | — |
| External services (DB, network, Clerk) | None — Phase 10 is CSS + a pure string function | n/a | — | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.
Step 2.6 assessment: phase is code-only; no external services required at build or test time (the tests are pure-function, node env — no DB, no DOM).

## Validation Architecture

> `workflow.nyquist_validation: true` in `.planning/config.json` — section required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^4.1.10` (already installed, `package.json:54`) |
| Config file | `vitest.config.ts` (exists — environment `node`, include `src/**/*.test.ts`, alias `@` → `./src`) |
| Quick run command | `npm test` (script = `vitest run`) — full suite; targeted: `npx vitest run src/lib/nav.test.ts` |
| Full suite command | `npm test` (verified: 22 test files, runs clean) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| QLTY-01 | `getActiveNavKey` — exact `/` → start; prefix-with-boundary for companies/personas/reviews; null for sign-in/''/siblings | unit | `npx vitest run src/lib/nav.test.ts -x` | ❌ Wave 0 (created in-phase) |
| QLTY-02 | 8-token AA set | manual (design-time) | Contrast recomputation (done in this research) + Phase 14 live audit | n/a (CSS constants) |
| PANE-01..04 | scoped render / zero primitive edits / zero `dark:` / content unchanged | manual + diff-rule | `git diff --stat` review: only `globals.css`, `src/lib/nav.ts`, `src/lib/nav.test.ts`; `@theme inline` & `.dark` & `sidebar.tsx` byte-identical | n/a (regression guardrails) |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/nav.test.ts` — created in-phase (the 11 UI-SPEC cases)
- Framework install: **none needed** — vitest already installed and configured
- Shared fixtures: **none needed** — pure function, no fixtures
*(The only gap is the test file itself, which the phase creates.)*

## Security Domain

> `workflow.security_enforcement: true` in config — section required. ASVS level 1.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a — no auth surface in Phase 10 (CSS + pure function) |
| V3 Session Management | no | n/a — cookie contract (`sidebar_state`, `sidebar_width`) is frozen, not touched |
| V4 Access Control | no | n/a — no authorization logic in scope |
| V5 Input Validation | yes | `getActiveNavKey` is a **total function**: any string → fixed union/null, never throws. Validation pattern = explicit allowlist + boundary guard (`===` + `startsWith('/x/')`), no regex, no unbounded input handling |
| V6 Cryptography | no | n/a — no crypto in scope |
| V8 Client-side / XSS | yes (minimal) | CSS token values are hardcoded build-time constants — no user input reaches the CSS block; no `dangerouslySetInnerHTML`, no dynamic class strings |
| V9 Server Comm | no | n/a — zero network surface this phase |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via CSS injection | Tampering | Impossible here: token block is static hex constants committed to source; no `var(--user-input)` paths exist |
| Hotlinked competitor assets | Spoofing/Data Exposure | N/A — zero assets added; UI-SPEC D1 locks a text wordmark (Phase 12), lucide icons only (PITFALLS Pitfall 8) |
| Regression of auth-gated UI (token scope leak) | DoS/Integrity | PANE-04 enforced by the scoped attribute hook: tokens cascade only into the sidebar subtree; content keeps `:root` values. Diff-rule gates this |

**Net assessment:** no new attack surface. The security-relevant behavior of Phase 10 is *negative* — it must not alter global tokens (`--background`, `--popover`, `--ring`, `--border`) that content and portals depend on.

## Sources

### Primary (HIGH confidence) — verified this session
- `src/app/globals.css` (read in full, 130 lines) — `@theme inline` 7-49, `:root` 51-84 (sidebar tokens 76-83), `.dark` 86-118, `@layer base` 120-130 with `* { @apply border-border outline-ring/50 }`
- `src/components/ui/sidebar.tsx` (read in full, 702 lines) — cookie constants 27-32, mobile `data-sidebar="sidebar"` 186, desktop `data-sidebar="sidebar"` 242, `bg-sidebar` both, `border-r` w/o color 236, `text-sidebar-foreground/70` 404, `data-active:bg-sidebar-accent` 469, badge collapse-hide 575
- `src/components/layout/app-sidebar.tsx` — 4 `isActive` expressions (39/48/57/66), indigo data-active classes, `pendingCount` badge 74-78
- `src/components/layout/app-shell-layout.tsx` — 200/400 clamp 7-9, `sidebar_width` read 18, inline `--sidebar-width` 35, server `pendingCount` 27-32
- `src/components/layout/sidebar-resize-handle.tsx` — `sidebar_width` cookie 7-8, imperative `--sidebar-width` write 27, `hover:bg-indigo-200` 84
- `package.json` — `vitest@^4.1.10` devDep 54, `"test": "vitest run"` 14
- `vitest.config.ts` — environment `node`, `include: ['src/**/*.test.ts']`, `@` alias
- `src/lib/import/dedupKeys.test.ts` — idiomatic test-file convention (describe/it/expect, single quotes, semicolons)
- `components.json` — style radix-nova, iconLibrary lucide, `registries: {}`
- **Contrast recomputation** — all 14 UI-SPEC ratios independently recomputed via WCAG relative-luminance script (node); values match exactly
- **Live vitest run** — `npx vitest run src/lib/import/dedupKeys.test.ts` → 16 passed, 155ms; Node v22.23.1, npm 10.9.8

### Secondary (MEDIUM confidence)
- `.planning/phases/10-sidebar-token-foundation/10-UI-SPEC.md` — APPROVED design contract: token block verbatim, QLTY-01 contract, D1-D4 locked decisions, divergences table
- `.planning/research/SUMMARY.md`, `FEATURES.md`, `PITFALLS.md` — milestone research; PITFALLS Pitfalls 1-8 all corroborated against the live files I read; Exa reference values (live CSS fetch 2026-08-01) carried as [CITED: dashboard.exa.ai production CSS via FEATURES.md]
- `.claude/skills/shadcn` — "No manual `dark:` color overrides; use semantic tokens" aligns with the locked mechanism; zero shadcn CLI operations this phase

### Tertiary (LOW confidence)
- None required — every claim in this research was verified against the repo or recomputed; no training-data-only assertions were made. Assumptions A1-A4 are the only soft spots and are each low-risk with verified mitigations.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages; vitest already installed and run-verified
- Architecture: HIGH — token mechanism, attribute hooks, cascade mechanics all verified against live files; contrast ratios independently recomputed
- Pitfalls: HIGH — every pitfall grounded in a specific line/mechanism read this session (PITFALLS.md corroborated 1:1)
- Scope fence: HIGH — Phase 10's file touch-list is exactly three files (`globals.css`, `src/lib/nav.ts`, `src/lib/nav.test.ts`)

**Research date:** 2026-08-01
**Valid until:** 2026-08-08 (fast-moving — next.js/vitest majors; re-verify token values only if the UI-SPEC is amended, not on a time basis)
