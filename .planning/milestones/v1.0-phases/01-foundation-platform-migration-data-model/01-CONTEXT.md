# Phase 1: Foundation — Platform Migration & Data Model - Context

**Gathered:** 2026-07-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Migrate the existing Astro/Clerk/Sanity short-link tool to Next.js (App Router) + Neon Postgres/Drizzle + `@clerk/nextjs`, deployed on the same Vercel project pinned to Node 22. Stand up a centralized staff-access check and the relational schema (Company, Persona, Signal, Company-Persona join/history table). No Company/Persona explorer UI ships in this phase — it's the platform + data foundation everything else builds on.

</domain>

<decisions>
## Implementation Decisions

### Seed Data
- **D-01:** User will provide the real seed dataset (actual target companies/personas), not fabricated placeholders.
- **D-02:** Target volume: small — roughly 5-15 companies (with their linked personas), enough to exercise search/filter meaningfully without needing virtualization.
- **D-03:** Data will be handed over **during** Phase 1 execution, after the schema/migration scripts exist — schema comes first, real data gets dropped in once there's a shape to load it into.
- **D-04:** Format: spreadsheet/CSV. Plan the seed-loading approach (script reading CSV → typed insert) around this, not a hand-typed TS fixture.

### Signal Taxonomy
- **D-05:** Each signal has a strength/confidence level — simple 3-tier (e.g. Low/Medium/High), not a numeric score. Supports badge visual weight now and a future scoring layer without overbuilding.
- **D-06:** Each signal has a free-text `note` field alongside its structured fields (type, source, strength, date) — carries the human context for why something was flagged (e.g. "CFO change announced via LinkedIn post, see link").
- **D-07:** Signal `type` is a fixed-but-extensible enum (Postgres enum or lookup table), seeded with the 4 known types (cost pressure, no mature GBS/SSC org, new CFO/GBS head, transformation program announcement). Adding a 5th type later is a small migration, not a schema redesign — not a free-form string.

### Staff-Access Check
- **D-08:** `requireStaffAccess()` centralizes the existing model exactly as-is: any signed-in Clerk user = staff. No email-domain restriction added in Phase 1. Matches PROJECT.md's explicit v1 "no roles" scope — the win here is centralizing the check into one function, not tightening who passes it. (Re-examine before milestone 2 per PROJECT.md/STATE.md blockers.)

### Old Short-Link Tool Retirement
- **D-09:** Delete the old tool's code as part of the migration — `src/pages/bridge.astro`, `src/pages/l/[code].astro`, `src/lib/sanity.ts`, and all Sanity dependencies/env vars. Clean cutover, no dead Astro code carried into the new Next.js app.
- **D-10:** The external `go.arclumenpartners.com` redirector (separate repo) has already been repointed away from this app — it is not sending traffic here anymore. No compatibility/fallback behavior needs to be built for it in this phase.

### Claude's Discretion
- Exact CSV column layout for seed data — propose a schema-aligned template when the user is ready to fill it in during execution.
- Package manager cleanup (npm vs yarn) — `research/STACK.md` and this repo's README already point at npm; standardize on npm and remove the stale `packageManager: yarn` field during the migration.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Stack & migration decisions
- `.planning/research/STACK.md` — full recommended stack (Next.js 16 App Router, Neon+Drizzle, `@clerk/nextjs`, shadcn/ui+TanStack+nuqs), version table, installation commands, and explicit "what NOT to use" (no Sanity, no Astro islands, no `@astrojs/vercel` adapter)
- `.planning/research/SUMMARY.md` — executive summary, critical pitfalls (esp. #1-4: typed signals, many-to-many Company-Persona with history, enrichment-shaped seed fields, centralized auth), and Phase 1 rationale/deliverables
- `.planning/research/ARCHITECTURE.md` — master-detail/URL-state architecture patterns (written against Astro; needs Next.js re-mapping per SUMMARY.md's "Gaps to Address" — Server Components + one Client Component + `nuqs`, not Astro islands)
- `.planning/research/PITFALLS.md` — full pitfalls detail behind SUMMARY.md's critical-pitfalls list

### Existing codebase (what's being migrated/retired)
- `.planning/codebase/STACK.md` — current Astro/Clerk/Sanity dependency versions and config
- `.planning/codebase/ARCHITECTURE.md` — current system diagram, component responsibilities, and the `go.` redirector integration contract (now moot per D-10, but documents why `bridge.astro` exists)
- `.planning/codebase/INTEGRATIONS.md` — current Clerk/Sanity env vars and auth wiring to be swapped
- `.planning/codebase/CONCERNS.md` — flags the "any authenticated user = staff" pattern (addressed by D-08) and stale README describing a superseded cookie architecture

### Project-level
- `.planning/PROJECT.md` — Core Value, v1 scope/out-of-scope, constraints (tech stack migration, Clerk reuse, same Vercel project/Node 22)
- `.planning/REQUIREMENTS.md` — FOUND-01 through FOUND-04, DATA-02, DATA-03 (this phase's mapped requirements)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None of the current Astro components carry forward directly (thin 4-page app, no shared component library, no client-side framework usage) — this is a clean-slate frontend rebuild per D-09.
- Clerk **configuration** (not code) carries forward: same Clerk project/dashboard, same publishable/secret key pair, same domain/subdomain cookie scoping for `arclumenpartners.com`.

### Established Patterns
- Current error-handling pattern (fail-safe, silent fallback — `try/catch` swallowing errors toward a safe default) is being retired along with the code it lives in; Phase 1 should establish a deliberate error-handling convention for the new stack rather than carrying this one forward implicitly.
- Current codebase has zero runtime validation (no zod) — `research/STACK.md` recommends adding zod at the new data layer boundary; worth establishing in Phase 1 since Signal/Company/Persona schemas are defined here.

### Integration Points
- `src/middleware.ts` (Clerk middleware wiring) is the direct analog to Next.js 16's `proxy.ts` (renamed from `middleware.ts`, old name still works) — `clerkMiddleware()` call carries over conceptually, just re-homed.
- `.vercel/project.json` already links this repo to the Vercel project `360-arclumen` — no new Vercel project needed, just a framework-preset change on redeploy.

</code_context>

<specifics>
## Specific Ideas

No specific UI/behavior references for this phase (no UI ships in Phase 1). Data-model specifics are captured in Decisions above (D-05 through D-07 for Signal shape).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Email-domain access restriction was raised and explicitly declined for Phase 1 — see D-08 — not deferred as a future item, just not needed given the no-roles v1 scope; revisit only if PROJECT.md's milestone-2 access re-examination note is acted on.)

</deferred>

---

*Phase: 1-Foundation — Platform Migration & Data Model*
*Context gathered: 2026-07-22*
