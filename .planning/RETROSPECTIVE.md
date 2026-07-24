# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-07-24
**Phases:** 4 | **Plans:** 14 | **Sessions:** several across 8 days (2026-07-16 → 2026-07-24)

### What Was Built
- Full Astro/Sanity → Next.js 16 App Router / Neon Postgres + Drizzle migration, Clerk auth carried forward via a single `requireStaffAccess()` gate
- Company Explorer: searchable/filterable list with signal badges, master-detail 360 view, URL-synced state
- Persona Explorer: same master-detail pattern reused end-to-end, full click-through browsability across both explorers
- Read-only Arcpedia knowledge integration (`fetchArcpediaArticles()`) surfaced on both 360 views, capped at 3 results, never-throws
- Resilience polish — every list and detail pane handles empty/loading/error states explicitly with independent failure domains

### What Worked
- Reusing the master-detail/URL-state pattern from Phase 2 in Phase 3 (Persona Explorer) meant Phase 3 shipped faster with fewer surprises — the pattern was already proven
- Sequencing the foundation migration (Phase 1) before any UI work paid off — no rework was needed when Phases 2-4 built on top of it
- Independent failure domains (DB fetch vs. external API fetch, established in Phase 4) made the resilience requirement (EXPL-06) mechanically simple to verify via grep + live testing, rather than requiring subjective judgment calls
- Live-reproducing integrations during verification (curling Arcpedia directly, checking Vercel env vars, not just trusting SUMMARY.md claims) caught a real gap (Persona-side content) that would have been missed by code review alone

### What Was Inefficient
- Phase 3 shipped a silent no-op bug (`hasSignals: false` filter) that collapsed with `undefined` at both the URL-parsing and query layers — caught by code review same-day, but duplicated logic across two files was the root cause; consolidating into `src/lib/params/personaFilters.ts` after the fact should have been the shape from the start
- Phase 4's Cloudflare Access token provisioning hit two non-obvious infra gotchas in sequence (wrong Access app in the policy scope, then a `pk_live_` vs `pk_test_` Clerk key blocking local sign-in) — both were diagnosable but cost real back-and-forth; worth flagging Cloudflare's multi-app-per-domain behavior and prod-vs-dev Clerk key separation as known gotchas for future infra work
- No automated test suite exists anywhere in the repo across all 4 phases — every verification pass relied on `tsc`/`build`/`grep` acceptance criteria plus manual UAT; UAT items across phases still show partial/pending at milestone close (7 items acknowledged as deferred rather than blocking)

### Patterns Established
- Independent failure domains: any component reading from two data sources (internal DB + external API) should use fully separate try/catch scopes, never let one source's failure masquerade as the other's
- Never-throws service module pattern for external reads: wrap the entire fetch in one try/catch, degrade to a safe empty value, never log the caught error (avoids leaking credentials/response bodies)
- Cloudflare Access Service Tokens must be added to the *specific* Access application's policy that gates the actual requested path — a domain can have multiple Access apps scoped to different path patterns
- Local dev against a production Clerk instance's `pk_live_` key silently fails (browser `_baseFetch` error, stuck on sign-in) because prod instances restrict allowed origins — local dev needs a separate `pk_test_`/`sk_test_` development instance

### Key Lessons
1. When an env var is declared `.optional()` to "degrade gracefully," verify it degrades gracefully on a *malformed-but-present* value too, not just when unset — `z.string().url().optional()` alone still throws on a typo; needs `.catch(undefined)` for true graceful degradation
2. Duplicate logic across files (e.g. filter-parsing duplicated across two page components) is a recurring source of the "fixed in one place, broken in the other" bug class — consolidate into one shared module as soon as the second copy appears, not after a bug surfaces
3. Verification that only reads SUMMARY.md claims can miss real gaps; independently reproducing the actual integration (live curl, live env var check) during phase verification caught a genuine data-availability gap that would otherwise have shipped as an unverified claim

### Cost Observations
- Model mix: not tracked this milestone
- Sessions: several across 8 days
- Notable: worktree-isolated parallel wave execution worked cleanly for single-plan waves; one SDK-level rough edge encountered — the summary-rescue safety net (`worktree.cleanup-wave`) has a Buffer-identity comparison bug that keeps re-materializing an already-committed SUMMARY.md as untracked on every retry, worked around by committing the rescued copy on main before merge

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | several | 4 | First milestone — established master-detail/URL-state pattern, never-throws external-integration pattern, independent-failure-domain pattern |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | 0 | N/A (no test suite) | 0 (no new npm packages added in Phase 4; earlier phases added shadcn/ui, Drizzle, nuqs, zod as needed) |

### Top Lessons (Verified Across Milestones)

1. Reusable UX patterns (master-detail/URL-state) established once and deliberately reused in the next phase reduce rework and surprises — worth continuing to design phase sequencing around "establish once, reuse next"
