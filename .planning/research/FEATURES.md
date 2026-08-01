# Feature Research — Exa-Style Left Navigation Panel (v1.2)

**Domain:** Dark/modern dashboard sidebar redesign (reference: dashboard.exa.ai left panel)
**Researched:** 2026-08-01
**Confidence:** HIGH (primary evidence = the live production HTML/CSS of dashboard.exa.ai, fetched 2026-08-01)

> **⚠️ Headline finding — the Exa sidebar is LIGHT, not dark.**
> Every public source shows dashboard.exa.ai's left panel on a **near-white background (`#fbfcfd`)** with a hairline right border — *not* a near-black panel. This was verified three independent ways: (1) the production CSS embedded in the dashboard's own HTML (`background:#fbfcfd`), (2) 7 real screenshots on gummble.com/apps/exa-web (captured 2026-04-14), all showing a light sidebar, (3) live page metadata. The "dark" surfaces in Exa's design language are the **marketing site's dark editorial bands (`#181815`)** and the **playground's dark code/output panels** — never the dashboard sidebar. The milestone's stated target ("Dark Exa-style sidebar panel (near-black)") is **not what dashboard.exa.ai ships**. This file specs the *actual* reference design, and treats the dark variant as a separate, clearly-labeled decision point (see Anti-Features #1).

---

## Feature Landscape

### Table Stakes (defining traits of the Exa sidebar — the redesign must ship these)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Light near-white panel `#fbfcfd` + 0.5px hairline right border (`var(--gray-200)`) | The single most defining trait of the reference. Panel is barely distinguishable from the white content area; separation comes from the hairline, not a fill contrast | LOW | Override `--sidebar` token or set `bg-[#fbfcfd]` on `<Sidebar>`; border via `border-r` on the wrapper. **Directly contradicts the milestone's "near-black" assumption — see Anti-Feature #1** |
| Logo + team-name switcher zone at top (one 36px row) | Exa's top-left holds the logo mark (16px, `#1F40ED` fill) + team name + `chevrons-up-down` (16px muted icon); trigger is a radix dropdown-menu with `border-radius: var(--border-radius-default)`, `padding: 8px 12px`, `max-width: 180px` | MEDIUM | ArcLumen has no logo asset (public/ holds only Next/Vercel defaults) and no multi-team model. Decision needed: invent a wordmark, use a text wordmark, or a static org label without switcher. Docs confirm the switcher lives "in the top-left of the dashboard" (exa.ai/docs/reference/setting-up-team) |
| Intent-grouped nav sections with muted gray 13px/500 labels | Section titles are `ABC Diatype 13px / 500 / #888888`, `margin-bottom: 4px`, `padding: 0 8px`; sections separated by `margin: 12px 0` (first `10px`), `gap: 2px` between items. Groups = **API Playground / Management / Learn** (labeled by user intent, not hierarchy) | LOW | shadcn `SidebarGroupLabel` exists unused in the primitive — wire it. ArcLumen mapping: e.g. **Explore** (Start, Companies, Key Personas) / **Manage** (Reviews) — exact grouping is a roadmap decision, routes stay unchanged |
| Nav item anatomy: 30px rows, 16px lucide icon + 15px/400 label, 10px gap, 8px horizontal padding | Production CSS: `height:30px; padding:0 8px; gap:10px; font-size:15px; font-weight:400; line-height:24px; color:#444444`; icon inherits `currentColor` (monochrome) | LOW | shadcn `SidebarMenuButton` default is close; tune size classes. Add the `Inbox`/house/etc. icons per item (lucide already installed) |
| Subtle active state: 4px-radius full-row fill + darker text | Production CSS (live): active = `color: black` + `::before { background: rgba(0,0,0,0.04); border-radius:4px; }` — a whisper-gray fill, no left indicator bar, no border | LOW | Replaces current `data-active:bg-indigo-50 data-active:text-indigo-600`. **Conflict flag:** April 2026 gummble screenshots show a *blue* fill + blue text active state; live Aug 2026 CSS shows gray fill + black text. Either Exa changed the style, or the screenshots are older. Recommend the live-CSS version (gray), with ArcLumen's indigo reserved for the badge/links only |
| Bottom zone: full-width action pill → 0.6px divider → avatar + username | Production CSS: `margin-top:auto; padding:12px 22px 16px 18px; gap:6px`; feedback pill is `rounded-[6px] border` (muted surface bg, 14px text, hover = border color); divider `0.6px var(--gray-200)`, `margin:8px 0`; avatar 24px circle `#C3ECFF` (light blue) with `text-blue-800` initials + username 15px/500 | MEDIUM | "Give us feedback" needs a real destination (mailto / Arcpedia link — decision). Avatar/username maps to Clerk session (`useUser()`), replacing the missing current bottom chrome |
| Collapse: top-right icon button (lucide `panel-left-close`, 24×24, radius 4px) with animated width | `position:absolute; top:14px; right:22px`; container `transition:width 0.2s ease-in-out`; labels fade (0.12s opacity) and clamp (`max-width`); bottom section wraps in `max-height:60px` collapsible; content area tracks `left: var(--sidebar-width)` | MEDIUM | shadcn's `data-collapsible="icon"` gives the rail behavior; Exa collapses to an icon rail (labels fade, icons stay). Must reconcile with the existing drag-to-resize handle + cookie persistence — see Dependency #5 |
| Right-aligned "NEW" badge: mono 10px/600 accent chip | `--font-family-protomono, 10px/600`, accent fill + accent text, `mix-blend-mode: multiply`, `margin-left:auto` right-aligned in the row | LOW | Current `SidebarMenuBadge` (amber "N pending") restyled to this chip language while keeping count semantics — or Exa-style literal "NEW" if a new feature lands |

### Differentiators (Exa moves worth copying deliberately)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Intent-first section grouping ("API Playground / Management / Learn") | Groups tools by *what the user wants to do* (search/crawl/research vs account ops vs learning) rather than by permission level or page hierarchy — UXSnaps: "Navigation is structured around user intent… Consistent icons, restrained color, and subtle labels like New make discovery easy without clutter" | LOW | ArcLumen analog: **Explore** (Start / Companies / Key Personas) + **Manage** (Reviews). This is the structural differentiator — copying it costs almost nothing and makes the sidebar feel "designed" |
| Scarce electric-blue brand voltage (`#1F40ED`) | Exa's brand blue appears only as logo fill, inline links, and the NEW badge — never as the active-nav fill. Scarcity is the move; it reads as precision (shadcn.io/design/exa breakdown) | LOW | ArcLumen's indigo plays this role; keep it out of the active state (gray fill) for authenticity |
| External-link affordance: `arrow-up-right` (14px, muted) on rows that leave the app | Signals "leaves dashboard" without a tooltip or label; `margin-left:auto` right-aligned | LOW | Only if ArcLumen adds outbound links (Arcpedia, docs). Not needed for the 4 current routes |
| "Give us feedback" as a persistent, bordered, full-width bottom pill | A quiet, always-available human channel at the exact place the eye lands when nav is done — cheaper than a feedback modal, more discoverable than a footer link | MEDIUM | Map to a real destination (mailto: team inbox). Anti-spam/misuse consideration for internal tool is minor |
| Monochrome `currentColor` icons + custom brand marks at 0.8 opacity | Icons inherit text color (dark on hover/active automatically); third-party marks (Slack logo) sit at `opacity:0.8` to avoid competing | LOW | ArcLumen has no third-party marks yet — just use lucide consistently |
| Team name skeleton on load (`12px` gray pulse) | Communicates async team data without layout shift | LOW | Only relevant if a team/org name is fetched server-side |

### Anti-Features (things NOT to copy / traps)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Dark near-black sidebar panel** | The milestone explicitly targets it; Exa's marketing dark bands and dark code panels create the association | The actual dashboard.exa.ai sidebar is **light `#fbfcfd`** — a dark panel would *not* match the reference at all. Dark would also invert every nav surface and likely clash with the light content area + `SidebarInset` | If a dark panel is truly wanted, it is an **invented** design: use Exa's dark-band vocabulary (`#181815` floor, white text, scarce `#1F40ED`) and label it a deliberate departure in the roadmap. Do not present it as "matching Exa" |
| Copying Exa's nav *items* (Search / Agent NEW / Contents / Answer / Monitors…) | Familiarity with the reference | ArcLumen's routes are Start / Companies / Key Personas / Reviews — copy the *anatomy and grouping*, never the items. Exa's own items changed between April and Aug 2026 (Crawling/Research → Agent/Monitors) | Map existing routes into intent groups only |
| Blue active fill + blue text (April 2026 screenshots) | Matches the classic Exa look some people remember | Conflicts with the *live* production CSS (gray `rgba(0,0,0,0.04)` fill + black text, Aug 2026). Also duplicates the badge color and weakens the scarce-brand-voltage principle | Follow the live CSS: subtle gray fill, dark text; keep ArcLumen indigo for the pending badge and any links |
| Loading skeletons everywhere | Polish | The team-name skeleton is loading chrome for *async team data* ArcLumen doesn't have; 4 nav items don't need skeletons | Render statically; skip skeletons entirely |
| Arizona serif display / editorial typography | Signature of Exa's marketing site | That's the marketing display tier (76.8px hero), not the dashboard sidebar; sidebar runs ABC Diatype sans at 13–15px. ArcLumen already uses Geist (nova preset) — fine | Keep Geist; mono only for badge/metadata |
| Floating "Ask ExaBot" chat pill | Seen on dashboard screenshots | It's content-area chrome, not sidebar; ArcLumen has an Analytic Agent already accessed via ExplorerMenu | Leave it out of this milestone |
| Collapse-to-icon-rail *replacing* drag-to-resize | Exa's collapse is a fixed-width animation | Current app has a proven drag-resize with cookie persistence (SidebarResizeHandle, MIN 200 / MAX 400). Removing it would regress a validated feature (v1.0 Phase 2 requirement) | Keep resize + collapse coexisting (Exa's own width is a CSS var — compatible); decide behavior matrix explicitly |

