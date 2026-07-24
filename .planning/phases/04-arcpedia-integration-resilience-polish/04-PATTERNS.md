# Phase 4: Arcpedia Integration & Resilience Polish - Pattern Map

**Mapped:** 2026-07-24
**Files analyzed:** 5 (1 new, 4 modified)
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/lib/arcpedia.ts` (NEW) | service (external API client) | request-response | `src/lib/db/queries/companies.ts` | role-match (query-module shape, not DB but same "one async fetch function, returns safe default" contract) |
| `src/lib/env.ts` (MODIFIED — add 3 optional vars) | config | transform (env parse) | itself (extend existing schema) | exact |
| `src/components/companies/company-detail.tsx` (MODIFIED — add try/catch + Related Knowledge section) | component (Server Component, detail pane) | CRUD (read) + request-response (external fetch) | `src/components/companies/company-list.tsx` (for try/catch shape) + itself (for section-append shape) | exact (error pattern), exact (section pattern — sibling file `persona-detail.tsx` already extends the same stack) |
| `src/components/personas/persona-detail.tsx` (MODIFIED — add try/catch + Related Knowledge section) | component (Server Component, detail pane) | CRUD (read) + request-response (external fetch) | `src/components/personas/persona-list.tsx` (for try/catch shape) + `company-detail.tsx` (for section-append shape, once modified) | exact |
| `src/app/companies/[id]/page.tsx`, `src/app/personas/[id]/page.tsx` | route/controller | request-response | unchanged this phase — no analog needed, callers already pass `id` straight through to `CompanyDetail`/`PersonaDetail` | n/a (no modification expected) |

## Pattern Assignments

### `src/lib/arcpedia.ts` (NEW — service, request-response)

**Analog:** `src/lib/db/queries/companies.ts` (module shape/naming convention) + `src/lib/env.ts` (env-var consumption)

**Imports pattern** — matches the "named exports only, no default export" convention seen in every `src/lib/**` file (`companies.ts:1-3`, `signals.ts:1-3`):
```typescript
import { env } from '@/lib/env';
```
No new package import — per RESEARCH.md's "Standard Stack", this uses native `fetch()` + `AbortSignal.timeout()` (Node 22 globals), zero new dependencies.

**Naming convention** (from `src/lib/db/queries/companies.ts:5-11`, `:59-62`):
```typescript
export interface CompanyFilters { ... }
export async function getCompanyById(id: number) {
  const rows = await db.select().from(company).where(eq(company.id, id));
  return rows[0];   // returns undefined, never throws — caller decides notFound()
}
```
Mirror this shape for the new module: PascalCase interface suffixed with a domain noun (`ArcpediaArticle`), camelCase async function (`fetchArcpediaArticles`), returns a safe default (`[]`) rather than throwing — same "never throws, caller decides what empty means" contract already used by `getCompanyById`.

**Core pattern — full function (RESEARCH.md Pattern 1, already verified against arcpedia's source this session, use verbatim as the starting point)**:
```typescript
// src/lib/arcpedia.ts
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
  if (!env.ARCPEDIA_ACCESS_CLIENT_ID || !env.ARCPEDIA_ACCESS_CLIENT_SECRET) {
    return [];
  }

  try {
    const url = `${ARCPEDIA_BASE_URL}/api/wiki/search?q=${encodeURIComponent(entityName)}`;
    const res = await fetch(url, {
      cache: 'no-store', // D-04: no caching layer, matches every other query in this app
      signal: AbortSignal.timeout(5000),
      headers: {
        'CF-Access-Client-Id': env.ARCPEDIA_ACCESS_CLIENT_ID,
        'CF-Access-Client-Secret': env.ARCPEDIA_ACCESS_CLIENT_SECRET,
      },
    });

    if (!res.ok) return [];

    const data = await res.json();
    if (!data || !Array.isArray(data.results)) return [];

    return data.results
      .slice(0, 3) // D-08 cap
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

**Error handling pattern:** single catch-all, returns `[]`, no logging (matches CLAUDE.md's "errors swallowed silently, not logged" convention — see Shared Patterns below).

---

### `src/lib/env.ts` (MODIFIED — config)

**Analog:** itself, lines 1-12 (extend in place)

**Current file in full:**
```typescript
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
});

export const env = envSchema.parse(process.env);
```

**Required addition (RESEARCH.md "Env schema addition", Pitfall 2):** the 3 new vars MUST be `.optional()`, never `.min(1)`-required like `DATABASE_URL` — this file's `envSchema.parse()` (not `.safeParse()`) crashes the whole app at import time on any required-but-missing var. D-10's "rest of the view must render normally" requirement extends to "the app must still boot" when the Cloudflare Access token hasn't been provisioned yet.
```typescript
ARCPEDIA_BASE_URL: z.string().url().optional(),
ARCPEDIA_ACCESS_CLIENT_ID: z.string().optional(),
ARCPEDIA_ACCESS_CLIENT_SECRET: z.string().optional(),
```

---

### `src/components/companies/company-detail.tsx` (MODIFIED)

**Analog for try/catch (D-09):** `src/components/companies/company-list.tsx` lines 33-55

```typescript
// company-list.tsx:33-55 — the exact shape to replicate around the
// company-detail.tsx fetch (single-record fetch instead of a list fetch)
let companies: Awaited<ReturnType<typeof listCompanies>>;
try {
  companies = await listCompanies(filters);
} catch {
  return (
    <div
      className={cn(
        'flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-center',
        selectedId ? 'hidden md:flex' : 'flex'
      )}
    >
      <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">
        {"Couldn't load companies"}
      </p>
      <p className="text-sm text-slate-500">
        Something went wrong fetching this data. Try refreshing the page.
      </p>
    </div>
  );
}
```
Note the detail-pane version has no `selectedId`-driven `hidden md:flex` toggle (that's list-pane-specific mobile behavior) — the card's copy/structure carries over, singular ("Couldn't load company" not "companies"), the mobile-hide class does not.

**Current file structure to modify** (`company-detail.tsx:34-46`):
```typescript
export async function CompanyDetail({ id }: { id: number }) {
  const company = await getCompanyById(id);
  if (!company) {
    notFound();
  }

  const [signals, personaRoles] = await Promise.all([
    listSignalsForCompany(id),
    listPersonasForCompany(id),
  ]);
  // NEW: wrap the above (company/signals/personaRoles fetch) in its own
  // try/catch per D-09, catching to the inline error card above.
  // NEW, independent of the above (D-10): const articles = await fetchArcpediaArticles(company.name);
  ...
```

**Core section-append pattern (ARCP-01, D-05/D-06/D-07/D-08/D-12)** — append as the last sibling `<section>` inside the existing `space-y-12` wrapper (`company-detail.tsx:48`, after "Linked Personas" which ends at line 127):
```typescript
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
```
This exact `<h2>` class string is copy-pasted verbatim from every existing section header in this file (`company-detail.tsx:57`, `:69`, `:88`, `:110`) — do not invent a new heading style. The link `<a>` class matches `persona-detail.tsx:123`/`:135` (email/LinkedIn links) exactly, per D-07/UI-SPEC.

**Import addition:**
```typescript
import { fetchArcpediaArticles } from '@/lib/arcpedia';
```

---

### `src/components/personas/persona-detail.tsx` (MODIFIED)

**Analog for try/catch (D-09):** `src/components/personas/persona-list.tsx` lines 32-53 (same shape as company-list.tsx above, singular copy: "Couldn't load personas" → "Couldn't load persona").

**Analog for section-append:** `company-detail.tsx`'s new Related Knowledge section (above) — identical structure, only the search entity changes:
```typescript
// D-03: persona's own name only, never the current company's name
const articles = await fetchArcpediaArticles(persona.name);
```
Placement: after the existing "Contact Info" section (`persona-detail.tsx:113-147`, ends at `</section>` line 147), inside the same `space-y-12` wrapper (`persona-detail.tsx:46`).

**Existing external-link precedent this section's `<a>` must match exactly** (`persona-detail.tsx:129-140`, D-07's cited precedent):
```typescript
{persona.linkedinUrl ? (
  <p>
    <a
      href={persona.linkedinUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[14px] font-normal leading-[1.5] text-indigo-600"
    >
      {persona.linkedinUrl}
    </a>
  </p>
) : null}
```

**Import addition:**
```typescript
import { fetchArcpediaArticles } from '@/lib/arcpedia';
```

---

## Shared Patterns

### Inline error card (D-09)
**Source:** `src/components/companies/company-list.tsx:33-55`, `src/components/personas/persona-list.tsx:32-53`
**Apply to:** `company-detail.tsx`, `persona-detail.tsx` (new — currently zero error handling on either file)
```typescript
try {
  // ...DB fetch(es)...
} catch {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-center">
      <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">
        {"Couldn't load company"}  {/* or "persona" */}
      </p>
      <p className="text-sm text-slate-500">
        Something went wrong fetching this data. Try refreshing the page.
      </p>
    </div>
  );
}
```
Note: detail-pane version drops the list-pane's `selectedId`-conditional `hidden md:flex`/`hidden md:block` classes — that's a list/detail split-pane mobile concern that doesn't apply once you're already on a single detail page.

### Independent try/catch per external system (D-10)
**Source:** RESEARCH.md Pattern 2 (new, no direct in-repo precedent — first time this codebase awaits two independent external systems in one component)
**Apply to:** `company-detail.tsx`, `persona-detail.tsx`
**Rule:** the DB-fetch try/catch (above) and the Arcpedia try/catch (inside `fetchArcpediaArticles` itself) must never be merged into one catch block — a DB failure must never be masked as "no articles," and an Arcpedia failure must never trigger the "Couldn't load company/persona" card. `fetchArcpediaArticles` already encapsulates its own catch-all internally (see `src/lib/arcpedia.ts` above), so the calling component doesn't need a second explicit `try/catch` around the `await fetchArcpediaArticles(...)` call — the function contract itself guarantees it never throws.

### No caching (D-04)
**Source:** `src/lib/db/queries/*.ts` (every query is always-live, no caching layer anywhere in the codebase) + Next.js 16's `fetch()` default (`no-store` as of Next 15+, confirmed in RESEARCH.md "State of the Art")
**Apply to:** `src/lib/arcpedia.ts` — explicit `cache: 'no-store'` on the `fetch()` call, self-documenting intent even though it's now the framework default.

### Named exports only, no default exports (project-wide, CLAUDE.md)
**Source:** every file in `src/lib/**` (`src/lib/db/queries/companies.ts`, `src/lib/env.ts`)
**Apply to:** `src/lib/arcpedia.ts`

### Section heading style (visual)
**Source:** `company-detail.tsx:57,69,88,110`, `persona-detail.tsx:55,65,88,114`
```typescript
<h2 className="mb-4 text-[18px] font-semibold leading-[1.2] text-slate-900">
```
**Apply to:** the new "Related Knowledge" `<h2>` in both files — copy verbatim, do not restyle.

### External link style (visual)
**Source:** `persona-detail.tsx:123,135` (email/LinkedIn)
```typescript
<a target="_blank" rel="noopener noreferrer" className="text-[14px] font-normal leading-[1.5] text-indigo-600">
```
**Apply to:** the Arcpedia article title `<a>` in the new Related Knowledge section (both files).

### Slug/query encoding (security, V5)
**Source:** none in-repo (new pattern) — required by RESEARCH.md Pitfall 4/Security Domain V5
**Apply to:** `src/lib/arcpedia.ts` (encode `q` param) and the `<a href>` construction in both detail components (encode `article.slug`) — both via `encodeURIComponent()`.

## No Analog Found

None — every file in scope has at least one strong in-repo analog (list-pane error card, sibling detail-pane file, existing env schema). The one genuinely new mechanism (independent per-external-system try/catch, D-10) has no in-repo precedent because this is the first time the codebase awaits two independent external systems in one component, but RESEARCH.md's Pattern 2 already specifies the exact shape to use — no exploration needed.

## Metadata

**Analog search scope:** `src/components/companies/`, `src/components/personas/`, `src/lib/`, `src/app/companies/`, `src/app/personas/`
**Files scanned:** `company-list.tsx`, `persona-list.tsx`, `company-detail.tsx`, `persona-detail.tsx`, `env.ts`, `companies.ts`, `signals.ts`, `companies/[id]/page.tsx`, `personas/[id]/page.tsx`, `companies/loading.tsx`, `personas/loading.tsx`
**Pattern extraction date:** 2026-07-24
