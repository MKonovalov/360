---
phase: 03-persona-explorer
reviewed: 2026-07-23T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - data/seed/company_persona_roles.csv
  - data/seed/personas.csv
  - src/app/personas/[id]/page.tsx
  - src/app/personas/layout.tsx
  - src/app/personas/loading.tsx
  - src/app/personas/page.tsx
  - src/components/layout/app-sidebar.tsx
  - src/components/personas/persona-detail.tsx
  - src/components/personas/persona-filters.tsx
  - src/components/personas/persona-list.tsx
  - src/components/personas/persona-search-input.tsx
  - src/lib/db/queries/companyPersonaRoles.ts
  - src/lib/db/queries/personas.ts
  - src/lib/db/schema.ts
  - src/lib/params/personaFilters.ts
  - src/lib/validation/seed.ts
  - src/scripts/seed.ts
findings:
  critical: 0
  warning: 9
  info: 4
  total: 13
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-07-23T00:00:00Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Fresh full-scope re-review after gap-closure plan 03-04. Verified both prior gaps against the actual diff (`94a4154e`, `085010f9`) and the current file contents, not just the commit messages:

- **CR-01 ("Has signals" filter no-op) is genuinely resolved.** `src/lib/db/queries/personas.ts` now branches on `filters.hasSignals === true` (→ `exists(...)`), `=== false` (→ `not(exists(...))`), and `undefined` (→ no filter), reusing a single `hasSignalsExistsSubquery`. The new shared `src/lib/params/personaFilters.ts` correctly parses the tri-state from the raw query param (`'true'` → `true`, `'false'` → `false`, anything else → `undefined`) instead of the old collapsing `=== 'true'` check. `persona-list.tsx`'s `hasActiveFilters` was also updated to `filters?.hasSignals !== undefined`, so an explicit "No" that matches zero rows now shows the correct "No personas match your filters" copy instead of the "no data seeded" copy. Traced end-to-end from `PersonaFilters` → URL param → `parsePersonaFilters` → `listPersonas` → SQL — no gaps found.
- **IN-02 (duplicated `parsePersonaFilters`) is genuinely resolved.** Both `src/app/personas/page.tsx` and `src/app/personas/[id]/page.tsx` now import the single implementation from `src/lib/params/personaFilters.ts`; the old per-page copies are gone.
- Diffed the two fix commits directly against `HEAD` and confirmed **no other file was touched** by the gap-closure work — every other finding from the prior review (`WR-01`..`WR-09`, `IN-01`, `IN-03`..`IN-05`) was re-verified against the current file contents below and remains present, unchanged, at (approximately) the same locations. IDs and content are preserved from the prior review for traceability; line numbers have been corrected where they drifted.

No new issues were introduced by the gap-closure change itself.

## Warnings

### WR-01: PersonaList's per-row fetch failure is not caught, contradicting its own "never throw a 500" comment

**File:** `src/components/personas/persona-list.tsx:99-105`
**Issue:** The component wraps only the initial `listPersonas(filters)` call in `try/catch` (lines 35-53), with a comment stating "a Neon fetch failure must degrade to known-good UI copy, never a thrown 500." But the subsequent per-row `listCompanyRolesForPersona` calls inside `Promise.all` (lines 99-105) run **outside** that try/catch. A transient DB failure between the two calls propagates as an unhandled rejection instead of the "Couldn't load personas" fallback UI.
**Fix:** Wrap the whole fetch pipeline (initial query + per-row enrichment) in one try/catch, or catch errors from the `Promise.all` separately and fall back to the same error UI.

### WR-02: PersonaDetail has no error handling for DB failures, and no `error.tsx` boundary exists anywhere in the app

**File:** `src/components/personas/persona-detail.tsx:32-40`
**Issue:** `getPersonaById(id)` and `listCompanyRolesForPersona(id)` are called with no try/catch. No `error.tsx`/`global-error.tsx` exists under `src/app` (still true — none was added by 03-04). Any thrown DB error here renders Next.js's default, unstyled error page rather than the "known-good UI state" pattern the rest of the codebase (and `CLAUDE.md`'s Error Handling guidance) establishes. `CompanyDetail` has the same gap, so this is a pre-existing, replicated pattern rather than new — still worth closing given it's directly reachable by clicking any persona.
**Fix:** Either add an `src/app/personas/[id]/error.tsx` boundary with the same "Couldn't load this persona" copy used elsewhere, or wrap the fetches in try/catch and render a fallback state.

### WR-03: `personaId` validation only checks `NaN`, letting non-integer/`Infinity` values through to the DB layer

**File:** `src/app/personas/[id]/page.tsx:27-30`
**Issue:**
```ts
const personaId = Number(id);
if (Number.isNaN(personaId)) {
  notFound();
}
```
`Number('1.5')` and `Number('Infinity')` are not `NaN`, so both pass this guard and are forwarded to `getPersonaById`/`listCompanyRolesForPersona` as the `id` param. `persona.id` is a Postgres integer column; a non-integer or `Infinity` parameter is likely to throw at the driver/DB level rather than simply matching zero rows — and (per WR-02) nothing catches that, so a malformed URL like `/personas/1.5` or `/personas/Infinity` yields a raw error page instead of the expected 404.
**Fix:** Use `Number.isInteger(personaId)` (and reject negatives) instead of `Number.isNaN`:
```ts
if (!Number.isInteger(personaId) || personaId < 1) {
  notFound();
}
```

