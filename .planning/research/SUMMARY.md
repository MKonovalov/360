# Project Research Summary

**Project:** ArcLumen 360 — v1.2 "Exa-Style Left Panel" (redesign existing left nav to the dashboard.exa.ai design language; restyle current routes, no new routes)
**Domain:** Light-only Next.js 16 App Router + shadcn (radix-nova) + Tailwind v4 app; sidebar redesign
**Researched:** 2026-08-01
**Decision resolved:** LIGHT panel, matching the reference (user-confirmed 2026-08-01 after the conflict surfaced)
**Confidence:** HIGH on mechanism (token swap, repo-verified) · HIGH on the reference design (live production CSS) · RESOLVED on the milestone premise

## Research Overview

| File | Scope | Key Takeaway |
|------|-------|--------------|
| STACK.md | How to make the panel dark with zero new dependencies | **Zero new packages.** The whole theme is the 8 `--sidebar-*` CSS custom properties in `globals.css` + a content-layer cleanup in `app-sidebar.tsx`. Token exclusivity is repo-verified (only `sidebar.tsx` consumes sidebar tokens). No `dark:` classes, no `.dark` toggle, no next-themes, no new fonts/icons/frameworks. |
| FEATURES.md | What dashboard.exa.ai actually looks like + what to copy | ⚠️ **CONFLICT — the real dashboard.exa.ai sidebar is LIGHT (`#fbfcfd` near-white), not dark** (verified 3 ways: live production CSS fetched 2026-08-01, 7 gummble screenshots, page metadata). Exa's dark surfaces are the *marketing* site's `#181815` bands and the *playground's* code panels — never the dashboard sidebar. Fully specs the light reference + a dark "invented" variant. |
| ARCHITECTURE.md | How to scope a dark theme inside a light app | Sidebar is 100% CSS-variable driven (no theme variant). One scoped `[data-sidebar="sidebar"]` token block darkens desktop expanded, icon-collapsed, AND the mobile sheet — zero JSX changes. `@theme inline` is the load-bearing precondition. Portals (`DropdownMenuContent`, `TooltipContent`) go to `document.body` and stay light unless container-scoped. |
| PITFALLS.md | What breaks when doing this | The single decision that prevents half the pitfalls: **dark via `--sidebar-*` tokens, never `.dark`/`dark:`**. Then: portal light-over-dark flashes, contrast failures in token pairs, hardcoded indigo/amber, mixed-theme artifacts (border/handle/autofill), collapsed-state regressions, no component tests (extract `getActiveNavKey`), and over-copying Exa assets/behavior. |

## Design Reference & Visual Language

> **⚠️ CONFLICT RESOLVED — LIGHT is the reference, and the owner confirmed LIGHT.** The milestone (PROJECT.md) and the initial user decision said **dark near-black sidebar**. FEATURES.md's primary evidence (live dashboard.exa.ai HTML/CSS, fetched 2026-08-01) showed the reference sidebar is **LIGHT `#fbfcfd`** with a 0.5px `gray-200` hairline right border. STACK/ARCHITECTURE/PITFALLS were researched under the dark assumption and their *mechanisms* stay valid under either palette — but only FEATURES.md verified the reference's actual look (PITFALLS.md even lists "dark near-black rail" as MEDIUM/LOW unverified). **On 2026-08-01 the owner chose LIGHT (match reference).** The dark panel is dropped from scope; if it is ever wanted later, it must be a labeled, deliberate departure built from Exa's *marketing* dark-band vocabulary (`#181815` floor, white/10 hover pills, white/8 hairlines, scarce `#1F40ED` voltage). The light reference palette is fully specified in FEATURES.md and the token-swap mechanism is identical either way.