---

## Feature Dependencies

```
Light #fbfcfd panel + hairline border
    └──requires──> --sidebar token override (globals.css) + <Sidebar> class change

Section labels (API-Playground-style groups)
    └──requires──> SidebarGroupLabel (exists unused in shadcn primitive)
                       └──requires──> AppSidebar restructure into <SidebarGroup>s

Exa item anatomy (30px / 16px icon / 15px label)
    └──requires──> replacing current data-active indigo classes with rgba(0,0,0,0.04) fill
                       └──requires──> SidebarMenuButton size/class tuning

Logo + team zone (top)
    └──requires──> NEW: ArcLumen logo/wordmark asset (none exists today)
    └──requires──> DECISION: org/team name source (static vs Clerk org)

Bottom zone (feedback pill + divider + avatar)
    └──requires──> DECISION: feedback destination (mailto/Arcpedia)
    └──requires──> useUser() from @clerk/nextjs for avatar/initials/username

NEW-style badge (mono accent chip)
    └──enhances──> existing SidebarMenuBadge (amber pending-count) — restyle, keep count

Collapse button (panel-left-close, top-right)
    └──requires──> DECISION: relationship to SidebarResizeHandle (Exa: width animation;
                   current app: drag resize + cookie). shadcn already has data-collapsible
                   infrastructure; Exa's own --sidebar-width var is the same mechanism

Dark panel variant (IF chosen)
    └──conflicts──> Light #fbfcfd panel (mutually exclusive; a milestone-scoping decision)
    └──requires──> Exa dark-band token set (#181815, white text) — invented, not reference
```

