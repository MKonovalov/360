# Project Research Summary

**Project:** ArcLumen 360 (milestone 1 — B2B ICP / account-intelligence explorer)
**Domain:** Data-heavy B2B ICP/account-intelligence explorer — internal, Clerk-authenticated master-detail dashboard (recall.ai Explorer Dashboard / Clay / CRM-lite record browser pattern) for GBS/SSC transformation advisory
**Researched:** 2026-07-22
**Confidence:** MEDIUM-HIGH

## Executive Summary

ArcLumen 360 milestone 1 is a browsing/viewing layer for Company and Persona records — the same "look at records, search, filter, drill into detail" shell that Apollo, ZoomInfo, 6sense, Clay, and ChartHop all started as, before layering in enrichment, scoring, and CRM sync. Research across stack, features, architecture, and pitfalls converges on one clear build strategy: model the data properly and completely from day one (typed signals, many-to-many Company↔Persona relationships, nullable/array fields shaped like a real enrichment API), while deliberately keeping the *functional* scope to manual/seed data, badges-not-scores, and no roles — matching PROJECT.md's explicit v1 exclusions. The data-model decisions are the highest-leverage, hardest-to-reverse choices in this project; the UI-scope decisions are comparatively low-risk because they're explicitly deferred rather than under-researched.

The stack research makes a strong, well-sourced case for migrating off the existing thin Astro shell to Next.js (App Router) — Astro's own documentation explicitly names "logged-in admin dashboards" as the class of app it isn't optimized for, and the specific UI shape here (collapsible nav + list + detail pane sharing selection state) is exactly the cross-island state-coordination problem Astro forces you to solve manually. It also recommends retiring Sanity from the Company/Persona data model in favor of Neon Postgres + Drizzle ORM, since milestone 1 already implies joinable, filterable, aggregatable relational data and the stated pipeline (scoring, enrichment writes, CRM sync) is a database workload, not a content-editing workload. Clerk and Vercel carry forward with minimal disruption (SDK swap only; dropping the Astro adapter also permanently fixes the Node-runtime-pin bug from commit `4e8b9a04`).

