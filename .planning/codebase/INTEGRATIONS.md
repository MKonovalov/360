# External Integrations

**Analysis Date:** 2026-07-22

## APIs & External Services

**Authentication:**
- Clerk (`@clerk/astro` ^2.2.0) - staff authentication/session management
  - SDK/Client: `@clerk/astro/server` (`clerkMiddleware()` in `src/middleware.ts`), `@clerk/astro/components` (`<SignIn />` in `src/pages/sign-in.astro`)
  - Auth: `PUBLIC_CLERK_PUBLISHABLE_KEY` (client-exposed), `CLERK_SECRET_KEY` (server-only)
  - Session read via `Astro.locals.auth()` → `{ userId }`, populated on every request by the middleware
  - Cookie: `__session`, host-only to `360.arclumenpartners.com` (Clerk does not support broadening this to the root domain without a paid "Satellite domains" plan — documented extensively in `go-redirect-SPEC.md` and `README.md`)

**Content/CMS:**
- Sanity (`@sanity/client` ^6.21.0) - headless CMS storing `shortLink` documents (`code`, `title`, `targetUrl`, optional `contactName`)
  - SDK/Client: `createClient()` in `src/lib/sanity.ts`, apiVersion `2024-01-01`, `useCdn: false` (always fresh reads, no CDN caching)
  - Auth: `PUBLIC_SANITY_PROJECT_ID`, `PUBLIC_SANITY_DATASET` (both public/read-only config, no API token used in current client — read access presumably via public dataset visibility)
  - Additional env vars present in `.env.local` but unused in current source: `PUBLIC_SANITY_ORGANISATION_ID`, `PUBLIC_SANITY_EDITOR_KEY` (likely reserved for a future Sanity Studio/editor integration, not yet implemented in this repo)
  - Queries: GROQ, e.g. `*[_type == "shortLink" && code == $code][0]{ _id, title, targetUrl, contactName }` (`src/pages/l/[code].astro`, `src/pages/bridge.astro`)

## Data Storage

**Databases:**
- Sanity (content lake, not a traditional DB) — sole data store for `shortLink` records
  - Connection: `PUBLIC_SANITY_PROJECT_ID` + `PUBLIC_SANITY_DATASET`
  - Client: `@sanity/client` (`src/lib/sanity.ts`)

**File Storage:**
- Not detected — no file/blob storage integration in current code

**Caching:**
- None — Sanity client explicitly sets `useCdn: false`

## Authentication & Identity

**Auth Provider:**
- Clerk (`@clerk/astro`)
  - Implementation: `clerkMiddleware()` registered as global Astro middleware (`src/middleware.ts`); every page checks `Astro.locals.auth()` for `userId` to gate access (`src/pages/index.astro`, `src/pages/l/[code].astro`) or branch behavior (`src/pages/bridge.astro`)
  - No sign-up flow found — only `<SignIn />` component wired at `/sign-in` (`src/pages/sign-in.astro`)
  - Cross-subdomain nuance: this app (`360.arclumenpartners.com`) is the ONLY place the `__session` cookie can be read; a sibling subdomain (`go.arclumenpartners.com`, described as "separate service" in README/spec, not part of this repo) cannot read it directly and must 302 into `/bridge` on this app to get an auth decision

## Monitoring & Observability

**Error Tracking:**
- None detected — no Sentry, Bugsnag, or similar SDK in dependencies

**Logs:**
- None detected — no logging library; errors are caught and swallowed silently with fallback behavior (e.g. `src/pages/bridge.astro` catches Sanity fetch errors and falls through to a safe redirect with no logging)

## CI/CD & Deployment

**Hosting:**
- Vercel — `@astrojs/vercel/serverless` adapter, `.vercel/project.json` links to Vercel project `360-arclumen` (org `team_OZy1cDQbpMv0U8V5oRVLWav7`)
- Deployment method documented in `go-redirect-SPEC.md`: `vercel deploy --prebuilt --prod` after building locally under Node 20 (`nvm use 20`) — auto-detection from a Node 22 shell produces a rejected `nodejs18.x` runtime

**CI Pipeline:**
- None detected — no `.github/workflows`, no CI config files found

## Environment Configuration

**Required env vars (existence noted only, values never read):**
- `PUBLIC_SANITY_PROJECT_ID` - Sanity project identifier (public)
- `PUBLIC_SANITY_DATASET` - Sanity dataset name (public)
- `PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk publishable key (public)
- `CLERK_SECRET_KEY` - Clerk secret key (server-only, sensitive)
- Present in `.env.local` but not referenced in current `src/`: `PUBLIC_SANITY_ORGANISATION_ID`, `PUBLIC_SANITY_EDITOR_KEY`

**Secrets location:**
- `.env.local` (gitignored, real values, present on disk but never read for this analysis)
- `.env.example` documents the key names only (no real values)
- Vercel project env vars (per README: "Add env vars from .env.example" during Vercel import)

## Webhooks & Callbacks

**Incoming:**
- None detected — no webhook endpoint routes in `src/pages/`

**Outgoing:**
- None detected

## Related External Service (Out of Repo)

**`go.arclumenpartners.com` short-link redirector:**
- Described in `README.md` and `go-redirect-SPEC.md` as a separate, minimal service/repo (not present in this codebase)
- Its sole job: `GET /l/:code` → 302 to `https://360.arclumenpartners.com/bridge?code=:code`
- Must NOT read or set cookies (keeps anonymous visitors anonymous)
- This repo's `src/pages/bridge.astro` is the integration point: it reads the Clerk session (only possible on this origin) and branches — staff go to `/l/:code` (internal viewer, `src/pages/l/[code].astro`), anonymous visitors are resolved via a Sanity lookup and redirected straight to `targetUrl`
- Integration contract constraints (from spec): 302 (not 301) redirects throughout; same root domain `arclumenpartners.com` required for cookie scoping to work at all; Node 20 runtime pinned on both services

---

*Integration audit: 2026-07-22*
