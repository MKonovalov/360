# Stack Research — v1.2 Exa-Style Dark Sidebar

**Domain:** Always-dark left navigation panel inside a light-theme Next.js 16 App Router + shadcn (`nova`/`radix-nova` preset) app
**Researched:** 2026-08-01
**Confidence:** HIGH (mechanism), MEDIUM (exact palette values — visual confirmation deferred to the UI phase)

## Executive Answer

**Zero new packages. One place changes: the 8 `--sidebar-*` CSS custom properties in the `:root` block of `src/app/globals.css`.** The shadcn sidebar's entire theme contract is these variables (background, foreground, primary, accent, border, ring). Because the app's light content never reads `--sidebar-*` (verified by grep — the *only* consumer is `src/components/ui/sidebar.tsx`), redefining them to dark values gives the Exa-style near-black panel with literally zero blast radius on the light app — desktop, mobile sheet, collapsed rail, and focus rings all follow for free. Then a small content-layer cleanup in `app-sidebar.tsx` (remove hardcoded indigo active-state overrides) and `sidebar-resize-handle.tsx` (indigo hover) so the token-driven theme can show through.

## Approach Comparison

| # | Approach | Verdict | Why |
|---|----------|---------|-----|
| (a) | Tailwind `dark:` variants / global `darkMode: 'class'` (`.dark` on `<html>`) | **REJECT** | Adding `.dark` to `<html>` flips the *entire app* dark: the `.dark` block in `globals.css` redefines every token (`--background`, `--card`, `--popover`, …) and every `dark:` utility already present in the UI primitives (button, input, select, dropdown, badge) activates. This is a full dark-mode system the milestone explicitly does not want. |
| (a′) | Scoped `.dark` class on the sidebar wrapper only | **REJECT — worse blast radius than needed** | The custom variant `@custom-variant dark (&:is(.dark *))` matches any `.dark` ancestor, so the subtree gets *all* `.dark` tokens (background/card/popover flip dark inside the sidebar) plus every `dark:` variant there. It also **misses the portaled mobile sheet** (see below) and muddles two intents: "this panel is dark by design" vs "this is dark mode." |
| (b) | Component-scoped dark CSS variables baked into the sidebar theme | **RECOMMENDED** — implemented as a `:root`-level sidebar-token swap | The sidebar's theme *is* its CSS variables (per shadcn docs: "The sidebar component is themed using specific CSS variables"). Redefine the 8 `--sidebar-*` values dark at `:root`. Token exclusivity (verified) makes this effectively component-scoped in blast-radius terms. Covers desktop + mobile-sheet portal in one block, zero primitive/provider edits. |
| (c) | `--sidebar-*` overrides scoped to `SidebarProvider` (inline `style` or wrapper class) | **FALLBACK — only if a second, light sidebar instance is ever needed** | Same variable mechanism, narrower CSS scope — but the mobile `SheetContent` **portals to `document.body`** (verified in `src/components/ui/sheet.tsx`: `SheetPortal` → Radix `Dialog.Portal`), and CSS custom properties do **not** traverse portals. Provider-scoped overrides would render the mobile sheet light unless the same class is also applied to `SheetContent` (a shadcn-primitive edit that `shadcn update` would clobber). |

**Winner: (b) — swap the `--sidebar-*` values in `:root`.** It is the shadcn-documented theming mechanism, matches the codebase's existing precedent (`app-shell-layout.tsx` already themes the sidebar via a `--sidebar-width` custom property), and is the only option that reaches the portaled mobile sheet without touching a managed primitive.

## Why `:root` (not the provider wrapper) is the correct scope

1. **Token exclusivity (verified):** grep across `src/` shows the only consumers of `bg-sidebar`, `text-sidebar-*`, `border-sidebar`, `ring-sidebar`, `--sidebar`, `--sidebar-*` are `src/components/ui/sidebar.tsx` and `globals.css` itself. Layout files (`app-shell-layout.tsx`, `sidebar-resize-handle.tsx`) use only `--sidebar-width` — a *geometry* variable, untouched. No page, detail pane, or dashboard widget reads sidebar tokens. Redefining them at `:root` cannot affect the light content area.
2. **Portal coverage:** the mobile `SheetContent` carries `bg-sidebar text-sidebar-foreground` and resolves those variables from its inheritance root — `<body>`/`:root`. Defining the dark values at `:root` is the one placement that dark-themes both the in-flow desktop sidebar and the portaled mobile sheet with a single block and zero primitive edits.
3. **Tailwind v4 wiring already in place:** `@theme inline { --color-sidebar: var(--sidebar); … }` maps each token to a utility (`bg-sidebar`, `text-sidebar-foreground`, `bg-sidebar-accent`, `border-sidebar-border`, `ring-sidebar-ring`). `inline` means utilities reference the variable directly and resolve through the normal CSS cascade — change the variable, every sidebar surface follows. No config change, no rebuild trickery.

