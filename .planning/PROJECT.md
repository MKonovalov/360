# ArcLumen 360

## What This Is

ArcLumen 360 is an end-to-end demand generation pipeline for ArcLumen Partners, giving the team a 360-degree overview of potential ICPs — target Companies and their Key Personas — surfaced through buying/intent signals (financial cost pressure, no mature GBS/SSC org, new CFO/GBS head, announcement of a large transformation program). v1.0 (shipped 2026-07-24) delivered a scalable explorer UI, modeled on the recall.ai dashboard explorer (collapsible left nav, searchable/filterable lists, master-detail pane), sitting behind the existing Clerk auth already running in this repo, plus a read-only knowledge integration with Arcpedia (ArcLumen Partners' internal wiki). v1.1 (shipped 2026-08-01) added a Start Page dashboard, a stacked full-width list/detail layout on both explorers, Menu-driven CSV import and commercial enrichment (Apollo.io/Prospeo), and an on-demand web-search Analytic Agent with a human-reviewed proposal queue.

## Core Value

Fast, shared ICP lookup — anyone on the team can pull up a company or persona and see a complete, trustworthy 360 view with buying signals in seconds, replacing signal knowledge that today lives scattered across individual heads and inboxes.

## Milestone Status: v1.1 SHIPPED (2026-08-01)

**v1.1 Start Page + Import + Analytic Agent** — 5 phases, 27 plans, 32 tasks, 31/31 requirements validated. Delivered: stacked full-width list/detail layout on both explorers, Start Page dashboard, shared ExplorerMenu, CSV import with partial-commit validation + rollback, Apollo.io/Prospeo enrichment with provenance, and the web-search Analytic Agent with a human-reviewed proposal queue + Langfuse tracing.

## Current Milestone: v1.2 Exa-Style Left Panel

**Goal:** Redesign the app's left navigation panel to match the dashboard.exa.ai sidebar — its dark visual style, item treatment, and interaction pattern — while keeping the current routes and nav items.

**Target features:**
- Dark Exa-style sidebar panel (near-black) against the app's light content area
- Restyle the current nav items (Start, Companies, Key Personas, Reviews) with Exa-like iconography, grouping, and active states — no new routes
- Logo/branding zone at top and user/settings zone at bottom, mirroring Exa's sidebar anatomy
- Preserve existing collapse/resize behavior and the pending-reviews badge

**Next milestone after v1.2:** not yet scoped. See "Future Candidates (Beyond v1.1)".

## Requirements

### Validated

<!-- Inferred from existing codebase (.planning/codebase/) -->

- ✓ Clerk authentication, ported to `@clerk/nextjs` (session gate via `requireStaffAccess()`, applies to pages and Server Actions alike) — validated in Phase 1 (2026-07-23)
- ✓ Next.js 16 App Router hosting on Vercel, Node 22.x confirmed live — validated in Phase 1 (2026-07-23), replaces the retired Astro/Node 20 setup
- ✓ Neon Postgres + Drizzle ORM relational schema (Company/Persona/Signal/CompanyPersonaRole, DATA-02/DATA-03) — validated in Phase 1 (2026-07-23), replaces the retired Sanity CMS integration
- ✓ Staff can log in via existing Clerk auth and reach the ArcLumen 360 explorer — validated in Phase 2 (2026-07-23), `requireStaffAccess()` gates `/companies` and `/companies/[id]`
- ✓ Left nav has two sections — Companies and Key Personas — collapsible/resizable like the recall.ai explorer — validated in Phase 2 (2026-07-23); Key Personas nav item present but disabled until Phase 3
- ✓ Company list is searchable and filterable — validated in Phase 2 (2026-07-23), debounced search + industry/signal-type/revenue-band/ownership-type filters, all URL-synced
- ✓ Clicking a Company list item opens its full detail in a master-detail pane (list stays visible, detail fills main area) — validated in Phase 2 (2026-07-23)
- ✓ Company list items show signal badges — validated in Phase 2 (2026-07-23)
- ✓ Company 360 view shows: firmographics, tech stack/tools used, buying signals (financial cost pressure, no mature GBS/SSC org, new CFO/GBS head, transformation program announcement), and linked personas — validated in Phase 2 (2026-07-23)
- ✓ Persona list is searchable and filterable (seniority, current company, has-signals; AND-composed) — validated in Phase 3 (2026-07-23); the has-signals "No" leg shipped broken in the initial pass (silent no-op) and was gap-closed same-day, see Key Decisions
- ✓ Clicking a Persona list item opens its full detail in a master-detail pane — validated in Phase 3 (2026-07-23)
- ✓ Persona 360 view shows: role/title & seniority, career history (previous companies with dates), linked current company, and contact info (email/LinkedIn) — validated in Phase 3 (2026-07-23), PERS-01 through PERS-04
- ✓ Company/Persona 360 views surface related knowledge articles read from Arcpedia's public `/api/wiki/search` — validated in Phase 4 (2026-07-24), ARCP-01/ARCP-02; read-only (grep-confirmed zero `method:` calls in `arcpedia.ts`), capped at 3 results, independent failure domain from the DB fetch. Company side proven live with real matches (8/9 seed companies); the current seed Persona dataset has no name matching real Arcpedia content, so the Persona "shows real articles" case is pending real data, not a code gap — tracked in `04-HUMAN-UAT.md`
- ✓ Every list and detail pane across both explorers handles empty/loading/error states explicitly (EXPL-06) — validated in Phase 4 (2026-07-24); Company/Persona detail panes now have the same inline DB-fetch error card pattern the list panes already had
- ✓ Companies/Personas list+detail layout rework: side-by-side → stacked full-width, single-expand accordion, URL-synced/deep-linkable, keyboard-navigable (LAYT-01 through LAYT-05) — validated in Phase 5 (2026-07-30); shared `ExplorerAccordionTable`/`ExplorerTableBehavior` components replace 6 files' worth of duplicated per-page markup. Code-review pass found and fixed a mobile-viewport regression (detail panel hidden below `md`) and a silent-failure case for stale/invalid `?selected=` ids; 6 live-browser interaction checks (click-to-expand, URL reload/Back, scroll-into-view, keyboard nav, roving-tabindex, mobile visibility) approved by user, tracked in `05-HUMAN-UAT.md`
- ✓ Shared `ExplorerMenu` dropdown on both explorers' list and detail surfaces, ready to host Import/Analyze (MENU-01, MENU-02) — validated in Phase 6 (2026-07-30); `AppShellLayout` also extracted to de-duplicate the Companies/Personas sidebar shell for the third and final time
- ✓ Start Page dashboard: 3 stat cards + 4 independently-failing widgets (Recent Signals, Recently Viewed, Needs Attention, Signal Breakdown), replacing the old anonymous-access root page (START-01 through START-05) — validated in Phase 6 (2026-07-30); a code-review + verification pass found 3 unguarded fetches that could still crash the whole page on a transient DB error, fixed same-day (commit `f00a43a7`) before phase close
- ✓ CSV Import: Menu → Import wizard on both explorers — auto column/enum mapping with manual override, partial-commit validation (valid rows commit, invalid rows reported with row number + reason), dedup on `company.domain`/`persona.email`, schema-generated template download, import history + rollback (IMPT-01 through IMPT-07) — validated in Phase 7 (2026-07-31); 11 plans including a Vitest test harness bootstrap (first automated tests in the repo, pure functions only)
- ✓ Enrichment API: Menu → Enrich pulls real firmographic/contact data from Apollo.io (companies) / Prospeo (personas), fill-empty-only merge policy (never silently overwrites staff data), per-field `fieldSources` provenance, merge-conflict review dialog, and match-confidence scores where the vendor exposes them (ENRC-01 through ENRC-05) — validated in Phase 8 (2026-07-31), proven live against real vendor data in `08-06-UAT.md`
- ✓ Analytic Agent: Menu → Analyze runs on-demand web-search signal analysis per Company, proposes typed candidate Signals into a review queue (never auto-writes to the live Signal table), with inline evidence/citation, accept/reject per proposal, pending-proposal badge, and existing-signal dedup (ANLZ-01 through ANLZ-05) — validated in Phase 9 (2026-08-01)
- ✓ Observability: every agent run traced in Langfuse (chain-of-thought/tool-call steps + token cost); rejections capture a structured correction reason (wrong signal type / missed inclusion-exclusion criteria / hallucinated / other) + optional note linked to the run's trace (OBSV-01, OBSV-02) — validated in Phase 9 (2026-08-01)

### Active

- [ ] Persona 360 "Related Knowledge" showing real Arcpedia articles end-to-end — code path proven identical to the working Company path, but the current seed Persona dataset has no name that matches real Arcpedia content; needs either updated seed data or acceptance of the gap (see `04-HUMAN-UAT.md`)
- [ ] (v1.2 requirements to be scoped via `/gsd-new-milestone` — current milestone: Exa-Style Left Panel, see "Current Milestone" section)

### Out of Scope

- Persona list row-level status/signal badges — EXPL-05 (list rows show signal badges) maps only to Phase 2's Company list per REQUIREMENTS.md's phase-mapping table; never a Phase 3 requirement despite an earlier PROJECT.md draft implying otherwise
- Writing/ingesting content back into Arcpedia from ArcLumen 360 — still read-only; AI-drafted content (e.g. tailored persona LinkedIn DMs) is a stated future direction, not v1.1
- Auto-writing Analytic Agent signal proposals directly to the DB — v1.1's agent proposes into a review queue only, staff approves before a Signal record goes live
- Full scoring/prioritization algorithm and prioritized target list output — v1.1's Analytic Agent detects/proposes signals, it does not rank or prioritize Companies; ranking logic is a later milestone
- CRM sync / automated outreach triggers — the pipeline's action stage (prioritized list → outreach → CRM sync) comes after scoring exists
- Multi-user roles/permissions — any authenticated staff user sees everything for now (matches existing app's current auth model)
- Existing short-link staff tool — being retired soon; not actively extended or migrated as part of this build

## Current State

**Milestone v1.1 (Start Page + Import + Analytic Agent) shipped 2026-08-01.** All 5 phases complete (27 plans, 32 tasks), 31/31 requirements validated, milestone archived to `.planning/milestones/v1.1-*`. The app now covers the full browse → enrich → import → analyze loop: stacked list/detail explorers, a Start Page dashboard, CSV import with partial-commit validation and rollback, Apollo.io/Prospeo enrichment with provenance, and a web-search Analytic Agent whose proposals are human-reviewed before any Signal goes live — every run traced in Langfuse.

**Phase 9 (Analytic Agent + Observability) complete 2026-08-01** — final phase of v1.1. On-demand `Menu → Analyze` per Company runs a Firecrawl-backed web-search agent (flat `ai@7` `generateText` contract) producing typed signal proposals into a `/reviews` queue — never auto-written to the live Signal table (fail-closed gate). Accept is idempotent (ONE Accept = ONE Signal), Reject captures a structured correction reason mirrored to Langfuse; runs/proposals/corrections tables live on Neon; the Company detail panel shows a pending-proposal badge. 7/7 requirements (ANLZ-01..05, OBSV-01/02) validated; route handler runs under Vercel Hobby's 60s `maxDuration` ceiling (user-confirmed during planning).

**Phase 8 (Enrichment API) complete 2026-07-31** — Menu → Enrich on either detail panel pulls real firmographic (Apollo.io companies) / contact (Prospeo personas) data with a fill-empty-only merge policy — staff-entered fields are never silently overwritten. Per-field `fieldSources` provenance (manual vs. enrichment), a merge-conflict review dialog for already-populated fields, and match-confidence scores where the vendor exposes them. 5/5 requirements (ENRC-01 through ENRC-05) validated; proven live against real vendor data in `08-06-UAT.md`.

**Phase 7 (CSV Import) complete 2026-07-31** — Menu → Import wizard on both explorers: auto column/enum mapping (manual override), partial-commit validation (valid rows commit; invalid rows reported with row number + reason), dedup on `company.domain`/`persona.email`, schema-generated template download, and import history with rollback (dependency-checked). 7/7 requirements (IMPT-01 through IMPT-07) validated; this phase also bootstrapped the repo's first automated tests (Vitest, pure functions only — dedupKeys, columnMapping, partitionRows).

**Phase 6 (Shared Menu Component + Start Page) complete 2026-07-30** — second phase of v1.1. New `(dashboard)` route group fully replaces `src/app/page.tsx` with a Start Page (3 stat cards + 4 independently-failing widgets), backed by a new `recentlyViewed` table and 4 dashboard aggregate queries pushed live to Neon. Both explorers gained a shared `ExplorerMenu` dropdown (list + detail surfaces) wired to a `recordView` Server Action, and the Companies/Personas sidebar shell was extracted into one `AppShellLayout` component. 7/7 requirements (MENU-01, MENU-02, START-01 through START-05) validated; code review + verification both caught the same gap — 3 unguarded DB fetches that could crash the whole page instead of just one widget — fixed same-day before phase close.

**Phase 5 (Layout Consolidation + Rework) complete 2026-07-30** — first phase of v1.1. Both Companies and Personas explorers moved from side-by-side master-detail to a single shared stacked accordion layout (`ExplorerAccordionTable`/`ExplorerTableBehavior`), consolidating `/companies` + `/companies/[id]` and `/personas` + `/personas/[id]` into single pages with thin redirect stubs for legacy bookmarks. 5/5 requirements (LAYT-01 through LAYT-05) validated; a code-review pass caught and fixed a mobile-viewport regression and a silent-failure case for invalid `?selected=` ids before the phase closed.

**Milestone v1.0 (MVP) shipped 2026-07-24.** All 4 phases complete: Foundation (Astro→Next.js/Neon/Drizzle migration), Company Explorer, Persona Explorer, and Arcpedia Integration & Resilience Polish. 24/24 v1.0 requirements validated. `fetchArcpediaArticles()` (`src/lib/arcpedia.ts`) is a read-only, never-throws, GET-only client capped at 3 results, wired into a "Related Knowledge" section on both Company and Persona 360 detail views; both detail panes also gained the same inline DB-fetch error card pattern the list panes already had (EXPL-06). Cloudflare Access Service Token (`arclumen-360-server`) provisioned for `arcpedia.arclumen.de` — the production Arcpedia deployment sits behind a Cloudflare Zero Trust Access gate at the edge, invisible to Arcpedia's own "public GET routes" docs (see Key Decisions).

**Known debt carried into next milestone** (see `.planning/STATE.md` Deferred Items, acknowledged at milestone close rather than blocking ship):
- Persona-side "Related Knowledge" — code path proven identical to the working Company path (8/9 seed companies show real matches live), but the current seed Persona dataset has no name matching real Arcpedia content, so this hasn't been observed working end-to-end for a Persona
- 3 VERIFICATION.md files (Phases 1, 2, 4) remain `status: human_needed` — genuinely open UAT (Phase 1: 2 items, Phase 2: 4 items, Phase 4: 1 item — see respective `*-HUMAN-UAT.md` files). Phase 3's record was stale (its `03-HUMAN-UAT.md` already showed `status: complete`); Phase 5's was resolved to `passed` at v1.1 close
- Automated test coverage is minimal — Phase 7 bootstrapped a Vitest harness covering pure logic only (dedupKeys, columnMapping, partitionRows, agent orchestration); no component/e2e coverage yet; all UI verification remains manual UAT + live build/tsc checks

Milestone artifacts archived to `.planning/milestones/v1.0-*` and `.planning/milestones/v1.1-*` (ROADMAP, REQUIREMENTS, MILESTONE-AUDIT; v1.0 also archived phase directories). Repo is between milestones, awaiting `/gsd-new-milestone`.

## Future Candidates (Beyond v1.1)

Not yet scoped. Carried forward from v1.0's deferred list, still relevant after v1.1 lands:

- Full scoring/prioritization algorithm over Company signals, prioritized target list output — PIPE-01/02
- CRM sync / outreach triggers — PIPE-03/04
- Multi-user roles/permissions beyond the current binary "any authenticated Clerk user = staff" model — ACCS-01
- Saved/custom filter views, bulk seed-data editing UX — VIEW-01/02
- AI-drafted, persona-tailored outreach content informed by Arcpedia — ARCP-03

## Context

- ArcLumen Partners' domain appears to be GBS/SSC (Global Business Services / Shared Services Center) transformation advisory — the named buying signals (CFO/GBS-head changes, transformation program announcements, cost pressure, immature GBS org) reflect this niche and should shape research and data modeling.
- This repo (`360-arclumen`) currently hosts a staff short-link landing tool: Astro SSR + Clerk + Sanity + Tailwind, deployed on Vercel with Node 20 pinned (see `.planning/codebase/` for full map, generated 2026-07-22). That tool is being retired in favor of ArcLumen 360 and is not being actively extended.
- `.planning/codebase/CONCERNS.md` flags: stale README describing an abandoned cookie architecture, silent `catch {}` error handling in a couple of pages, no role-based authorization (any authenticated Clerk user = staff), and zero automated tests. Worth keeping in mind when reusing Clerk/auth patterns.
- Problem this solves: today, ICP/signal knowledge lives in individual heads and inboxes with no shared visibility across the team.
- End users: a mixed/leadership audience — not just sales reps, but broader internal staff and execs reviewing the pipeline.
- Full pipeline vision beyond milestone 1: a prioritized target list, outreach triggers pushed to sales, and CRM/export sync. Milestone 1 stops at the browsing/overview experience — the UI shell working end-to-end against seed data is the milestone-1 definition of done.
- **Arcpedia** (`/Users/mkonovalov/Projects/arcpedia`, live at arcpedia.arclumen.de) is an existing, actively-built internal wiki ("a wiki for the agent age" — Next.js + Cloudflare Workers, Clerk-authenticated, LLM-powered ingest/query). It exposes a public (no-auth *at the application level*) REST read surface: `GET /api/wiki/search?q=`, `GET /api/wiki/browse?q=&scope=&tag=&page=`, `POST /api/wiki/dataview` (query by frontmatter), plus a session-gated `POST /api/query` (LLM-synthesized answers over the corpus) and an MCP server at `/api/mcp`. In production, the domain also sits behind a Cloudflare Zero Trust Access gate at the edge (see Key Decisions) — a Service Token is required regardless of the app-level "public" designation. ArcLumen 360 v1.0 reads from `/api/wiki/search` to surface related knowledge articles on Company/Persona 360 views — no write-back. Beyond v1.0, the user's stated future direction includes AI-drafted, tailored outreach content (e.g. persona-specific LinkedIn DMs, ARCP-03) — not in scope now, but worth keeping the data model open to it.
- Codebase size at v1.1 ship: ~13,100 LOC across `src/**/*.{ts,tsx}` (up from ~3,840 at v1.0). A Vitest harness (bootstrapped in Phase 7) covers pure logic only — `dedupKeys`, `columnMapping`, `partitionRows`, `mergePlan`, and the analytic-agent orchestration (`analyzeCompany.test.ts`) — no component/e2e coverage yet. UI verification relies on manual UAT + live build/tsc checks.

## Constraints

- **Tech stack**: Migrate Astro → Next.js (App Router) and Sanity → Neon Postgres + Drizzle ORM, per research (`.planning/research/STACK.md`). Astro's island-isolation model fights master-detail selection state; Sanity's editorial-CMS shape doesn't fit relational Company/Persona/Signal data that will need high-frequency programmatic writes once enrichment lands.
- **Auth**: Reuse the existing Clerk integration/config, ported to `@clerk/nextjs` — same Clerk project/dashboard, same session model, don't re-implement auth from scratch.
- **Deployment**: Same Vercel project/domain. Node 20 pin goes away with the Astro adapter (source of the original pin bug) — pin Node 22.x instead per Vercel's Node 20 deprecation (Oct 2026).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build ArcLumen 360 inside this repo (`360-arclumen`), absorbing/retiring the existing short-link tool | Reuse existing Clerk auth + Vercel deploy setup rather than standing up a new repo | Done — Phase 1 |
| Milestone 1 = explorer UI shell only, against manual/seed data | Validate the explorer UX and Company/Persona data model before investing in real enrichment integrations | — Pending (Phase 2+) |
| Migrate Astro → Next.js App Router, Sanity → Neon Postgres + Drizzle, before building explorer UI | Research confirmed current stack fights master-detail state and relational data needs; Clerk/Vercel continuity preserved | Done — Phase 1 |
| shadcn/ui installed with the `nova` preset (Geist/lucide, `neutral` base) instead of the originally-assumed New York/Slate flow | shadcn CLI's init flow replaced named-color prompts with a preset system between research and execution; `nova` was the closest match to UI-SPEC's locked style | Done — Phase 2 |
| `PersonaFilters.hasSignals` must be a genuine tri-state (`true`/`false`/`undefined`), not a plain boolean | Phase 3 shipped with `false` and `undefined` collapsed into the same value at both the URL-parsing layer (duplicated across two page files) and the query layer (`listPersonas` had no `NOT EXISTS` branch) — the "No" filter silently returned all 10 personas instead of 0. Caught by code review (CR-01) and independently reproduced by verification against live data before shipping further | Done — Phase 3 gap closure; `parsePersonaFilters` also consolidated into one shared module (`src/lib/params/personaFilters.ts`) to prevent the duplicate-fix risk recurring |
| Arcpedia's production domain requires a Cloudflare Access Service Token, not just app-level "public GET routes" | `arcpedia.arclumen.de` sits behind a Cloudflare Zero Trust Access application at the edge — confirmed via direct curl, all paths 302'd to a Zero Trust login page. Arcpedia's own first-party caller (`task-consumer`) already uses this pattern. A domain can also have *multiple* Access apps scoped to different path patterns; the token must be added to the specific app's policy that actually gates the requested path, not just a root-domain app | Done — Phase 4; token scoped to the app gating `/api/wiki/search`, mirroring `task-consumer`'s placement |
| Local dev needs a Clerk *development* instance, not the production `pk_live_` key | Production Clerk instances restrict the Frontend API to configured allowed origins (`arclumenpartners.com`/`360.arclumenpartners.com`); `localhost` was never on that list, so local sign-in silently failed (`_baseFetch` error, stuck on `/sign-in`) — discovered during Phase 4's live UAT pass | Done — Phase 4; `.env.local` now uses `pk_test_`/`sk_test_` dev-instance keys locally, which allow `localhost` by default |
| Shared entity-agnostic accordion foundation (`ExplorerAccordionTable` Server Component + `ExplorerTableBehavior` client wrapper) replaces per-page duplicated list/detail markup | Both explorers needed identical stacked list/detail behavior; one foundation means the keyboard-nav/scroll-into-view/close-control logic is written once instead of six times | Done — Phase 5; Companies and Personas both wire into the same two components |
| CSV import header/enum mapping is exact-match only — no fuzzy matching, manual override is the safety net | Auto-mapping must never silently guess a wrong column or enum value; a wrong guess corrupts data invisibly, a manual override is deliberate | Done — Phase 7; `normalizeHeader` alias map + `UNMAPPED_ENUM_SENTINEL` surfaces unmapped enum values as row errors instead of silently passing bad values |
| CSV import validation is partial-commit: valid rows commit, invalid rows are reported with row number + reason | A single bad row must never block the whole import (IMPT-03); the batch either commits cleanly or reports precisely which rows failed | Done — Phase 7 |
| Import dedup keys: `company.domain` / `persona.email` as unique constraints; `buildUpdatePatch` extracted as a pure named export so blank-cell-untouched logic is unit-testable without a DB | Dedup needs a stable natural key (IMPT-04); pure-function extraction makes the merge semantics testable in Vitest without a round-trip | Done — Phase 7 |
| Vitest test harness: co-located `*.test.ts`, plain `describe`/`it`/`expect`, **no mocking library**, pure functions only (no DB or React code in tests) | First automated tests in the repo; restricting to pure logic keeps tests fast, deterministic, and dependency-free | Done — Phase 7; covers dedupKeys, columnMapping, partitionRows, mergePlan, analyzeCompany |
| Enrichment vendors: Apollo.io for Companies (firmographics), Prospeo for Personas (contacts) | ENRC-01 needed a concrete vendor per entity type; Apollo/Prospeo expose match-confidence and field-level data needed by ENRC-05 | Done — Phase 8; proven live in `08-06-UAT.md` |
| Analytic Agent uses flat `ai@7` `generateText` contract (not the plan's `ToolLoopAgent`/`agent:`/`result.object` syntax) with `isStepCount(12)` capping tool-loop iterations | Plan syntax was stale for ai@7.0.45 — verified against `node_modules/ai/dist/index.d.ts`; flat contract + step cap avoids runaway tool loops | Done — Phase 9 |
| Agent persist path uses no `db.transaction()` (neon-http has none): status-guarded conditional update is the exactly-once guard, the unique index is the race backstop | ONE Accept = ONE Signal must hold under concurrency (ANLZ-05 / D-11); transaction-free exactly-once via status guard + unique index | Done — Phase 9 |
| Correction row is durable truth; the Langfuse annotation is a fire-and-forget mirror that can never fail the reject | A reject reason must never be lost because observability is down (OBSV-02); DB write first, trace best-effort second | Done — Phase 9 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-01 — v1.2 milestone (Exa-Style Left Panel) started*
