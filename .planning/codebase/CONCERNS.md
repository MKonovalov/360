# Codebase Concerns

**Analysis Date:** 2026-07-22

## Tech Debt

**Stale README describing an abandoned (and impossible) architecture:**
- Issue: `README.md` still documents the *original* design where the `go.` subdomain itself reads and verifies Clerk's `__session` cookie via `verifyToken`, and where the Clerk Dashboard is configured to issue the cookie on the root domain (`.arclumenpartners.com`) so `go.` can read it. This was proven impossible — Clerk's `__session` cookie is host-only and cannot be scoped to a parent domain (see `go-redirect-SPEC.md`, "Why this revision"). The actual, shipped architecture (commit `ddd018d5`) instead has `go.` blindly 302 to `360./bridge?code=...`, and `bridge.astro` performs staff detection because it runs on the same origin as the cookie.
- Files: `README.md` (entire "Detection" and "Prereqs already done" sections, lines 12-44), vs. `go-redirect-SPEC.md` (correct/current design), `src/pages/bridge.astro` (actual implementation).
- Impact: Anyone onboarding from `README.md` alone will implement the wrong thing in the sibling `go.` repo, waste time trying to configure a root-domain cookie in Clerk that doesn't support it, or misunderstand why `/l/[code]` on `360.` is staff-only while `/bridge` is public.
- Fix approach: Rewrite `README.md`'s architecture section to match `go-redirect-SPEC.md` (thin `go.` redirector → `bridge.astro` decides staff vs. visitor → Sanity lookup). Keep `go-redirect-SPEC.md` as the historical rationale, but make `README.md` the single source of truth for current behavior.

**Mixed/ambiguous package manager tooling:**
- Issue: `package.json` declares `"packageManager": "yarn@1.22.22..."`, but `package-lock.json` (npm) is committed at the repo root and `README.md` instructs `npm install`. No `yarn.lock` exists.
- Files: `package.json` (line 29), `package-lock.json`, `README.md` (line 51).
- Impact: Corepack-aware tooling (or contributors following the `packageManager` field) may invoke yarn, produce a `yarn.lock`, and diverge from the committed `package-lock.json`, causing dependency drift between local/dev and CI/Vercel builds.
- Fix approach: Pick one package manager and align all three signals (`packageManager` field, lockfile, README instructions). Given Vercel/npm is what's actually used to deploy, standardize on npm and remove the `packageManager` field or set it to the npm equivalent.

**Manual, error-prone Node-version-pinned deploy process:**
- Issue: Local dev uses Node 22 (per `nvm`/shell default), but the Vercel Node runtime must be `nodejs20.x` — the Astro Vercel adapter, when built under Node 22, emits a `nodejs18.x` runtime that Vercel rejects. The documented workaround (`go-redirect-SPEC.md`, "Node runtime" section) is to manually `nvm use 20` before every build and deploy with `vercel deploy --prebuilt --prod`, rather than relying on Vercel's own build step.
- Files: `astro.config.mjs` (line 10, `adapter: vercel({ runtime: 'nodejs20.x' })`), `package.json` (line 7, `"engines": { "node": "22.x" }` — contradicts the actual required build runtime), `go-redirect-SPEC.md` (lines 64-68).
- Impact: This already caused one broken deploy (see commit `4e8b9a04`, "Fix Vercel serverless runtime: pin Node 20"). Any contributor who runs a normal `vercel --prod` or lets Vercel's own build step run under its detected Node version risks reintroducing the same failure. There is no CI check enforcing the correct build Node version.
- Fix approach: Either set Vercel's Project Settings → Node.js Version to 20.x so Vercel's own build (not just local prebuilt) is consistent, or add a `.nvmrc` (currently absent) plus a preinstall/prebuild guard that fails fast if `process.version` doesn't match. Align `package.json` `engines.node` to `20.x` to remove the contradiction with the adapter's pinned runtime.