## The Change

### 1. `src/app/globals.css` — swap the `--sidebar-*` values in `:root` (the only stack change)

Keep the `.dark` block untouched (harmless, future-proof). Suggested palette — **achromatic** to match the `nova`/`neutral` base (every existing token is `oklch(x 0 0)`), grounded in Exa's near-black surfaces (design breakdowns: `#181815` / `#111827` floors, subtle white/10 hover pills, white/8 hairline borders):

```css
:root {
  /* …existing tokens unchanged… */
  --sidebar: oklch(0.16 0 0);              /* near-black panel (~Exa #181815) */
  --sidebar-foreground: oklch(0.92 0 0);   /* light text */
  --sidebar-primary: oklch(0.95 0 0);      /* branding/logo text on dark */
  --sidebar-primary-foreground: oklch(0.16 0 0);
  --sidebar-accent: oklch(0.26 0 0);       /* hover + active pill (Exa white/10 look) */
  --sidebar-accent-foreground: oklch(0.95 0 0);
  --sidebar-border: oklch(1 0 0 / 8%);     /* hairline separator */
  --sidebar-ring: oklch(0.45 0 0);         /* subtle focus ring */
}
```

Exact values are a UI-SPEC decision; this is a grounded starting point. The **mechanism** is what this research locks in.

### 2. Content-layer cleanup (roadmap tasks, not stack changes)

These hardcoded *light-only* utilities sit on top of the token system and will fight the dark theme:

