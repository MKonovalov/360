# Codebase Structure

**Analysis Date:** 2026-07-22

## Directory Layout

```
360-arclumen/
├── src/
│   ├── env.d.ts            # Ambient TS types for import.meta.env + Astro/Clerk env refs
│   ├── middleware.ts        # Clerk auth middleware, wired to every SSR request
│   ├── lib/
│   │   └── sanity.ts        # Shared Sanity client + ShortLinkRecord type
│   └── pages/                # File-based routing (Astro convention)
│       ├── index.astro       # `/` — landing/status page
│       ├── bridge.astro      # `/bridge` — staff/visitor routing brain
│       ├── sign-in.astro     # `/sign-in` — Clerk hosted sign-in widget
│       └── l/
│           └── [code].astro  # `/l/:code` — authenticated staff short-link viewer
├── .vercel/                   # Generated Vercel build output (not source; see below)
├── astro.config.mjs           # Astro config: SSR output, Vercel adapter, integrations
├── tailwind.config.cjs        # Tailwind content globs (src/**/*.{astro,html,...})
├── tsconfig.json              # Extends astro/tsconfigs/strict; `@/*` → `src/*` alias
├── package.json                # Scripts: dev/build/preview/check; yarn packageManager
├── .env.example                # Documents required env vars (no real secrets)
├── go-redirect-SPEC.md         # Authoritative spec for the cross-service (go./360.) design
└── README.md                   # Project overview (partially superseded by SPEC — see ARCHITECTURE.md)
```

## Directory Purposes

**`src/pages/`:**
- Purpose: Astro's file-based router — one file per route, frontmatter is the server handler, markup below is the response body
- Contains: `.astro` files only; nested directories map to nested URL segments (`l/[code].astro` → `/l/:code`)
- Key files: `bridge.astro` (core logic), `l/[code].astro` (staff viewer)

**`src/lib/`:**
- Purpose: Non-route, non-component shared code — currently just external client construction
- Contains: `sanity.ts` (the only file here)
- Key files: `sanity.ts`

**`.vercel/`:**
- Purpose: Vercel CLI's local build/output cache (created by `vercel build` / `vercel dev`)
- Generated: Yes, fully
- Committed: Present in working tree at time of analysis, but this is standard Vercel tooling output, not application source — treat as disposable

## Key File Locations

**Entry Points:**
- `src/pages/index.astro`: site root
- `src/pages/bridge.astro`: the actual product entry point (hit via redirect from the external `go.` service)
- `src/middleware.ts`: request-level entry point, runs before every page

**Configuration:**
- `astro.config.mjs`: SSR mode, Vercel serverless adapter (Node 20.x runtime pin), Tailwind + Clerk integrations, `site` URL
- `tsconfig.json`: strict TS, `@/*` path alias to `src/*` (not currently used by any import — all imports use relative paths like `../lib/sanity`)
- `tailwind.config.cjs`: content scanning globs only, no custom theme
- `.env.example`: documents `PUBLIC_SANITY_PROJECT_ID`, `PUBLIC_SANITY_DATASET`, `PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`

**Core Logic:**
- `src/pages/bridge.astro`: staff-vs-visitor routing decision (the entire product logic)
- `src/lib/sanity.ts`: Sanity client + `ShortLinkRecord` shape

**Testing:**
- None present. No test files, test runner config, or CI test workflow found in the repository.

## Naming Conventions

**Files:**
- Astro pages: lowercase, kebab-case where multi-word (`sign-in.astro`), or Astro's bracket syntax for dynamic segments (`[code].astro`)
- Lib modules: lowercase, single-word where possible (`sanity.ts`)
- Config files: tool-standard names at repo root (`astro.config.mjs`, `tailwind.config.cjs`, `tsconfig.json`)

**Directories:**
- `src/pages/<segment>/` mirrors the URL path exactly (Astro convention) — e.g., `src/pages/l/[code].astro` serves `/l/:code`
- `src/lib/` for shared, non-route code (currently only one file, but the convention is established)

## Where to Add New Code

**New Route/Page:**
- Add a new `.astro` file under `src/pages/`; the file path becomes the URL path automatically (no manual router registration)
- Follow the existing pattern: `export const prerender = false` at the top of frontmatter if the route needs auth/dynamic data (all current routes do this)

**New External Service Client (e.g., another CMS or API):**
- Add a new file to `src/lib/` (mirror `sanity.ts`'s pattern: one exported client instance + any TypeScript interfaces for the data shapes it returns)

**Shared UI (if the app grows beyond simple pages):**
- No `src/components/` directory exists yet. If reusable markup emerges (currently each `.astro` page duplicates its own `<html>`/`<head>`/card shell), introduce `src/components/` and a `src/layouts/` for a shared `<html>` shell — none of this exists today, so this is new structure, not an existing convention to follow.

**Environment Variables:**
- Add new vars to `.env.example` (documentation only, no real values) and to `src/env.d.ts`'s `ImportMetaEnv` interface for type safety

## Special Directories

**`.vercel/`:**
- Purpose: Local Vercel build cache/output (config, serverless function bundles, static assets)
- Generated: Yes
- Committed: Present in the working tree, but should typically be gitignored — verify against `.gitignore` before adding new files here manually

**`.astro/` (referenced but not present at analysis time):**
- Purpose: Astro's generated type declarations (`.astro/types.d.ts`, referenced by `src/env.d.ts:1` and `tsconfig.json:10`)
- Generated: Yes, by `astro dev`/`astro build`/`astro check`
- Committed: No (not present in the repo listing; regenerated on demand)

---

*Structure analysis: 2026-07-22*
