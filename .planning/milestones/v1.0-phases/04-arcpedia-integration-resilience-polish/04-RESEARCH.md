# Phase 4: Arcpedia Integration & Resilience Polish - Research

**Researched:** 2026-07-24
**Domain:** External read-only API integration (Next.js Server Component → Arcpedia REST API) + resilience/error-state hardening across existing detail/list panes
**Confidence:** MEDIUM — the Arcpedia API contract itself is HIGH confidence (read directly from the arcpedia source repo), but a critical production-access finding (below) is unverified against live traffic and materially affects whether ARCP-01 can work at all without an infra change outside this repo.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Match articles by keyword search — call `GET /api/wiki/search?q=<name>` using the Company's name or Persona's name. No manual tagging convention (Arcpedia has none today for company/persona entities); do not build a tag-based or hybrid matching system for milestone 1.
- **D-02:** Do not filter or flag by `confidence`/`expiry`/`valid_from`. Show all matched articles as-is — no trust-scoring logic this phase.
- **D-03:** On the Persona 360 view, search by the persona's own name only — do NOT also search by their current company's name. Company and Persona 360 views each run one symmetric, single-entity-name query.
- **D-04 (Claude's discretion):** Fetch live per page load, no caching layer. Rationale: matches the existing codebase pattern exactly — every DB query in this app is already always-live with zero caching. Revisit only if research shows Arcpedia's search endpoint has real-world latency that hurts page load.
- **D-05:** Place the related-knowledge section as a new section at the bottom of the existing detail pane stack (after Contact Info on Persona, after Linked Personas on Company) — do not introduce a sidebar/second-column layout.
- **D-06:** Show title + snippet per article, not title-only. Research must confirm what `/api/wiki/search`'s response actually returns (title/slug/excerpt fields) before planning locks the exact fields rendered.
- **D-07:** Article links open in a new tab to Arcpedia (`target="_blank" rel="noopener noreferrer"`, `arcpedia.arclumen.de/wiki/<slug>`) — same external-link pattern already used for Persona LinkedIn links.
- **D-08:** Cap at 3 articles per 360 view (both Company and Persona).
- **D-09 (Claude's discretion):** Detail panes get the same inline-card try/catch error pattern already shipped in `company-list.tsx`/`persona-list.tsx` — for consistency, not a new `error.tsx` boundary pattern.
- **D-10 (Claude's discretion):** If the Arcpedia section itself fails to load (API down/timeout/non-2xx), the rest of the 360 view must render normally regardless of whether the failure is shown silently or with a small inline note. Treat this as its own try/catch, separate from the DB-fetch try/catch.
- **D-11 (Claude's discretion):** Whether the Arcpedia section gets its own Suspense/streaming boundary vs. the existing route-level `loading.tsx` is Claude's call — check Arcpedia's actual response latency during research before introducing Suspense/streaming.
- **D-12:** When Arcpedia returns zero matching articles (not an error — a genuine empty result), hide the section entirely. Do not render an empty "No related articles found" box.

**UI-SPEC resolutions (already locked, approved):**
- D-10 resolved: **silent** — section renders nothing on Arcpedia failure, identical treatment to zero-match (D-12). Rest of page renders normally (hard requirement).
- D-11 resolved: **no new Suspense boundary** — Arcpedia `fetch()` runs inside the same `async` Server Component as the rest of the detail pane, covered by the existing route-level `loading.tsx`. This default is explicitly conditioned on "if research finds real-world latency that visibly delays the whole pane, revisit." **See Pitfall 1 below — this condition could not be tested this session** (Arcpedia's production endpoint is unreachable from an unauthenticated caller; see Critical Finding).
- Response shape confirmed (was previously inferred, now independently re-verified this session against `arcpedia/src/app/api/wiki/search/route.ts` and `arcpedia/src/lib/search.ts`): `{ results: Array<{ slug, title, summary, snippet, score, fuzzy? }> }`.

### Claude's Discretion
D-04, D-09, D-10, D-11 — user explicitly deferred to Claude's judgment, with a stated bias toward reusing existing codebase patterns over inventing new ones, unless research surfaces a concrete reason not to.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. Manual tag-based Arcpedia matching (D-01's rejected alternative) and confidence/staleness filtering (D-02's rejected alternative) are explicit non-decisions, not deferrals.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ARCP-01 | Company/Persona 360 views show related knowledge articles read from Arcpedia's public read API | API contract confirmed (Standard Stack, Code Examples). **Critical Finding below**: the production `arcpedia.arclumen.de` domain is gated by a Cloudflare Access application at the edge — a raw server-side `fetch()` without a provisioned Access Service Token will not reach the app's "public" route handler at all. This is a blocking infra dependency, not a code question. |
| ARCP-02 | ArcLumen 360 only reads from Arcpedia in milestone 1 — no writes/ingestion | Confirmed via `docs/API.md`: every mutating Arcpedia route (`POST`/`PUT`/`PATCH`/`DELETE`) requires a Clerk session or service token this app will never hold. `GET /api/wiki/search` is the only endpoint this phase should ever call — trivially satisfies "read only" by construction (Code Examples, Don't Hand-Roll). |
| EXPL-06 | Lists and detail panes handle empty, loading, and error states explicitly | Detail-pane try/catch pattern specified (Code Examples, Architecture Patterns), matching the already-shipped list-pane pattern. Loading state confirmed to already exist at route level (`loading.tsx`) and cover detail panes with no new work needed (Architecture Patterns, Pitfall 3). |
</phase_requirements>

## Summary

This phase is two independent, small pieces of work layered onto code that already exists: (1) a read-only `fetch()` call to Arcpedia's `/api/wiki/search` endpoint appended to the bottom of `CompanyDetail`/`PersonaDetail`, and (2) extending the exact try/catch error-card pattern already shipped in `company-list.tsx`/`persona-list.tsx` to the two detail-pane components, which currently have zero error handling. Both are narrow, mechanical changes — the *contract* for each (API response shape, error-card copy/styling, Suspense architecture) was already locked in `04-CONTEXT.md` and `04-UI-SPEC.md` before this research ran, and this session's job was to verify those decisions against the real systems involved, not to explore alternatives.

**The one open question that materially changes the picture:** the production Arcpedia deployment (`arcpedia.arclumen.de`) currently sits behind a **Cloudflare Zero Trust Access** application at the edge — confirmed directly by `curl`-ing `/`, `/api/status`, `/api/wiki`, and `/api/wiki/search` from this session's environment, all four returned `302` to a `mkonovalov.cloudflareaccess.com` interactive login page. This gate sits in front of arcpedia's own application-level auth (`docs/API.md`'s claim that `GET` routes are "always public") — it's enforced by Cloudflare's edge before any Next.js code in the arcpedia repo even runs. Independent corroboration: arcpedia's own `workers/task-consumer` (a trusted first-party caller) sends `CF-Access-Client-Id`/`CF-Access-Client-Secret` headers on every request specifically to "satisfy Cloudflare Access on a protected custom domain so this worker-to-worker call skips the browser login" (`workers/task-consumer/index.ts:57-65`) — i.e., even arcpedia's own infrastructure needs an Access Service Token to call its own "public" API. A plain server-side `fetch()` from ArcLumen 360, with no such token, will silently receive an HTML login page in the response body (not JSON, not an HTTP error status worth branching on specifically — `fetch()` follows the redirect and lands on a `200` HTML page). This is caught for free by D-10's existing broad try/catch (`res.json()` throws a `SyntaxError` on HTML input), so the resilience behavior (section hidden, rest of page fine) is **already correct without any special-case code** — but it means ARCP-01 will functionally show zero articles in production until a Cloudflare Access Service Token is provisioned for ArcLumen 360 and threaded through as two new env vars + two new request headers. This is an infrastructure/access-provisioning gap, not an implementation gap, and should be called out explicitly to the user before the plan locks in "done" criteria for ARCP-01.

**Primary recommendation:** Build the integration exactly as `04-UI-SPEC.md` specifies (plain server-side `fetch()` inside the existing detail-pane Server Components, no caching, no Suspense, silent-fail-and-hide on any error or CF-Access-login response), add the two Access-token env vars as **optional** (not fail-fast-required) so the app still boots and gracefully degrades if the token isn't provisioned yet, and flag the Cloudflare Access provisioning step as a `checkpoint:human-verify` task the user must complete outside this codebase for ARCP-01 to actually surface articles in production.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Arcpedia article search (per entity name) | Backend Server (Next.js Server Component) | — | Server-side `fetch()` keeps the Cloudflare Access Service Token secret server-only; matches the existing "Server Components fetch directly" convention used for every DB query today |
| Arcpedia result rendering (title + snippet + link) | Backend Server (SSR) | Browser (link click navigation only) | Rendered server-side as static markup; the only client-side behavior is the browser following an `<a target="_blank">` link, no client JS needed |
| Detail-pane error handling (DB fetch failure) | Backend Server (SSR) | — | Same tier and pattern as the already-shipped list-pane try/catch; error card is rendered server-side, no client state |
| Detail-pane loading state | Backend Server (SSR, route-level Suspense) | — | `loading.tsx` is a Next.js route-level Suspense fallback; no new tier introduced |
| Cloudflare Access token exchange | External / Infra (Cloudflare Zero Trust) | Backend Server (sends headers) | The Access gate lives entirely at Cloudflare's edge, outside both this app's and arcpedia's own code — ArcLumen 360's only responsibility is sending the two headers if configured |

## Project Constraints (from CLAUDE.md)

- **Fail-safe, fail-silent, fail-toward-known-good-UI** is a hard, project-wide convention (not just a Phase 2/3 choice) — every external call (DB, and now Arcpedia) must degrade to known-good UI, never throw an unhandled 500. This directly matches D-09/D-10.
- Every dynamic/auth-gated page must set `export const prerender = false` — not applicable here since this app has already fully migrated to Next.js (this CLAUDE.md line is legacy from the pre-migration Astro app and can be disregarded for Phase 4; the actual runtime constraint that matters is Next.js's own dynamic-rendering rules, which the existing `page.tsx`/`loading.tsx` files already satisfy).
- Named exports only, no default exports for library modules (`src/lib/*.ts`) — any new `src/lib/arcpedia.ts` helper must use named exports, matching `src/lib/db/queries/*.ts`.
- camelCase variables/functions; PascalCase interfaces suffixed with the domain noun (e.g., `ArcpediaSearchResult`, mirroring `ShortLinkRecord`'s naming convention, though that file itself is legacy/pre-migration).
- Single quotes, semicolons, 2-space indentation (no repo-wide linter enforces this, but it's the sole observed style — match it).
- Comments explain *why*, not *what* — any non-obvious call (e.g., why the Access headers are conditionally attached, why `res.json()` failure is treated as "no results") should get a short comment, matching the existing density (1-4 lines).
- Env vars: client-safe vars prefixed `NEXT_PUBLIC_`, server-only secrets unprefixed. The Cloudflare Access Client ID/Secret are secrets — never prefix with `NEXT_PUBLIC_`.
- **GSD Workflow Enforcement**: this phase's implementation must go through `/gsd-execute-phase`, not direct edits.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|---------------|
| Native `fetch()` (Node 22 global) | built-in | HTTP call to Arcpedia's `/api/wiki/search` | Matches the existing "Server Components fetch directly, no client-side data-fetching library" convention (`04-CONTEXT.md` Established Patterns) — no HTTP client library needed for a single external GET call |
| `AbortSignal.timeout()` (Node 22 global, stable since Node 17.3) | built-in | Bound the Arcpedia fetch to a fixed timeout so a slow/hung Arcpedia response can't hang the whole detail-pane render | No new dependency; standard Web/Node API, already available in this app's Node 22 runtime `[VERIFIED: Node.js docs — AbortSignal.timeout is a stable Node global since v17.3, well below this repo's Node 22.x floor]` |

No new npm packages are required for the core Arcpedia integration. Zero installs = zero legitimacy-audit surface for this piece.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` (already a dependency, `^4.4.3`) | existing | Optionally validate the shape of Arcpedia's JSON response before rendering (defense against a future arcpedia response-shape change) | Not required by D-01–D-12, but cheap given `zod` is already installed and used elsewhere (`src/lib/env.ts`, filter validation) — a 5-line schema (`z.object({ results: z.array(z.object({ slug: z.string(), title: z.string(), snippet: z.string() })) })`) gives a clean, typed failure path that folds naturally into the same try/catch |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native `fetch()` | An HTTP client library (`ky`, `undici` client, `axios`) | Unnecessary — a single unauthenticated-shape GET call with a timeout is exactly what native `fetch()` + `AbortSignal.timeout()` already covers; adding a library here would be the exact kind of "new mechanism" the user's stated discretion bias (D-04/D-09/D-10/D-11) explicitly says to avoid |
| A dedicated `<Suspense>` boundary around the Arcpedia section | Streaming the section in separately from the rest of the pane | Explicitly deferred per D-11/UI-SPEC — introduces a new pattern (nothing in this codebase uses Suspense boundaries below the route level today) for a benefit (perceived-latency improvement) that could not be measured this session (see Pitfall 1) |

**Installation:** None required.

**Version verification:** N/A — no new package.json entries.

## Package Legitimacy Audit

No new external packages are introduced by this phase's core work (native `fetch`, optionally the already-installed `zod`). The Package Legitimacy Gate is not triggered.

If the planner elects to close the Wave 0 test-framework gap (see Validation Architecture) by installing Vitest, run the gate at that time — Vitest was not evaluated in this session because Phase 2 and Phase 3 both explicitly declined to introduce it, and this phase's context does not change that calculus (see Validation Architecture below).

**Packages removed due to slopcheck [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
 Staff browser
      │  GET /companies/:id  or  GET /personas/:id
      ▼
 Next.js Server Component (CompanyDetail / PersonaDetail)
      │
      ├─► listSignalsForCompany / listCompanyRolesForPersona / getCompanyById / getPersonaById
      │        │  Neon Postgres via Drizzle (existing, unchanged)
      │        └─► try/catch → inline "Couldn't load {company|persona}" card on failure (NEW this phase, D-09)
      │
      └─► fetchArcpediaArticles(entityName)                              (NEW this phase, ARCP-01)
               │  GET https://arcpedia.arclumen.de/api/wiki/search?q=<entityName>
               │  headers: CF-Access-Client-Id / CF-Access-Client-Secret (if configured)
               │
               ▼
         Cloudflare edge — Zero Trust Access application  ◄── Critical Finding: gates ALL traffic,
               │  valid Access headers?                        including "public" GET routes, per
               │        │ NO → 302 → interactive login HTML     arcpedia's own docs/API.md claim
               │        │ YES → passes through
               ▼
         arcpedia Next.js app → src/app/api/wiki/search/route.ts
               │  fuzzySearchWikiContent(q, 10, ...) — BM25/exact match, then Levenshtein fuzzy fallback
               │  reads wiki pages from R2 (prod) or filesystem (dev)
               ▼
         { results: [{ slug, title, summary, snippet, score, fuzzy? }, ...] }
               │
               ▼
         fetchArcpediaArticles: try/catch around fetch+json-parse+zod-parse
               │  ANY failure (network, timeout, non-JSON login page, zod mismatch) → return [] (NEW, D-10)
               │  results.length === 0 → render nothing (NEW, D-12)
               │  results.length > 0 → render "Related Knowledge" section, first 3 (D-08)
               ▼
         Rendered detail pane (never blocked by Arcpedia failure — independent try/catch, D-10)
```

### Recommended Project Structure

```
src/
├── lib/
│   └── arcpedia.ts          # NEW — fetchArcpediaArticles(entityName), named export, matches src/lib/db/queries/*.ts naming convention
├── components/
│   ├── companies/
│   │   └── company-detail.tsx   # MODIFIED — add try/catch (D-09) + Related Knowledge section (ARCP-01)
│   └── personas/
│       └── persona-detail.tsx   # MODIFIED — same two additions
```

### Pattern 1: Server-side external fetch, no client hook

**What:** The Arcpedia call is a plain `await fetch(...)` inside the same `async` Server Component that already awaits DB queries — no `use client`, no `useEffect`, no data-fetching library.
**When to use:** Any server-renderable external read where the credential (Access token) must never reach the browser.
**Example:**
```typescript
// src/lib/arcpedia.ts
// Source: verified against arcpedia/src/app/api/wiki/search/route.ts and
// arcpedia/src/lib/search.ts (ContentSearchResult interface) this session.
import { env } from '@/lib/env';

export interface ArcpediaArticle {
  slug: string;
  title: string;
  snippet: string;
}

const ARCPEDIA_BASE_URL = env.ARCPEDIA_BASE_URL ?? 'https://arcpedia.arclumen.de';

/**
 * Read-only keyword search against Arcpedia (ARCP-02: GET only, never called
 * with a mutating method). Never throws — any failure (network, timeout, the
 * Cloudflare Access login page instead of JSON, or an unexpected response
 * shape) degrades to an empty array so the caller can treat "no articles"
 * and "couldn't reach Arcpedia" identically, per D-10/D-12.
 */
export async function fetchArcpediaArticles(entityName: string): Promise<ArcpediaArticle[]> {
  // No Access Service Token configured yet — skip the network round-trip
  // entirely rather than making a call guaranteed to hit the CF Access wall.
  if (!env.ARCPEDIA_ACCESS_CLIENT_ID || !env.ARCPEDIA_ACCESS_CLIENT_SECRET) {
    return [];
  }

  try {
    const url = `${ARCPEDIA_BASE_URL}/api/wiki/search?q=${encodeURIComponent(entityName)}`;
    const res = await fetch(url, {
      cache: 'no-store', // D-04: no caching layer, matches every other query in this app
      signal: AbortSignal.timeout(5000), // bound worst-case pane render time
      headers: {
        'CF-Access-Client-Id': env.ARCPEDIA_ACCESS_CLIENT_ID,
        'CF-Access-Client-Secret': env.ARCPEDIA_ACCESS_CLIENT_SECRET,
      },
    });

    if (!res.ok) return [];

    const data = await res.json(); // throws SyntaxError on the CF Access login HTML page — caught below
    if (!data || !Array.isArray(data.results)) return [];

    return data.results
      .slice(0, 3) // D-08 cap — Arcpedia's own default maxResults is 10
      .map((r: { slug: string; title: string; snippet: string }) => ({
        slug: r.slug,
        title: r.title,
        snippet: r.snippet,
      }));
  } catch {
    return [];
  }
}
```

### Pattern 2: Independent try/catch per external system (D-10)

**What:** The Arcpedia fetch's try/catch is fully separate from the DB-fetch try/catch — a DB failure and an Arcpedia failure are two independent failure domains and must not be conflated into one catch block.
**When to use:** Any Server Component that awaits two or more independent external systems.
**Example:**
```typescript
// src/components/companies/company-detail.tsx (excerpt — additions only)
import { fetchArcpediaArticles } from '@/lib/arcpedia';

export async function CompanyDetail({ id }: { id: number }) {
  // ... existing getCompanyById / notFound() / signals / personaRoles unchanged ...

  // D-09: same inline-card try/catch as company-list.tsx, applied to a
  // single-record fetch instead of a list fetch — this whole component's
  // top section (company + signals + personaRoles) already either succeeds
  // together above, or notFound() has already returned. If any of those
  // awaits throw, this component itself needs a wrapping try/catch — added
  // at the call site in page.tsx per the plan, not shown here.

  // ARCP-01/D-10: independent from the above — Arcpedia failure must never
  // affect anything already rendered.
  const articles = await fetchArcpediaArticles(company.name);

  return (
    <div className="space-y-12 rounded-lg border border-slate-200 bg-white p-8">
      {/* ...existing sections unchanged... */}

      {articles.length > 0 && ( // D-12: hide entirely on empty/failure
        <section>
          <h2 className="mb-4 text-[18px] font-semibold leading-[1.2] text-slate-900">
            Related Knowledge
          </h2>
          <ul className="space-y-4">
            {articles.map((article) => (
              <li key={article.slug}>
                <a
                  href={`https://arcpedia.arclumen.de/wiki/${encodeURIComponent(article.slug)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[14px] font-normal leading-[1.5] text-indigo-600"
                >
                  {article.title}
                </a>
                <p className="text-[14px] font-normal leading-[1.5] text-slate-500">
                  {article.snippet}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
```

### Anti-Patterns to Avoid

- **Conflating the DB try/catch with the Arcpedia try/catch:** a company that exists and loads fine must never show "Couldn't load company" because Arcpedia timed out, and vice versa — D-10 is explicit that these are independent failure domains.
- **`dangerouslySetInnerHTML` for title/snippet:** Arcpedia content is LLM-synthesized from arbitrary ingested sources (`SCHEMA.md`); render as plain JSX text (auto-escaped) — never inject as raw HTML.
- **Making the Access token env vars fail-fast-required in `src/lib/env.ts`:** this app's env schema pattern (`envSchema.parse(process.env)` at import time) crashes the entire app on a missing var. If `ARCPEDIA_ACCESS_CLIENT_ID`/`SECRET` are added as required, the whole app fails to boot in any environment where the Cloudflare Access token hasn't been provisioned yet — directly contradicting D-10's "rest of the view must render normally" requirement at the level of the entire app, not just the Arcpedia section. They must be optional (`.string().optional()`).
- **Following `fetch()`'s default redirect behavior into treating a 200 as success:** a Cloudflare Access login page is served with `200 OK` HTML after `fetch()` auto-follows the initial `302` — do not treat `res.ok` alone as "got real data"; the `res.json()` parse (or a lightweight zod check) is the actual signal, which is already what Pattern 1 relies on.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fuzzy/keyword article matching | A custom BM25 or Levenshtein matcher against Arcpedia's exported wiki content | Arcpedia's own `/api/wiki/search` (`fuzzySearchWikiContent`) | Arcpedia already does exact + fuzzy fallback server-side (`src/lib/search.ts`); D-01 already locks this decision — reimplementing any of it in ArcLumen 360 would duplicate logic that lives in, and is versioned by, a different repo |
| Request timeout/cancellation | A manual `setTimeout` + `Promise.race` wrapper | `AbortSignal.timeout(ms)` passed to `fetch()`'s `signal` option | Built into the Node/Web fetch API since Node 17.3 — no reason to hand-roll |
| Cloudflare Access authentication | A custom OAuth/JWT client for Cloudflare Zero Trust | Two static headers (`CF-Access-Client-Id`/`CF-Access-Client-Secret`) sent on every request | This is the documented, first-party mechanism for machine-to-machine calls against a CF Access–protected app — arcpedia's own `task-consumer` worker uses exactly this, nothing more sophisticated is needed or supported |

**Key insight:** every piece of this phase's Arcpedia-facing logic is either "call one endpoint with two static headers" or "reuse the exact error-card component already built in Phase 2/3." There is no genuinely novel engineering problem here — the risk in this phase is entirely in verifying the *actual* contract (which this research did) and in infrastructure provisioning (the Access token), not in code complexity.

## Common Pitfalls

### Pitfall 1: Production Arcpedia is gated by Cloudflare Access, not just Clerk (CRITICAL — verify before marking ARCP-01 done)

**What goes wrong:** A plan that treats `docs/API.md`'s "GET routes are always public" claim at face value will ship a `fetch()` call that always returns zero articles in production, silently — because D-10's error handling makes this failure invisible by design. The feature will appear to work in code review and in any environment where the caller happens to already have a valid Access session, but will never surface a single article for a real staff user hitting the deployed ArcLumen 360 app, unless a Cloudflare Access Service Token has been separately provisioned.
**Why it happens:** arcpedia's application-level auth (`getPrincipal()`, Clerk session checks in `src/middleware.ts`) is a second, *inner* auth layer. Cloudflare Zero Trust Access is a separate, *outer* layer enforced at Cloudflare's edge, configured in the Cloudflare dashboard (not in the arcpedia repo's own code) — `docs/API.md` accurately describes the inner layer and doesn't mention the outer one at all, because from arcpedia's own application code's point of view, it doesn't exist.
**How to avoid:** Add a `checkpoint:human-verify` task early in the plan: provision a Cloudflare Access Service Token for `arcpedia.arclumen.de` (Cloudflare Zero Trust dashboard → Access → Service Auth → Service Tokens) and add its Client ID/Secret to ArcLumen 360's environment (Vercel project env vars + local `.env.local`) as `ARCPEDIA_ACCESS_CLIENT_ID` / `ARCPEDIA_ACCESS_CLIENT_SECRET`. Until that's done, treat ARCP-01 as "correctly implemented, not yet demonstrably working end-to-end" rather than fully verified.
**Warning signs:** The Related Knowledge section never appears for ANY company/persona, even ones a human confirms have matching Arcpedia content when searched directly in the Arcpedia UI while signed in.

### Pitfall 2: `env.ts`'s fail-fast pattern will crash the whole app if the new vars are declared required

**What goes wrong:** `src/lib/env.ts` uses `envSchema.parse(process.env)` (not `.safeParse()`) specifically so a missing var crashes at import time. If the new Arcpedia env vars are added with `z.string().min(1)` (matching `DATABASE_URL`'s pattern), every environment without the Access token provisioned yet (very likely true for local dev and possibly the first production deploy of this phase) will fail to boot entirely — not just show a missing Arcpedia section.
**Why it happens:** Copy-paste of the existing required-var pattern without considering that this phase's whole design intent (D-10) is graceful degradation specifically because this external dependency is allowed to be unavailable.
**How to avoid:** Declare the three new vars (`ARCPEDIA_BASE_URL`, `ARCPEDIA_ACCESS_CLIENT_ID`, `ARCPEDIA_ACCESS_CLIENT_SECRET`) as `.optional()` in the zod schema.
**Warning signs:** `npm run dev` or the Vercel build fails immediately after this phase's env changes land, in an environment that previously worked fine.

### Pitfall 3: Assuming the detail pane needs a new loading state

**What goes wrong:** Building a new `Suspense` boundary or a new loading skeleton specifically for the Arcpedia section, when the existing route-level `loading.tsx` (`src/app/companies/loading.tsx`, `src/app/personas/loading.tsx`) already covers the entire detail pane's initial load, including any newly-added awaited call inside the same Server Component tree.
**Why it happens:** Not confirming that `CompanyDetail`/`PersonaDetail` are rendered inside the same route segment that `loading.tsx` guards, before assuming new loading UI is needed.
**How to avoid:** Confirmed this session — `04-UI-SPEC.md`'s "Interaction Notes (D-11)" already correctly concludes no new Suspense boundary is needed; this research found nothing that contradicts that (though see Pitfall 1/Open Question 1 — the *latency* half of that conditional recommendation could not be measured live).
**Warning signs:** A plan task proposes a new `<Suspense fallback={...}>` wrapping only the Related Knowledge section — this would be new, unprecedented architecture for this codebase and should require explicit justification tied to a measured latency number, not a guess.

### Pitfall 4: Rendering Arcpedia's `slug` unescaped into an href

**What goes wrong:** Building the Arcpedia article link as a raw template string (`` `https://arcpedia.arclumen.de/wiki/${article.slug}` ``) without encoding, on the assumption that `slug` is always a clean, pre-validated string.
**Why it happens:** Arcpedia's own `SCHEMA.md` documents a strict `SAFE_SLUG_RE` (`[a-z0-9-]` plus a few Unicode ranges, hyphen-joined, no leading/trailing hyphen) enforced by `validateSlug()` — in practice this makes a malicious slug unlikely, but the response is still third-party data crossing a trust boundary.
**How to avoid:** Wrap `slug` in `encodeURIComponent()` when building the href, exactly as done for the search query itself. Cheap, defensive, no downside.
**Warning signs:** N/A (this is a defense-in-depth recommendation, not something currently exploitable given arcpedia's own slug validation — see Security Domain, V5).

## Code Examples

### Fetching and rendering (full flow)

See Pattern 1 and Pattern 2 above under Architecture Patterns — those are the verified, ready-to-implement code shapes for this phase, sourced directly against `arcpedia/src/app/api/wiki/search/route.ts` and `arcpedia/src/lib/search.ts` read in this session (not training-data recall).

### Env schema addition

```typescript
// src/lib/env.ts (additions)
const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  // Optional — see Pitfall 2. Arcpedia integration must degrade gracefully
  // (D-10) if these are unset, so they cannot be fail-fast-required like the
  // vars above.
  ARCPEDIA_BASE_URL: z.string().url().optional(),
  ARCPEDIA_ACCESS_CLIENT_ID: z.string().optional(),
  ARCPEDIA_ACCESS_CLIENT_SECRET: z.string().optional(),
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-------------------|---------------|--------|
| `fetch()` defaults to `force-cache` in the App Router | `fetch()` defaults to `no-store` (fresh every request unless explicitly opted into `'use cache'`/`next: { revalidate }`) | Next.js 15 (continued in Next 16, this app's installed version `16.2.11`) `[VERIFIED via WebSearch, cross-referenced against nextjs.org/docs/app/api-reference/functions/fetch]` | D-04 ("fetch live per page load, no caching") is now the *framework default* for this app's Next.js version, not something that needs an explicit `cache: 'no-store'` override to achieve — though setting it explicitly (as Pattern 1 does) is good defensive practice against a future default change and self-documents intent, matching this codebase's "comments explain why" convention |

**Deprecated/outdated:** None relevant to this phase — the Arcpedia API surface itself (`/api/wiki/search`) is current, actively maintained code in the same session's timeframe (arcpedia's own docs describe it as the stable public search endpoint, no deprecation notice).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Arcpedia's production Cloudflare Access application will accept a newly-provisioned Service Token (Client ID/Secret) without additional per-route Access policy configuration beyond what already exists for `task-consumer` | Pitfall 1, Summary | If the Access policy is scoped more narrowly (e.g., only allows the existing `task-consumer` service token, not a new one), provisioning a new token may not be sufficient — could require an additional Access policy change in the Cloudflare Zero Trust dashboard, which is entirely outside this repo and this session's ability to verify |
| A2 | Arcpedia's `/api/wiki/search` real-world response latency (once past the Access gate) is low enough that no dedicated Suspense boundary is needed | D-11, Pitfall 3 | Could not be measured this session (Access gate blocks unauthenticated test calls). If latency turns out to be high (e.g., cold-start reads across many R2 objects for the fuzzy fallback path), the whole detail pane will feel slow, and D-11's "no new Suspense" default should be revisited once a token is provisioned and real latency can be measured |
| A3 | The Access Service Token env vars, once provisioned, are safe to keep server-only (never need `NEXT_PUBLIC_` exposure) | Pitfall 2, Security Domain | Effectively certain to be true (client-side calls to this endpoint would leak the secret to every visitor's browser) — flagged only for completeness, not because there's real doubt |

**If this table is empty:** N/A — see above; three assumptions logged, all tied to the one infrastructure dependency this phase surfaced.

## Open Questions

1. **Has a Cloudflare Access Service Token already been (or will it be) provisioned for ArcLumen 360 to call arcpedia.arclumen.de?**
   - What we know: The production domain is definitively gated by Cloudflare Access (verified via direct `curl` this session, four separate paths, all `302` to the same Zero Trust login). Arcpedia's own first-party service caller (`task-consumer`) uses a Service Token via `CF-Access-Client-Id`/`CF-Access-Client-Secret` headers for exactly this kind of machine-to-machine call.
   - What's unclear: Whether the user (who also controls the `arcpedia` repo/Cloudflare account, per this session's file-system access to both repos under the same `/Users/mkonovalov/Projects/` tree) has already planned to provision a token for ArcLumen 360 specifically, or whether this is new information to them.
   - Recommendation: Surface this explicitly in planning — add a `checkpoint:human-verify` task for token provisioning, and make ARCP-01's "done" definition conditional on a manual confirmation that articles actually render for at least one known-matching company/persona in a deployed environment, not just that the code path is correct.

2. **What is arcpedia's `/api/wiki/search` real-world latency in production?**
   - What we know: The endpoint's exact-match path is a fast in-memory index scan (`page-index.ts`-backed); the fuzzy fallback path (triggered when exact results are `< 3`) reads full page bodies for every non-excluded page with bounded concurrency (`READ_CONCURRENCY` in `mapWithConcurrency`) — this is the potentially slower path, and it's the common case for Company/Persona names that don't literally appear as Arcpedia page titles.
   - What's unclear: Actual latency numbers — blocked by the Access gate (Open Question 1) from live-testing this session.
   - Recommendation: Once a Service Token is available, measure P50/P95 latency for a few representative company/persona name searches before finalizing whether D-11's "no new Suspense" default should stand. A 5-second `AbortSignal.timeout()` (per Pattern 1) bounds the worst case regardless.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Arcpedia production API (`arcpedia.arclumen.de`) | ARCP-01 | ✗ (unauthenticated) | — | D-10's silent-hide behavior means the app functions correctly without it; ARCP-01 simply won't visibly demo articles until the Access token is provisioned (Pitfall 1) |
| Cloudflare Access Service Token for arcpedia.arclumen.de | ARCP-01 | ✗ (not present in `.env.local`/`.env.example`; not found in this repo) | — | None — this is the blocking dependency; must be provisioned in the Cloudflare Zero Trust dashboard (outside this repo) |
| Native `fetch()` / `AbortSignal.timeout()` (Node 22 runtime) | ARCP-01, resilience polish | ✓ | Node 22.x (per `package.json` engines) | — |

**Missing dependencies with no fallback:**
- Cloudflare Access Service Token for arcpedia.arclumen.de — blocks ARCP-01 from actually surfacing articles in any deployed environment until provisioned. Code can and should still be built and merged (D-10 makes this safe), but the requirement's "done" bar should be split into "implemented" vs. "verified working end-to-end."

**Missing dependencies with fallback:**
- Arcpedia API reachability in general — falls back to "Related Knowledge section doesn't render," which is indistinguishable from D-12's zero-match case by design.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None installed (confirmed — no `vitest.config.*`, `jest.config.*`, `playwright.config.*`, or `*.test.*`/`*.spec.*` files anywhere in the repo; `package.json` has no `test` script). Same state as Phase 2 and Phase 3 — still unaddressed. |
| Config file | none — see Wave 0 |
| Quick run command | none |
| Full suite command | none |

This app's `human_verify_mode: "end-of-phase"` config setting and Phase 1–3's precedent (zero automated tests, `*-HUMAN-UAT.md` checklists instead) both apply unchanged to Phase 4. This phase's testable surfaces (Arcpedia integration, detail-pane error states) are dominated by external-system behavior (Arcpedia's live response) and visual/rendering behavior — both are a better fit for manual UAT than for a first automated test suite introduced mid-milestone.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|--------------------|-------------|
| ARCP-01 | Related Knowledge section shows title+snippet for a company/persona with matching Arcpedia content, capped at 3, links open in a new tab | manual (UAT) — requires the Cloudflare Access token to be provisioned first (Open Question 1) | — | ❌ blocked on infra, not just missing tests |
| ARCP-01 (empty/failure path) | Section renders nothing when Arcpedia returns zero matches OR is unreachable | manual (UAT) — trivially demonstrable even without the Access token today, since the token's absence *is* the failure path | — | ❌ but the pure-logic part (`fetchArcpediaArticles` returning `[]` and the caller conditionally rendering) is a strong Vitest-unit-test candidate if the planner wants one low-cost automated test this phase (see Wave 0) |
| ARCP-02 | No write/mutating call is ever made to Arcpedia | code-review / static check — `fetchArcpediaArticles` only ever issues a `GET`; no `POST`/`PUT`/`PATCH`/`DELETE` calls exist in the new code | — | ❌ manual code-review verification (grep for `method:` in the new file is sufficient, no test framework needed) |
| EXPL-06 (detail-pane error state) | A DB fetch failure on `/companies/:id` or `/personas/:id` shows the "Couldn't load company/persona" card instead of a 500 | manual (UAT) — force a failure (e.g., temporarily point `DATABASE_URL` at an invalid host) and confirm the card renders | — | ❌ visual/behavioral verification; the underlying try/catch is simple enough that a unit test would mostly test React rendering, not novel logic |
| EXPL-06 (detail-pane loading state) | Route-level skeleton shows while the detail pane (DB + Arcpedia) is loading | manual (UAT) — confirmed via code inspection this session that `loading.tsx` already covers this; visual confirmation still valuable | — | ❌ visual verification only |

### Sampling Rate
- **Per task commit:** n/a — no automated quick-run command exists.
- **Per wave merge:** n/a.
- **Phase gate:** Human UAT checklist (matching Phase 1–3's `*-HUMAN-UAT.md` precedent) before `/gsd-verify-work`. Critically, the ARCP-01 "articles actually render" check on this checklist should be marked conditional/blocked until the Cloudflare Access token is provisioned (Open Question 1) — do not let phase-gate UAT silently pass this item just because "the section doesn't error" (that's also what a successful zero-match case looks like).

### Wave 0 Gaps
- [ ] No test framework installed — **recommendation: do not introduce one this phase**, consistent with Phase 2/3's decision. If the planner wants one low-cost automated test this phase specifically because Arcpedia's live-service dependency makes manual UAT unreliable/unrepeatable, `fetchArcpediaArticles`'s pure error-handling branches (bad JSON → `[]`, missing env vars → `[]` without a network call, `results.length` slicing to 3) are the single best unit-test candidate of anything in this phase — but this would require `npm install -D vitest` + `vitest.config.ts` (same net-new gap flagged, unaddressed, in Phase 2 and Phase 3's research).

*(No other gaps — verification story is deliberately manual, matching Phase 1–3 precedent, with the one exception above flagged as optional.)*

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: "high"` (`.planning/config.json`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|--------------------|
| V2 Authentication | Yes (indirect) | Already satisfied by Clerk (Phase 1) for the ArcLumen 360 side; no Phase 4 changes. The *new* auth surface (Cloudflare Access to arcpedia) is a service-to-service credential, not a user-facing auth flow — see V9/V14 below |
| V4 Access Control | No new surface | Arcpedia calls are read-only, unauthenticated from the *user's* perspective (the CF Access token authenticates ArcLumen 360's server, not the staff user) — no per-user access control question arises |
| V5 Input Validation / Output Encoding | Yes | The entity name (company/persona name) must be `encodeURIComponent()`-encoded before building the query string (Pattern 1 already does this). Arcpedia's response (`title`, `snippet`, `slug`) is third-party data — must be rendered as plain JSX text (auto-escaped), never via `dangerouslySetInnerHTML`; `slug` must also be `encodeURIComponent()`-encoded when building the outbound `href` (Pitfall 4), even though arcpedia's own `SAFE_SLUG_RE` makes this defense-in-depth rather than a currently-exploitable gap |
| V8 Data Protection | Yes | `ARCPEDIA_ACCESS_CLIENT_SECRET` is a credential — must never be logged (the catch-all `catch { return []; }` pattern in Pattern 1 deliberately swallows the error without logging the error object, which could otherwise leak request/response details in a server log) and must never be exposed via `NEXT_PUBLIC_*` |
| V9 Communications Security | Yes | All Arcpedia traffic is HTTPS (`https://arcpedia.arclumen.de`) — never construct the URL from an env var without validating scheme; `ARCPEDIA_BASE_URL` should be validated with `z.string().url()` (already reflected in the Code Examples env schema) to prevent an accidental `http://` misconfiguration from sending the Access secret in plaintext over the network |
| V13 API and Web Service | Yes | ArcLumen 360 must only ever issue `GET` requests to Arcpedia (ARCP-02) — no request body, no mutating verb, ever, in this phase's code |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Credential leakage via client bundle | Information Disclosure | Keep `ARCPEDIA_ACCESS_CLIENT_ID`/`SECRET` unprefixed (server-only) in `src/lib/env.ts`; fetch call lives only in an `async` Server Component, never a Client Component or route handler exposed to the browser |
| Reflected content injection via third-party API response | Tampering / Information Disclosure | Render `title`/`snippet` as plain JSX text (React auto-escapes); never `dangerouslySetInnerHTML` on Arcpedia response fields |
| SSRF via user-controllable target URL | Tampering | Not applicable here — the Arcpedia origin is a hardcoded constant (`ARCPEDIA_BASE_URL`, itself only overridable via a validated `.url()` env var, not user input); only the query string's `q` param varies, and it's built from an internal DB field (company/persona name), not raw user input from a request |
| Sensitive error detail leakage via logs | Information Disclosure | The catch-all `catch { return []; }` intentionally does not log the caught error's message/stack — matches this codebase's existing "errors swallowed silently, not logged" convention (CLAUDE.md Error Handling) |
| Open redirect / target confusion via unescaped slug in outbound link | Tampering (low severity — outbound link only, not a redirect this app serves) | `encodeURIComponent(article.slug)` before building the `href` (Pitfall 4); `target="_blank" rel="noopener noreferrer"` already mitigates `window.opener` tab-napping regardless |

## Sources

### Primary (HIGH confidence)
- `/Users/mkonovalov/Projects/arcpedia/docs/API.md` — full endpoint table, auth model, error-code conventions; read in full this session
- `/Users/mkonovalov/Projects/arcpedia/SCHEMA.md` — frontmatter field definitions (`confidence`, `expiry`, `valid_from`, `tags`, `aliases`), slug validation rules; read in full this session
- `/Users/mkonovalov/Projects/arcpedia/docs/ARCHITECTURE.md` — system overview, storage abstraction (filesystem vs. R2/KV/Vectorize), data flow; read in full this session
- `/Users/mkonovalov/Projects/arcpedia/docs/DEPLOYMENT.md` — Cloudflare Workers deployment, `wrangler.jsonc` bindings, service token secret names (`arcpedia_SERVICE_TOKEN`); read in full this session
- `/Users/mkonovalov/Projects/arcpedia/src/app/api/wiki/search/route.ts` — actual route handler source, confirms `q` required, `scope` optional, `fuzzySearchWikiContent(q, 10, scope, principal)`, `{ results }` response envelope
- `/Users/mkonovalov/Projects/arcpedia/src/lib/search.ts` — `ContentSearchResult` interface (`slug, title, summary, snippet, score, fuzzy?`), exact + fuzzy (Levenshtein) matching implementation, `mapWithConcurrency`-bounded fuzzy-fallback page reads
- `/Users/mkonovalov/Projects/arcpedia/workers/task-consumer/index.ts` — direct code evidence of `CF-Access-Client-Id`/`CF-Access-Client-Secret` header usage for a first-party service-to-service call against the same "protected custom domain"
- Live `curl` tests against `https://arcpedia.arclumen.de/`, `/api/status`, `/api/wiki`, `/api/wiki/search?q=test` (this session, 2026-07-24) — all four returned `302`/redirect-then-200-HTML to `mkonovalov.cloudflareaccess.com` Zero Trust login, confirming the Critical Finding directly rather than inferring it

### Secondary (MEDIUM confidence)
- WebSearch, "Next.js 16 fetch caching default behavior no-store App Router Server Components" — cross-referenced against `nextjs.org/docs/app/api-reference/functions/fetch` link returned in results; confirms `fetch()` defaults to `no-store` as of Next.js 15+ (this app runs 16.2.11)

### Tertiary (LOW confidence)
- None used as the basis for any claim in this document — every Arcpedia-specific claim was verified directly against the arcpedia source repo or live traffic this session, not recalled from training data.

## Metadata

**Confidence breakdown:**
- Arcpedia API contract (request/response shape, error modes): HIGH — read directly from arcpedia's own route handler and `search.ts` source this session, not inferred
- Cloudflare Access gating finding: HIGH — independently verified via live `curl` (4 endpoints, consistent result) AND corroborated by arcpedia's own `task-consumer` code needing the same headers
- Real-world Arcpedia search latency: LOW — could not be measured (blocked by the Access gate); flagged as Open Question 2 rather than guessed
- Detail-pane error/resilience pattern: HIGH — directly read from `company-list.tsx`/`persona-list.tsx`, mechanical extension to `company-detail.tsx`/`persona-detail.tsx`
- Next.js 16 fetch caching default: MEDIUM — WebSearch cross-referenced with an official-docs link, not independently fetched/read in full this session

**Research date:** 2026-07-24
**Valid until:** 14 days for the Arcpedia API contract (stable, low-churn per arcpedia's own "Planned evolution" notes); re-verify the Cloudflare Access finding immediately before implementation if more than a few days pass, since it depends on external infra state (a Zero Trust policy) that could change independently of this repo or arcpedia's
