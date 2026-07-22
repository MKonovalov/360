<!-- refreshed: 2026-07-22 -->
# Architecture

**Analysis Date:** 2026-07-22

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    External: go.arclumenpartners.com                 │
│         (separate repo/service, NOT in this codebase — thin          │
│          redirector, reads/sets NO cookies)                          │
└───────────────────────────────┬───────────────────────────────────────┘
                                 │ 302 → /bridge?code=CODE
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│              Astro SSR Pages (this repo, `src/pages/`)               │
├─────────────────┬───────────────────┬────────────────┬──────────────┤
│  `index.astro`  │   `bridge.astro`  │  `l/[code]     │ `sign-in     │
│  landing/status │   staff/visitor   │   .astro`      │  .astro`     │
│                 │   routing brain   │  staff viewer  │  Clerk widget│
└────────┬────────┴─────────┬─────────┴───────┬────────┴──────────────┘
         │                  │                 │
         ▼                  ▼                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│         Clerk Middleware — `src/middleware.ts`                       │
│         Populates `Astro.locals.auth()` on every request             │
└─────────────────────────────────────────────────────────────────────┘
         │                                    │
         ▼                                    ▼
┌────────────────────────┐        ┌───────────────────────────────────┐
│  Clerk (external auth) │        │  Sanity CMS client — `src/lib/     │
│  session/user identity │        │  sanity.ts` — GROQ fetch of        │
│                         │        │  `shortLink` documents             │
└────────────────────────┘        └───────────────────────────────────┘
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

