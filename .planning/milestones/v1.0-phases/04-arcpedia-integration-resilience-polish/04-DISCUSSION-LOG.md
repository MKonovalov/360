# Phase 4: Arcpedia Integration & Resilience Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-23
**Phase:** 4-arcpedia-integration-resilience-polish
**Areas discussed:** Arcpedia matching strategy, Arcpedia section UX, Resilience polish scope (EXPL-06)

---

## Arcpedia Matching Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Keyword search by name | `GET /api/wiki/search?q=<name>`, zero-config, no Arcpedia-side changes | ✓ |
| Manual tag convention | Team tags articles with company/persona name as `tags`, query via `/api/wiki/dataview` | |
| Hybrid: tag first, keyword fallback | Best coverage+precision, more moving parts | |
| You decide | | |

**User's choice:** Keyword search by name
**Notes:** Arcpedia has no built-in company/persona entity linkage — confirmed via `SCHEMA.md`, tags are freeform topics only. Manual tagging would ship empty until the team adopts a new convention, so keyword search was the lowest-friction choice for milestone 1.

| Option | Description | Selected |
|--------|-------------|----------|
| Show everything, no filtering | Simplest, matches thin-integration scope | ✓ |
| Filter out low-confidence/expired | Threshold >= 0.55 (Arcpedia's own lint threshold), hide expired | |
| Show all, but flag stale/low-confidence | Visual indicator, no hiding | |
| You decide | | |

**User's choice:** Show everything, no filtering
**Notes:** No confidence/staleness logic this phase.

| Option | Description | Selected |
|--------|-------------|----------|
| Persona name only | Symmetric with Company 360's single-name query | ✓ |
| Persona + current company name | More context, but overlapping results between persona/company pages | |
| You decide | | |

**User's choice:** Persona name only

| Option | Description | Selected |
|--------|-------------|----------|
| Live, on every page load | Matches existing no-caching codebase pattern | |
| Cached with short TTL | Faster repeat loads, new cache-invalidation pattern | |
| You decide | | ✓ |

**User's choice:** You decide
**Notes:** Claude leans live/no-cache — consistent with every other data fetch in this codebase (no caching layer exists anywhere yet). Revisit if research shows real latency issues.

---

## Arcpedia Section UX

| Option | Description | Selected |
|--------|-------------|----------|
| New section at the bottom | Lowest-risk, matches existing single-column detail pane stack | ✓ |
| Sidebar/aside panel | More prominent, but no 2-column layout exists to reuse | |
| You decide | | |

**User's choice:** New section at the bottom

| Option | Description | Selected |
|--------|-------------|----------|
| Title + snippet | Richer, matches "trustworthy 360 view in seconds" core value | ✓ |
| Title only | Simplest, no dependency on API response shape | |
| You decide | | |

**User's choice:** Title + snippet
**Notes:** Research must confirm `/api/wiki/search`'s actual response fields before planning locks exact rendering.

| Option | Description | Selected |
|--------|-------------|----------|
| New tab to Arcpedia | Standard external link, same pattern as existing LinkedIn links | ✓ |
| You decide | | |

**User's choice:** New tab to Arcpedia

| Option | Description | Selected |
|--------|-------------|----------|
| 3 | Tight, scannable | ✓ |
| 5 | More coverage | |
| You decide | | |

**User's choice:** 3

---

## Resilience Polish Scope (EXPL-06)

| Option | Description | Selected |
|--------|-------------|----------|
| Same inline-card pattern | Extends the already-shipped list-pane try/catch pattern to detail panes | |
| Next.js error.tsx boundary | New pattern for this codebase, could take down more than intended | |
| You decide | | ✓ |

**User's choice:** You decide
**Notes:** Claude leans toward the same inline-card pattern for consistency with the already-shipped list panes. Codebase scout confirmed detail panes currently have zero error handling — a DB failure hits Next.js's default 500 page today.

| Option | Description | Selected |
|--------|-------------|----------|
| Degrade silently, hide the section | Arcpedia treated as nice-to-have, rest of page unaffected | |
| Show a small inline error in that section only | Visible but scoped failure, rest of page unaffected | |
| You decide | | ✓ |

**User's choice:** You decide
**Notes:** Either is acceptable — the hard requirement is that the rest of the 360 view must stay usable regardless of Arcpedia's availability. Treated as its own try/catch, separate from the DB-fetch error handling (two independent external systems, two independent failure domains).

| Option | Description | Selected |
|--------|-------------|----------|
| Own Suspense boundary | Streams independently, avoids blocking the whole page on a slow external API | |
| Part of the existing route-level loading | Simpler, no new pattern, but slow Arcpedia delays the whole page | |
| You decide | | ✓ |

**User's choice:** You decide
**Notes:** Check actual Arcpedia response latency during research before introducing Suspense/streaming, which is a new pattern for this codebase.

| Option | Description | Selected |
|--------|-------------|----------|
| "No related articles found" | Neutral copy, matches existing empty-state tone | |
| Hide the section entirely | Same treatment as a failure — nothing to show means don't show it | ✓ |
| You decide | | |

**User's choice:** Hide the section entirely

---

## Claude's Discretion

- Arcpedia fetch caching strategy (live vs. cached) — leaning live/no-cache for consistency with the existing codebase
- Detail-pane error-handling pattern (inline-card vs. error.tsx) — leaning inline-card for consistency with list panes
- Arcpedia-section failure display (silent vs. visible inline note) — either acceptable, rest of page must stay usable
- Arcpedia-section loading UX (own Suspense boundary vs. existing route-level loading) — depends on research into actual API latency

## Deferred Ideas

None — discussion stayed within phase scope. Manual tag-based matching and confidence/staleness filtering were considered and explicitly declined for milestone 1 (see decisions above), not deferred to a future phase.