**Non-null assertions on data fetched from an external CMS:**
- Issue: `src/pages/l/[code].astro` uses non-null assertions (`record!.title`, `record!.contactName`, `record!.targetUrl`) immediately after only checking `if (!record) notFound = true`. If Sanity ever returns a `shortLink` document missing `title` or `targetUrl` (e.g., an incomplete draft or schema change), this renders `undefined` into the page or breaks the "Open destination" link silently instead of failing loudly.
- Files: `src/pages/l/[code].astro` (lines 11-21, 40-48).
- Impact: Low blast radius (internal staff-only page) but a mis-authored Sanity document produces a broken/misleading link with no error surfaced.
- Fix approach: Validate required fields (`targetUrl` at minimum) after the null check and fall back to the `notFound` branch (or a distinct "incomplete record" state) if `targetUrl` is missing.

## Known Bugs

No reproducible bugs identified in current source. The one previously-fixed defect (root-domain cookie assumption) is resolved in code but not yet reflected in `README.md` (see Tech Debt above).

## Security Considerations

**Authorization is "any authenticated Clerk user," not role-based:**
- Risk: `src/pages/l/[code].astro` and the staff branch of `src/pages/bridge.astro` treat the mere presence of `Astro.locals.auth().userId` as sufficient to be treated as "staff" and view internal short-link metadata / destination URLs. There is no check against a role, organization membership, or allow-list.
- Files: `src/pages/l/[code].astro` (line 6-7), `src/pages/bridge.astro` (lines 13-18).
- Current mitigation: Presumably all accounts provisioned in this Clerk instance are trusted staff, so this is by design for now — but nothing in code enforces or documents that assumption.
- Recommendations: If the Clerk instance is ever opened to non-staff sign-ups (e.g., self-service, partner logins), add an explicit role/claim check before granting the staff view. Document the "every Clerk user = staff" assumption explicitly in code comments so future changes don't silently widen access.

**Errors are swallowed with bare `catch {}`, hiding operational failures:**
- Risk: Both `src/pages/l/[code].astro` (lines 13-21) and `src/pages/bridge.astro` (lines 22-30) wrap Sanity calls in `try { ... } catch { ... }` with no logging of the caught error. A misconfigured `PUBLIC_SANITY_PROJECT_ID`/`PUBLIC_SANITY_DATASET`, a Sanity outage, or a malformed GROQ result all collapse into the same generic "not found" (staff view) or redirect-to-`/` (visitor) behavior.
- Files: `src/pages/l/[code].astro`, `src/pages/bridge.astro`, `src/lib/sanity.ts`.
- Current mitigation: None — no error tracking/logging integration exists anywhere in the codebase (confirmed via search for logging frameworks: none found).
- Recommendations: At minimum, log the caught error (e.g., `console.error`) so Vercel's function logs capture the failure reason instead of only the generic user-facing fallback. Consider a lightweight error-tracking integration (Sentry or similar) given this service is on the critical path for every HubSpot-generated short link.

**Sanity client created with the public dataset/project ID and `useCdn: false`, no server/client separation:**
- Risk: `src/lib/sanity.ts` reads `PUBLIC_SANITY_PROJECT_ID`/`PUBLIC_SANITY_DATASET` (intentionally public — comment says "safe on the client too if ever needed") but the client is also used server-side for the `shortLink` lookups that return `targetUrl`. There's no Sanity API token/auth, meaning the `shortLink` dataset must be publicly readable (or ACL'd separately) for the visitor-path lookup in `bridge.astro` to work without staff auth.
- Files: `src/lib/sanity.ts` (lines 4-9), `src/pages/bridge.astro` (lines 22-30, unauthenticated visitor path queries Sanity directly).
- Current mitigation: Not verified in code — depends on Sanity dataset ACL configuration, which lives outside this repo.
- Recommendations: Confirm the Sanity dataset's visibility settings are intentionally "public read" (or that a scoped token is added) and document that assumption in `src/lib/sanity.ts`, since a private dataset would silently break the anonymous-visitor redirect path (falling into the swallowed-error fallback above, redirecting visitors to `/` instead of their real destination).

## Performance Bottlenecks

