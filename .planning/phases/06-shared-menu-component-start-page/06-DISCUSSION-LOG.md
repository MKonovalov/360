# Phase 6: Shared Menu Component + Start Page - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-30
**Phase:** 6-Shared Menu Component + Start Page
**Areas discussed:** Start Page routing & landing, Recently-viewed capture, "Needs attention" semantics, Menu button placement

---

## Start Page routing & landing

| Option | Description | Selected |
|--------|-------------|----------|
| Replace `/` entirely, gate it | Dashboard becomes `/`, wrapped in the same sidebar layout as /companies; signed-out visitors see a sign-in prompt instead of today's status card | ✓ |
| New route (e.g. /start), `/` stays as-is | Dashboard lives at its own path; root keeps today's bespoke public status page | |
| You decide | Claude picks based on implementation cleanliness | |

**User's choice:** Replace `/` entirely, gate it

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — add a nav item, same shell | AppSidebar gets a third item above Companies/Key Personas | ✓ |
| No — standalone page, no sidebar | Dashboard is a distinct full-bleed experience outside the explorer shell | |

**User's choice:** Yes — add a nav item, same shell

---

## Recently-viewed capture

| Option | Description | Selected |
|--------|-------------|----------|
| Client effect on row expand | Small client component in CompanyDetail/PersonaDetail fires the write on mount | ✓ |
| Only on the legacy /companies/[id] redirect stub | Write only happens on old-bookmark landing before redirect | |
| You decide | Claude picks the trigger point during planning/research | |

**User's choice:** Client effect on row expand

| Option | Description | Selected |
|--------|-------------|----------|
| 5 items, upsert by (user, record) | Matches Salesforce's compact convention; re-opening bumps to top | ✓ |
| 10 items, upsert by (user, record) | Same dedup, longer list | |
| You decide | Claude picks a reasonable default | |

**User's choice:** 5 items, upsert by (user, record)

---

## "Needs attention" semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Piggyback on recently-viewed | Reuses the recently-viewed table; a Company is "reviewed" if any staff has a row for it within the threshold | ✓ |
| Explicit "Mark reviewed" action | New deliberate button/action, separate from viewing | |
| Defer this section | Ship the other 4 dashboard sections now, fast-follow this one | |

**User's choice:** Piggyback on recently-viewed

| Option | Description | Selected |
|--------|-------------|----------|
| strength = 'high', not viewed in 14 days | Top signal tier only, 2-week staleness window | ✓ |
| strength = 'medium' or 'high', not viewed in 7 days | Wider net, tighter window — more aggressive triage | |
| You decide | Claude picks defaults; tunable later, no schema impact | |

**User's choice:** strength = 'high', not viewed in 14 days

---

## Menu button placement

| Option | Description | Selected |
|--------|-------------|----------|
| Menu dropdown left of the X | Both controls stay in the top-right corner as a button group | ✓ |
| Move close button, Menu takes top-right | Reposition ExplorerCloseButton elsewhere, Menu gets the corner alone | |
| You decide | Claude picks the concrete layout during planning/research | |

**User's choice:** Menu dropdown left of the X

**Notes:** This resolves a collision flagged during Phase 5's discussion (`05-CONTEXT.md` D-05: "Place the close control top-right of the expanded panel — same corner Phase 6's 'Menu' button will land in, so the two don't collide later").

| Option | Description | Selected |
|--------|-------------|----------|
| Separate top-right element | Matches MENU-01's literal wording, visually distinct from search/filter controls | ✓ |
| Inside the existing filter row | Menu lives alongside search/filters, right-aligned | |

**User's choice:** Separate top-right element

---

## Claude's Discretion

- Exact query shape for dashboard stats/needs-attention queries (Drizzle `count()`/`sql` conventions)
- Exact shadcn `dropdown-menu` installation and Menu/MenuItem composition
- Server Action vs. Route Handler for the recently-viewed write path
- Exact stat-card / list-row visual composition on the Start Page

## Deferred Ideas

None beyond what's already tracked in `.planning/REQUIREMENTS.md`'s v2 section (`START-D01` team-wide activity feed). An explicit "Mark reviewed" action was considered and explicitly rejected in favor of piggybacking on recently-viewed — not deferred, decided against.
