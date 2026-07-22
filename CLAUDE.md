<!-- GSD:project-start source:PROJECT.md -->
## Project

**ArcLumen 360**

ArcLumen 360 is an end-to-end demand generation pipeline for ArcLumen Partners, giving the team a 360-degree overview of potential ICPs — target Companies and their Key Personas — surfaced through buying/intent signals (financial cost pressure, no mature GBS/SSC org, new CFO/GBS head, announcement of a large transformation program). Milestone 1 delivers a scalable explorer UI, modeled on the recall.ai dashboard explorer (collapsible left nav, searchable/filterable lists, master-detail pane), sitting behind the existing Clerk auth already running in this repo.

**Core Value:** Fast, shared ICP lookup — anyone on the team can pull up a company or persona and see a complete, trustworthy 360 view with buying signals in seconds, replacing signal knowledge that today lives scattered across individual heads and inboxes.

### Constraints

- **Tech stack**: Migrate Astro → Next.js (App Router) and Sanity → Neon Postgres + Drizzle ORM, per research (`.planning/research/STACK.md`). Astro's island-isolation model fights master-detail selection state; Sanity's editorial-CMS shape doesn't fit relational Company/Persona/Signal data that will need high-frequency programmatic writes once enrichment lands.
- **Auth**: Reuse the existing Clerk integration/config, ported to `@clerk/nextjs` — same Clerk project/dashboard, same session model, don't re-implement auth from scratch.
- **Deployment**: Same Vercel project/domain. Node 20 pin goes away with the Astro adapter (source of the original pin bug) — pin Node 22.x instead per Vercel's Node 20 deprecation (Oct 2026).
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 5.6+ (installed 5.9.3) - all application code (`src/lib/sanity.ts`, `src/middleware.ts`, `src/env.d.ts`)
- Astro component syntax (`.astro` files, frontmatter TypeScript + HTML templates) - `src/pages/*.astro`
- None (no separate backend language; this is a single Astro SSR app)
## Runtime
- Node.js — `package.json` declares `"engines": { "node": "22.x" }`, but the Vercel adapter is explicitly pinned to `nodejs20.x` in `astro.config.mjs` (`adapter: vercel({ runtime: 'nodejs20.x' })`). This mismatch is intentional/documented: local dev runs under Node 22, but Vercel's serverless runtime must be Node 20 or Vercel rejects the build (see commit `4e8b9a04` and `go-redirect-SPEC.md` "Node runtime" section).
- Locally installed Node: v22.23.1 (`node -v`)
- **Constraint:** do not let Vercel auto-detect the runtime from a Node 22 shell — build locally under Node 20 or rely on the explicit `runtime: 'nodejs20.x'` adapter config.
- `package.json` declares `packageManager: "yarn@1.22.22..."` (Yarn Classic)
- However `package-lock.json` is present (487KB) — indicates npm has also been used to install. Lockfile state is inconsistent (both yarn and npm lockfiles referenced/present); treat with caution. `README.md` local-dev instructions use `npm install` / `npm run dev`.
- Lockfile: present (`package-lock.json`); no `yarn.lock` found in listing.
## Frameworks
- Astro 4.16 (installed 4.16.19) - meta-framework, SSR web app. `output: 'server'` is REQUIRED per `astro.config.mjs` comment — cookies (Clerk `__session`) only work under SSR, never on a static build.
- `@astrojs/vercel` 7.8 (installed 7.8.2) - Vercel serverless adapter (`astro.config.mjs`)
- `@astrojs/tailwind` 5.1 (installed 5.1.5) - Tailwind integration for Astro
- `@clerk/astro` 2.2+ (installed 2.17.14) - Clerk auth integration for Astro (middleware + `<SignIn />` component)
- Not detected — no test runner, test config, or test files found in the repository.
- `@astrojs/check` 0.9 - `astro check` script (type/diagnostic checking, run via `npm run check`)
- `vercel` CLI 56.2 (installed 56.2.1) - devDependency, used for `vercel deploy --prebuilt --prod` per `go-redirect-SPEC.md`
- TypeScript 5.6+ (installed 5.9.3) - `tsconfig.json` extends `astro/tsconfigs/strict`
## Key Dependencies
- `@clerk/astro` (^2.2.0) - authentication; provides `clerkMiddleware()` (`src/middleware.ts`) and `Astro.locals.auth()` used across every page (`src/pages/index.astro`, `src/pages/bridge.astro`, `src/pages/l/[code].astro`)
- `@sanity/client` (^6.21.0) - headless CMS client for fetching `shortLink` documents (`src/lib/sanity.ts`)
- `astro` (^4.16.0) - core web framework, SSR routing/rendering
- `@astrojs/vercel` (^7.8.0) - Vercel serverless adapter, pinned to `nodejs20.x` runtime
- `tailwindcss` (^3.4.0) - utility CSS, used inline in all `.astro` templates
## Configuration
- Env vars loaded via Astro's `import.meta.env` (Vite-style) and Clerk's own env conventions (`PUBLIC_*` prefix = exposed to client, no prefix = server-only)
- `.env.example` lists required keys (values not read/quoted here — existence only): `PUBLIC_SANITY_PROJECT_ID`, `PUBLIC_SANITY_DATASET`, `PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- `.env.local` present locally (real keys; gitignored) — additional keys present beyond `.env.example`: `PUBLIC_SANITY_ORGANISATION_ID`, `PUBLIC_SANITY_EDITOR_KEY` (not referenced in current source — likely for Sanity Studio/editor tooling not yet wired into this repo)
- Type-checked env shape declared in `src/env.d.ts` (`ImportMetaEnv` interface covers the 4 `.env.example` keys; does not include the two extra `.env.local`-only keys)
- `.gitignore` excludes `.env`, `.env.*`, explicitly allowing `.env.example`
- `astro.config.mjs` - main framework config: `output: 'server'`, Vercel adapter, `site` set to production domain, integrations (`tailwind()`, `clerk()`)
- `tsconfig.json` - extends `astro/tsconfigs/strict`; path alias `@/*` → `src/*`
- `tailwind.config.cjs` - content globs over `src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}`, no custom theme/plugins
- `.vercel/project.json` - links local repo to Vercel project `360-arclumen` (projectId `prj_DbEzimzON9nzF7Nmk7Nueta7k00V`)
## Platform Requirements
- Node.js (22.x per `engines`, but see runtime mismatch note above — prefer Node 20 for builds destined for Vercel deploy)
- `npm install` (per README) or `yarn` (per `packageManager` field) — pick one and be consistent to avoid lockfile drift
- `.env` file populated from `.env.example` (README: `cp .env.example .env`)
- Vercel serverless (Node 20.x runtime, framework preset: Astro)
- Custom domain: `360.arclumenpartners.com` (declared as `site` in `astro.config.mjs`)
- Requires Clerk Dashboard configuration: root domain `arclumenpartners.com`, subdomains `360` and `go` registered so `__session` cookie scope works (see `README.md` "Prereqs already done")
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Codebase Size Note
## Naming Patterns
- Astro pages use kebab-case or plain lowercase: `src/pages/index.astro`, `src/pages/bridge.astro`, `src/pages/sign-in.astro`
- Dynamic route segments use bracket syntax matching Astro's file-based routing: `src/pages/l/[code].astro`
- Library/utility modules use lowercase, no suffix: `src/lib/sanity.ts` (not `sanity.util.ts` or `sanityClient.ts`)
- Framework-reserved files keep exact required names: `src/middleware.ts`, `src/env.d.ts`
- No standalone exported functions yet in the codebase; all logic lives inline in Astro frontmatter (the `---` script block) or as client instantiation (`createClient(...)`).
- When adding functions, follow camelCase per existing variable naming (`sanity`, `record`, `notFound`).
- camelCase throughout: `targetUrl`, `contactName`, `userId`, `notFound`, `record`.
- Booleans read as a predicate/state flag, no `is`/`has` prefix convention established yet — `notFound` is the only example. Prefer `is`/`has` prefixes for new boolean variables for clarity (e.g. `isStaff` as documented in `README.md`'s example `go.` service snippet) since that pattern already appears in project documentation.
- PascalCase interfaces, suffixed with the domain noun + `Record` for Sanity document shapes: `ShortLinkRecord` in `src/lib/sanity.ts:11`.
- `interface` (not `type`) is used for object shapes in `.ts` files. Follow `interface` for document/record shapes, reserve `type` for unions/aliases if introduced later.
## Code Style
- No `.prettierrc` or Prettier config file exists in the repo. No `.eslintrc*` / `eslint.config.*` exists either — there is no automated formatting or linting enforced.
- Observed style (manually consistent across all files): single quotes for strings (`'../../lib/sanity'`), semicolons terminate every statement, 2-space indentation.
- `astro check` (via `npm run check` / `package.json` script) is the only static check configured — it runs Astro's TypeScript diagnostics (`@astrojs/check` + `typescript` devDependencies), not a linter.
- Not configured. There is no ESLint or Biome setup. When adding one, `tsconfig.json` already extends `astro/tsconfigs/strict`, so keep new lint config aligned with strict TypeScript (no implicit any, etc.).
- `tsconfig.json` extends `astro/tsconfigs/strict` (`tsconfig.json:2`) — strict mode is active project-wide.
- Path alias `@/*` maps to `src/*` (`tsconfig.json:6-8`) but is not yet used anywhere in source — all current imports use relative paths (`../../lib/sanity`, `../lib/sanity`). Prefer relative imports for consistency with existing pages unless refactoring to adopt `@/*` broadly.
## Import Organization
- `@/*` → `src/*` is configured in `tsconfig.json` but unused. New code may adopt it, but match existing files' relative-import style if editing them for consistency.
- Every SSR page that touches Clerk auth or Sanity data explicitly sets `export const prerender = false;` at the top of the frontmatter. This is required because Astro's default output for individual routes can be prerendered unless explicitly opted out — always add this line to any new dynamic/auth-gated page.
## Error Handling
- Network/data-fetch calls to Sanity are wrapped in `try { ... } catch { ... }` with the catch block deliberately empty or setting a fallback flag — errors are swallowed silently, not logged or re-thrown:
- Auth is checked with early-return guard clauses, not exceptions: `const { userId } = Astro.locals.auth(); if (!userId) return Astro.redirect('/sign-in');` (`src/pages/l/[code].astro:6-7`).
- No custom error classes, no centralized error handler, no logging framework. Errors that occur during Sanity fetch degrade to a safe default (redirect to `/`, show "not found" UI) rather than surfacing a 500 or stack trace to the user.
- **Guidance for new code:** follow this "fail safe, fail silent, fail toward a known-good UI state" pattern for any external call (Sanity, Clerk). Do not introduce unhandled promise rejections or let Astro's default 500 page show for expected failure modes (missing record, unknown code).
## Logging
## Comments
- Comments explain *why*, not *what* — every comment block in the codebase documents a non-obvious architectural or security decision, not a restatement of code. Examples:
- Inline one-line comments mark subtle branches: `// NOTE: never set a cookie here -> visitors stay anonymous` (in `README.md`'s embedded snippet).
- **Guidance for new code:** when a security/privacy/architecture decision is non-obvious from the code alone, add a comment explaining the reasoning, matching the density and tone already established (concise, 1-4 lines, placed directly above the relevant code).
- Not used anywhere in the codebase. Do not introduce JSDoc blocks unless establishing a new project-wide convention.
## Function Design
## Module Design
- `src/lib/sanity.ts` uses named exports (`export const sanity`, `export interface ShortLinkRecord`) — no default exports observed anywhere in the codebase. Follow named-export convention for all new modules.
- `src/middleware.ts` exports the single required `onRequest` named export per Astro's middleware contract.
- Declared and typed centrally in `src/env.d.ts` via the `ImportMetaEnv` interface (`src/env.d.ts:5-10`) — any new env var must be added here for type safety, matching the `readonly <NAME>: string` pattern.
- Client-safe vars are prefixed `PUBLIC_` (`PUBLIC_SANITY_PROJECT_ID`, `PUBLIC_SANITY_DATASET`, `PUBLIC_CLERK_PUBLISHABLE_KEY`); server-only secrets are not prefixed (`CLERK_SECRET_KEY`). Follow this prefix convention strictly — never expose a non-`PUBLIC_` var to client code.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## System Overview
```text
```
## Component Responsibilities
| Component | Responsibility | File |
|-----------|----------------|------|
| Clerk middleware | Wires Clerk auth into every SSR request so `Astro.locals.auth()` is populated | `src/middleware.ts` |
| Sanity client | Single shared client + `ShortLinkRecord` type for querying short-link documents | `src/lib/sanity.ts` |
| Landing page | Minimal status page; shows sign-in link or staff hint | `src/pages/index.astro` |
| Bridge page | Core routing decision: staff → internal viewer, visitor → real destination | `src/pages/bridge.astro` |
| Staff viewer | Authenticated-only page showing short-link metadata + destination link | `src/pages/l/[code].astro` |
| Sign-in page | Renders Clerk's hosted `<SignIn />` component | `src/pages/sign-in.astro` |
| Astro config | Declares SSR (`output: 'server'`), Vercel adapter, integrations | `astro.config.mjs` |
## Pattern Overview
- All routes set `export const prerender = false` — this app has no static pages; every request runs server-side (required for Clerk's `__session` cookie).
- No client-side JavaScript beyond what Clerk's `<SignIn />` component injects; all logic (auth check, Sanity fetch, redirect decision) happens on the server before HTML is sent.
- Single external system per concern: Clerk for identity, Sanity for short-link data. No database of its own, no ORM, no server framework beyond Astro + the Vercel serverless adapter.
- The "business logic" of the entire app is concentrated in one file, `src/pages/bridge.astro`, which encodes the staff-vs-visitor branching decision described in `go-redirect-SPEC.md`.
## Layers
- Purpose: Populate Clerk auth state before any page renders
- Location: `src/middleware.ts`
- Contains: One `clerkMiddleware()` call, re-exported as `onRequest`
- Depends on: `@clerk/astro/server`
- Used by: Every page under `src/pages/` via `Astro.locals.auth()`
- Purpose: Astro's file-based router; each `.astro` file is both the HTTP handler (frontmatter) and the HTML template (markup)
- Location: `src/pages/`
- Contains: Auth checks, Sanity queries, redirect logic, and Tailwind-styled markup — all in one file per route
- Depends on: `src/lib/sanity.ts`, Clerk's `Astro.locals.auth()`, `@clerk/astro/components`
- Used by: Nothing above this layer — pages are the entry points
- Purpose: Centralize external-service client construction so it isn't duplicated per page
- Location: `src/lib/sanity.ts`
- Contains: One `sanity` client instance and the `ShortLinkRecord` interface
- Depends on: `@sanity/client`, `PUBLIC_SANITY_*` env vars
- Used by: `src/pages/bridge.astro`, `src/pages/l/[code].astro`
## Data Flow
### Primary Request Path (visitor clicking a HubSpot short link)
### Staff Viewer Path
- No client-side or server-side application state. All state is either the incoming request (query params, cookies via Clerk) or read fresh from Sanity per request (`useCdn: false` in `src/lib/sanity.ts:8` — always live data, no CDN caching).
## Key Abstractions
- Purpose: Shape of a Sanity `shortLink` document as consumed by this app
- Examples: `src/lib/sanity.ts:11-16`
- Pattern: Plain TypeScript interface, no validation/runtime schema — trusts Sanity's GROQ projection to match the shape
- Purpose: The sole authentication/authorization primitive; every protected/branching page destructures `{ userId }` from it
- Examples: `src/pages/index.astro:3`, `src/pages/bridge.astro:13`, `src/pages/l/[code].astro:6`
- Pattern: Presence of `userId` = "signed in staff member"; absence = anonymous visitor. No roles, scopes, or permission levels beyond this binary.
## Entry Points
- Location: `src/pages/index.astro`
- Triggers: Direct navigation to the site root
- Responsibilities: Show a minimal status card (signed in vs. sign-in link); no business logic
- Location: `src/pages/bridge.astro`
- Triggers: 302 redirect from the external `go.` short-link service, with `?code=` query param
- Responsibilities: The entire staff/visitor routing decision for the product (see Primary Request Path above)
- Location: `src/pages/l/[code].astro`
- Triggers: Direct navigation (staff bookmarks) or redirect from `bridge.astro` for signed-in staff
- Responsibilities: Authenticated short-link detail view
- Location: `src/pages/sign-in.astro`
- Triggers: Redirect target when an unauthenticated user hits `l/[code].astro`, or manual navigation
- Responsibilities: Render Clerk's hosted sign-in UI
- Location: `src/middleware.ts`
- Triggers: Every SSR request, before any page frontmatter runs
- Responsibilities: Attach Clerk auth state to `Astro.locals`
## Architectural Constraints
- **Threading:** Single-request-per-invocation serverless model (Vercel Node.js 20.x runtime, pinned via `astro.config.mjs:10` — `runtime: 'nodejs20.x'`). No background workers, queues, or long-running processes.
- **Global state:** `src/lib/sanity.ts` constructs one module-level `sanity` client instance shared across all imports (standard for serverless — no connection pooling concerns since Sanity is HTTP-based).
- **Circular imports:** None detected — three-file dependency graph (`middleware.ts` → Clerk SDK; pages → `src/lib/sanity.ts` → `@sanity/client`).
- **Cookie scoping (hard constraint):** Clerk's `__session` cookie is host-only to `360.arclumenpartners.com` and cannot be read by the sibling `go.` subdomain. This is why all staff-detection logic must live in `bridge.astro` on this origin, not in the external `go.` service. See `go-redirect-SPEC.md:1-13` for the full rationale — this reverses an earlier (incorrect) design still described in `README.md`.
- **No prerendering:** Every page explicitly sets `export const prerender = false`; combined with `output: 'server'` in `astro.config.mjs:9`, the entire site is dynamically rendered per request. There are no static assets to serve for HTML routes.
## Anti-Patterns
### Stale documentation describing a superseded design
### Business logic embedded directly in page frontmatter
## Error Handling
- `bridge.astro`: wraps the Sanity fetch in `try { ... } catch { /* fall through to safe fallback */ }` (`src/pages/bridge.astro:22-30`) — any failure (network, bad query, missing record) results in a redirect to `/`, never a 500 or an invented URL.
- `l/[code].astro`: same pattern — a Sanity error sets `notFound = true` and renders a "Link not found" card instead of throwing (`src/pages/l/[code].astro:13-21`).
- No centralized error boundary, logging, or error-tracking integration exists anywhere in the codebase.
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