**Overall:** Server-rendered (SSR) Astro app functioning as a thin "auth-aware redirect bridge" — not a general web app. Every page is a standalone request handler with no shared component library or client-side framework code (no React/Vue islands used despite Astro's capability for it).

**Key Characteristics:**
- All routes set `export const prerender = false` — this app has no static pages; every request runs server-side (required for Clerk's `__session` cookie).
- No client-side JavaScript beyond what Clerk's `<SignIn />` component injects; all logic (auth check, Sanity fetch, redirect decision) happens on the server before HTML is sent.
- Single external system per concern: Clerk for identity, Sanity for short-link data. No database of its own, no ORM, no server framework beyond Astro + the Vercel serverless adapter.
- The "business logic" of the entire app is concentrated in one file, `src/pages/bridge.astro`, which encodes the staff-vs-visitor branching decision described in `go-redirect-SPEC.md`.

## Layers

**Middleware (cross-cutting):**
- Purpose: Populate Clerk auth state before any page renders
- Location: `src/middleware.ts`
- Contains: One `clerkMiddleware()` call, re-exported as `onRequest`
- Depends on: `@clerk/astro/server`
- Used by: Every page under `src/pages/` via `Astro.locals.auth()`

**Pages (routing + view + logic, colocated):**
- Purpose: Astro's file-based router; each `.astro` file is both the HTTP handler (frontmatter) and the HTML template (markup)
- Location: `src/pages/`
- Contains: Auth checks, Sanity queries, redirect logic, and Tailwind-styled markup — all in one file per route
- Depends on: `src/lib/sanity.ts`, Clerk's `Astro.locals.auth()`, `@clerk/astro/components`
- Used by: Nothing above this layer — pages are the entry points

**Lib (shared clients):**
- Purpose: Centralize external-service client construction so it isn't duplicated per page
- Location: `src/lib/sanity.ts`
- Contains: One `sanity` client instance and the `ShortLinkRecord` interface
- Depends on: `@sanity/client`, `PUBLIC_SANITY_*` env vars
- Used by: `src/pages/bridge.astro`, `src/pages/l/[code].astro`

## Data Flow

### Primary Request Path (visitor clicking a HubSpot short link)

1. External `go.` service 302-redirects `go.arclumenpartners.com/l/CODE` to `360.arclumenpartners.com/bridge?code=CODE` (outside this repo).
2. `src/middleware.ts` runs first, populating `Astro.locals.auth()` for the incoming request.
3. `src/pages/bridge.astro` reads `code` from the query string and `userId` from `Astro.locals.auth()` (`src/pages/bridge.astro:12-13`).
4. If `userId` is present (staff), redirect to `/l/${code}` (`src/pages/bridge.astro:16-18`).
5. If no `userId` (anonymous visitor), query Sanity for `targetUrl` via GROQ (`src/pages/bridge.astro:23-26`) and redirect there.
6. On missing record or Sanity error, redirect to `/` as a safe fallback (`src/pages/bridge.astro:29-33`) — the app never invents a destination URL.

### Staff Viewer Path

1. `src/pages/l/[code].astro` checks `Astro.locals.auth()`; if no `userId`, redirects to `/sign-in` (`src/pages/l/[code].astro:6-7`).
2. Otherwise fetches the full `shortLink` document (`_id`, `title`, `targetUrl`, `contactName`) from Sanity by `code` (`src/pages/l/[code].astro:14-17`).
3. Renders a "Staff view" card with title, optional contact name, and a link to the real destination — the staff member sees the destination before clicking through.

**State Management:**
- No client-side or server-side application state. All state is either the incoming request (query params, cookies via Clerk) or read fresh from Sanity per request (`useCdn: false` in `src/lib/sanity.ts:8` — always live data, no CDN caching).

## Key Abstractions

**ShortLinkRecord:**
- Purpose: Shape of a Sanity `shortLink` document as consumed by this app
- Examples: `src/lib/sanity.ts:11-16`
- Pattern: Plain TypeScript interface, no validation/runtime schema — trusts Sanity's GROQ projection to match the shape

**Clerk `Astro.locals.auth()`:**
- Purpose: The sole authentication/authorization primitive; every protected/branching page destructures `{ userId }` from it
- Examples: `src/pages/index.astro:3`, `src/pages/bridge.astro:13`, `src/pages/l/[code].astro:6`
- Pattern: Presence of `userId` = "signed in staff member"; absence = anonymous visitor. No roles, scopes, or permission levels beyond this binary.

## Entry Points

**`src/pages/index.astro`:**
- Location: `src/pages/index.astro`
- Triggers: Direct navigation to the site root
- Responsibilities: Show a minimal status card (signed in vs. sign-in link); no business logic

**`src/pages/bridge.astro`:**
- Location: `src/pages/bridge.astro`
- Triggers: 302 redirect from the external `go.` short-link service, with `?code=` query param
- Responsibilities: The entire staff/visitor routing decision for the product (see Primary Request Path above)

**`src/pages/l/[code].astro`:**
- Location: `src/pages/l/[code].astro`
- Triggers: Direct navigation (staff bookmarks) or redirect from `bridge.astro` for signed-in staff
- Responsibilities: Authenticated short-link detail view

**`src/pages/sign-in.astro`:**
- Location: `src/pages/sign-in.astro`
- Triggers: Redirect target when an unauthenticated user hits `l/[code].astro`, or manual navigation
- Responsibilities: Render Clerk's hosted sign-in UI

**`src/middleware.ts`:**
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

**What happens:** `README.md:12-33` documents a `go.` service that verifies the Clerk `__session` cookie itself via `verifyToken` and a root-domain-scoped cookie. `go-redirect-SPEC.md` (the newer, authoritative spec) explicitly states this is impossible because `__session` is host-only, and the actual implementation in `src/pages/bridge.astro` reflects the corrected design.
**Why it's wrong:** A reader trusting `README.md` alone would implement a `go.` service that cannot work, and would misunderstand why `bridge.astro` exists.
**Do this instead:** Treat `go-redirect-SPEC.md` as the source of truth for the cross-service architecture; update or remove the conflicting section in `README.md` when touched next.

### Business logic embedded directly in page frontmatter

**What happens:** The staff/visitor branching decision, Sanity query, and error-fallback logic all live inline in `src/pages/bridge.astro`'s frontmatter rather than in a testable function in `src/lib/`.
**Why it's wrong:** There is no way to unit test the routing decision without rendering the Astro page; any future addition of a second entry point for the same logic would duplicate it.
**Do this instead:** If this logic grows (e.g., analytics, rate limiting, additional destinations), extract it into a plain function in `src/lib/` (e.g., `src/lib/routeShortLink.ts`) that `bridge.astro` calls, keeping the `.astro` file as a thin adapter.

## Error Handling

**Strategy:** Fail-safe, silent-fallback. Errors from Sanity are caught and treated as "not found" rather than surfaced to the visitor.

**Patterns:**
- `bridge.astro`: wraps the Sanity fetch in `try { ... } catch { /* fall through to safe fallback */ }` (`src/pages/bridge.astro:22-30`) — any failure (network, bad query, missing record) results in a redirect to `/`, never a 500 or an invented URL.
- `l/[code].astro`: same pattern — a Sanity error sets `notFound = true` and renders a "Link not found" card instead of throwing (`src/pages/l/[code].astro:13-21`).
- No centralized error boundary, logging, or error-tracking integration exists anywhere in the codebase.

## Cross-Cutting Concerns

**Logging:** None. No logging library, no `console.log` calls, no external log/monitoring service configured.
**Validation:** None beyond TypeScript's compile-time types (`astro/tsconfigs/strict` in `tsconfig.json:2`). Sanity query results are trusted at runtime with no schema validation (e.g., no zod).
**Authentication:** Entirely delegated to Clerk via `@clerk/astro`; `src/middleware.ts` is the sole wiring point, and pages consume it through `Astro.locals.auth()`. There is no custom session, token, or role logic in this repo.

---

*Architecture analysis: 2026-07-22*
