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

## Milestone: v1.1 — Start Page + Import + Analytic Agent

**Shipped:** 2026-08-01
**Phases:** 5 (05-09) | **Plans:** 27 | **Sessions:** several across 4 days (2026-07-29 → 2026-08-01)

### What Was Built
- Layout Consolidation + Rework (Phase 5): Companies and Personas moved to a shared, stacked full-width list/detail layout, replacing 6 files' worth of duplicated side-by-side markup
- Shared Menu Component + Start Page (Phase 6): one-time `dropdown-menu` primitive reused by Import and Analyze; new dashboard landing page with stats, recent signals, recently-viewed, and needs-attention
- CSV Import (Phase 7): Menu → Import CSV upload wizard for Companies/Personas with column/enum mapping, partial-commit validation, dedup, template download, import history/rollback — and the repo's first automated Vitest suite
- Enrichment API (Phase 8): Apollo.io (companies) / Prospeo (personas) commercial enrichment with auto-fill-empty-only merge policy, field-level provenance, and merge-conflict review
- Analytic Agent + Observability (Phase 9): Menu → Analyze web-search signal-detection agent with a human-reviewed proposal queue, full Langfuse tracing, and correction-reason capture on reject/edit

### What Worked
- Sequencing layout consolidation (Phase 5) first meant both Import's and Analyze's Menu buttons anchored cleanly — the "establish once, reuse next" pattern from v1.0 held again (shared Menu + `company.domain`/persona-email dedup keys reused across Phases 6-9)
- First automated test suite, introduced in Phase 7, grew to 139 passing tests by Phase 8 verification including isolated Neon database integration coverage — caught real merge-path issues that grep/manual UAT would have missed
- Exactly-once semantics achieved without a transaction primitive (neon-http has no `db.transaction`): status-guarded conditional update as primary guard, unique index as the 23505 race backstop — a clean, testable pattern
- Durable-truth design: the correction row is the source of truth; Langfuse annotation is a fire-and-forget mirror that never fails the primary reject/edit write
- Live UAT with real vendor APIs (Apollo companies + Prospeo personas) in Phase 8 validated end-to-end enrichment behavior, not mocks

### What Was Inefficient
- Phase 09 P03 ran 10h16m — the milestone's single longest plan, absorbing the cost of resolving the flagged-but-unanswered async-execution question (sync Route Handler `generateText` vs fire-and-poll) during implementation rather than research
- Model ID drift: the dated `20250514` Anthropic model ID 404'd against the live roster and had to be swapped to `claude-sonnet-4-6` mid-phase
- No component or e2e browser coverage yet — the Vitest suite covers unit + DB integration, but Menu → Import/Analyze flows still rely on manual browser UAT
- Enrichment (Phase 8) shipped without a standalone config-visible API-key toggle for non-staff consumers; API keys live in env only (acknowledged as a known limitation, revisit if external tooling needs enrichment)

### Patterns Established
- First Route Handler pattern: Next 16 async params, `export const maxDuration = 60`, `requireStaffAccess()` single gate FIRST, two separate try/catch failure domains (AI vs DB) with distinct fail-loud 422/503/502 bodies
- Exactly-once without transactions: status-guarded conditional update + unique-index 23505 race backstop (neon-http constraint)
- Window `CustomEvent` bridge (`ANALYZE_START_EVENT`) between sibling client components instead of inline fetch — Menu strip lives elsewhere in the page tree
- Citation resolution normalizes URLs (scheme/query/fragment/case/trailing slash) and allows extending the fetched URL at a path-segment boundary; citing a parent is still forbidden
- Accordion foundation for the stacked list/detail layout (Phase 5) — one component owning expand/collapse + URL state instead of per-file markup duplication

