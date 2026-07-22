# Technology Stack

**Analysis Date:** 2026-07-22

## Languages

**Primary:**
- TypeScript 5.6+ (installed 5.9.3) - all application code (`src/lib/sanity.ts`, `src/middleware.ts`, `src/env.d.ts`)
- Astro component syntax (`.astro` files, frontmatter TypeScript + HTML templates) - `src/pages/*.astro`

**Secondary:**
- None (no separate backend language; this is a single Astro SSR app)

## Runtime

**Environment:**
- Node.js — `package.json` declares `"engines": { "node": "22.x" }`, but the Vercel adapter is explicitly pinned to `nodejs20.x` in `astro.config.mjs` (`adapter: vercel({ runtime: 'nodejs20.x' })`). This mismatch is intentional/documented: local dev runs under Node 22, but Vercel's serverless runtime must be Node 20 or Vercel rejects the build (see commit `4e8b9a04` and `go-redirect-SPEC.md` "Node runtime" section).
- Locally installed Node: v22.23.1 (`node -v`)
- **Constraint:** do not let Vercel auto-detect the runtime from a Node 22 shell — build locally under Node 20 or rely on the explicit `runtime: 'nodejs20.x'` adapter config.

**Package Manager:**
- `package.json` declares `packageManager: "yarn@1.22.22..."` (Yarn Classic)
- However `package-lock.json` is present (487KB) — indicates npm has also been used to install. Lockfile state is inconsistent (both yarn and npm lockfiles referenced/present); treat with caution. `README.md` local-dev instructions use `npm install` / `npm run dev`.
- Lockfile: present (`package-lock.json`); no `yarn.lock` found in listing.

## Frameworks

**Core:**
- Astro 4.16 (installed 4.16.19) - meta-framework, SSR web app. `output: 'server'` is REQUIRED per `astro.config.mjs` comment — cookies (Clerk `__session`) only work under SSR, never on a static build.
- `@astrojs/vercel` 7.8 (installed 7.8.2) - Vercel serverless adapter (`astro.config.mjs`)
- `@astrojs/tailwind` 5.1 (installed 5.1.5) - Tailwind integration for Astro
- `@clerk/astro` 2.2+ (installed 2.17.14) - Clerk auth integration for Astro (middleware + `<SignIn />` component)

**Testing:**
- Not detected — no test runner, test config, or test files found in the repository.

**Build/Dev:**
- `@astrojs/check` 0.9 - `astro check` script (type/diagnostic checking, run via `npm run check`)
- `vercel` CLI 56.2 (installed 56.2.1) - devDependency, used for `vercel deploy --prebuilt --prod` per `go-redirect-SPEC.md`
- TypeScript 5.6+ (installed 5.9.3) - `tsconfig.json` extends `astro/tsconfigs/strict`

## Key Dependencies

**Critical:**
- `@clerk/astro` (^2.2.0) - authentication; provides `clerkMiddleware()` (`src/middleware.ts`) and `Astro.locals.auth()` used across every page (`src/pages/index.astro`, `src/pages/bridge.astro`, `src/pages/l/[code].astro`)
- `@sanity/client` (^6.21.0) - headless CMS client for fetching `shortLink` documents (`src/lib/sanity.ts`)
- `astro` (^4.16.0) - core web framework, SSR routing/rendering

**Infrastructure:**
- `@astrojs/vercel` (^7.8.0) - Vercel serverless adapter, pinned to `nodejs20.x` runtime
- `tailwindcss` (^3.4.0) - utility CSS, used inline in all `.astro` templates

## Configuration

**Environment:**
- Env vars loaded via Astro's `import.meta.env` (Vite-style) and Clerk's own env conventions (`PUBLIC_*` prefix = exposed to client, no prefix = server-only)
- `.env.example` lists required keys (values not read/quoted here — existence only): `PUBLIC_SANITY_PROJECT_ID`, `PUBLIC_SANITY_DATASET`, `PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- `.env.local` present locally (real keys; gitignored) — additional keys present beyond `.env.example`: `PUBLIC_SANITY_ORGANISATION_ID`, `PUBLIC_SANITY_EDITOR_KEY` (not referenced in current source — likely for Sanity Studio/editor tooling not yet wired into this repo)
- Type-checked env shape declared in `src/env.d.ts` (`ImportMetaEnv` interface covers the 4 `.env.example` keys; does not include the two extra `.env.local`-only keys)
- `.gitignore` excludes `.env`, `.env.*`, explicitly allowing `.env.example`

**Build:**
- `astro.config.mjs` - main framework config: `output: 'server'`, Vercel adapter, `site` set to production domain, integrations (`tailwind()`, `clerk()`)
- `tsconfig.json` - extends `astro/tsconfigs/strict`; path alias `@/*` → `src/*`
- `tailwind.config.cjs` - content globs over `src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}`, no custom theme/plugins
- `.vercel/project.json` - links local repo to Vercel project `360-arclumen` (projectId `prj_DbEzimzON9nzF7Nmk7Nueta7k00V`)

## Platform Requirements

**Development:**
- Node.js (22.x per `engines`, but see runtime mismatch note above — prefer Node 20 for builds destined for Vercel deploy)
- `npm install` (per README) or `yarn` (per `packageManager` field) — pick one and be consistent to avoid lockfile drift
- `.env` file populated from `.env.example` (README: `cp .env.example .env`)

**Production:**
- Vercel serverless (Node 20.x runtime, framework preset: Astro)
- Custom domain: `360.arclumenpartners.com` (declared as `site` in `astro.config.mjs`)
- Requires Clerk Dashboard configuration: root domain `arclumenpartners.com`, subdomains `360` and `go` registered so `__session` cookie scope works (see `README.md` "Prereqs already done")

---

*Stack analysis: 2026-07-22*
