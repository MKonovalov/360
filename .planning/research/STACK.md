# Stack Research

**Domain:** Data-heavy B2B ICP/account-intelligence explorer (admin/dashboard-style internal tool — recall.ai bot explorer / Clay / CRM-lite record browser pattern)
**Researched:** 2026-07-22
**Confidence:** MEDIUM-HIGH (framework/data-layer direction verified via current npm registry + official docs + multiple independent sources; some CLI-behavior details are single-source and flagged LOW)

## Answering the Core Questions

### 1. Is Astro SSR still a reasonable choice for this dashboard, or does React/Next.js fit better?

**Recommendation: migrate to Next.js (App Router).** Confidence: MEDIUM-HIGH.

Astro's own documentation draws the line explicitly: Astro is a **content-focused, multi-page** framework (marketing sites, docs, blogs); frameworks like Next.js/SvelteKit are built for **application-like** experiences — "logged-in admin dashboards, inboxes, social networks" are named as the class of thing Astro is *not* optimized for ([Why Astro — docs.astro.build](https://docs.astro.build/en/concepts/why-astro/)). ArcLumen 360 is precisely that: a fully-authenticated, no-SEO-value, highly-interactive master-detail UI (collapsible nav + live search/filter + selected-row detail pane) with state that must flow between multiple UI regions on every interaction.

Astro's islands-architecture is the specific mismatch. Each interactive region (nav, list, detail pane) would need to be its own hydrated island (`client:load`), and keeping "which company is selected" in sync between the list island and the detail-pane island requires reaching for an external store (nanostores, or a hand-rolled event bus) rather than the ordinary single-component-tree state a React app gets for free. This is a well-documented friction point for exactly this UI shape, not a hypothetical one (multiple independent sources agree on this specific limitation — see Sources). There is also no content/SEO requirement here to justify Astro's zero-JS-by-default tradeoff — the entire surface sits behind Clerk auth, so "ship less JS to anonymous visitors" isn't a real constraint on this build.

