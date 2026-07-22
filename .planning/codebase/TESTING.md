# Testing Patterns

**Analysis Date:** 2026-07-22

## Test Framework

**Runner:**
- None configured. There is no Jest, Vitest, Mocha, or Playwright dependency in `package.json`. No `jest.config.*`, `vitest.config.*`, or `playwright.config.*` file exists anywhere in the repository.
- No `*.test.*` or `*.spec.*` files exist under `src/`.

**Assertion Library:**
- Not applicable — no test framework installed.

**Run Commands:**
```bash
npm run dev       # astro dev — local dev server, manual verification only
npm run build     # astro build — production build
npm run preview   # astro preview — preview built output
npm run check     # astro check — TypeScript/Astro diagnostics (closest thing to automated verification)
```
There is no `npm test` script defined in `package.json`.

## Current Verification Approach

The project currently relies entirely on:
1. **`astro check`** (`package.json` script `check`, uses `@astrojs/check` + `typescript` devDependencies) — catches TypeScript type errors and Astro template errors, but does not execute any runtime logic or assertions.
2. **Manual/manual-QA verification**, documented explicitly in `README.md`:
   - "Verify the cookie scope (do this once)" section (`README.md:40-45`) describes a manual DevTools-based check: sign in, open Application → Cookies, confirm the `__session` cookie's Domain attribute shows the leading-dot root domain.
   - Local dev flow (`README.md:47-52`): `cp .env.example .env`, `npm install`, `npm run dev`, then manual browser testing.
3. **TypeScript strict mode** (`tsconfig.json` extends `astro/tsconfigs/strict`) as a static safety net in place of unit tests.

## Test File Organization

Not applicable — no tests exist.

## Test Structure

Not applicable — no test suites exist.

## Mocking

Not applicable — no mocking framework or patterns exist. The two external dependencies that would need mocks in a real test suite are:
- `sanity.fetch(...)` calls in `src/pages/l/[code].astro:14-17` and `src/pages/bridge.astro:23-26` (network call to Sanity CMS via `@sanity/client`)
- `Astro.locals.auth()` from Clerk middleware (`src/middleware.ts`), consumed in `src/pages/index.astro:3`, `src/pages/bridge.astro:13`, `src/pages/l/[code].astro:6`

## Fixtures and Factories

Not applicable — no test data fixtures exist. The only "fixture-like" data shape is the `ShortLinkRecord` interface (`src/lib/sanity.ts:11-16`), which documents the expected Sanity document shape (`_id`, `title`, `targetUrl`, optional `contactName`) and would be the basis for any future mock/fixture data.

## Coverage

**Requirements:** None enforced — no coverage tool configured (no `c8`, `nyc`, or Vitest/Jest coverage config).

## Test Types

**Unit Tests:** Not present. If introduced, prime candidates given the codebase's logic-in-frontmatter style:
- The auth-guard branching logic in `src/pages/l/[code].astro` and `src/pages/bridge.astro` (redirect-if-no-session, redirect-if-staff-else-resolve-target) is currently inline in Astro frontmatter, which is difficult to unit test directly. Extracting the branching decision (e.g., "given `userId` and a resolved record, what is the redirect target?") into a plain exported function in `src/lib/` would make it testable with a standard runner (Vitest is the natural fit for an Astro/Vite-based project).

**Integration Tests:** Not present. The Sanity fetch + redirect flow (`bridge.astro`, `[code].astro`) and the Clerk middleware wiring (`middleware.ts`) are integration points with no automated coverage — currently validated only by the manual cookie-scope check in `README.md`.

**E2E Tests:** Not used. No Playwright/Cypress config or dependency.

## Recommendations for Introducing Tests

Given the codebase has zero test infrastructure today, if a testing phase is planned:
1. **Add Vitest** (`vitest` + `@vitest/coverage-v8` or similar) — pairs naturally with Astro's Vite-based tooling and needs no additional config for TypeScript.
2. **Extract logic from `.astro` frontmatter into `src/lib/` functions** first (e.g., a `resolveDestination(userId, record): string` helper) so unit tests don't require an Astro test harness (`@astrojs/testing` / container API) for basic branching logic.
3. **Mock `@sanity/client`'s `fetch`** at the module boundary (`src/lib/sanity.ts`) rather than hitting the real Sanity API in tests.
4. **Mock `Astro.locals.auth()`** by testing extracted decision functions with a plain `{ userId: string | null }` shape rather than the full Clerk locals object.
5. Keep the manual cookie-scope verification step in `README.md` as a deployment checklist item — it is an environment/DNS-level check that automated tests cannot cover.

---

*Testing analysis: 2026-07-22*
