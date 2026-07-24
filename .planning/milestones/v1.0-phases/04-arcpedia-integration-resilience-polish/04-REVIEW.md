---
phase: 04-arcpedia-integration-resilience-polish
reviewed: 2026-07-24T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/lib/arcpedia.ts
  - src/lib/env.ts
  - .env.example
  - src/components/companies/company-detail.tsx
  - src/components/personas/persona-detail.tsx
findings:
  critical: 1
  warning: 3
  info: 3
  total: 7
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-07-24T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Reviewed the Arcpedia knowledge-panel integration (`src/lib/arcpedia.ts`, `src/lib/env.ts`), its env contract (`.env.example`), and the two detail panes that consume it (`company-detail.tsx`, `persona-detail.tsx`). The resilience patterns the phase set out to build — never-throw fetch wrapper, independent try/catch failure domains for DB vs. Arcpedia, D-10-style silent degrade-to-empty — are implemented correctly and match the in-code design rationale comments.

However, one finding undermines the stated goal of "Arcpedia integration must degrade gracefully": the optional `ARCPEDIA_BASE_URL` env var is validated with `z.string().url()`, and because `env.ts` is imported transitively by `src/lib/db/index.ts` (used by virtually every server-rendered route), a malformed-but-present value crashes the entire app at cold start rather than degrading just the Arcpedia feature. There's also a genuine functional bug: the outbound "Related Knowledge" link is hardcoded to the production Arcpedia domain in both detail components, ignoring the very `ARCPEDIA_BASE_URL` config the fetch call itself respects — so a non-default base URL silently breaks the feature it's supposed to configure.

## Critical Issues

### CR-01: Malformed (but present) `ARCPEDIA_BASE_URL` crashes the entire app, not just the optional feature

**File:** `src/lib/env.ts:13`
**Issue:** The schema comment states: "Optional — Arcpedia integration must degrade gracefully (D-10) if these are unset... so they cannot be fail-fast-required like the vars above." But `ARCPEDIA_BASE_URL: z.string().url().optional()` only guards against the var being *unset* — `.optional()` does not suppress validation failures when the var *is* set but not a valid URL (e.g. an operator sets `ARCPEDIA_BASE_URL=arcpedia.arclumen.de` without a scheme, a very plausible typo). In that case `envSchema.parse(process.env)` throws at module load.

`env.ts` is not scoped to the Arcpedia feature — it's imported by `src/lib/db/index.ts` (`import { env } from '../env'; const sql = neon(env.DATABASE_URL);`), which is the shared DB client used by essentially every page/query in the app (`company-detail.tsx`, `persona-detail.tsx`, list views, etc.). Because this parse runs eagerly at import time, a single malformed optional Arcpedia var takes down cold starts for the *entire* application (companies, personas, everything), not just the "Related Knowledge" section — directly contradicting the graceful-degradation goal documented in the same file.

**Fix:**
```ts
const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  // .catch(undefined) ensures a malformed optional value degrades to
  // "feature disabled" instead of crashing the whole app at import time.
  ARCPEDIA_BASE_URL: z.string().url().optional().catch(undefined),
  ARCPEDIA_ACCESS_CLIENT_ID: z.string().optional(),
  ARCPEDIA_ACCESS_CLIENT_SECRET: z.string().optional(),
});
```

## Warnings

### WR-01: "Related Knowledge" link ignores the configured `ARCPEDIA_BASE_URL`, duplicated in two files

