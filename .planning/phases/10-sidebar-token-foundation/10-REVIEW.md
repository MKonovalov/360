---
phase: 10-sidebar-token-foundation
reviewed: 2026-08-01T12:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/app/globals.css
  - src/lib/nav.ts
  - src/lib/nav.test.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-08-01T12:00:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Reviewed the Phase 10 source changes: the scoped 8-token `--sidebar-*` block plus two unlayered companion rules in `src/app/globals.css`, and the new pure `getActiveNavKey` function + 11-case Vitest suite in `src/lib/nav.ts` / `src/lib/nav.test.ts`.

The `nav.ts` function and its test suite are correct, total, and well-tested — no findings beyond coverage gaps. The CSS is where the substantive issues live. The critical structural problem: the token block is scoped to `[data-sidebar="sidebar"]`, which in the vendored `sidebar.tsx` is the **inner** wrapper (`sidebar-inner`, `sidebar.tsx:242`) — a *descendant* of the `data-slot="sidebar-container"` element that carries the hairline border (`sidebar.tsx:229`). CSS custom properties resolve down the tree, never up, so the container's `border-color: var(--sidebar-border)` reads the global `:root`/`.dark` value, not the scoped `#e5e7eb`. The hairline color is therefore a functional no-op in light mode (identical to the base-layer `--border`) and wrong in dark mode. Contrast comments in the token block were independently re-verified (12.30:1, 3.11:1, 4.30:1 all check out).

## Warnings

### WR-01: Hairline `border-color` never receives the scoped `#e5e7eb` — token block targets the wrong (inner) element

**File:** `src/app/globals.css:100-103` (companion rule) with token block at `src/app/globals.css:87-96`

**Issue:** The token block is scoped to `[data-sidebar="sidebar"]`, which the vendored sidebar renders on the **inner** wrapper (`sidebar.tsx:241-245`, `data-slot="sidebar-inner"`), a *descendant* of the `data-slot="sidebar-container"` element that the companion rule targets. Custom properties inherit downward only, so on the container `var(--sidebar-border)` resolves from its ancestors — `:root` (light: `oklch(0.922 0 0)`, `globals.css:82`) or `.dark` (dark: `oklch(1 0 0 / 10%)`, `globals.css:138`) — never from the scoped block. Consequences:

1. **Light mode (default):** `:root`'s `--sidebar-border` is byte-identical to the global `--border` (`oklch(0.922 0 0)`), so `border-color: var(--sidebar-border)` produces exactly what `@layer base`'s `border-border` already applies. The rule's stated purpose ("hairline uses `--sidebar-border`, not global `--border`") is a silent no-op, and the hairline renders ≈`#e9e9e9` instead of the verbatim gray-200 `#e5e7eb` required by PANE-01 / UI-SPEC ("hex values verbatim").
2. **Dark mode:** the sidebar panel stays light `#fbfcfd` (Phase 10 scope) but the container's hairline becomes the `.dark` value `oklch(1 0 0 / 10%)` — a translucent white border on a near-white panel.

The same defective block is embedded verbatim in `10-UI-SPEC.md:64-78`, so the spec must be corrected alongside the code. Note the `border-right-width: 0.5px` half of the rule *does* work (unlayered beats the `border-r` utility), so the hairline renders — just at the wrong color and through the wrong token path.

**Fix:** Cover the container in the token scope so both the container's border and the inner wrapper's `bg-sidebar`/text resolve scoped values (the inner inherits from its ancestor container):

```css
[data-sidebar="sidebar"],
[data-slot="sidebar-container"] {
  --sidebar: #fbfcfd;
  /* ...remaining 7 tokens unchanged... */
}
```

(or equivalently, move the token block to `[data-slot="sidebar-container"]` alone — it is always the ancestor of the inner wrapper). This keeps zero vendored edits, keeps the tokens verbatim, and makes both the panel background *and* the hairline resolve the scoped palette in every mode.

