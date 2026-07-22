# Coding Conventions

**Analysis Date:** 2026-07-22

## Codebase Size Note

This is a very small Astro SSR project (4 pages, 1 lib module, 1 middleware file — no `src/components/`, no `src/layouts/`). Conventions below are inferred from the small existing surface (`src/pages/*.astro`, `src/lib/sanity.ts`, `src/middleware.ts`) and should be treated as the established baseline to extend consistently, not a large sample.

## Naming Patterns

**Files:**
- Astro pages use kebab-case or plain lowercase: `src/pages/index.astro`, `src/pages/bridge.astro`, `src/pages/sign-in.astro`
- Dynamic route segments use bracket syntax matching Astro's file-based routing: `src/pages/l/[code].astro`
- Library/utility modules use lowercase, no suffix: `src/lib/sanity.ts` (not `sanity.util.ts` or `sanityClient.ts`)
- Framework-reserved files keep exact required names: `src/middleware.ts`, `src/env.d.ts`

**Functions:**
- No standalone exported functions yet in the codebase; all logic lives inline in Astro frontmatter (the `---` script block) or as client instantiation (`createClient(...)`).
- When adding functions, follow camelCase per existing variable naming (`sanity`, `record`, `notFound`).

**Variables:**
- camelCase throughout: `targetUrl`, `contactName`, `userId`, `notFound`, `record`.
- Booleans read as a predicate/state flag, no `is`/`has` prefix convention established yet — `notFound` is the only example. Prefer `is`/`has` prefixes for new boolean variables for clarity (e.g. `isStaff` as documented in `README.md`'s example `go.` service snippet) since that pattern already appears in project documentation.

**Types:**
- PascalCase interfaces, suffixed with the domain noun + `Record` for Sanity document shapes: `ShortLinkRecord` in `src/lib/sanity.ts:11`.
- `interface` (not `type`) is used for object shapes in `.ts` files. Follow `interface` for document/record shapes, reserve `type` for unions/aliases if introduced later.

## Code Style

**Formatting:**
- No `.prettierrc` or Prettier config file exists in the repo. No `.eslintrc*` / `eslint.config.*` exists either — there is no automated formatting or linting enforced.
- Observed style (manually consistent across all files): single quotes for strings (`'../../lib/sanity'`), semicolons terminate every statement, 2-space indentation.
- `astro check` (via `npm run check` / `package.json` script) is the only static check configured — it runs Astro's TypeScript diagnostics (`@astrojs/check` + `typescript` devDependencies), not a linter.

**Linting:**
- Not configured. There is no ESLint or Biome setup. When adding one, `tsconfig.json` already extends `astro/tsconfigs/strict`, so keep new lint config aligned with strict TypeScript (no implicit any, etc.).

**TypeScript strictness:**
- `tsconfig.json` extends `astro/tsconfigs/strict` (`tsconfig.json:2`) — strict mode is active project-wide.
- Path alias `@/*` maps to `src/*` (`tsconfig.json:6-8`) but is not yet used anywhere in source — all current imports use relative paths (`../../lib/sanity`, `../lib/sanity`). Prefer relative imports for consistency with existing pages unless refactoring to adopt `@/*` broadly.

## Import Organization

**Order (as observed in `.astro` frontmatter):**
1. Astro/framework-level config export first if present (`export const prerender = false;`) — this appears as the very first line of frontmatter in every page (`src/pages/index.astro:2`, `src/pages/bridge.astro:9`, `src/pages/l/[code].astro:2`, `src/pages/sign-in.astro:2`), even before imports in some files and after a comment block in others.
2. Third-party/framework imports (`@clerk/astro/components`, `@clerk/astro/server`)
3. Local/relative imports (`../lib/sanity`, `../../lib/sanity`)

**Path Aliases:**
- `@/*` → `src/*` is configured in `tsconfig.json` but unused. New code may adopt it, but match existing files' relative-import style if editing them for consistency.

**Convention for `prerender`:**
- Every SSR page that touches Clerk auth or Sanity data explicitly sets `export const prerender = false;` at the top of the frontmatter. This is required because Astro's default output for individual routes can be prerendered unless explicitly opted out — always add this line to any new dynamic/auth-gated page.

## Error Handling

**Patterns:**
- Network/data-fetch calls to Sanity are wrapped in `try { ... } catch { ... }` with the catch block deliberately empty or setting a fallback flag — errors are swallowed silently, not logged or re-thrown:
  ```ts
  // src/pages/l/[code].astro:13-21
  try {
    record = await sanity.fetch(...);
    if (!record) notFound = true;
  } catch {
    notFound = true;
  }
  ```
  ```ts
  // src/pages/bridge.astro:22-30
  try {
    const rec = await sanity.fetch(...);
    if (rec?.targetUrl) return Astro.redirect(rec.targetUrl);
  } catch {
    // fall through to safe fallback
  }
  ```
- Auth is checked with early-return guard clauses, not exceptions: `const { userId } = Astro.locals.auth(); if (!userId) return Astro.redirect('/sign-in');` (`src/pages/l/[code].astro:6-7`).
- No custom error classes, no centralized error handler, no logging framework. Errors that occur during Sanity fetch degrade to a safe default (redirect to `/`, show "not found" UI) rather than surfacing a 500 or stack trace to the user.
- **Guidance for new code:** follow this "fail safe, fail silent, fail toward a known-good UI state" pattern for any external call (Sanity, Clerk). Do not introduce unhandled promise rejections or let Astro's default 500 page show for expected failure modes (missing record, unknown code).

## Logging

**Framework:** None. No `console.log`/`console.error` calls exist in `src/`. Errors are caught and handled via UI fallback state rather than logged.

**Guidance:** If logging is introduced (e.g., for the empty catch blocks in `bridge.astro` / `[code].astro`), keep it out of the anonymous-visitor path in `bridge.astro` — the codebase's explicit privacy design principle (see comments) is that anonymous visitors must not be tracked beyond existing behavior.

## Comments

**When to Comment:**
- Comments explain *why*, not *what* — every comment block in the codebase documents a non-obvious architectural or security decision, not a restatement of code. Examples:
  - `src/middleware.ts:3-5` — explains Clerk requires this file to populate `Astro.locals.auth()`.
  - `src/pages/bridge.astro:2-8` — explains the cross-subdomain cookie constraint driving the whole file's design.
  - `astro.config.mjs:6-7` — explains why `output: 'server'` is required (cookies need SSR).
  - `src/lib/sanity.ts:3` — explains why `PUBLIC_` env vars are used (safe on client).
- Inline one-line comments mark subtle branches: `// NOTE: never set a cookie here -> visitors stay anonymous` (in `README.md`'s embedded snippet).
- **Guidance for new code:** when a security/privacy/architecture decision is non-obvious from the code alone, add a comment explaining the reasoning, matching the density and tone already established (concise, 1-4 lines, placed directly above the relevant code).

**JSDoc/TSDoc:**
- Not used anywhere in the codebase. Do not introduce JSDoc blocks unless establishing a new project-wide convention.

## Function Design

**Size:** No standalone functions exist yet; all logic is inline in Astro frontmatter blocks, each under ~30 lines. Keep new page frontmatter logic similarly short and linear (fetch → check → branch → render/redirect).

**Parameters:** `createClient({...})` in `src/lib/sanity.ts:4-9` uses an options-object parameter pattern (not positional args) — follow this for any new client/service constructors.

**Return Values:** Astro pages use early `return Astro.redirect(...)` for control flow inside frontmatter (`src/pages/l/[code].astro:7`, `src/pages/bridge.astro:17,27,33`) rather than nested if/else — prefer guard-clause early returns for new page logic.

## Module Design

**Exports:**
- `src/lib/sanity.ts` uses named exports (`export const sanity`, `export interface ShortLinkRecord`) — no default exports observed anywhere in the codebase. Follow named-export convention for all new modules.
- `src/middleware.ts` exports the single required `onRequest` named export per Astro's middleware contract.

**Barrel Files:** None exist (`src/lib/` has only one file). Do not introduce an `index.ts` barrel unless `src/lib/` grows to warrant it.

**Environment variables:**
- Declared and typed centrally in `src/env.d.ts` via the `ImportMetaEnv` interface (`src/env.d.ts:5-10`) — any new env var must be added here for type safety, matching the `readonly <NAME>: string` pattern.
- Client-safe vars are prefixed `PUBLIC_` (`PUBLIC_SANITY_PROJECT_ID`, `PUBLIC_SANITY_DATASET`, `PUBLIC_CLERK_PUBLISHABLE_KEY`); server-only secrets are not prefixed (`CLERK_SECRET_KEY`). Follow this prefix convention strictly — never expose a non-`PUBLIC_` var to client code.

---

*Convention analysis: 2026-07-22*
