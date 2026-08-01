# Pitfalls Research

**Domain:** Adding a dark Exa-style sidebar to an existing light-only Next.js 16 + shadcn/ui (radix-nova) app
**Researched:** 2026-08-01
**Confidence:** HIGH (all mechanics verified against the vendored `src/components/ui/sidebar.tsx`, `globals.css`, `app-sidebar.tsx`, `sidebar-resize-handle.tsx`, `dropdown-menu.tsx`, `tooltip.tsx`, `layout.tsx`; shadcn theming guidance cross-checked via Context7)

## The one decision that prevents half of these pitfalls

**Make the sidebar dark by overriding the `--sidebar-*` CSS variables in `:root` — do NOT toggle the `.dark` class, and do NOT use `dark:` variant classes inside the sidebar.**

Why this project specifically:
- The app is light-only and will stay that way: `<body className="h-full bg-slate-50 text-slate-900">` is hardcoded in `src/app/layout.tsx:23`, there is no `next-themes`, no `.dark` toggle, and the `.dark` block in `globals.css` is dead code (zero JS references it).
- The vendored sidebar is already 100% tokenized — every surface uses `bg-sidebar`, `text-sidebar-foreground`, `hover:bg-sidebar-accent`, `ring-sidebar-ring`, `border-sidebar-border`. Changing the 8 `--sidebar-*` tokens in `:root` restyles the entire sidebar, its mobile Sheet drawer (`bg-sidebar` on `SheetContent`), and nothing else. Content uses `--background`/`--popover`/`--accent` — a clean separation already exists.
- `@custom-variant dark (&:is(.dark *))` means `dark:` classes require a `.dark` ancestor. They would work on in-place sidebar markup but **silently do nothing for Radix portal content** (rendered at `<body>`, outside the sidebar subtree) — producing exactly the mixed light/dark mess this milestone must avoid.
- Toggling `.dark` on `<html>` would invert the whole app (popovers, dropdowns, tables, dashboard) — a massive, invisible regression surface for a cosmetic sidebar change.

Consequence of following it: CSS-variable leakage (b), portal mismatch (c), and most of the contrast failures (a) become non-issues by construction.

---

## Critical Pitfalls

### Pitfall 1: Wrong theming strategy — flipping `.dark` or scattering `dark:` variants

**What goes wrong:**
Either (a) the whole app inverts to dark (tables, popovers, dashboard widgets, import wizard) or (b) the sidebar renders as a patchwork — some elements dark via overridden tokens, others stuck light because a `dark:` variant silently doesn't apply. In the worst case both happen: `.dark` flipped on `<html>` AND `dark:` classes inside the sidebar, so portals get one theme and in-place markup another.

**Why it happens:**
`globals.css` already contains a full dark palette (`.dark` block, `globals.css:86-118`), so "just enable dark mode" looks like a one-liner. The `.dark` values even look sidebar-appropriate (`--sidebar: oklch(0.205 0 0)`). But `.dark` swaps **every** token, including `--background`, `--popover`, `--card`, `--accent` — all used heavily by light content. Radix components (`DropdownMenuContent` = `bg-popover`, `TooltipContent` = `bg-foreground text-background`) portal to `<body>`, so any dark: scoping that relies on a `.dark` ancestor inside the sidebar cannot reach them.

**How to avoid:**
Override exactly the 8 sidebar tokens in `:root` (or on a scoped class if a future theme toggle demands it):
```css
:root {
  --sidebar: oklch(0.19 0 0);            /* near-black, Exa-like */
  --sidebar-foreground: oklch(0.96 0 0); /* near-white — see Pitfall 3 re: /70 labels */
  --sidebar-primary: oklch(0.96 0 0);
  --sidebar-primary-foreground: oklch(0.19 0 0);
  --sidebar-accent: oklch(0.28 0 0);     /* hover/active pill — MUST move off the light 0.97 */
  --sidebar-accent-foreground: oklch(0.96 0 0);
  --sidebar-border: oklch(1 0 0 / 12%);
  --sidebar-ring: oklch(0.9 0 0);        /* light ring — see Pitfall 3 */
}
```
Add a code-review rule: **no `dark:` classes and no `.dark` toggling in this milestone.** The sidebar is dark because its tokens are dark, not because the app has a dark mode. Also update the existing `@theme inline` mapping only if adding a new token (e.g. `--sidebar-*`-derived shades) — new tokens must be mapped there or referenced via arbitrary values.

**Warning signs:**
- Any `dark:` class appears in `app-sidebar.tsx` or `sidebar.tsx`.
- Someone adds `next-themes` or a theme toggle to the PR.
- `globals.css` `.dark` block starts getting edited "to make the sidebar right".
- The sidebar looks right in `npm run dev` but dropdowns/tooltips are white — that's the portal split already happening.

**Phase to address:** Phase 1 (Dark Sidebar Foundation) — the token override IS the foundation. This is a Phase-1 task, not a Phase-3 discovery.