### WR-02: Unlayered `[data-sidebar="sidebar"] *` outline rule is a specificity trap for all future `outline-*` utilities inside the sidebar

**File:** `src/app/globals.css:104-106`

**Issue:** The rule is unlayered, so it beats **every** layered style — not just the `@layer base` `outline-ring/50` leak it exists to neutralize, but also any future `@layer utilities` rule such as `focus-visible:outline-destructive` or `outline-red-500` on an element inside the sidebar. Once an element inside the sidebar sets its own outline color (e.g., a destructive action, a custom focus treatment), that utility will silently never render — the unlayered universal selector wins regardless of specificity or ordering. It is latent today (all sidebar focusables use `outline-hidden` + `focus-visible:ring-2`, `sidebar.tsx:404/424/469/556/669`), which is exactly why it will go unnoticed until something inside the sidebar needs a non-ring outline color. The intent (beat `@layer base`) does not require unlayered placement — Tailwind v4's layer order is `theme, base, components, utilities`, so `@layer components` beats `base` while still yielding to `utilities`.

**Fix:** Move the rule into `@layer components` (or narrow the selector), preserving the win over `@layer base` without nuking the utilities layer:

```css
@layer components {
  [data-sidebar="sidebar"] * {
    outline-color: var(--sidebar-ring);
  }
}
```

Note: keep `border-right-width: 0.5px` (WR-01) unlayered — it must beat the `border-r` *utility* in `@layer utilities`, and a components-layer rule would lose to it.

## Info

### IN-01: `getActiveNavKey` / `NavKey` are unused outside the test suite

**File:** `src/lib/nav.ts:6,8`

**Issue:** Nothing in `src/` imports `nav.ts` except `nav.test.ts` — the export is dead code until a later phase consumes it in the sidebar nav. Expected for a foundation-phase deliverable (the whole point is a locked, tested primitive for Phase 11), so not a defect — but worth tracking: if the Phase 11 nav lands without consuming this function, the QLTY-01 lock has silently failed.

**Fix:** Consume it in the Phase 11 nav rebuild; until then, no action required.

### IN-02: Boundary-guard test coverage is thinner than the risk warrants

**File:** `src/lib/nav.test.ts:45-47`

**Issue:** The sibling-prefix boundary guard — the riskiest logic in the function (the `startsWith('/x/')` + `===` pairing) — has a single case: exact `/companies-archive`. Missing cases: a sibling prefix *with* a subpath (`/companies-archive/123`), a trailing-slash section path (`/companies/`), and a case-sensitivity check (`/Companies`). All would pass against the current implementation, but they are exactly the inputs that would catch a future regression to naive `startsWith('/companies')` — the drive-by "simplification" the function exists to prevent.

**Fix:** Add:
```ts
it('returns null for a sibling prefix with a subpath', () => {
  expect(getActiveNavKey('/companies-archive/123')).toBeNull();
});
it("returns 'companies' for a trailing-slash index path", () => {
  expect(getActiveNavKey('/companies/')).toBe('companies');
});
```

### IN-03: `border-right-width: 0.5px` is side-agnostic while the component's border is side-conditional

**File:** `src/app/globals.css:102` (vs `src/components/ui/sidebar.tsx:236`)

**Issue:** The component only applies the hairline on the matching side — `group-data-[side=left]:border-r` / `group-data-[side=right]:border-l`. The companion rule unconditionally sets `border-right-width: 0.5px`, so a hypothetical `side="right"` sidebar would render a **1px** left border (the `border-l` utility's width), not the 0.5px hairline. Zero current impact (the app renders `side="left"`, the default) — noted so the Phase 11 nav rebuild doesn't copy the assumption.

**Fix:** Either leave as-is with a `/* left-side only */` comment, or gate the width on the same data attribute: `[data-slot="sidebar-container"][data-side="left"] { border-right-width: 0.5px; }`.

---

_Reviewed: 2026-08-01T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