Practically for this codebase: the existing Astro app is a thin 4-page redirect bridge with no shared component library and no client-side framework usage today (confirmed in `.planning/codebase/ARCHITECTURE.md`) — there is very little Astro-specific investment to preserve. The two things worth explicitly carrying forward are **Clerk** (same Clerk project/dashboard config, swap `@clerk/astro` → `@clerk/nextjs`) and **Vercel** (same project, but drop the Astro adapter entirely — Next.js is Vercel's native, zero-adapter framework).

**Bonus fix:** this migration also resolves the Node-runtime pin bug that was worked around in commit `4e8b9a04` (`@astrojs/vercel` forcing `nodejs18.x`). Next.js on Vercel has no adapter layer — the Node version is set directly in Vercel Project Settings (or `engines` in `package.json`), with no framework-specific runtime translation to fight. See the Node version note in Platform section below — Node 20 is being deprecated on Vercel Oct 1, 2026, so this is also a chance to move off it.

**If the team prefers to minimize churn and stay on Astro:** it's not impossible — use React islands for nav/list/detail via `@astrojs/react`, share selection state through `nanostores` (`@nanostores/react`), and accept the added indirection. This is listed as the explicit alternative below, but is not the primary recommendation.

### 2. Is Sanity CMS appropriate for structured Company/Persona records with relations, or does this call for a real database?

**Recommendation: Postgres (Neon, via Vercel's native integration) + Drizzle ORM.** Confidence: HIGH.

Sanity is a headless CMS built around an editorial workflow: a Studio UI for content editors, document drafts/publish states, and GROQ as a content-query language. It *can* model references between document types (a Persona document referencing a Company document), so "relations" alone aren't a hard blocker — but the shape of this data and its trajectory argue strongly for a real relational database instead:

- **Milestone 1 already implies structured, filterable, joinable data**: Company ↔ Persona is a real one-to-many/many-to-many relationship that needs to support search, filtering by signal type/strength, and "linked personas"/"linked company" lookups — this is exactly what SQL joins and indexes are for, and exactly what GROQ reference-dereferencing is a workaround for.
- **The stated pipeline beyond milestone 1** (scoring/prioritization algorithm, enrichment API writes from Clearbit/Apollo/ZoomInfo-style sources, CRM sync) is a programmatic-write-heavy, aggregation-heavy workload. That's a database problem, not a content-editing problem — Sanity's per-document mutation API and rate limits are the wrong shape for high-frequency enrichment writes, and there's no SQL aggregation for building a scoring layer later.
- **No editorial/collaboration need**: nobody is drafting/reviewing marketing copy for a Company record — this is structured business data, not content.

Use **Neon Postgres via the Vercel Marketplace integration** (Vercel's own "Vercel Postgres" product was sunset in 2025; Neon is its direct technical successor and is now the first-class Postgres option in the Vercel dashboard — one-click provision, auto-sets `DATABASE_URL`/`DATABASE_URL_UNPOOLED`) with **Drizzle ORM** (TypeScript-first schema + query builder, lightweight/serverless-friendly, pairs naturally with `@neondatabase/serverless`'s HTTP driver for low cold-start latency on Vercel functions). Prisma is a reasonable alternative but its engine binary adds cold-start weight that Drizzle avoids — not a hard blocker, just a worse fit for a serverless-per-request model.

For milestone 1's stated "manual/seed dataset," Postgres full-text search (`tsvector`/`ILIKE`) is sufficient for search/filter — do not reach for Algolia/Meilisearch/Elasticsearch until real data volume or fuzzy-matching needs justify it.

**Sanity's fate:** retire it from this app's core data model. If there's ever a genuine editorial-content need later (e.g., a "playbooks" or internal-docs surface), Sanity could be reintroduced for *that* narrow purpose — but it should not hold Company/Persona records going forward.

### 3. UI/component libraries for collapsible-nav + searchable-list + detail-pane layout

**Recommendation: shadcn/ui + TanStack Table + TanStack Virtual (add when needed) + cmdk + nuqs.** Confidence: MEDIUM-HIGH.

- **shadcn/ui's `Sidebar` component/blocks** are built for exactly this layout — `SidebarProvider` manages collapsed/expanded state, with `SidebarHeader`/`SidebarContent`/`SidebarGroup`/`SidebarMenu` sub-components and ready-made dashboard-sidebar blocks (`ui.shadcn.com/blocks/sidebar`). This is the single best-fit off-the-shelf match for the "collapsible left nav" requirement.
- **TanStack Table** for the searchable/filterable Company and Persona lists — headless, so it pairs directly with shadcn's table primitives (shadcn's own docs demonstrate this combination) and gives sorting/filtering/column-state for free while you own the markup/styling.
- **TanStack Virtual** — add only once a list is large enough to need it (rule of thumb: a few hundred+ rows rendered at once, or an infinite-scroll list). Milestone 1's seed dataset almost certainly doesn't need it yet; treat it as the answer when real enrichment data grows the Company/Persona tables, not a day-1 dependency.
- **cmdk** — command-palette-style fast search/jump-to-record (the shadcn `Command` component wraps this) — a strong fit for "anyone on the team can pull up a company or persona in seconds," matching the stated Core Value.
- **nuqs** — type-safe URL search-param state. Use it to drive "which record is selected" (e.g. `?company=acme-corp`) so the master-detail selection is shareable/bookmarkable/back-button-safe, without a custom global store.
- **TanStack Query** — client-side data fetching/caching for the interactive parts (live search-as-you-type, filter changes, detail-pane swap) sitting on top of Next.js Route Handlers/Server Actions; Server Components still own the first-paint data fetch.
- Supporting: **Zod** for validating API/query-param shapes (the existing codebase has zero runtime validation today — this closes that gap for the new data layer); **date-fns** for "last-updated" badge formatting; **sonner** (shadcn's recommended toast) for any async-action feedback; **lucide-react** for icons (shadcn's default icon set).

**Note on shadcn/ui internals (LOW confidence, single-source, verify at implementation time):** recent shadcn CLI versions have started defaulting new inits to Base UI primitives instead of Radix UI. Radix remains fully supported and has a much larger base of examples/tutorials — unless there's a specific reason to try Base UI, explicitly choose Radix when running `shadcn init` for stability.

### 4. Keeping Clerk auth + Vercel deploy (Node 20 pinned) without disruption

**Recommendation: same Clerk project/config, swap SDK; same Vercel project, drop the adapter, move off Node 20.** Confidence: HIGH.

- **Clerk**: this is a config/dashboard-level integration (publishable key, secret key, domain/subdomain cookie scoping for `arclumenpartners.com` + `360`/`go` subdomains — all documented in `.planning/codebase/STACK.md` and `ARCHITECTURE.md`). None of that changes. Only the SDK package changes: `@clerk/astro` → `@clerk/nextjs` (current: `7.5.22`). Next.js is Clerk's original and most mature integration — `clerkMiddleware()` exists for Next.js exactly as it does for Astro, with the same `auth()`/route-protection model, so this is a like-for-like swap, not a re-implementation of auth logic.
  - **Next.js 16 renamed `middleware.ts` to `proxy.ts`** (old filename still works but is deprecated) — Clerk's `clerkMiddleware()` works under either name; only the file name changes. Worth flagging so whoever scaffolds the app doesn't get tripped up by outdated Clerk tutorials still showing `middleware.ts`.
- **Vercel**: same Vercel project (`360-arclumen`, already linked via `.vercel/project.json`), same custom domain (`360.arclumenpartners.com`). What goes away: `@astrojs/vercel` and its runtime-pinning workaround entirely — Next.js deploys on Vercel natively with no adapter, so the whole class of bug fixed in commit `4e8b9a04` (adapter forcing `nodejs18.x`) cannot recur.
  - **Node version**: don't re-pin to Node 20. Vercel is deprecating Node 20 in Project Settings on **October 1, 2026** (per Vercel's own changelog) — since this is a fresh build, set the Vercel Project Settings Node version to **22.x** (current LTS) via `package.json` `engines` (`"node": "22.x"`) and let Vercel pick it up directly — there's no adapter-level override to fight anymore.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js (App Router) | 16.2.11 | Full-stack React framework, hosting for the explorer | Native Vercel framework (no adapter/runtime-pin issues); Server Components for first-paint data + Client Components for interactive master-detail; App Router is the stable, default pattern |