---

### Pitfall 2: Radix portal surfaces render light over the dark sidebar (user menu, tooltips)

**What goes wrong:**
The Exa-style sidebar's bottom user/settings zone (and any sidebar-scoped dropdown/popover) opens a **white** `DropdownMenuContent` (`bg-popover text-popover-foreground`, `dropdown-menu.tsx:46`) floating over a near-black sidebar — a jarring white-on-black flash. Collapsed-state tooltips (the `tooltip` prop on `SidebarMenuButton`, `sidebar.tsx:527-537`) render `bg-foreground text-background` (dark-on-white) — legible, but stylistically detached from a dark sidebar. If the team "fixes" this by styling portal content dark *partially* (bg only), the `focus:bg-accent`/`focus:text-accent-foreground` states in `dropdown-menu.tsx:76` still resolve to **light** accent values → invisible/hover-blend text inside the dark dropdown.

**Why it happens:**
All three primitives portal to `<body>` (`DropdownMenuContent` wraps `DropdownMenuPrimitive.Portal`, `dropdown-menu.tsx:41`; `TooltipContent` wraps `TooltipPrimitive.Portal`, `tooltip.tsx:40`; Sheet similarly). Portal content is outside the sidebar's DOM subtree, so sidebar-scoped theming never reaches it. There is no "the portal knows its trigger is dark" mechanism.

**How to avoid:**
Make an explicit, written decision in the phase plan: **portals are app-theme (light), not sidebar-theme (dark)** — with one carve-out for the sidebar's own user menu if it's genuinely a sidebar surface. Consequences to lock in:
- Default: leave `DropdownMenuContent`/`TooltipContent` light. A light tooltip next to a dark sidebar is fine (the tooltip floats over light content). A white dropdown anchored *inside* the dark sidebar is not — if the user menu is placed in the dark `SidebarFooter`, scope it dark **via its own component classes, not global overrides**: `className="bg-sidebar text-sidebar-foreground border-sidebar-border"` on `DropdownMenuContent` plus an explicit `data-[variant]`-safe accent: since `focus:bg-accent` is still light, add a scoped override like `bg-sidebar [&_[data-slot=dropdown-menu-item]:focus]:bg-sidebar-accent [&_[data-slot=dropdown-menu-item]:focus]:text-sidebar-accent-foreground` — or simpler, `dark:` is banned here, so write one explicit class set.
- Never restyle the base `dropdown-menu.tsx`/`tooltip.tsx` components "to match the dark sidebar" — those serve light content surfaces (ExplorerMenu on list/detail, filters) and would break them.

**Warning signs:**
- A white rectangle appears over the dark sidebar when clicking the avatar/username.
- Any edit to `dropdown-menu.tsx` or `tooltip.tsx` base classes during this milestone without a content-side justification.
- Focus highlight inside a dark dropdown is a light gray on light bg (text disappears on hover).

**Phase to address:** Phase 2 (Icon/Collapsed + Portal Integration) — the user-menu dropdown decision belongs with the bottom-zone work.

---

### Pitfall 3: Partial token overrides → contrast failures on dark (AA text, focus rings, active pills)

**What goes wrong:**
Individually plausible token choices fail WCAG AA in combination:
- **`--sidebar-foreground` too gray:** group labels render at `text-sidebar-foreground/70` (`sidebar.tsx:404`). Near-white foreground passes at 70% (≈10:1), but an Exa-ish mid-gray foreground drops to ≈4:1 → below the 4.5:1 AA floor for 12px labels.
- **`--sidebar-accent` left light:** hover/active use `hover:bg-sidebar-accent` / `data-active:bg-sidebar-accent` (`sidebar.tsx:469`). The current `:root` accent is `oklch(0.97 0 0)` — nearly white. A dark sidebar with the accent token unchanged = white flash on every hover/active.
- **Focus rings invisible:** menu buttons use `focus-visible:ring-2 ring-sidebar-ring` and the global `* { @apply outline-ring/50 }` (`globals.css:122`) resolves `outline-ring/50` to **`--ring`** (light gray at 50% alpha) on **every** element — including inside the dark sidebar. A mid-gray ring at half opacity on near-black is ≈1.5:1, far under the 3:1 focus-appearance requirement (WCAG 2.4.11).
- **Active-pill indicator below 3:1:** copying Exa's subtle active treatment (`bg-white/5`-style pill) makes the selected-vs-unselected *indication* ≈1.05:1, failing 1.4.11 non-text contrast. Exa ships this tradeoff; an internal tool used daily should not.