No significant bottlenecks identified. The app is a thin, low-traffic SSR redirector with a single Sanity query per request (`useCdn: false`, so every lookup bypasses Sanity's CDN and hits the live API — acceptable at this traffic scale but worth flipping to `useCdn: true` if request volume grows, since `shortLink` content changes infrequently).

## Fragile Areas

**Deploy pipeline (Node version mismatch):**
- Files: `astro.config.mjs`, `package.json`, `go-redirect-SPEC.md`.
- Why fragile: Correct production deploys depend on a manual step (building under Node 20 locally, then `vercel deploy --prebuilt`) that isn't enforced by any tooling in this repo. A contributor unaware of the spec's "Node runtime" note can easily regress into the `nodejs18.x` rejection already hit once.
- Safe modification: Any change to `astro.config.mjs`'s adapter config or `package.json` engines should be cross-checked against `go-redirect-SPEC.md`'s Node runtime section before deploying.
- Test coverage: None — no CI workflow (`.github/workflows` absent) validates a from-scratch build/deploy under the pinned Node version.

**Two-service, two-repo redirect flow (`go.` + `360.`):**
- Files: `src/pages/bridge.astro`, `go-redirect-SPEC.md`.
- Why fragile: The full user-facing flow spans this repo (`360.`) and a separate sibling repo (`go.`, not present here) that is out of this codebase's direct control. Changes to the `/bridge` route's query param contract (`?code=`) or redirect targets must stay in sync with the external `go.` repo's hardcoded `TARGET_BASE` and route shape. There's no shared contract/schema/integration test between the two repos.
- Safe modification: Treat `bridge.astro`'s `code` query param and redirect semantics as a public API contract; any change requires coordinating a matching change in the `go.` repo per `go-redirect-SPEC.md`'s verification checklist.
- Test coverage: None. The spec's "Verification checklist" (lines 70-76) is a manual QA checklist, not automated.

## Scaling Limits

Not applicable at current scope — this is a low-traffic internal redirector (single Sanity query per request, no batching/pagination concerns, no database beyond Sanity's own hosted infrastructure).

## Dependencies at Risk

**No dependency version pinning beyond caret ranges:**
- Risk: All dependencies in `package.json` use caret ranges (`^4.16.0`, `^2.2.0`, etc.) with a committed `package-lock.json` for reproducibility, but no automated dependency update/audit process (no Dependabot/Renovate config, no CI) exists to catch breaking changes or security advisories in `@clerk/astro`, `@astrojs/vercel`, or `@sanity/client`.
- Impact: Silent drift between what's locally installed and what a fresh `npm install` on a new machine resolves to, especially for the pre-1.0-adjacent `@astrojs/vercel` (`^7.8.0`) and `@clerk/astro` (`^2.2.0`) packages, which change frequently.
- Migration plan: Add a lightweight automated dependency-update tool (Dependabot config or `npm outdated` in CI) even without full CI/CD, to surface upgrade risk before it becomes a production incident.

## Missing Critical Features

**No automated build/lint/type-check gate before deploy:**
- Problem: `package.json` defines `astro check` (line 13) but nothing runs it automatically — no CI workflow, no pre-commit hook, no Vercel build-time invocation confirmed. Given the deploy process already bypasses Vercel's own build step (`vercel deploy --prebuilt`), there is no automated gate at all between a local edit and production.
- Blocks: Catching TypeScript errors, Astro template errors, or accidental regressions (e.g., reintroducing the root-cookie assumption) before they reach `360.arclumenpartners.com`.

## Test Coverage Gaps

**Zero automated tests exist in this repository:**
- What's not tested: All application logic — Clerk auth gating (`src/pages/l/[code].astro`, `src/pages/bridge.astro`), Sanity query/record shape assumptions (`src/lib/sanity.ts`), and the staff-vs-visitor branching that is the entire purpose of this service.
- Files: No `*.test.*`/`*.spec.*` files found anywhere in `src/`; no test runner (Jest/Vitest/Playwright) listed in `package.json` dependencies.
- Risk: Any regression in the staff/visitor redirect logic (the core business function — misrouting a real customer to the wrong destination, or leaking an internal viewer URL to an anonymous visitor) would only be caught by manual QA or a live incident. The go-redirect-SPEC.md verification checklist (lines 70-76) is the only existing "test," and it is manual.
- Priority: High — this service sits on the critical path for every HubSpot-generated short link; a routing regression is directly customer-visible.

---

*Concerns audit: 2026-07-22*