| File | Current (light-only) | Change to |
|------|----------------------|-----------|
| `src/components/layout/app-sidebar.tsx` | `className="data-active:bg-indigo-50 data-active:text-indigo-600 …"` × 4 (Start, Companies, Key Personas, Reviews) | **Delete the overrides.** The primitive's default `data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground` (already in `sidebar.tsx`) produces the Exa-style subtle pill automatically once the tokens are dark. |
| `src/components/layout/app-sidebar.tsx` | `SidebarMenuBadge className="bg-amber-100 text-amber-800"` | Dark-aware badge, e.g. `bg-amber-400/15 text-amber-300` (Exa's muted-tint treatment). |
| `src/components/layout/sidebar-resize-handle.tsx` | `hover:bg-indigo-200` | `hover:bg-sidebar-border` (or `hover:bg-white/10`). |
| New branding zone (top) / user zone (bottom) | — | Use sidebar tokens only (`text-sidebar-foreground`, `bg-sidebar`, `hover:bg-sidebar-accent`, `border-sidebar-border`) so they follow the theme. lucide-react icons (already installed) — primitive `[&_svg]` sizing handles them. |

Collapse behavior, cookie-persisted width (`--sidebar-width`), drag-resize, rail, and the pending-reviews badge all keep working — they are token- or geometry-driven and need no structural change.

### 3. Conditional: sidebar search box (only if v1.2 includes one — Exa has one)

`SidebarInput`/`Input` resolve `bg-background` (light `oklch(1 0 0)`) — a white input on the dark panel. If a search box is added, do **not** use `Input` as-is; scope the surface tokens inside the sidebar subtree in `globals.css`:

```css
[data-slot="sidebar"] [data-sidebar="input"] {
  --background: var(--sidebar-accent);
  --input: var(--sidebar-border);
}
```

(Or style the input with explicit dark utilities.) Not needed if v1.2's target list stays nav-items + branding + user zone.

## What to Install

**Nothing.**

| Item | Verdict |
|------|---------|
| New npm packages | **None.** The mechanism is CSS custom properties + the already-installed Tailwind v4 / shadcn token wiring. |
| Fonts | **No change.** Geist (already loaded via `next/font/google`, `--font-sans`) is the standard open stand-in for Exa's ABCDiatype sans voice. |
| shadcn registry additions ("sidebar theme variant") | **None exist.** Theming a sidebar *is* its CSS variables — there is no theme variant to install, which is precisely why this is a one-block CSS change. |
| Versions to bump | **None.** No lockfile/compat risk; nothing new enters `package.json`. |

## What NOT to Add (explicit)

| Avoid | Why | Use instead |
|-------|-----|-------------|
| `next-themes` / any theme-provider or theme-toggle library | There is no dark-mode system and none is wanted — the panel is dark by design, permanently. A provider adds JS, an effect/hydration flash, and localStorage for zero benefit. | Static `:root` token swap |
| Global `darkMode: 'class'` / `.dark` on `<html>` | Flipping the app dark: `.dark` block redefines every token and every `dark:` utility in the UI primitives activates. | Sidebar-only `--sidebar-*` swap |
| Scoped `.dark` class on the sidebar wrapper | Redefines `--background`/`--card`/`--popover` inside the subtree, activates all `dark:` variants there, misses the portaled mobile sheet, and couples "dark by design" to the dark-mode system. | `:root` sidebar-token swap |
| A second CSS framework / styling layer (CSS Modules, styled-components, emotion, vanilla-extract) | Tailwind v4 + the shadcn token system does this natively with zero new build config. | CSS custom properties |
| New icon library (`@tabler/icons`, `react-icons`, …) | lucide-react is installed and the milestone keeps current icons. | lucide-react |
| New font (Inter, ABCDiatype via fontsource, …) | Geist is loaded, matches the `nova` preset, and is the standard substitute for Exa's sans voice. | Geist (already present) |
| Runtime theme switcher (`@shadcn/themes`-style, `data-theme` toggling) | Adds JS + provider + potential CLS for a permanently-dark panel. | Static CSS vars |
| Patching `src/components/ui/sidebar.tsx` with hardcoded dark classes | The primitive is `shadcn update`-managed; token-driven theming means **zero** primitive edits. | Token swap + content-layer class cleanup in `app-sidebar.tsx` |
| `@custom-variant dark` changes / `dark:` utilities for the sidebar content | The `dark:` variant is the wrong tool for a *non-variant* condition (the panel is always dark). Hardcode the dark values via tokens or direct utilities. | Sidebar tokens / direct utilities |

## Stack Patterns by Variant

**If a second, light sidebar instance is ever needed (e.g. an admin area):**
- Move the dark overrides out of `:root` into a scoped class (e.g. `.exa-sidebar`) applied to `SidebarProvider` *and* the mobile `SheetContent`'s `className` (one-line primitive edit, documented deviation), keeping `:root` light. `@theme inline` keeps working because the class only redefines the raw `--sidebar-*` variables for that subtree.

**If the app ever adopts a real global dark mode:**
- The `.dark` block already carries dark sidebar values — the Exa-style panel simply stays dark in both modes. No conflict, no rework.

## Version Compatibility

| Package | Installed | Compatible with | Notes |
|---------|-----------|-----------------|-------|
| `tailwindcss` | ^4 (v4, CSS-first) | `@theme inline` token mapping, `@custom-variant dark` — verified current in v4 docs | No `tailwind.config.ts` exists (correct for v4); do not reintroduce one |
| `shadcn` | ^4.14.0 (`radix-nova` style per `components.json`) | Sidebar CSS-variable theming contract identical across styles — verified in shadcn docs | `menuAccent: "subtle"` + `menuColor: "default"` preset behaves as expected with dark tokens |
| `lucide-react` | ^1.26.0 | Icon sizing handled by sidebar primitives (`[&_svg]:size-4`) | Keep for nav icons |
| `next` | 16.2.11 | No interaction — this is pure CSS | No `use client`/server-component changes |

## Sources

- **Context7 `/websites/ui_shadcn`** — sidebar theming docs ("the sidebar component is themed using specific CSS variables … for both light and dark modes"), manual-install `globals.css` template matching this repo's file 1:1. HIGH confidence.
- **Context7 `/websites/tailwindcss`** — v4 dark-mode docs (`@custom-variant dark (&:is(.dark *))`, class-based activation, data-attribute variant). HIGH confidence.
- **Web design research (Exa breakdowns + exaBase/exawizards design system)** — Exa near-black surfaces `#181815` / `#111827`, white/10-ish hover treatment, tight radii; ecosystem confirmation that sidebar tokens + `@theme inline` is the standard shadcn theming pattern. MEDIUM confidence on exact hex → oklch conversion; lock values in UI phase.
- **Repo verification (HIGH confidence, primary evidence):** token-exclusivity grep (only `sidebar.tsx` consumes `--sidebar-*` color tokens); `SheetPortal`→`Dialog.Portal` in `src/components/ui/sheet.tsx` (portal breaks provider-scoped CSS var cascade); `SidebarProvider` style-prop precedent in `app-shell-layout.tsx`; indigo/amber hardcodes in `app-sidebar.tsx` and `sidebar-resize-handle.tsx`.

## Research Flags for the Roadmap

- **UI-SPEC owns the exact palette** — this doc pins the mechanism and a grounded starting palette; visual fidelity to Exa's dashboard sidebar should be validated in the UI phase (screenshot comparison).
- **Conditional scope creep watch:** only add the sidebar-search-input override task if the milestone's feature list includes a search box.
- **No version drift risk:** zero new dependencies means no lockfile changes and no compat matrix to maintain for this milestone.

---
*Stack research for: ArcLumen 360 v1.2 (Exa-Style Dark Sidebar)*
*Researched: 2026-08-01*