### WR-04: No `ORDER BY` on career-history queries, and no DB constraint prevents multiple `isCurrent = true` rows per persona

**File:** `src/lib/db/queries/companyPersonaRoles.ts:22-39`, `src/lib/db/schema.ts:90-98`
**Issue:** Neither `listPersonasForCompany` nor `listCompanyRolesForPersona` has an `ORDER BY` clause. SQL does not guarantee row order without one, so the "Career History" list in `persona-detail.tsx:91-105` renders in whatever order Postgres happens to return rows — not necessarily chronological, and not guaranteed stable across query plans. Separately, `companyPersonaRole` has no unique/partial-unique constraint (or CHECK) ensuring at most one `isCurrent = true` row per persona. If seed/enrichment data (or a future write path) ever produces two current rows for the same persona, `roles.find((r) => r.role.isCurrent)` (`persona-detail.tsx:42`, `persona-list.tsx:102`) will silently pick whichever one the unordered query happens to return first. (Current seed data has at most one `isCurrent` row per persona, so this is latent, not yet triggered.)
**Fix:** Add `.orderBy(desc(companyPersonaRole.startDate))` (or similar) to both queries, and add a partial unique index in the schema, e.g. `UNIQUE (persona_id) WHERE is_current`, to make "at most one current role" an enforced invariant rather than an assumption.

### WR-05: Seed script's role-insert loop is not transactional, and referential-integrity checks happen after "all validation" is claimed complete

**File:** `src/scripts/seed.ts:65-168`
**Issue:** The comment at lines 75-78 states "All four files are validated above before any DB connection is opened or any row is inserted... never a partial insert." In reality, only *shape* validation (Zod schemas) happens upfront. The `company_name`/`persona_name` **reference** checks (lines 126-131, 145-154) happen lazily, one row at a time, *during* the insert loop — after companies, personas, and signals have already been committed to the DB (no transaction wraps `main()`). If row *N* out of *M* in `company_persona_roles.csv` references an unknown company/persona, the script throws and exits, but rows `1..N-1` are already inserted and rows `N..M` are not — leaving a partially-seeded, inconsistent dataset despite the delete-first cleanup pattern implying idempotent/atomic re-runs.
**Fix:** Either wrap `main()`'s inserts in a single DB transaction (roll back entirely on any error), or pre-validate all cross-file name references (build the name→row maps and check every `company_name`/`persona_name` reference across all four files) before starting any insert.

### WR-06: Unsanitized `seniority` filter value passed straight to the DB, producing a misleading generic error for a bad query param

**File:** `src/lib/db/queries/personas.ts:59-61`, `src/components/personas/persona-filters.tsx:23-26`
**Issue:**
```ts
filters.seniority
  ? eq(persona.seniority, filters.seniority as (typeof seniorityEnum.enumValues)[number])
  : undefined,
```
`filters.seniority` originates from the raw `searchParams` (`?seniority=...`), not from the `Select`'s constrained option list — the type assertion performs no runtime check. An edited/typo'd URL such as `?seniority=intern` will fail as an invalid Postgres enum literal, which `PersonaList`'s catch-all (`persona-list.tsx:35-53`) then reports as the generic "Couldn't load personas / Something went wrong fetching this data" — misleading for what is really just an invalid filter value, not a data-fetch failure. Additionally, `persona-filters.tsx:23-26`'s comment claims "this is the single source of truth that keeps a tampered/invalid query-param value from ever reaching the Drizzle WHERE clause" — that guarantee is not actually enforced anywhere in the query layer (`listPersonas` has no validation of its own), so the comment overstates what the code does. (The identical pattern exists in `src/lib/db/queries/companies.ts` for `revenueBand`/`ownershipType`/`signalType`, so this is a pre-existing codebase-wide pattern, not novel to Phase 3 — still worth fixing.)
**Fix:** Validate `filters.seniority` against `seniorityEnum.enumValues` inside `listPersonas` (or `parsePersonaFilters`) and silently drop/ignore invalid values instead of forwarding them to Postgres; correct the comment to reflect that validation must happen at the query layer, not just in the UI's option list.

### WR-07: `PersonaSearchInput` is an uncontrolled input that won't resync with external navigation changes

**File:** `src/components/personas/persona-search-input.tsx:16-24`
**Issue:** The `<Input>` uses `defaultValue={search}` with no `value`/`key` tying it to the `search` state. `defaultValue` only sets the *initial* value on mount; if the `search` URL param changes from outside this component's own `onChange` (browser back/forward navigation, a future "clear filters" link, etc.), the visible text stays stale while the underlying results have already updated to match the new URL.
**Fix:** Either make the input controlled (`value={search}` with local state synced via `useEffect`), or key the input on `search` (`key={search}`) so navigation forces a remount with the new value.

### WR-08: `dateFormatter` has no explicit `timeZone`, risking an off-by-one-day display for date-only values