**File:** `src/components/companies/company-detail.tsx:168`, `src/components/personas/persona-detail.tsx:187`
**Issue:** `fetchArcpediaArticles()` searches against `env.ARCPEDIA_BASE_URL ?? 'https://arcpedia.arclumen.de'` (configurable), but both detail components build the outbound article link with a hardcoded literal:
```tsx
href={`https://arcpedia.arclumen.de/wiki/${encodeURIComponent(article.slug)}`}
```
`arcpedia.ts` doesn't even export `ARCPEDIA_BASE_URL`, so there's no way for the components to stay in sync with it. Whenever `ARCPEDIA_BASE_URL` is overridden (staging Arcpedia instance, domain migration, local dev pointing at a mock), search results come from the configured host but the clickable link always points at production — producing broken links or, worse, silently showing the wrong knowledge base to the user. This is also duplicated verbatim in two files, so any future base-URL change has to be made in three places (`arcpedia.ts` fallback + both hardcoded strings) to stay consistent.

**Fix:** Export a helper from `arcpedia.ts` and reuse it in both components:
```ts
// arcpedia.ts
export function getArcpediaArticleUrl(slug: string): string {
  return `${ARCPEDIA_BASE_URL}/wiki/${encodeURIComponent(slug)}`;
}
```
```tsx
// company-detail.tsx / persona-detail.tsx
import { fetchArcpediaArticles, getArcpediaArticleUrl } from '@/lib/arcpedia';
...
<a href={getArcpediaArticleUrl(article.slug)} target="_blank" rel="noopener noreferrer">
```

### WR-02: `ARCPEDIA_BASE_URL` scheme is not enforced to HTTPS, risking secret leakage over plaintext

**File:** `src/lib/env.ts:13`
**Issue:** `z.string().url()` accepts any valid URL, including `http://...`. `fetchArcpediaArticles()` sends `CF-Access-Client-Secret` as a request header to whatever `ARCPEDIA_BASE_URL` resolves to (`src/lib/arcpedia.ts:41-43`). If an operator ever sets this to an `http://` origin (typo, local proxy, misconfigured staging value), the Cloudflare Access service token secret is sent in plaintext over the network. There's no validation preventing this.
**Fix:**
```ts
ARCPEDIA_BASE_URL: z
  .string()
  .url()
  .refine((u) => u.startsWith('https://'), 'ARCPEDIA_BASE_URL must use https')
  .optional()
  .catch(undefined),
```

### WR-03: `persona.linkedinUrl` rendered as a raw `href` with no scheme validation

**File:** `src/components/personas/persona-detail.tsx:161`
**Issue:** `persona.linkedinUrl` is stored as free text (`schema.ts:72`, "D-02/D-03: full URL, stored/rendered as-is") and rendered directly as `<a href={persona.linkedinUrl} target="_blank" rel="noopener noreferrer">`. There's no allowlist on the URL scheme, so a manually-entered value of `javascript:...` (or any non-http(s) scheme) would execute when a staff member clicks the link. This predates Phase 4 and is a documented decision (D-03), but it's a real defense-in-depth gap surfaced while reviewing this file at standard depth — worth hardening given the field is manually entered and not otherwise validated anywhere in the write path reviewed here.
**Fix:**
```tsx
{persona.linkedinUrl && /^https?:\/\//i.test(persona.linkedinUrl) ? (
  <a href={persona.linkedinUrl} target="_blank" rel="noopener noreferrer">
    {persona.linkedinUrl}
  </a>
) : null}
```

## Info

### IN-01: Trailing slash in `ARCPEDIA_BASE_URL` produces a malformed double-slash search URL

**File:** `src/lib/arcpedia.ts:36`
**Issue:** `const url = \`${ARCPEDIA_BASE_URL}/api/wiki/search?q=...\`` assumes no trailing slash. `.env.example` documents `ARCPEDIA_BASE_URL=https://arcpedia.arclumen.de` (no trailing slash), but nothing prevents an operator from adding one, producing `https://arcpedia.arclumen.de//api/wiki/search?...`. Most servers normalize this, but it's an easy, silent misconfiguration.
**Fix:** Strip a trailing slash before use: `const ARCPEDIA_BASE_URL = (env.ARCPEDIA_BASE_URL ?? 'https://arcpedia.arclumen.de').replace(/\/$/, '');`

### IN-02: Zero observability into Arcpedia integration health

**File:** `src/lib/arcpedia.ts:46-63`
**Issue:** Every failure path — non-2xx response, schema mismatch, network error, timeout — returns `[]` with no signal emitted anywhere. The comment correctly notes the *caught exception* must never be logged (could leak the CF-Access secret or response body), but the `!res.ok` branch (line 46) is a safe place to log a low-cardinality, non-sensitive signal (e.g. `res.status`) without touching secrets or body content. As written, if the Cloudflare Access Service Token expires or the Arcpedia API changes shape, the feature will silently show "no articles" forever with no way to detect the regression from logs/metrics.
**Fix:** Log (or increment a metric for) `res.status` in the `!res.ok` branch only — never the response body or the caught error object.

### IN-03: `humanizeEnum`, `dateFormatter`, and `FirmographicField` duplicated verbatim across both detail components

**File:** `src/components/companies/company-detail.tsx:12-33`, `src/components/personas/persona-detail.tsx:10-31`
**Issue:** These three helpers are byte-for-byte identical in both files (pre-existing, not introduced by this phase, but present in both files under review). Now that `src/lib/arcpedia.ts` establishes a shared-module precedent for this codebase, it's a natural point to extract these into a shared module (e.g. `src/lib/format.ts`) rather than let the duplication grow as more detail panes are added.
**Fix:** Extract to `src/lib/format.ts` and import from both components.

---

_Reviewed: 2026-07-24T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