The most important risk this research surfaces is schema debt, not feature debt: pitfalls research (grounded partly in this repo's own `CONCERNS.md`) flags that hand-seeding data tempts teams into unstructured signal blobs, rigid 1:1 Company-Persona links, and "always complete" seed shapes — all of which are cheap to avoid now (typed signal records, a join/history table, nullable/array fields) and expensive to retrofit once UI and seed data both assume the wrong shape. A second, lower-urgency risk is the "any authenticated Clerk user = full access" model carried forward unexamined into a product now surfacing competitive-intelligence data for a broader audience — acceptable for v1 if centralized and documented, but must be revisited before milestone 2 adds external access or CRM sync.

## Key Findings

### Recommended Stack

Migrate the existing thin Astro/Clerk/Sanity app to **Next.js (App Router)** for the frontend/hosting layer, replace **Sanity** with **Neon Postgres + Drizzle ORM** as the Company/Persona datastore, and build the UI on **shadcn/ui** (Sidebar, Table, Command) plus the **TanStack** ecosystem. Clerk and Vercel carry forward with only an SDK swap (`@clerk/astro` → `@clerk/nextjs`) and adapter removal (no more Astro-Vercel Node-version workaround).

**Core technologies:**
- Next.js 16 (App Router) — native Vercel framework, no adapter/runtime-pin issues, Server Components for first-paint + Client Components for interactive master-detail
- Neon Postgres (via Vercel Marketplace) + Drizzle ORM — relational data with real joins/filters; serverless-friendly, low cold-start vs. Prisma
- @clerk/nextjs — direct swap for `@clerk/astro`, same Clerk project/dashboard config, no auth re-implementation
- shadcn/ui (Sidebar, Table, Command blocks) + TanStack Table/Query + nuqs + cmdk — collapsible nav, searchable lists, URL-driven master-detail selection, fast command-palette search
- Postgres full-text search (`tsvector`/`ILIKE`) for milestone-1 scale — do not reach for Algolia/Meilisearch/Elasticsearch until real data volume justifies it; same logic applies to TanStack Virtual (add only once lists grow past a few hundred rows)

### Expected Features

ArcLumen 360 v1 sits squarely at the "browsing shell" layer every category leader (Apollo, ZoomInfo, 6sense, Clay, ChartHop) started from, deliberately deferring the data-pipeline layer that differentiates them commercially.

**Must have (table stakes):**
- Company record: firmographics, tech stack, buying/intent signal badges (source + last-updated), linked personas
- Persona record: role/seniority, career history, linked company
- Search + filter across both lists; master-detail pane (list stays visible, detail fills main area)
- Signal/status badges visible in list rows (not just detail) for scan-and-triage
- Collapsible left nav (Companies / Key Personas); empty/loading/error states

**Should have (differentiators, model now even if not fully built):**
- GBS/SSC-specific signal taxonomy (cost pressure, immature GBS org, new CFO/GBS head, transformation announcement) as first-class structured fields — this is the actual "360 view" differentiator vs. generic sales-intelligence tools
- Shared team visibility of tribal knowledge (the whole point of centralizing signals that currently live in scattered inboxes) — arguably v1's real differentiator, not a "future" one
- Saved/custom filter views (v1.x, once real usage shows repeated filter patterns)

**Defer (v2+, explicit anti-features):**
- Live enrichment API integration (Clearbit/Apollo/ZoomInfo/Clay-style)
- Scoring/prioritization algorithm
- CRM sync / automated outreach
- Multi-user roles/permissions
- Automated career-history/org sync

### Architecture Approach

The core pattern — collapsible nav + searchable/filterable list + master-detail pane, with the URL as the single source of truth for selection/filters/search — is well-established (confirmed against Recall.ai's own Explorer Dashboard, which uses path-param deep links) and is **framework-agnostic**. Architecture research was conducted against the existing Astro stack (islands, `<ClientRouter />`, `transition:persist`), but per the Stack recommendation to migrate to Next.js, its patterns translate directly: one interactive region (not three) owns search+filter+list rendering, URL search params (via `nuqs`) and route params drive selection state, a `lib/data/*` layer isolates domain types (`Company`, `Persona`) from the backing store so a future data-source swap doesn't ripple into UI code, and relation resolution (Company↔Persona) happens inside that data layer, not per-page.

**Major components:**
1. Left nav (section switcher, collapsible) — Companies / Key Personas
2. List + filter region (single interactive owner of search/filter/list state) — feeds off SSR/Server-Component data, syncs to URL
3. Detail pane (Company 360 / Persona 360) — firmographics, signals, linked records; minimal own interactivity needed
4. Data-fetching layer (`lib/data/companies.ts`, `personas.ts`) — typed query functions shaping DB/CMS records into domain types, resolving Company↔Persona relations in one place
5. Auth guard — centralized `requireAuth`/`requireStaffAccess` helper (replaces today's scattered inline `if (userId)` checks)

### Critical Pitfalls

1. **Signals modeled as unstructured text/notes instead of typed, sourced, dated facts** — model each signal as its own record (`signal_type`, `company_id`, `detected_at`, `source`, `strength`), never a freeform blob; badges/filtering (explicit v1 requirements) depend on this structure.
2. **Company-Persona relationship modeled as a rigid 1:1 FK instead of many-to-many with history** — use a `PersonaCompanyRole`/employment join table (`is_current`, `start_date`/`end_date`) from day one; "previous companies" and multi-company relevance are already in scope and a 1:1 FK cannot represent them without a later migration.
3. **Seed data shaped for hand-entry convenience, not for the future enrichment API's real shape** — make enrichment-sourced fields nullable/array-typed and add a `source`/`enriched_at` field now (even if always `"manual"`/`null`); spike-read one real enrichment API's schema before finalizing the seed schema.
4. **"Any authenticated Clerk user = full access" carried forward unexamined** — this repo's own `CONCERNS.md` already flags this pattern; acceptable for v1 if centralized into one `requireStaffAccess()` function with an explicit code comment, but must be re-verified before milestone 2 (CRM sync, external/partner access).
5. **List/detail UI built without URL-as-state-of-record or virtualization, assuming seed-data scale forever** — both are cheap to build in from the start (URL sync for selection/filters; a virtualized list component) and expensive to retrofit once real enrichment data grows the dataset.

## Implications for Roadmap

Based on combined research, suggested phase structure:

### Phase 1: Foundation — Framework Migration, Auth, Data Model
**Rationale:** Framework choice (Next.js vs. Astro) and datastore choice (Postgres vs. Sanity) are the highest-leverage, hardest-to-reverse decisions in this project and block every other phase. Doing schema modeling correctly here (typed signals, many-to-many relations, nullable/array fields) avoids the most expensive pitfalls in the whole research set.
**Delivers:** Next.js App Router app scaffolded on the existing Vercel project (adapter dropped, Node 22 pinned); `@clerk/nextjs` wired with a centralized `requireAuth`/`requireStaffAccess` helper; Neon Postgres + Drizzle schema for `Company`, `Persona`, `Signal` (typed, sourced, dated), and `PersonaCompanyRole` (join/history table); seed dataset loaded via scripted/structured data (not hand-typed CMS entries).
**Addresses:** Underpins every P1 feature in FEATURES.md; no user-facing feature ships yet, but nothing else can be built correctly without it.
**Avoids:** Pitfalls 1, 2, and 3 (signal/relationship/seed-shape modeling) and lays groundwork for Pitfall 4 (centralized auth check); also eliminates the Node-20/Astro-adapter bug class from STACK.md.

### Phase 2: Company Explorer (list + detail)
**Rationale:** Company is named first in PROJECT.md's Core Value and establishes the master-detail/URL-state pattern once, to be reused for Persona in Phase 3.
**Delivers:** Collapsible left nav (shadcn `Sidebar`); Company list with search + filter (TanStack Table) and master-detail selection driven by URL params (`nuqs`); Company detail view (firmographics, tech stack, signal badges with source/date, linked personas).
**Addresses:** FEATURES P1 — company list/detail, signal badges in list rows, collapsible nav, source/note field.
**Avoids:** Pitfall 5 (build list with virtualization-ready structure and a `filterCompanies(params)` seam even if unused at seed scale) and Pitfall 6 (URL as source of truth for selection/filters from day one, not bolted on later).

### Phase 3: Persona Explorer (list + detail)
**Rationale:** Mirrors Phase 2's pattern almost exactly, so incremental risk and research need are low once the Company loop is validated.
**Delivers:** Persona list with search/filter/master-detail; Persona detail view (role/title/seniority, career history via the `PersonaCompanyRole` join, linked company).
**Addresses:** FEATURES P1 — persona list/detail.
**Uses:** Same list+filter+detail architecture component from Phase 2; `PersonaCompanyRole` join table from Phase 1 for "previous companies."

### Phase 4: Cross-Record Search & Resilience Polish
**Rationale:** Once both explorers exist, the stated Core Value ("pull up a company or persona in seconds," shareable/bookmarkable) needs a unified fast-search layer and needs its promises actually verified end-to-end, not just built.
**Delivers:** `cmdk`-powered command palette for jump-to-any-record; empty/loading/error states across all lists and detail panes; explicit verification that pasting a company/persona detail URL into a new tab reproduces the exact view (deep-linking acceptance test).
**Addresses:** FEATURES differentiator (fast shared lookup / centralizing tribal knowledge).
**Avoids:** The UX pitfalls table (undated/unsourced badges, missing partial-data states) and closes out Pitfall 6's acceptance criteria explicitly rather than assuming Phase 2/3 already satisfied it.

### Phase Ordering Rationale

- Framework/data-model decisions (Phase 1) must precede any UI work because both FEATURES.md and PITFALLS.md agree the schema shape (typed signals, many-to-many relations, nullable/array fields) is expensive to retrofit once seed data and UI both assume a shape.
- Company before Persona (Phase 2 before 3) follows PROJECT.md's own Core Value framing and lets the master-detail/URL-state pattern be built once and validated before being reused, rather than building two list/detail implementations in parallel and risking drift.
- Search/polish is deliberately last (Phase 4) because it depends on both explorers existing and is where the "looks done but isn't" checklist items (deep-linking, dated badges, empty states) get verified against real, complete features rather than partial ones.
- Scoring, enrichment, CRM sync, and roles are explicitly out of this roadmap's scope per PROJECT.md and FEATURES.md's anti-features list — do not create a phase for them; they depend on production usage data from these four phases first.

### Research Flags

Needs deeper research during planning:
- **Phase 1:** Greenfield migration territory — Next.js 16 App Router + Clerk integration specifics (the `middleware.ts` → `proxy.ts` rename), Drizzle+Neon schema/migration tooling, and the shadcn CLI's Radix-vs-Base-UI default are all flagged LOW-MEDIUM confidence single-source findings in STACK.md that should be verified at implementation time, not assumed.

Standard patterns (skip research-phase):
- **Phase 2 & 3:** Master-detail UI, shadcn `Sidebar`/`Table`/`Command`, TanStack Table/Query, URL state via `nuqs` are all well-documented, HIGH-confidence patterns (official docs + a named reference product, Recall.ai's Explorer Dashboard) — standard implementation, not novel research.
- **Phase 4:** `cmdk`/command-palette integration is a well-documented shadcn pattern; the deep-linking acceptance check is a verification task, not a research task.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Framework/data-layer direction verified via official Astro docs + live npm registry versions + official Vercel/Neon/Clerk/shadcn docs; a few CLI-behavior details (shadcn's Base-UI-default claim) are single-source and explicitly flagged LOW |
| Features | MEDIUM-HIGH | Feature landscape corroborated across multiple category leaders (Apollo, ZoomInfo, 6sense, Clay, ChartHop); the GBS/SSC-specific signal taxonomy is project-supplied domain knowledge, not independently verified against a live competitor in that niche |
| Architecture | MEDIUM-HIGH | Master-detail/URL-state pattern confirmed via official Astro docs and Recall.ai's own Explorer Dashboard docs; however, this research was conducted assuming Astro is retained, while STACK.md recommends migrating to Next.js — patterns transfer conceptually but need explicit re-mapping during planning (see Gaps below) |
| Pitfalls | MEDIUM | Data-modeling and UI pitfalls well-documented across CRM/CDP literature (MEDIUM); the Clerk-reuse and seed-to-integration pitfalls are grounded directly in this repo's own `CONCERNS.md` audit (HIGH, first-party evidence) |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Framework research/architecture mismatch:** STACK.md recommends migrating to Next.js (App Router); ARCHITECTURE.md's diagrams and code examples are written against the existing Astro stack (islands, `<ClientRouter />`, `transition:persist`). The underlying patterns (URL-as-state-of-record, single interactive region owning list+filter, domain-type decoupling from the backing store) apply regardless of framework, but the Astro-specific implementation details in ARCHITECTURE.md need translation to Next.js equivalents (Server Components + one Client Component + `nuqs`) during Phase 1/2 planning — do not apply ARCHITECTURE.md's code samples literally if the Next.js migration is adopted.
- **Sanity retirement decision:** STACK.md recommends dropping Sanity for Company/Persona records in favor of Neon+Drizzle; ARCHITECTURE.md's system diagram still shows Sanity as the backing store (written before/independent of that recommendation). Confirm and document this decision explicitly at the start of Phase 1 rather than defaulting to "keep what's already integrated."
- **shadcn CLI default primitive (Radix vs. Base UI):** LOW confidence, single source — explicitly choose Radix at `shadcn init` time unless there's a specific reason to try Base UI; verify current CLI behavior at implementation time.
- **GBS/SSC signal taxonomy market validation:** The four named signals are project-supplied domain framing, not independently verified against a live competitor targeting this same niche — fine to build as v1's differentiator, but don't treat the taxonomy itself as externally validated; expect it to evolve once the team uses the tool.
- **No test framework in place today:** Flagged in the existing codebase's `CONCERNS.md` and carried into STACK.md's dev-tools table — not a milestone-1 blocker, but the roadmap should pick (Vitest or Playwright) before scope grows past these four phases.

## Sources

### Primary (HIGH confidence)
- [Why Astro — docs.astro.build](https://docs.astro.build/en/concepts/why-astro/) — official framing of content-focused vs. application use cases
- [Islands architecture - Astro Docs](https://docs.astro.build/en/concepts/islands/) — islands are isolated by default
- [View transitions - Astro Docs](https://docs.astro.build/en/guides/view-transitions/) — `transition:persist`, `<ClientRouter />` rename
- [Explorer Dashboard - Recall.ai Docs](https://docs.recall.ai/docs/explorer-dashboard) — reference product's path-param deep-link pattern
- npm registry (executed 2026-07-22) — ground-truth current versions for the full recommended stack
- [Vercel: Node.js 20 is being deprecated](https://vercel.com/changelog/node-js-20-is-being-deprecated); [Vercel: Supported Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [Neon: Vercel Postgres transition guide](https://neon.com/docs/guides/vercel-postgres-transition-guide); [Neon for Vercel — Marketplace](https://vercel.com/marketplace/neon)
- [shadcn/ui: Sidebar component](https://ui.shadcn.com/docs/components/radix/sidebar) / [Sidebar blocks](https://ui.shadcn.com/blocks/sidebar); [Tailwind v4 docs](https://ui.shadcn.com/docs/tailwind-v4)
- [Clerk: clerkMiddleware() reference](https://clerk.com/docs/reference/nextjs/clerk-middleware); [Next.js Quickstart](https://clerk.com/docs/nextjs/getting-started/quickstart); [Role based access control with Clerk Organizations](https://clerk.com/blog/role-based-access-control-with-clerk-orgs); [B2B/B2C Roles and Permissions with Clerk Organizations](https://clerk.com/docs/guides/organizations/control-access/roles-and-permissions)
- `.planning/codebase/STACK.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`, `.planning/codebase/CONCERNS.md`, `.planning/PROJECT.md` — first-party, ground truth for this repo's existing state and constraints

### Secondary (MEDIUM confidence)
- [What Is Firmographic Data | Apollo](https://www.apollo.io/insights/what-is-firmographic-data-and-why-does-it-matter-for-outbound-prospecting); [Building an ICP with Sales Intelligence | Apollo](https://www.apollo.io/insights/how-do-i-build-an-ideal-customer-profile-using-data-from-a-sales-intelligence-platform)
- [ZoomInfo Data Overview](https://www.zoominfo.com/data); [ZoomInfo Intent Data](https://www.zoominfo.com/features/intent-data); [Buyer Intent Signals: 2026 Guide](https://pipeline.zoominfo.com/sales/intent-data-signals-that-matter)
- [6sense Signalverse](https://6sense.com/signalverse/); [How 6sense Turns Buying Signals into Account Priorities](https://6sense.com/guides/account-prioritization/)
- [Clay Waterfall enrichment](https://www.clay.com/waterfall-enrichment); [Enriching Company Data | Clay University](https://university.clay.com/lessons/enriching-company-data)
- [Common Room — Signals product page](https://www.commonroom.io/product/signals/); [Capture every signal, everywhere | Common Room blog](https://www.commonroom.io/blog/capture-every-signal-everywhere/)
- [ChartHop org chart resources](https://www.charthop.com/resource/what-is-org-chart-software), [buying considerations](https://www.charthop.com/resources/considerations-when-buying-org-chart-software), [docs](https://docs.charthop.com/org-chart)
- [Transforming finance with GBS | EY](https://www.ey.com/en_us/services/consulting/finance-consulting-services/transforming-finance-with-global-business-services); [10 Shared Services Trends 2025 | Auxis](https://www.auxis.com/10-shared-services-trends-shaping-the-gbs-industry-in-2025/)
- [Custom CRM Data Modeling](https://www.lowcode.agency/blog/custom-crm-objects-data-modeling); [CRM Data Model Explained](https://mriacrm.com/crm-data-model-explained-contacts-companies-deals-and-beyond/); [Normalizing Data Models Across CRMs](https://truto.one/blog/what-is-the-best-way-to-normalize-data-models-across-different-crms)
- [CDP Event Schema Versioning](https://www.pathtoproject.com/blog/20260413-cdp-event-schema-versioning-without-breaking-activation); [Customer Data Processing for Intent Signals](https://www.datawhistl.com/blog/customer-data-processing-for-capturing-intent-signals-in-outbound-marketing-why-packaged-cdps-struggle-and-warehouse-native-architectures-win/)
- [Rendering large lists without virtualization](https://rishandigital.com/reactjs/rendering-large-lists-without-virtualization-causing-slow-ui/); [10 Ways to Optimize Large List Rendering](https://www.fegno.com/10-proven-ways-to-optimize-large-list-rendering-in-react/)
- [Sync React state with the URL](https://carlogino.com/blog/react-sync-state-with-url); [State Management | React Router](https://reactrouter.com/explanation/state-management)
- [Multi-tenant authentication | Clerk](https://clerk.com/blog/multi-tenant-authentication-what-you-need-to-know)
- [Master–detail interface - Wikipedia](https://en.wikipedia.org/wiki/Master%E2%80%93detail_interface)
- [Building a multi-framework dashboard with Astro - LogRocket](https://blog.logrocket.com/building-multi-framework-dashboard-with-astro/); [Boost Performance with Astro Islands - Strapi](https://strapi.io/blog/astro-islands-architecture-explained-complete-guide)

### Tertiary (LOW confidence)
- WebSearch synthesis on "Astro vs Next.js for dashboards," "shadcn CLI Base UI default," and "Next.js 16 proxy.ts rename" — cross-referenced but individual blog posts not independently fetched; the Base-UI-default CLI claim explicitly needs verification at implementation time
- [DEV Community: seed data quality](https://dev.to/joeauty/how-to-stop-living-with-your-seed-data-sucking-4lej) — single source, directionally consistent with general experience
- Clearbit/Apollo enrichment API field-mapping patterns (Explorium.ai, ZoomInfo pipeline comparisons, Clearbit Help Center) — general shape reference only, not independently verified per-field

---
*Research completed: 2026-07-22*
*Ready for roadmap: yes*