| React | 19.2.8 | UI library | Required by Next.js 16; shadcn/ui, TanStack libraries all target React 19 |
| TypeScript | 5.6+ | Language | Already the project's language; carries over unchanged |
| Tailwind CSS | 4.3.3 | Styling | Already in use in this repo (v3); v4's CSS-first config (`@theme`) is what current shadcn/ui targets |
| @clerk/nextjs | 7.5.22 | Auth SDK | Direct swap for `@clerk/astro`; same Clerk project/dashboard config, no auth re-implementation |
| Neon Postgres (via Vercel Marketplace) | — (managed service) | Primary datastore for Company/Persona records | Relational data with real joins/filters; direct successor to the sunset "Vercel Postgres" product; one-click Vercel integration auto-wires `DATABASE_URL` |
| Drizzle ORM | 0.45.2 | Typed query builder / schema | TypeScript-first, serverless-friendly (no heavy engine binary), pairs with Neon's HTTP driver for low cold-start latency |
| drizzle-kit | 0.31.10 | Migrations/schema tooling | Companion CLI to Drizzle ORM for generating/running SQL migrations |
| @neondatabase/serverless | 1.1.0 | Postgres driver | HTTP-based driver purpose-built for serverless/edge functions on Vercel |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui (CLI: `shadcn`) | CLI 4.14.0 | Component source (Sidebar, Table, Command, Badge, etc.) | Scaffold collapsible nav (`Sidebar` block), status badges, and base primitives at project start |
| @tanstack/react-table | 8.21.3 | Headless table logic | Company/Persona list sorting, filtering, column state |
| @tanstack/react-virtual | 3.14.8 | List virtualization | Add once a list renders hundreds+ rows at once or uses infinite scroll — not needed for milestone-1 seed data |
| @tanstack/react-query | 5.101.4 | Client data fetching/caching | Search-as-you-type, filter changes, detail-pane swap without full navigation |
| cmdk | 1.1.1 | Command palette | Fast "jump to company/persona" search (powers shadcn's `Command` component) |
| nuqs | 2.9.1 | URL search-param state | Drive master-detail selection (`?company=slug`) so it's shareable/bookmarkable |
| zod | 4.4.3 | Runtime validation | Validate API/query inputs and Drizzle query results at the boundary — closes the "no validation" gap noted in the current codebase |
| date-fns | 4.4.0 | Date formatting | "Last updated" badges, signal timestamps |
| lucide-react | 1.25.0 | Icons | shadcn/ui's default icon set |
| sonner | 2.0.7 | Toasts | Async action feedback (shadcn's recommended toast library) |
| @clerk/themes | 2.4.57 | Clerk UI theming | Match Clerk's hosted `<SignIn/>`/`<UserButton/>` to the app's Tailwind theme |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| ESLint + Next.js config | Linting | Ships with `create-next-app`; keep TypeScript strict mode from the existing `tsconfig.json` |
| Vercel CLI | Deploy/preview | Already a devDependency in this repo; usage pattern carries over unchanged |
| Vitest or Playwright (pick one when tests are prioritized) | Testing | Current codebase has zero tests (flagged in `.planning/codebase/CONCERNS.md`) — not a milestone-1 blocker, but flag for roadmap |

## Installation

```bash
# Core (fresh Next.js app inside this repo, replacing the Astro app)
npx create-next-app@latest --typescript --tailwind --app --eslint

# Auth
npm install @clerk/nextjs @clerk/themes

# Data layer
npm install drizzle-orm @neondatabase/serverless
npm install -D drizzle-kit

# UI / dashboard
npx shadcn@latest init
npx shadcn@latest add sidebar table badge command sonner
npm install @tanstack/react-table @tanstack/react-query cmdk nuqs zod date-fns lucide-react

# Add later, only once list sizes require it
npm install @tanstack/react-virtual
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Next.js (App Router) | Stay on Astro + React islands + nanostores | Team strongly prioritizes minimizing framework churn over developer ergonomics for the interactive master-detail UI; accept added state-sharing complexity |
| Next.js (App Router) | Plain Vite + React Router SPA + Vercel serverless functions | If there's a strong preference to avoid Next.js's opinionated caching/RSC model for an internal-only, auth-gated tool with no SEO need — viable but loses Next's built-in Server Components/streaming and Vercel's zero-config framework preset |
| Neon Postgres + Drizzle | Prisma ORM | Team has existing Prisma expertise; accept slightly higher cold-start latency from Prisma's engine binary on serverless |
| Neon Postgres + Drizzle | Supabase (Postgres + built-in auth/storage) | If the team later wants a bundled Postgres+Storage+Realtime platform instead of Clerk+Neon separately — not recommended here since Clerk auth is already a hard constraint |
| shadcn/ui (Radix) | shadcn/ui (Base UI, new CLI default) | Team wants to try shadcn's newer primitive layer; Radix has a larger base of examples/tutorials today, so default to Radix unless there's a specific reason to switch |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Sanity CMS for Company/Persona records | Built for editorial content workflows (drafts, Studio UI), not structured/relational business data that needs joins, aggregation, and high-frequency programmatic writes from future enrichment APIs | Neon Postgres + Drizzle ORM |
| Astro islands for the whole master-detail UI | Cross-island state sharing (list selection → detail pane) requires external stores and manual wiring for a pattern React handles natively; no SEO/content benefit exists behind Clerk auth to justify the tradeoff | Next.js App Router (Client Components share state via ordinary React state/URL params) |
| `@astrojs/vercel` adapter / Node 20 pin | The adapter forced `nodejs18.x` requiring a manual pin workaround (commit `4e8b9a04`); Node 20 is also being deprecated on Vercel Oct 1, 2026 | Next.js deploys natively on Vercel with no adapter; pin Node 22.x via `engines` |
| Algolia/Meilisearch/Elasticsearch (for milestone 1) | Overkill for a manual/seed dataset with no live enrichment yet — adds infra and cost with no current data-volume justification | Postgres full-text search (`tsvector`)/`ILIKE` filtering; revisit if data volume or fuzzy-match needs grow |
| TanStack Virtual on day one | Adds complexity (fixed-height rows, scroll-container plumbing) before there's data volume to justify it | Plain rendered lists/tables for milestone-1 seed data; add virtualization when a list crosses a few hundred rows |
| Prisma (unless team preference) | Engine-binary cold starts are a worse fit for Vercel's per-request serverless functions than Drizzle's lightweight query builder | Drizzle ORM + `@neondatabase/serverless` |

## Stack Patterns by Variant

**If the team decides to keep Astro despite the recommendation above:**
- Use `@astrojs/react` for islands hosting shadcn/ui components, `@nanostores/react` for cross-island selection state
- Keep `@clerk/astro` (no SDK swap needed)
- Data layer recommendation (Neon + Drizzle) is unaffected by this choice — it's independent of the frontend framework

**If milestone 2+ adds live enrichment API integration:**
- Postgres becomes even more clearly the right call — enrichment writes (Clearbit/Apollo/ZoomInfo-style) are exactly the high-frequency, structured-write workload Sanity is a poor fit for
- Consider a background job runner (Vercel Cron + Route Handlers, or Inngest/Trigger.dev) for enrichment sync — out of scope for this research pass but worth flagging for that phase

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| next@16.2.11 | react@19.2.8 / react-dom@19.2.8 | Next.js 16 requires React 19 |
| @clerk/nextjs@7.5.22 | next@16.x (App Router) | Clerk's Next.js SDK tracks current Next.js majors closely; confirm no pinned peer-dep ceiling at implementation time |
| tailwindcss@4.3.3 | shadcn CLI 4.14.0 | shadcn's current CLI generates Tailwind v4 CSS-first config (`@theme`); do not mix with the repo's existing Tailwind v3 config — this is a breaking migration, not additive |
| drizzle-orm@0.45.2 | @neondatabase/serverless@1.1.0 | Use Drizzle's `neon-http` (or `neon-serverless`) driver adapter to pair the two |
| Next.js 16 | `middleware.ts` → `proxy.ts` rename | Old filename still functions but is deprecated; new Clerk/Next.js tutorials may reference either name — Clerk's `clerkMiddleware()` works unchanged under both |

## Sources

- [Why Astro — docs.astro.build](https://docs.astro.build/en/concepts/why-astro/) — official framing of content-focused vs. application use cases (HIGH confidence)
- npm registry (`npm view <pkg> version`, executed 2026-07-22) — ground-truth current versions for `next`, `react`, `@clerk/nextjs`, `@clerk/astro`, `astro`, `@astrojs/vercel`, `tailwindcss`, `shadcn`, `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `@vercel/postgres`, `@tanstack/react-table`, `@tanstack/react-virtual`, `@tanstack/react-query`, `cmdk`, `nuqs`, `zod`, `date-fns`, `lucide-react`, `sonner`, `@clerk/themes` (HIGH confidence — verified live, not training data)
- [Vercel: Node.js 20 is being deprecated — changelog](https://vercel.com/changelog/node-js-20-is-being-deprecated) — official deprecation date (Oct 1, 2026) (HIGH confidence)
- [Vercel: Supported Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) — current supported versions (24.x default, 22.x, 20.x) (HIGH confidence)
- [Neon: Vercel Postgres transition guide](https://neon.com/docs/guides/vercel-postgres-transition-guide) — official confirmation Neon is the successor to the sunset Vercel Postgres product (HIGH confidence)
- [Neon for Vercel — Marketplace](https://vercel.com/marketplace/neon) — current integration path (HIGH confidence)
- [shadcn/ui: Sidebar component](https://ui.shadcn.com/docs/components/radix/sidebar) and [Sidebar blocks](https://ui.shadcn.com/blocks/sidebar) — official docs for the collapsible-nav component (HIGH confidence)
- [shadcn/ui: Tailwind v4 docs](https://ui.shadcn.com/docs/tailwind-v4) — official CLI/Tailwind v4 integration notes (HIGH confidence)
- [Clerk: clerkMiddleware() SDK reference](https://clerk.com/docs/reference/nextjs/clerk-middleware) and [Next.js Quickstart](https://clerk.com/docs/nextjs/getting-started/quickstart) — official Next.js integration pattern (HIGH confidence)
- WebSearch synthesis on "Astro vs Next.js for dashboards," "shadcn base default," and "Next.js 16 proxy.ts rename" — cross-referenced across multiple independent articles; individual blog-post sources not independently fetched, so treated as MEDIUM confidence except where corroborated by the official docs above; the Base-UI-default CLI claim is flagged explicitly as LOW confidence pending verification at implementation time
- `.planning/codebase/STACK.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/PROJECT.md` — existing repo state and constraints (ground truth for this repo)

---
*Stack research for: Data-heavy B2B ICP/account-intelligence explorer dashboard*
*Researched: 2026-07-22*