### Dependency Notes

- **Light panel requires theme-token override:** the nova `neutral` preset sets `--sidebar: oklch(0.985 0 0)` (near-white) already; the delta to `#fbfcfd` is tiny but the *border* (0.5px hairline) is new. Both live in globals.css `:root`.
- **Section labels depend on primitive already shipped:** `SidebarGroupLabel` is part of the installed shadcn `sidebar.tsx` (702 lines) but unused today — zero new infra.
- **Logo zone is the only hard dependency:** no ArcLumen logo asset exists; the milestone either ships a wordmark or a text treatment. This is the one place where a design decision (not just styling) is required.
- **Collapse vs resize is the only behavioral conflict:** Exa collapses with an animated width (its `--sidebar-width` var), the current app drags to resize (same var, cookie-persisted). They can coexist (shadcn `collapsible="icon"` + the existing resize handle), but the roadmap must decide the collapse target width and whether the drag handle stays visible.
- **Dark panel conflicts with the reference:** choosing it invalidates the "matches dashboard.exa.ai" framing of the whole milestone; must be surfaced to the product owner before planning (see Anti-Feature #1).

---

## MVP Definition

### Launch With (v1.2)

- [ ] Light `#fbfcfd` panel + 0.5px hairline right border (replaces current flat white) — the defining Exa trait
- [ ] Intent-grouped sections using existing routes (e.g. **Explore**: Start / Companies / Key Personas; **Manage**: Reviews) via `SidebarGroupLabel`
- [ ] Exa item anatomy: 30px rows, 16px lucide icons, 15px/400 labels, 8px padding, 10px gap
- [ ] Subtle active state: 4px-radius `rgba(0,0,0,0.04)` fill + dark text (live-CSS version), replacing indigo-50/600
- [ ] Top logo zone (wordmark decision required) + bottom user zone (avatar/initials from Clerk + username)
- [ ] Pending-reviews badge restyled to the mono accent chip language (count semantics preserved)
- [ ] Collapse button + animated width; drag-to-resize preserved

### Add After Validation (v1.2.x)

- [ ] "Give us feedback" pill — once a destination is decided (mailto/Arcpedia); trivially skippable without it
- [ ] External-link affordance (`arrow-up-right`) on any outbound rows (Arcpedia/docs)
- [ ] Dark variant as an opt-in theme — only if the light reference is confirmed with the owner first

### Future Consideration (v2+)

- [ ] Real team/org switcher (multi-team model) — ArcLumen has no teams today; Exa's dropdown only matters with >1 team
- [ ] Team-name skeleton / async org header data — needs a server-side org concept first

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Light panel + hairline border | HIGH (identity) | LOW (token + class) | P1 |
| Intent-grouped sections | HIGH (discoverability) | LOW (SidebarGroupLabel exists) | P1 |
| Item anatomy (30px/16px/15px, icon+label) | HIGH (feel) | LOW (class tuning) | P1 |
| Subtle gray active state | HIGH (feel) | LOW (replace data-active classes) | P1 |
| Top logo zone | MEDIUM (branding) | MEDIUM (asset decision) | P1 |
| Bottom user zone (avatar/username) | MEDIUM (identity) | LOW–MEDIUM (Clerk useUser) | P1 |
| Pending badge restyle (mono accent chip) | MEDIUM (status) | LOW (SidebarMenuBadge class) | P1 |
| Collapse button + width animation | MEDIUM (ergonomics) | MEDIUM (coexist with resize) | P2 |
| Feedback pill | LOW–MEDIUM | LOW (once destination decided) | P2 |
| External-link affordances | LOW | LOW | P3 |
| Dark variant | n/a — contradicts reference | HIGH (inverts all nav styling) | P3 / decision |

**Priority key:** P1 = required to *look* like Exa's sidebar · P2 = should-have · P3 = nice-to-have / needs owner decision.

---

## Competitor Feature Analysis

| Feature | Exa Dashboard (reference) | ArcLumen Today (v1.1) | Our Target (v1.2) |
|---------|---------------------------|------------------------|-------------------|
| Panel background | `#fbfcfd` (near-white, blue-tinted) + 0.5px gray-200 right border | `--sidebar: oklch(0.985 0 0)` (white), no hairline | `#fbfcfd` + hairline border |
| Top zone | 16px `#1F40ED` logo + team name + chevrons (36px row, radix dropdown) | none | Logo/wordmark + org label (static or Clerk org) |
| Sections | API Playground / Management / Learn (13px/500 `#888888` labels) | single flat group, no labels | Intent groups over existing routes |
| Item anatomy | 30px rows · 16px icon · 15px/400 label · 10px gap · 8px padding | shadcn default (`SidebarMenuButton`), ~14px label | Exa dimensions |
| Active state | `rgba(0,0,0,0.04)` fill, 4px radius, black text (live CSS; blue in Apr 2026 shots) | `indigo-50` fill + `indigo-600` text | subtle gray fill + dark text (ArcLumen indigo reserved for badge) |
| Hover state | same `rgba(0,0,0,0.04)` fill | indigo-tinted (via data-active hover classes) | gray fill |
| Badges | right-aligned mono 10px accent chip ("NEW", `mix-blend-multiply`) | amber `SidebarMenuBadge` "N pending" | mono accent chip w/ pending count |
| Bottom zone | "Give us feedback" pill → 0.6px divider → 24px `#C3ECFF` avatar + name | none | feedback pill (optional) → divider → Clerk avatar + name |
| Collapse | `panel-left-close` button top-right, 0.2s width anim, labels fade | shadcn collapsible + drag-resize (cookie) | collapse button + keep drag-resize |
| Icon treatment | lucide 16px `stroke-width:2`, `currentColor`, custom marks @ 0.8 opacity | lucide, colored by active state | monochrome `currentColor` |
| External links | `arrow-up-right` 14px muted, `margin-left:auto` | n/a | only if outbound rows exist |

---

## Sources

| Source | Used For | Confidence |
|--------|----------|------------|
| `dashboard.exa.ai/home` production HTML + embedded styled-components CSS (fetched 2026-08-01, full extraction incl. `Sidebar__Container` `background:#fbfcfd`, `border-right:0.5px solid var(--gray-200)`, `NavItemStyled` 30px/15px/400/#444444, `rgba(0,0,0,0.04)` active fill, `NavSectionTitleStyled` 13px/500/#888888, `NewTag` mono 10px/600 + `mix-blend-multiply`, `BottomSection`, `FeedbackDivider` 0.6px, `CollapseButton` panel-left-close 24×24 top:14/right:22, width transition 0.2s, avatar `#C3ECFF`, "Give us feedback" pill, complete nav DOM: Home / Search / Agent NEW / Contents / Answer / Monitors / Usage / Billing / API Keys / Team Settings / Exa in Slack / Docs↗ / Exa MCP↗ / Templates) | All concrete design values (colors, sizes, spacing, structure, interactions) | **HIGH** — primary source, current production |
| `dashboard.exa.ai/playground/*` + `/home` + `/onboarding-guest` page metadata (WebSearch/WebFetch, 2026-08-01): section labels "API Playground / Management / Learn", "Give us feedback", current item list | Nav structure & section names (cross-check) | **HIGH** (live pages) |
| gummble.com/apps/exa-web — 94+ real Exa Web screenshots (captured 2026-04-14); 7 analyzed via image analysis | Light sidebar, team switcher (logo + name + chevrons), section labels, **blue active fill** (conflicts with live CSS — flagged), NEW badge, feedback + avatar footer, external-link ↗ | **MEDIUM** — screenshots consistent but predate the live CSS; active-state color conflicts |
| UXSnaps breakdown — uxsnaps.com/home-dashboard-exa | "Navigation is structured around user intent… groups tools by what users want to do… Consistent icons, restrained color, and subtle labels like New" — validates intent grouping and restraint | MEDIUM — secondary analysis |
| exa.ai/docs/reference/setting-up-team | Team dropdown "in the top-left of the Exa dashboard" + team-switcher screenshot | MEDIUM — official docs, screenshot of sidebar top zone |
| shadcn.io/design/exa (+ `/raw` DESIGN.md) | Brand tokens: electric blue `#1f40ed` (scarcity principle), dark band `#181815` (marketing, not dashboard), ABC Diatype body/labels, Geist Mono metadata, 2px/4px/6px tight radius scale, greige neutrals | MEDIUM — captures marketing site, explicitly notes the dashboard carries "richer token systems… not represented here" |
| exa.ai/docs/changelog + current API docs | Nav evolution (Search/Deep Search/Contents/Agent; "Try it in the dashboard →") — shows the sidebar items are product-driven and change over time; do not copy items | MEDIUM |
| Current ArcLumen code (this repo): `app-sidebar.tsx`, `app-shell-layout.tsx`, `sidebar-resize-handle.tsx`, `ui/sidebar.tsx`, `globals.css` | Dependency mapping for the redesign | HIGH (local, read 2026-08-01) |

**Evidence hierarchy note:** the live production CSS of dashboard.exa.ai is treated as the ground truth for all concrete values (colors, dimensions, spacing, transitions). Where screenshots (April 2026) conflict with live CSS (Aug 2026) — specifically the active-state color (blue fill vs gray fill) — the conflict is reported explicitly with both sources rather than resolved by invention. The nav *items* also differ between the two captures (Crawling/Research/Websets/Examples Library in April vs Agent/Monitors/Exa in Slack/Templates now), confirming items are volatile; the milestone must copy the *design language*, not the items.

---

### Research flags for the roadmap

- **Phase 0 decision gate:** light (matches reference) vs dark (invented) — must be resolved with the product owner before any planning; the milestone's current framing ("dark Exa-style panel") does not match the reference product.
- **Phase 0 decisions:** logo/wordmark asset, org-name source, feedback destination, collapse-vs-resize coexistence matrix.
- **Likely low-risk phases:** token overrides, section labels, item anatomy, active state, badge restyle (all LOW complexity, no new infra).
- **Needs deeper research before execution:** none blocking — the design language is fully specified above from primary evidence.

---
*Feature research for: ArcLumen 360 v1.2 — Exa-Style Left Panel*
*Researched: 2026-08-01*