**File:** `src/components/personas/persona-detail.tsx:17-21, 98-102`
**Issue:** `new Date(role.startDate)` parses a plain `YYYY-MM-DD` string as UTC midnight. `dateFormatter` (`Intl.DateTimeFormat('en-US', {...})`) has no `timeZone` set, so it formats using the runtime's local timezone. In any runtime whose local offset is behind UTC, this renders the *previous* calendar day (e.g. `2024-01-01` → "Dec 31, 2023"). This is a Server Component so the practical impact depends on the server's configured timezone, but the code is not defensively correct regardless of deployment environment.
**Fix:** Pass `timeZone: 'UTC'` explicitly in the `Intl.DateTimeFormat` options, or parse the date-only string into a UTC-anchored `Date` before formatting.

### WR-09: `linkedin_url` is validated only against CSV-formula-injection prefixes, not as an actual URL — no guard against `javascript:` scheme values

**File:** `src/lib/validation/seed.ts:24-28, 90-108`, `src/components/personas/persona-detail.tsx:129-140`
**Issue:** `linkedin_url` uses `optionalSafeCsvString`, which only rejects values starting with `= + - @ \t \r`. It is not validated as an `http(s)://` URL. `persona-detail.tsx` then renders it directly: `<a href={persona.linkedinUrl} target="_blank" rel="noopener noreferrer">`. `rel="noopener noreferrer"` does not neutralize a `javascript:` URI — clicking such a link would execute script in the signed-in staff user's session. Today's seed data is internally authored and trusted, so this isn't currently exploitable, but nothing in the schema or validation layer stops a `javascript:...` value from being stored and rendered as a clickable link if this field is ever populated by a less-trusted source (the project's stated roadmap includes future enrichment-API writes).
**Fix:** Validate `linkedin_url` as a proper URL and restrict the scheme, e.g. `z.url({ protocol: /^https?$/ })` (or equivalent), rejecting anything that isn't `http`/`https`.

## Info

### IN-01: `humanizeEnum` duplicated verbatim across three new files

**File:** `src/components/personas/persona-detail.tsx:9-15`, `src/components/personas/persona-list.tsx:17-23`, `src/components/personas/persona-filters.tsx:16-21`
**Issue:** The same slug-to-title-case helper is copy-pasted three times in this phase alone (and again mirrored in the pre-existing `components/companies/*` equivalents). Any future change to the humanization rule requires updating up to six call sites in sync. Not addressed by the 03-04 gap-closure pass (only `parsePersonaFilters`/IN-02 was consolidated).
**Fix:** Extract to a shared `src/lib/format.ts` (or similar) and import from all call sites.

### IN-02 (RESOLVED): `parsePersonaFilters`/`firstValue` duplication

**File:** `src/lib/params/personaFilters.ts` (new), `src/app/personas/page.tsx`, `src/app/personas/[id]/page.tsx`
**Status:** Fixed by plan 03-04 (`085010f9`). Both route files now import a single `parsePersonaFilters`/`firstValue` implementation from `src/lib/params/personaFilters.ts`; the previously-duplicated per-page copies were removed. Verified via `git show` that both `page.tsx` files were edited in the same commit that added the shared module, and no other implementation of this logic remains in the codebase. No further action needed.

### IN-03: `getPersonaByName` is dead code

**File:** `src/lib/db/queries/personas.ts:94-99`
**Issue:** The comment says it exists "to resolve a CSV row's plain-text persona_name to a generated serial id during seeding," but `src/scripts/seed.ts` builds and uses its own `personaNameToId` `Map` instead (lines 110-123 of `seed.ts`) and never calls this function. Confirmed via repo-wide grep — zero callers outside its own declaration.
**Fix:** Either remove the unused export, or refactor `seed.ts` to use it (removing the duplicate map-building logic) if it was meant to be the intended implementation.

### IN-04: `persona-list.tsx` renders `title` with no null fallback, inconsistent with `persona-detail.tsx`

**File:** `src/components/personas/persona-list.tsx:142`
**Issue:** `<TableCell>{persona.title}</TableCell>` renders nothing (a blank cell) when `title` is `null`, whereas `persona-detail.tsx:59` and other fields consistently use `?? '—'` for the same nullable column. Minor UI inconsistency — a blank table cell reads as a loading/rendering glitch rather than "no data."
**Fix:** `<TableCell>{persona.title ?? '—'}</TableCell>`.

### IN-05: Literal `%`/`_` in a search term act as unintended ILIKE wildcards

**File:** `src/lib/db/queries/personas.ts:40-58`
**Issue:** `filters.search` is interpolated into the pattern string (`` `%${filters.search}%` ``) before being passed as a parameterized value to `ilike`. This is not a SQL-injection risk (values are still parameterized), but a user typing `%` or `_` in the search box gets ILIKE wildcard behavior rather than a literal match, which can produce surprising result sets.
**Fix:** Escape `%`, `_`, and `\` in `filters.search` before building the pattern (e.g. `value.replace(/[%_\\]/g, '\\$&')`), if literal-match behavior is desired.

---

_Reviewed: 2026-07-23T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