**Actual reference anatomy (dashboard.exa.ai, light):** near-white `#fbfcfd` panel, 0.5px hairline right border; 36px top row = 16px `#1F40ED` logo mark + team name + chevron (radix dropdown); intent-grouped sections with 13px/500 `#888888` muted labels (API Playground / Management / Learn); nav rows = 30px height, 16px lucide icon + 15px/400 `#444444` label, 10px gap, 8px padding, monochrome `currentColor` icons; active state = 4px-radius `rgba(0,0,0,0.04)` gray fill + black text (live Aug 2026 CSS; Apr 2026 screenshots show *blue* — prefer live gray, flagged conflict); bottom zone = full-width "Give us feedback" pill → 0.6px divider → 24px `#C3ECFF` avatar + 15px/500 username; collapse button `panel-left-close` 24×24 top-right with 0.2s width animation; "NEW" badge = mono 10px/600 accent chip, `mix-blend-multiply`, right-aligned.

**ArcLumen mapping (copy the language, never Exa's items):** **Explore** (Start, Companies, Key Personas) / **Manage** (Reviews) via `SidebarGroupLabel` (exists unused in the primitive); Exa item anatomy applied to the 4 existing routes; pending-reviews badge restyled to the mono accent-chip language (keep count semantics); indigo reserved for scarce brand voltage only (badge/links), not the active fill. **Preserve as hard constraints:** drag-to-resize (200–400px clamp, `sidebar_width` cookie), `⌘B` collapse (`sidebar_state` cookie), server-driven `pendingCount` badge.

## Technical Findings

- **Tailwind v4:** `@theme inline { --color-sidebar: var(--sidebar); … }` makes utilities emit `var()` inline, resolved per-element at runtime — so redefining the source vars on a hook flips exactly that subtree. **The `@theme inline` block is load-bearing; do not convert to non-inline.**
- **shadcn sidebar vars:** The 8 `--sidebar-*` tokens (`sidebar`, `sidebar-foreground`, `sidebar-primary`, `sidebar-primary-foreground`, `sidebar-accent`, `sidebar-accent-foreground`, `sidebar-border`, `sidebar-ring`) are the entire theme contract. The vendored `sidebar.tsx` (702 lines) has **no theme variant** — its `variant` prop is layout-only. **Do not edit the primitive.**
- **File touchpoints:**
  - `src/app/globals.css` — **MODIFIED**: one dark token block (the whole feature's CSS footprint).
  - `src/components/layout/app-sidebar.tsx` — **MODIFIED**: delete 4× `data-active:bg-indigo-50 data-active:text-indigo-600` overrides; dark-adapt amber badge (`bg-amber-100 text-amber-800` → e.g. `bg-amber-400/20 text-amber-200` + border); add logo zone (`SidebarHeader`) + user zone (`SidebarFooter`) — both already exported; restructure into `SidebarGroup`s.
  - `src/components/layout/sidebar-resize-handle.tsx` — **MODIFIED (cosmetic)**: `hover:bg-indigo-200` → boundary-neutral hover.
  - `src/components/ui/sidebar.tsx` / `app-shell-layout.tsx` / `(dashboard)`+`companies`+`personas` layouts / `dropdown-menu.tsx` / `explorer-menu.tsx` — **UNTOUCHED** (except optional `container` prop if dark menus are committed).
- **Zero installs:** no packages, no fonts (Geist already loaded), no version bumps, no shadcn theme variant exists to add.
- **Conditional:** a sidebar search box (Exa has one) needs a scoped input-surface override (`[data-slot="sidebar"] [data-sidebar="input"] { --background: var(--sidebar-accent); --input: var(--sidebar-border) }`) — skip if v1.2 stays nav-items + branding + user zone.

## Architecture Findings

- **Integration mechanism (all 3 mechanism files agree):** theme is pure CSS custom-property resolution — no React state, no context. Scope the dark `--sidebar-*` values on the `[data-sidebar="sidebar"]` hook (ARCHITECTURE.md's primary: one rule covers desktop expanded + icon-collapsed + mobile `SheetContent`, which carries the same attribute and `bg-sidebar`). STACK.md/PITFALLS.md recommend `:root` instead; **both work** (token exclusivity is verified) — the scoped attribute hook is the narrower, future-proof choice and needs no global change. Either way: **never** `.dark` on `<html>`, never `dark:` variants, never a theme prop on the primitive.
- **Server/client split:** `AppShellLayout` (server shell) passes `pendingCount` and owns the width/cookie contract — untouched. `AppSidebar` (client consumer) owns per-item styling. No server changes, no data-layer changes, `usePathname()` active logic untouched except class strings.
- **Portal boundary:** `DropdownMenuContent`/`TooltipContent` portal to `document.body` — they cannot inherit sidebar-scoped CSS and resolve `:root` (light). Default policy: **portals stay app-theme (light)** — fine over a dark panel; a white dropdown *inside* the dark footer needs per-component scoped classes (or a `container` prop passthrough on `dropdown-menu.tsx`). Decision gates Phase C.
- **Suggested build order (dependency-aware):** A) token foundation in `globals.css` (pure CSS, unblocks everything) → B) consumer restyle in `app-sidebar.tsx` (needs A's tokens) → C) edge surfaces: user-menu portal, resize-handle polish (conditional, depends on UI-SPEC) → D) contrast audit + full UAT matrix.

## Pitfalls & Guardrails

1. **Wrong theming strategy (`.dark`/`dark:`)** — inverts the whole app; `dark:` silently no-ops on portals. *Avoid:* token override only; diff rule "no `dark:` classes in the milestone."
2. **Portal light-over-dark flash** — white dropdown/tooltip over the dark panel. *Avoid:* written portal policy: light by default; carve-out only for the sidebar user menu, scoped per-component (never base-component edits — ExplorerMenu surfaces are light).
3. **Partial token overrides → contrast failures** — set all 8 tokens as a verified set. Foreground near-white (labels render at `/70`); accent ≥3:1 vs panel; ring light (global `outline-ring/50` falls back to `--ring` — add scoped outline override, never change global `--ring`); active pill ≥3:1 (Exa's ~1.05:1 pill fails WCAG 1.4.11 — do **not** copy that tradeoff for a daily-use internal tool). Phase D runs the audit gate.
4. **Hardcoded indigo/amber accents** — invisible to token changes; sweep `app-sidebar.tsx`; badge must set bg + text together (≥4.5:1); **collapsed state hides the badge** — add a collapsed dot on Reviews (new behavior, needs UAT line).
5. **Mixed-theme artifacts** — sidebar `border-r` falls back to global `--border` (light hairline): add `border-sidebar-border`; resize-handle hover flash; autofill white rectangle on dark inputs; mobile-drawer scrollbars; `themeColor` must NOT be the sidebar color (browser chrome wraps the whole light page).
6. **Collapsed/icon rail legibility** — icons, ≥3:1 rail active pill, tooltips per item (Reviews tooltip includes pending count), logo needs a collapsed form (letter-mark).
7. **Regression blindness (zero component tests)** — extract `getActiveNavKey(pathname)` as a pure function + Vitest (Start = exact `/`, others = `.startsWith()` prefix — a drive-by "simplification" silently breaks `/companies/[id]` highlight); **freeze the cookie contract** (`sidebar_state`, `sidebar_width` 200–400 clamp, inline `--sidebar-width` style); replicate v1.1's Phase-5 live-browser UAT matrix (expanded/collapsed/mobile × 4 routes × state pairs, screenshots).
8. **Over-copying Exa** — no hotlinking/embedding exa.ai assets (license + referrer leak); copy interaction/visual language, not items; keep resize/`⌘B`/badge behaviors; Phase-D divergence review vs. reference screenshot.

## Recommendations

1. **Dark/light conflict — RESOLVED: ship LIGHT (matches the reference).** The owner confirmed the light `#fbfcfd` direction on 2026-08-01 after the conflict was surfaced. Milestone framing is now authentic: "matches dashboard.exa.ai," no departure label needed. The dark `--sidebar-*` palette from STACK.md is **not** used; instead apply the light reference values from FEATURES.md (near-white `#fbfcfd` panel, hairline `gray-200` border, `rgba(0,0,0,0.04)` active fill, `#888888` section labels, `#444444` item text).
2. **Mechanism (locked):** one scoped `--sidebar-*` token block (on `[data-sidebar="sidebar"]`), zero new dependencies, zero vendored-primitive edits, `@theme inline` untouched. Apply the **light** reference values from FEATURES.md as the UI-SPEC baseline (panel `#fbfcfd`, border `gray-200` hairline, active `rgba(0,0,0,0.04)`, accent = current indigo family for the badge), not STACK.md's dark palette.
3. **Milestone scope (per user):** restyle the 4 current routes only — **light Exa-style panel** (`#fbfcfd` + hairline border), intent groups (Explore/Manage), Exa item anatomy, subtle gray active treatment, mono-chip pending badge, top logo zone + bottom user zone (Clerk `useUser()`), collapse button coexisting with the existing drag-resize. Preserve routes, resize, `⌘B`, and badge gating.
4. **Phase structure:** Phase 0 (planning decisions in UI-SPEC: dark-as-departure sign-off, logo treatment, portal policy) → Phase A token foundation + `getActiveNavKey` extraction/tests → Phase B consumer restyle → Phase C edge surfaces (conditional) → Phase D contrast audit + full live-browser UAT matrix.
5. **Research flags:** no phase needs deeper external research — the design language is fully specified from primary evidence. The risk is *decision*, not discovery; use `/gsd-ui-phase` to lock palette + portal decision before Phase B.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH (mechanism) / MEDIUM (palette) | Token swap repo-verified; exact oklch values are UI-SPEC decisions |
| Features | HIGH (reference) | Live production CSS of dashboard.exa.ai (2026-08-01); conflicts with the dark milestone premise |
| Architecture | HIGH (mechanism) / LOW (dropdown styling) | Source reads verify hooks/portals; sidebar-menu styling unconfirmed |
| Pitfalls | HIGH | All mechanics verified against vendored files + Context7 shadcn docs |

**Overall confidence:** HIGH on "how to do it"; MEDIUM on "what we're matching" (dark premise vs. light reference).

### Gaps to Address

- **Dark-vs-light premise gap — CLOSED:** owner chose light (match reference) on 2026-08-01; dark is out of scope. Roadmap applies the FEATURES.md light palette, not the STACK.md dark palette.
- **Logo/wordmark:** no ArcLumen logo asset exists; a wordmark/letter-mark decision (and collapsed form) is the only hard design dependency.
- **Collapse-vs-resize matrix:** decide collapse target width and whether the drag handle stays visible (both coexist via `--sidebar-width`).
- **Portal policy + feedback destination + org-name source:** small open decisions, all gated into UI-SPEC / Phase 0.

## Sources

**Primary (HIGH):** live `dashboard.exa.ai` production HTML/CSS (fetched 2026-08-01) — all concrete design values; direct source reads of `sidebar.tsx`, `globals.css`, `app-sidebar.tsx`, `app-shell-layout.tsx`, `sidebar-resize-handle.tsx`, `dropdown-menu.tsx`, `tooltip.tsx`, `layout.tsx`, `package.json`; Context7 shadcn sidebar theming + Tailwind v4 dark-mode docs.
**Secondary (MEDIUM):** gummble.com/apps/exa-web screenshots (Apr 2026, blue-active conflict flagged), UXSnaps breakdown, exa.ai docs/changelog, shadcn.io/design/exa breakdown (`#181815` dark band, `#1f40ed` voltage, tight radii).
**Tertiary (LOW):** dashboard.exa.ai sidebar-menu/dropdown coloring (unconfirmed) — resolved by the light-portals-default policy.

---
*Research completed: 2026-08-01*
*Ready for roadmap: yes — dark/light premise resolved (LIGHT, matches reference)*