### Key Lessons
1. First automated test harness pays off fast — introducing Vitest in Phase 7 meant Phase 8's exactly-once merge logic and Phase 9's agent DB paths shipped with regression protection instead of hope
2. Provider/model identifiers drift between research and implementation — verify model IDs against the live roster during planning, not after a mid-phase 404
3. Flagged architecture questions (Phase 9's async execution strategy) should be resolved during research, not absorbed into implementation — P03's 10h16m was largely that deferral
4. "Establish once, reuse next" extends beyond UI: shared primitives (Menu dropdown, dedup keys, accordion) reused across phases kept later phases additive rather than rework-heavy

### Cost Observations
- Model mix: not tracked this milestone
- Sessions: several across 4 days
- Notable: Phase 09 P03 was the milestone's longest single plan (10h16m, 3 tasks, 18 files) — the agent phase carried the milestone's highest risk (first Route Handler, first AI/tool-calling dependency, first agent write-path) and paid for it in wall-clock
---

## Milestone: v1.2 — Exa-Style Left Panel

**Shipped:** 2026-08-02
**Phases:** 5 (10-14) | **Plans:** 10 | **Sessions:** several across 2 days (2026-08-01 → 2026-08-02)

### What Was Built
- Sidebar Token Foundation (Phase 10): one scoped 8-token `--sidebar-*` light-theme block on `[data-sidebar="sidebar"]` in globals.css (zero new packages, vendored sidebar.tsx untouched, `@theme inline` byte-identical) + `getActiveNavKey` pure function with an 11-case Vitest lock
- Nav Items Restyle (Phase 11): Explore/Manage intent groups, Exa 30px/16px/15px/10px/8px row anatomy, gray active fill replacing the v1.1 indigo treatment, mono 10px/600 accent-chip pending badge + collapsed-rail dot, indigo/amber sweep complete
- Branding & User Zones (Phase 12): top wordmark + org-label zone, bottom Clerk-identity zone (avatar/initials + display name + the app's FIRST in-app sign-out) + "Give us feedback" mailto pill — all sidebar-token-only
- Collapse & Resize Coexistence (Phase 13): always-visible collapse button + 48px icon-rail (`collapsible="icon"`), D1 28px letter-mark, ~200ms rail tooltips incl. `Reviews (N)`, resize-handle hides when collapsed — 200-400 clamp + cookies + ⌘B frozen byte-identical
- Contrast Audit & UAT Matrix (Phase 14): WCAG math locked in `src/lib/contrast.ts`, a live-browser 12-cell Playwright matrix + interaction micro-tests (18/18), computed-style audit of all 6 token pairs (all AA), Exa divergence review

### What Worked
- The "dormant classes first" strategy paid off: Phases 11-12 pre-wired `group-data-[collapsible=icon]:` selectors with zero activation, and Phase 13 flipped the single `collapsible="icon"` switch to light up the whole rail — the largest behavioral feature shipped as a one-prop change plus tested copy helpers
- Pure-function extraction as the regression lock (nav.ts, user.ts, sidebar-collapse.ts, contrast.ts) — the same "extract + Vitest" pattern from v1.1's Phase 7 kept every restyle provable; the contrast helper's ratios matched the live browser audit exactly, independently validating the W3C math
- Live-browser verification via Playwright MCP (Phase 14) finally closed v1.1's "no e2e browser coverage" gap — a 12-cell matrix with screenshots + interaction micro-tests replaced manual UAT for the sidebar surface
- The plan-checker revision loop caught a real arithmetic error (wrong compositeAlpha tuple in a test fixture) that would have burned an executor cycle — independent verification of plan internals has value
- Collapse persistence fix post-close (server-read `sidebar_state` → `defaultOpen`) was a clean one-line-class fix: the vendored provider only writes the cookie, so route-group remounts silently re-expanded — reading it on the shell fixed the class of bug, not just the instance

### What Was Inefficient
- Phase 14's executor hit a 30-min inactivity timeout before its final SUMMARY commit — all evidence was already committed, but the closeout needed manual recovery; the timeout interrupted the wave before the state/roadmap updates landed
- The Exa live-fetch fallback: dashboard.exa.ai sits behind Exa's own auth wall, so the divergence review used the dated FEATURES.md capture — a documented fallback, but the live reference was the plan's ideal
- Post-close micro-fixes (duplicate toggle, collapse persistence, group-label click interception) surfaced as real user-observed issues after the UAT matrix — the matrix asserted DOM state, not every pointer-event edge
- Modern Chromium serializes computed colors as `lab()`/`oklab()` (CSS Color 4) — the audit script's naive rgba parser returned null until it resolved colors through an offscreen canvas; a real browser-version gotcha

### Patterns Established
- Dormant-class pre-wiring across phases: build the `group-data-[collapsible=icon]:` surface before the switch that activates it, so the activation phase is a mechanical flip + contract tests
- Pure-function regression locks: every UI restyle that touches a derive-able value (active key, display name, tooltip copy, contrast ratio) extracts it into a tested `src/lib/*.ts` module
- Playwright MCP live-browser verification: 12-cell state×route matrix + interaction micro-tests with committed screenshots, replacing manual UAT for the shipped surface
- Server-read persistence for vendored client state: when a vendored provider only writes its cookie, the server shell reads it and threads the initial value as a prop
- `pointer-events-none` on collapsed-rail group labels — opacity-0 labels still intercept clicks over nav icons

### Key Lessons
1. Deferred live verification lands as a distinct phase: routing all manual checks into Phase 14's matrix meant the milestone ended with a single provable evidence stack (UAT + VERIFICATION + screenshots) instead of scattered partial UATs
2. The plan-checker's arithmetic verification is worth the loop — a wrong expected tuple in a test fixture is invisible to review but fatal to execution
3. Executor timeouts are a wave-hygiene risk — keep the SUMMARY + state closeout as the FIRST thing an autonomous plan does after its last gate, not the last
4. Real-user pointer events find what DOM assertions miss — the collapsed-rail click interception and route-group collapse reset were both live-user observations post-matrix

### Cost Observations
- Model mix: not tracked this milestone
- Sessions: several across 2 days
- Notable: Phase 14's UAT matrix (18 live-browser tests) was the milestone's most tool-call-heavy work — the Playwright driver, contrast audit, and Exa fetch all ran against the live app


---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | several | 4 | First milestone — established master-detail/URL-state pattern, never-throws external-integration pattern, independent-failure-domain pattern |
| v1.1 | several | 5 | Layout consolidation + shared primitives (Menu, accordion, dedup keys); first automated test suite (Vitest, 139 tests by Phase 8); first Route Handler + AI/agent integration with durable-truth + fire-and-forget observability split |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | 0 | N/A (no test suite) | 0 (no new npm packages added in Phase 4; earlier phases added shadcn/ui, Drizzle, nuqs, zod as needed) |
| v1.1 | 139 (Vitest) | Unit + Neon DB integration; no component/e2e browser coverage yet | 0 (no new deps in Phases 5-6; Phases 7-9 added Vitest, Langfuse, `ai` SDK, vendor clients as required) |

### Top Lessons (Verified Across Milestones)

1. Reusable UX patterns (master-detail/URL-state) established once and deliberately reused in the next phase reduce rework and surprises — worth continuing to design phase sequencing around "establish once, reuse next"
2. An automated test suite, once introduced, changes the verification economics of every later phase — v1.1's exactly-once merge logic and agent DB paths were proven by test, not just by UAT, and caught issues grep-based verification would have missed
3. Architecture questions flagged during research (async execution strategy, transaction availability) are cheaper to resolve in planning than to absorb into implementation — deferral showed up as the milestone's longest plan (Phase 09 P03, 10h16m)