**Why it happens:**
Tokens are independent knobs; teams set `--sidebar` dark, see the background flip, and stop. The failure modes live in the *pairs* (accent+bg, ring+bg, foreground+opacity) and in the global `border-border`/`outline-ring/50` base rules that apply to sidebar elements too (see Pitfall 5's border case).

**How to avoid:**
Treat the token block as a set with a verification budget, not a single change:
1. In Phase 1, set all 8 tokens together with the pairs checked: `--sidebar-accent` ≥3:1 lighter than `--sidebar` (so hover is perceivable) but not white; `--sidebar-foreground` near-white so `/70` labels still pass; `--sidebar-ring` light (≈`oklch(0.9 0 0)`) since ring contrast is against the dark bg.
2. For focus: rely on the tokenized `ring-sidebar-ring` for sidebar buttons and add one scoped rule to neutralize the global outline leak inside the sidebar, e.g. `[data-sidebar="sidebar"] { outline-color: var(--sidebar-ring); }` or set `--ring` only where the sidebar is the dominant surface — do NOT change global `--ring` (content focus rings depend on it).
3. For the active item: choose one of (a) light pill `data-active:bg-sidebar-accent` where `--sidebar-accent` is a clearly lighter gray, with `text-sidebar-accent-foreground` near-white (recommended — token-based, survives collapse/theme changes), or (b) keep the indigo accent but as dark-appropriate shades (`indigo-400/10` bg + `indigo-300` text) — either way the pill-vs-bg must be ≥3:1. Verify with a contrast tool at Phase-3 gate.
4. Phase 3 audit: run a manual contrast pass over every state pair (idle / hover / active / focus-visible / label / badge) on the actual dark values; record ratios in the UAT file.

**Warning signs:**
- Hover on a nav item = near-white block.
- `⌘B`-collapsed then Tab through items with eyes on the ring — ring invisible.
- Group labels ("Start", "Companies"…) hard to read at a glance.
- Active item looks identical to hover item.

**Phase to address:** Phase 1 sets tokens; **Phase 3 (A11y + Regression Verification)** runs the contrast audit gate. Add a Phase-3 task: "WCAG AA contrast check across all sidebar state pairs".

---

### Pitfall 4: Existing hardcoded accents — indigo active state and the amber pending badge

**What goes wrong:**
- `app-sidebar.tsx:40,49,58,67` hardcodes **light** active treatment: `data-active:bg-indigo-50 data-active:text-indigo-600`. On a dark sidebar these render as a near-white indigo pill — technically high contrast, but visually wrong next to Exa-style treatment, and if anyone tweaks them toward "translucent" without setting text (`data-active:bg-indigo-500/15` only), the text falls back to `text-sidebar-foreground` — white-on-tinted-dark, low contrast.
- `SidebarMenuBadge` base class is `text-sidebar-foreground` (`sidebar.tsx:575`). The amber badge currently overrides both (`bg-amber-100 text-amber-800`, `app-sidebar.tsx:75` — amber-100/amber-800 is ≈4.9:1, passes AA). If the restyle sets only a background (`bg-amber-500/25`) and leaves text inherited, badge text becomes near-white on pale amber ≈1.5:1 — invisible count.
- **Collapsed state hides the badge entirely:** `group-data-[collapsible=icon]:hidden` (`sidebar.tsx:575`). The pending-reviews count silently vanishes in icon-only mode — the exact state where a notification indicator matters most. Exa's answer is a dot on the icon; this app currently has none.

**Why it happens:**
These are **static Tailwind palette colors, not tokens** — they are invisible to any `--sidebar-*` change, so the restyle worklist must enumerate them explicitly. Badge hiding on collapse is stock shadcn behavior (it has no collapsed badge primitive); the app inherited it without a review.

**How to avoid:**
- Phase 1 task: sweep `app-sidebar.tsx` (and the resize handle, see Pitfall 5) for hardcoded palette colors and replace with token-based or dark-appropriate classes. Decide the active treatment deliberately (Pitfall 3 options a/b).
- Badge: keep the amber pill identity but make it dark-surface-safe in one explicit class set (`bg-amber-400/20 text-amber-200` + `border border-amber-400/30`, verify ≥4.5:1). Never set bg without text.
- Phase 2 task: collapsed badge. Add a `SidebarMenuBadge` variant that survives collapse — e.g. a small dot (absolute `size-2 rounded-full bg-amber-400`) shown only when `state === "collapsed"` and `pendingCount > 0`, since the count label can't fit 3rem. This is a **new behavior**, not a restyle — it needs its own UAT line item.
- Preserve the `pendingCount > 0` gating (no badge for empty queue) and the server-side count fetch in `app-shell-layout.tsx:27-32` (DB failure → 0, no badge) — don't move the count query into the client component during restyle.

**Warning signs:**
- Collapse the sidebar → pending count disappears with no replacement.
- Badge renders as a light rectangle with unreadable text.
- Active item looks like a white block instead of the intended treatment.

**Phase to address:** Phase 1 (active state + badge colors), Phase 2 (collapsed dot).

---

### Pitfall 5: Mixed-theme artifacts — light border edge, light resize-handle hover, autofill, scrollbars, browser chrome

**What goes wrong:**
A dark panel inside a light app leaks light edges and OS defaults in five distinct places:
1. **Sidebar right edge:** the desktop `sidebar-container` uses `group-data-[side=left]:border-r` with **no color class** (`sidebar.tsx:236`). Border color falls back to the global `@layer base * { @apply border-border }` rule (`globals.css:121-123`) → `--border` = light `oklch(0.922 0 0)`. Result: a light 1px vertical line down the dark sidebar's edge.
2. **Resize handle hover:** `sidebar-resize-handle.tsx:84` hovers `bg-indigo-200` (light) — a bright indigo flash on the dark edge during drag. Default state is transparent, so the handle is also hard to *discover* on a dark surface (it was already subtle on light).
3. **Autofill:** if the Exa-style sidebar adds a search/user input, `SidebarInput` is `bg-background` (`sidebar.tsx:325`) — **white**, and browser autofill paints its own near-white rectangle (`-webkit-autofill` ignores bg). 
4. **Scrollbars:** desktop sidebar hides them via shadcn's `no-scrollbar` utility (present in `node_modules/shadcn/dist/tailwind.css`), so the main risk is the mobile Sheet drawer and any long dark list — default light scrollbars on dark panels.
5. **Browser chrome/favicon:** no `themeColor` metadata and a stock light `favicon.ico`. If the team "matches the dark sidebar" by setting `themeColor` to near-black, mobile browser chrome goes dark while the page is light — a mismatch; and the favicon stays light regardless.

**Why it happens:**
Item 1 is structural: the vendored sidebar relies on the global border rule instead of an explicit token, so the sidebar's own `--sidebar-border` never applies. Items 2–5 are the classic "dark surface, light surroundings" oversights — each is a single unthemed value.

**How to avoid:**
- Phase 1: add explicit `border-sidebar-border` to the `sidebar-container` class (vendored file, one-word change) — or set `--border` scoped to the sidebar wrapper via a custom property override, never globally.
- Phase 1: restyle the resize handle to `hover:bg-sidebar-accent` and give it a resting affordance on dark (e.g. `bg-sidebar-border` at rest, or keep transparent but ensure the cursor + `aria-label` remain; decide explicitly and note it in UAT).
- Phase 2: if adding a sidebar search/user input, override `SidebarInput` to a dark surface (`bg-sidebar-accent/50` etc.) AND add the autofill fix: `-webkit-box-shadow: inset 0 0 0 1000px <sidebar-input-color>; -webkit-text-fill-color: <sidebar-foreground>` on `:-webkit-autofill`.
- Phase 2: verify the mobile drawer (`SheetContent`, `sidebar.tsx:189` — already `bg-sidebar`, so it goes dark automatically once tokens flip) for scrollbar appearance; add `no-scrollbar` or styled scrollbars if needed.
- Phase 3: browser-chrome decision — leave `themeColor` unset or set it to the content bg (`#f8fafc`/slate-50), NOT the dark sidebar color; the sidebar is a column, the browser frame wraps the whole page. Favicon stays as-is unless a branded asset is chosen deliberately (Pitfall 8).

**Warning signs:**
- A light hairline runs down the dark sidebar's right edge.
- Dragging the resize handle flashes indigo.
- White rectangle appears where a username/search field sits when autofilling.
- Mobile drawer shows default scrollbars.

**Phase to address:** Phase 1 (border + handle), Phase 2 (autofill/scrollbars), Phase 3 (chrome decision).

---

### Pitfall 6: Collapsed/icon-only state legibility — icons, tooltips, labels, and the new logo

**What goes wrong:**
In `collapsible="icon"` mode the sidebar is a 3rem rail (`--sidebar-width-icon` = `3rem`, `sidebar.tsx:31`): icons only, `size-8!` buttons, group labels fade out (`opacity-0`), tooltips appear on hover. Regressions specific to dark:
- **Icons** inherit `text-sidebar-foreground` — fine if the token is near-white, invisible if it's a dark/odd value after a partial override.
- **Active state in the rail:** the active pill treatment must still read at 32px with no text; a subtle-gray pill at 3rem is easy to miss entirely (the 3:1 indicator rule from Pitfall 3 is more important here than anywhere).
- **Tooltips:** only render when collapsed (`hidden={state !== "collapsed" || isMobile}`, `sidebar.tsx:533`). Their styling decision is Pitfall 2's; but a subtler trap is that the new **logo/branding zone** (Exa has a top logo) has no natural collapsed form — a wide logo in a 3rem rail overflows or misaligns, and this app has no existing logo component to lean on.
- The **pending badge is hidden when collapsed** (Pitfall 4) — the rail loses its only notification channel.

**Why it happens:**
Collapse is a *different layout*, not a smaller one. Every element that "disappears" (labels, badge) or "shrinks" (logo, item) must be re-decided, and dark tokens make the rail's low-information state even lower-contrast.

**How to avoid:**
- Phase 2 task list, per element: icon color (token), active pill in rail (≥3:1 pill-vs-rail), tooltip content + placement for each of the 4 items (Start/Companies/Key Personas/Reviews — "Reviews" tooltip should include the pending count when >0), collapsed logo treatment (swap to an icon mark or letter mark — a new asset, see Pitfall 8), collapsed badge dot (Pitfall 4).
- Keep the `⌘B` shortcut and `sidebar_state` cookie contract **unchanged** (see Pitfall 7) so collapse behavior is untouched by the restyle.
- Verify in a manual UAT pass: collapse → Tab/arrow through items → each shows a correct tooltip; collapse while `pendingCount > 0` → dot visible on Reviews.

**Warning signs:**
- Collapsed rail shows an overflowing logo or empty gap at top.
- Reviews tooltip in the rail says nothing about pending proposals.
- Active rail icon is distinguishable only by color, and that color is dim.

**Phase to address:** Phase 2 (Icon/Collapsed + Portal Integration).

---

### Pitfall 7: Regression blindness — the no-component-test reality and the cookie/state contract

**What goes wrong:**
The app has Vitest pure-function tests only (dedupKeys, columnMapping, partitionRows, mergePlan, analyzeCompany) and **zero component/e2e tests**; all UI verification is manual UAT + `next build`/tsc (`PROJECT.md` v1.1 debt item). The sidebar restyle touches exactly the behaviors that are easy to silently break:
- **Active highlight on subroutes:** `app-sidebar.tsx` deliberately uses `pathname === '/'` for Start (exact — because every route is a prefix match for `/`) and `.startsWith('/companies')`/`'/personas'`/`'/reviews'` for the rest (`app-sidebar.tsx:39,48,57,66`, with a comment documenting the trap). During restyle, someone "simplifying" to `pathname === '/companies'` silently breaks the highlight on `/companies/[id]` — the most-visited page state.
- **Collapsed badge/tooltip behavior** (Pitfalls 4/6) — pure visual, invisible to `next build`.
- **Cookie contract:** `sidebar_state` (7-day, written by `SidebarProvider`), `sidebar_width` (1-year, clamped 200–400px by `AppShellLayout` + `SidebarResizeHandle`), and the inline `--sidebar-width` style override (`app-shell-layout.tsx:35`). Any restyle that renames the cookies, changes the clamp, drops the inline style, or repurposes `sidebar_state` for theme would lose per-user state silently (or, worse, leak theme state into the collapse cookie).
- **Mobile drawer** goes dark automatically via `bg-sidebar` — but only if nobody overrides `SheetContent` styling while "polishing" the desktop sidebar.

**Why it happens:**
No component tests means the safety net is a human reading a diff or clicking through happy paths. Restyles are when people "tidy" neighboring code (the `isActive` simplification above is a classic drive-by edit).

**How to avoid:**
1. **Extract the nav-active logic into a pure function and test it** — this fits the existing "pure functions only" Vitest convention exactly. `src/lib/nav.ts` exporting `getActiveNavKey(pathname: string): 'start' | 'companies' | 'personas' | 'reviews' | null` (Start = exact `/`, others = prefix, and a guard that `/companies-archive`-style sibling prefixes don't false-positive). Tests cover `/`, `/companies`, `/companies/123`, `/personas`, `/personas/456`, `/reviews`, `/reviews/9`, and `/sign-in`. This is the single highest-leverage verification this milestone can add — it converts the #1 silent regression into a test.
2. **Freeze the state contract in the phase plan:** cookie names, clamp bounds, inline-style override, and `SidebarProvider` props are all "do not touch" unless a plan task explicitly says otherwise; add a diff-review checklist item.
3. **Replicate the v1.1 Phase-5 verification pattern** (6 live-browser interaction checks recorded in a `*-HUMAN-UAT.md`): a scripted matrix of expanded / collapsed / mobile × each of the 4 routes × (idle, hover, active, keyboard-focus) × badge-present/absent, with screenshots. The v1.1 close documented this exact pattern as working.
4. Keep `next build` + tsc in the verify loop for every phase, but explicitly note it catches **nothing** visual — the UAT matrix is the real gate.

**Warning signs:**
- A PR touching `app-sidebar.tsx` also rewrites the `isActive` expressions or the pathname comments.
- Any change to `SIDEBAR_COOKIE_NAME`/`COOKIE_NAME` constants.
- A "refactor" that replaces the inline `style={{ '--sidebar-width': ... }}` with a fixed class.

**Phase to address:** Phase 1 (extract + test `getActiveNavKey` as a Phase-1 task — it can be done before any visual work), Phase 3 (full manual UAT matrix). State-contract freeze applies from Phase 1 planning onward.

---

### Pitfall 8: Over-copying the Exa reference (branding, assets, interaction patterns)

**What goes wrong:**
Copying from dashboard.exa.ai is the milestone's stated intent, and three failure modes are specific to copying a competitor's live product:
1. **Trademark/asset infringement:** Exa's logo, exact icon set, and any imagery/illustrations are Exa's assets. Copying the *layout pattern* (dark rail, grouped nav, bottom user zone) is fine and standard practice; embedding their logo, copying their mark, or hotlinking assets from exa.ai is not, and hotlinking also leaks referrer data + creates a runtime dependency on their uptime/CSP.
2. **Interaction patterns that don't fit:** Exa's nav reflects *their* IA (their sections, their search-overlay pattern, their keyboard scheme). This app's nav is Start / Companies / Key Personas / Reviews with a **drag-resize handle** Exa doesn't have (v1.0–v1.1 shipped that interaction; removing it to "match Exa" would regress a validated feature), cookie-persisted collapse, and a pending badge driven by a server-side count. Copying Exa's *look* must not drag in their *behavior model*.
3. **Design-quality fallback:** Exa's subtle active pill (≈1.05:1 indicator contrast) is a deliberate aesthetic tradeoff on a polished product. Blindly importing it re-imports the a11y failure (Pitfall 3) with none of Exa's surrounding polish.

**Why it happens:**
"Make it look like the reference" is the whole brief, so the natural tendency is pixel-matching — including things that were never intended to transfer.

**How to avoid:**
- Phase 0 (planning) decision, written into the milestone: copy **interaction + visual language** (dark rail, grouping, active treatment *style*), not **brand assets**. The app already owns a logo zone — the milestone needs an ArcLumen mark treatment (or a placeholder letter-mark) for the top zone and collapsed rail, NOT the Exa wordmark.
- Preserve the app's existing interactions as hard constraints: drag-resize (with its cookie), `⌘B` collapse, `sidebar_state`/`sidebar_width` cookies, pending badge driven by `pendingCount`, the 4 nav items and their routes. Exa's exact gray values can be adapted, not copied verbatim (their palette is brand-specific anyway — the near-black/white/gray triad is what transfers).
- If any visual asset is sourced (icon marks, logo), use MIT/Apache icon sets already in the repo (lucide-react is installed) or create originals; record provenance in the phase plan.
- Phase 3 review task: "differ from the reference where the app differs" — check the sidebar against Exa's screenshot and confirm every divergence is intentional (resize handle, badge, Start-page exact-match active).

**Warning signs:**
- An SVG or image file appears in the PR that came from exa.ai or another competitor site.
- The resize handle, `⌘B`, or badge code is deleted "because Exa doesn't have it".
- The nav items are reordered/renamed to mirror Exa's sections.

**Phase to address:** Phase 0/planning decision + Phase 1 (logo/icon sourcing), Phase 3 (divergence review).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Override the 8 `--sidebar-*` tokens in `:root` instead of building a theme system | One-file change, zero content risk, trivially reversible | No `.dark` support later without rework (the `@theme inline` mapping already exists, so a future theme toggle is ~1 hour) | Acceptable — the app is deliberately light-only; re-evaluate only if a real dark-mode requirement appears |
| Hardcode the dark sidebar's active/amber colors as static classes in `app-sidebar.tsx` | Fast, no token ceremony | Drifts from the token system; the next restyle repeats the sweep (Pitfall 4) | Acceptable for this milestone IF the Phase-3 audit covers them; prefer tokens where the component already exposes them |
| Add `getActiveNavKey` as a pure module instead of a React hook | Testable with the existing Vitest convention, zero new infra | A second source of truth for "what does active mean" if pages later compute it differently | Acceptable and recommended — the function is the single source; pages import it |
| Portal-scoped dark classes on `DropdownMenuContent` for the user menu | Matches Exa look | Maintains a second dropdown theme; future dropdowns in the sidebar need the same treatment | Acceptable for ONE component (the user menu) with an explicit comment; never a global override |
| Screenshot-based UAT matrix instead of component tests | No new test infra, matches v1.1 precedent | Regressions can still ship between UAT passes | Acceptable for this milestone; revisit when the sidebar (or any UI) is next touched |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| shadcn sidebar tokens (`--sidebar-*`) | Changing `--sidebar` alone and leaving accent/foreground/ring light (Pitfall 3) | Override all 8 tokens as a verified set; check each pair's contrast |
| Radix portals (DropdownMenu/Tooltip/Sheet) | Assuming sidebar-scoped or `dark:` styling reaches portal content | Portals render at `<body>`; treat them as app-theme (light) or scope them explicitly per-component (Pitfall 2) |
| Global `@layer base *` border rule | Relying on `border-r` in the sidebar to use `--sidebar-border` | It uses `--border`; add explicit `border-sidebar-border` to the container (Pitfall 5) |
| Global `outline-ring/50` on `*` | Thinking sidebar focus rings use `--sidebar-ring` everywhere | Buttons use `ring-sidebar-ring`, but the outline fallback uses `--ring`; add a scoped `--ring`/outline override for the sidebar (Pitfall 3) |
| `sidebar_state` / `sidebar_width` cookies | Renaming/repurposing them during restyle | Freeze the cookie contract; collapse/width persistence is orthogonal to theme (Pitfall 7) |
| Mobile `Sheet` drawer | Restyling only the desktop `Sidebar` | The drawer is `bg-sidebar` and follows the token change automatically; verify it explicitly (Pitfall 5) |
| Browser autofill | Dark input + stock autofill = white rectangle | `-webkit-box-shadow` fill + `-webkit-text-fill-color` on `:-webkit-autofill` (Pitfall 5) |
| `SidebarMenuBadge` collapse hiding | Forgetting the badge disappears in icon mode | Add a collapsed dot variant; treat as new behavior with UAT (Pitfall 4) |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Re-render storm from `usePathname()` in `AppSidebar` | None at this scale — `AppSidebar` is ~80 lines, 4 items | None needed; do not add memoization prematurely | Never at this nav size; revisit only if the nav grows to 100+ items |
| Animation library to mimic Exa's polish | Bundle bloat, FOUC | Use `tw-animate-css` (already installed) + CSS transitions only | N/A — no Exa-specific animation exists in the reference worth porting |
| `--sidebar-width` recomputation per resize pixel | None — resize writes the CSS var imperatively (`sidebar-resize-handle.tsx:27`) | Keep the imperative `style.setProperty` pattern; don't "refactor" to React state per pixel | N/A — this is already the correct pattern |

The sidebar is DOM-light and stateless; there are no real performance concerns in this milestone. Don't invent any.

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Hotlinking/embedding assets from exa.ai | Referrer leakage + runtime dependency on their CSP/uptime + license/trademark violation | Only lucide (installed) or originals; never hotlink (Pitfall 8) |
| Adding a new font/CDN dependency to "match Exa's typography" | Third-party JS/asset surface; the app currently loads only Geist via `next/font` | Reuse Geist (already the app font); if a display font is wanted, self-host via `next/font` |
| Theming changes that flip `--background`/`--popover` globally | Whole-app visual inversion = UI confusion + potential text-on-text | Token override scoped to `--sidebar-*` only (Pitfall 1) |

No new attack surface beyond the above; the sidebar is client-rendered markup over already-authed routes.

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Active item highlight lost on `/companies/[id]` | Users think they've left the section; "where am I" friction on the most-used page | Keep `.startsWith()` prefix logic; lock with `getActiveNavKey` tests (Pitfall 7) |
| Pending badge invisible when collapsed | Missed review queue (the whole point of the badge) | Collapsed dot on Reviews icon (Pitfall 4) |
| White portal flash over dark sidebar | Feels broken/glitchy; erodes trust in the new design | Explicit portal policy: light by default, dark-scoped only for the user menu (Pitfall 2) |
| Tooltips in collapsed mode say nothing about pending items | Keyboard/hover users lose the queue signal | Include count in the Reviews tooltip (Pitfall 6) |
| Resize handle invisible on dark edge | Power users lose the resize interaction they shipped in v1.0/v1.1 | Resting affordance on dark + `hover:bg-sidebar-accent` (Pitfall 5) |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces. **Because there are no component tests, each item below is a manual-verification gate.**

- [ ] **Active highlight on detail pages:** visit `/companies/123` and `/personas/456` — the Companies/Key Personas item must stay highlighted (this is the single most likely silent regression; covered by `getActiveNavKey` tests).
- [ ] **Collapsed badge:** collapse via `⌘B`, confirm the Reviews icon shows the pending dot; expand, confirm count returns and matches.
- [ ] **Collapsed tooltips:** collapse, hover each icon (Start/Companies/Key Personas/Reviews) — tooltip appears right-side, legible, no clipping.
- [ ] **Focus-visible on dark:** collapse, Tab through items — ring must be visible against near-black (≥3:1); check the same on the resize handle and user-menu trigger.
- [ ] **Hover/active contrast pairs:** hover an item (accent pill) and select it (active pill) — both must be distinguishable from idle AND from each other.
- [ ] **Amber badge legibility:** badge text ≥4.5:1 against its own bg; badge bg distinguishable from sidebar bg.
- [ ] **Dark right-edge border:** the sidebar's right edge is dark-on-dark (no light 1px hairline).
- [ ] **Resize handle:** drag works (200–400px clamp), hover affordance visible on dark, `sidebar_width` cookie persists across reload.
- [ ] **Collapse persistence:** `sidebar_state` cookie persists; reload keeps state; no FOUC of a wide sidebar.
- [ ] **Mobile drawer:** below `md`, the drawer is dark, scrolls cleanly (no default scrollbar), closes correctly; content behind stays light.
- [ ] **Portals:** open the user menu in the dark footer — it renders per the written policy (dark-scoped or deliberately light); ExplorerMenu dropdowns on content pages still light and correct.
- [ ] **Autofill (if search/user input added):** trigger browser autofill in the sidebar input — no white rectangle.
- [ ] **Browser chrome:** mobile address bar color matches the app decision (not the dark sidebar); favicon unchanged/deliberate.
- [ ] **Start-page active edge:** on `/` only Start is active; on `/companies` only Companies (no double-active).
- [ ] **No `dark:` classes / no theme toggle** anywhere in the sidebar diff.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Theme strategy wrong (`.dark` flipped, app inverted) | LOW | Revert to the `--sidebar-*` token override (one file); the `.dark` block is untouched dead code |
| Contrast failures | LOW-MEDIUM | Adjust the 8 token values in `:root` only; re-run the Phase-3 contrast audit |
| Portal mismatch (white dropdown on dark) | LOW | Add per-component scoped classes for the one offending portal; revert if it spreads |
| Badge/active-state colors wrong | LOW | Swap the static classes in `app-sidebar.tsx`; re-run the badge UAT line |
| Collapsed-state regressions (badge lost, tooltip missing) | MEDIUM | Restore the `group-data-[collapsible=icon]` treatments; re-run the collapsed UAT matrix |
| `isActive` simplification broke subroute highlight | MEDIUM | Revert to `.startsWith()` + `getActiveNavKey`; the Vitest test catches it permanently |
| Copied Exa asset committed | LOW (asset removal) / HIGH (if it shipped to prod) | Remove asset + purge from git history if already deployed; replace with lucide/original |

---

## Pitfall-to-Phase Mapping

Suggested phase structure for the v1.2 roadmap (exact numbering at `/gsd-new-milestone` — this is the dependency ordering, not a prescription):

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Wrong theming strategy (`.dark`/`dark:`) | Phase 1 — Dark Sidebar Foundation | Diff rule: no `dark:` classes in the milestone; app stays light on every route |
| 3. Partial token overrides → contrast failures | Phase 1 (set tokens) + Phase 3 (audit gate) | Phase-3 task: WCAG AA + 3:1 (focus/indicator) check over all state pairs |
| 4. Hardcoded indigo/amber accents | Phase 1 (colors) + Phase 2 (collapsed dot) | Badge UAT line + collapsed UAT matrix |
| 5. Mixed-theme artifacts (border/handle/autofill/chrome) | Phase 1 (border, handle) + Phase 2 (autofill/scrollbars) + Phase 3 (chrome decision) | "Looks Done" checklist items 6–12 |
| 2. Portal surfaces render light over dark | Phase 2 — Icon/Collapsed + Portal Integration | User-menu + tooltip portal UAT lines |
| 6. Collapsed/icon-only legibility | Phase 2 | Collapsed UAT matrix (tooltips, dot, logo mark, rail active) |
| 7. Regression blindness (no component tests) | Phase 1 (`getActiveNavKey` extraction + Vitest) + Phase 3 (full UAT matrix) | `npm test` covers active logic; live-browser matrix covers the rest |
| 8. Over-copying Exa | Phase 0 planning decision + Phase 1 (asset sourcing) + Phase 3 (divergence review) | Phase-3 task: sidebar-vs-reference screenshot diff with documented divergences |

**Phase ordering rationale:** Phase 1 must land the token foundation + the `getActiveNavKey` tests first — every other pitfall's fix composes on top of the token set, and the test locks the highest-risk behavior before any visual work begins. Phase 2 handles everything that only exists in collapsed/portaled states (which depend on Phase 1's dark tokens existing). Phase 3 is the verification gate: contrast audit, divergence review, and the full manual UAT matrix — the mitigation for the app's no-component-test constraint.

---

## Sources

- Vendored `src/components/ui/sidebar.tsx` (radix-nova style, 702 lines) — token usage, collapse mechanics, badge/tooltip hiding, border-r class, cookie constants — read directly (HIGH)
- `src/app/globals.css` — `:root`/`.dark` token blocks, `@custom-variant dark`, global `border-border`/`outline-ring/50` base rules (HIGH)
- `src/components/layout/app-sidebar.tsx` — `isActive` prefix-vs-exact logic, hardcoded indigo/amber classes (HIGH)
- `src/components/layout/app-shell-layout.tsx` — cookie clamp, `--sidebar-width` inline style, server-side `pendingCount` (HIGH)
- `src/components/layout/sidebar-resize-handle.tsx` — imperative width write, `hover:bg-indigo-200`, cookie contract (HIGH)
- `src/components/ui/dropdown-menu.tsx`, `tooltip.tsx` — Radix portal wrapping + light theme classes (HIGH)
- `src/app/layout.tsx` — hardcoded light body, no theme system (HIGH)
- shadcn/ui sidebar theming docs via Context7 (`/shadcn-ui/ui`) — `--sidebar-*` token override guidance, icon-collapse group-data patterns (HIGH)
- `.planning/PROJECT.md` v1.1 debt: "automated test coverage minimal… no component/e2e; all UI verification manual UAT + live build/tsc" (HIGH)
- dashboard.exa.ai visual characteristics (dark near-black rail, gray pill treatment) — MEDIUM/LOW (observed pattern; specific values not verified)

---
*Pitfalls research for: ArcLumen 360 v1.2 Exa-Style Left Panel*
*Researched: 2026-08-01*
