---
phase: 02-company-explorer
reviewed: 2026-07-23T00:00:00Z
depth: standard
files_reviewed: 35
files_reviewed_list:
  - data/seed/companies.csv
  - data/seed/company_persona_roles.csv
  - data/seed/personas.csv
  - data/seed/signals.csv
  - src/app/companies/[id]/page.tsx
  - src/app/companies/layout.tsx
  - src/app/companies/loading.tsx
  - src/app/companies/page.tsx
  - src/app/globals.css
  - src/app/layout.tsx
  - src/components/companies/company-detail.tsx
  - src/components/companies/company-filters.tsx
  - src/components/companies/company-list.tsx
  - src/components/companies/company-search-input.tsx
  - src/components/companies/signal-badge.tsx
  - src/components/layout/app-sidebar.tsx
  - src/components/layout/sidebar-resize-handle.tsx
  - src/components/ui/badge.tsx
  - src/components/ui/button.tsx
  - src/components/ui/input.tsx
  - src/components/ui/scroll-area.tsx
  - src/components/ui/select.tsx
  - src/components/ui/separator.tsx
  - src/components/ui/sheet.tsx
  - src/components/ui/sidebar.tsx
  - src/components/ui/skeleton.tsx
  - src/components/ui/table.tsx
  - src/components/ui/tooltip.tsx
  - src/hooks/use-mobile.ts
  - src/lib/db/queries/companies.ts
  - src/lib/db/queries/companyPersonaRoles.ts
  - src/lib/db/schema.ts
  - src/lib/utils.ts
  - src/lib/validation/seed.ts
  - src/scripts/seed.ts
findings:
  critical: 0
  warning: 6
  info: 3
  total: 9
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-07-23T00:00:00Z
**Depth:** standard
**Files Reviewed:** 35
**Status:** issues_found

## Summary

Reviewed the Company Explorer feature: Next.js App Router pages, the master-detail company list/detail components, filter/search inputs, the sidebar (including a hand-rolled resize handle), Drizzle query layer, CSV seed validation (Zod), and the seed script. Auth gating (`requireStaffAccess`) is applied consistently at both the layout and page level as documented, and the query layer correctly uses Drizzle's parameterized builders (no raw SQL string interpolation, no SQL injection surface) for `ilike`/`eq`/`exists` filters. shadcn UI primitives are unmodified boilerplate and were reviewed at reduced scrutiny per the task brief.

No Critical/security-severity issues were found. The main problems are: an inconsistently-applied "fail toward known-good UI" error-handling convention (the project's own documented pattern is only partially applied — some DB calls that can throw are left unguarded while sibling calls in the same component are wrapped), a route param that isn't validated strictly enough before hitting the DB, an uncontrolled search input that can desync from URL state, a seed script whose partial-insert behavior contradicts its own code comment, and some code duplication of a `humanizeEnum` helper across three components.

## Warnings

### WR-01: `CompanyDetail` fetch calls are unguarded, unlike sibling `CompanyList`

**File:** `src/components/companies/company-detail.tsx:35,42-45`
**Issue:** `getCompanyById`, `listSignalsForCompany`, and `listPersonasForCompany` are called with no `try/catch`. `CLAUDE.md`'s documented Error Handling convention (and the sibling `company-list.tsx:36-55`, which explicitly wraps its own DB call for this reason) requires that any failure of an external/DB call "fail safe, fail silent, fail toward a known-good UI state" rather than surface a 500. If the DB call in `CompanyDetail` throws (network blip, connection pool exhaustion, etc.), the whole Server Component throws unhandled, and the user gets Next.js's generic error boundary instead of the "Couldn't load companies"-style fallback used elsewhere in this same feature.
**Fix:**
```tsx
let company;
try {
  company = await getCompanyById(id);
} catch {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
      <p className="text-[18px] font-semibold text-slate-900">Couldn't load this company</p>
      <p className="text-sm text-slate-500">Something went wrong fetching this data. Try refreshing the page.</p>
    </div>
  );
}
if (!company) notFound();
```
Wrap the `Promise.all([listSignalsForCompany(id), listPersonasForCompany(id)])` call the same way, or fold it into the same try block.

### WR-02: `CompanyList`'s per-row signal fetch is outside the try/catch that guards the rest of the component

**File:** `src/components/companies/company-list.tsx:37-55,96-104`
**Issue:** `listCompanies(filters)` is wrapped in `try/catch` (lines 37-55) specifically to satisfy the "fail toward known-good UI" convention referenced in the comment on line 33. But the subsequent `Promise.all(companies.map(... listSignalsForCompany ...))` (lines 98-104) is a second, independent set of DB calls that is not covered by any error handling. If any one of those calls throws, the component throws unhandled past the earlier guard, defeating the purpose of the try/catch above it.
**Fix:** Extend the existing try/catch to cover the whole data-fetching sequence (company list + per-row signals), or wrap the `Promise.all` in its own try/catch with the same fallback UI.

### WR-03: Company detail route accepts non-integer numeric ids, risking a raw DB error instead of a 404

**File:** `src/app/companies/[id]/page.tsx:46-49`
**Issue:** `const companyId = Number(id); if (Number.isNaN(companyId)) notFound();` only rejects non-numeric strings. `Number("1.5")` is `1.5` (not `NaN`), `Number("1e2")` is `100`, and both pass this guard. `company.id` is a Postgres `serial`/`integer` column; binding a non-integer value (e.g. `1.5`) as a query parameter for `eq(company.id, 1.5)` in `getCompanyById` (`src/lib/db/queries/companies.ts:59-62`) can produce a raw driver/Postgres type error rather than a graceful 404, and that error is also unguarded per WR-01.
**Fix:**
```ts
const companyId = Number(id);
if (!Number.isInteger(companyId) || companyId <= 0) {
  notFound();
}
```
(Also apply the same fix if this parsing logic is duplicated elsewhere.)

### WR-04: `CompanySearchInput` is an uncontrolled input that can desync from the URL-driven `search` state

**File:** `src/components/companies/company-search-input.tsx:16-24`
**Issue:** The `<Input>` uses `defaultValue={search}` with an `onChange` handler, making it an uncontrolled input whose displayed text is only set once, at mount. If the `search` query-state value ever changes by a route other than this input's own `onChange` — browser back/forward navigation to a different `?search=` value, a future "clear all filters" action, or a shared/bookmarked URL loaded while this component is already mounted client-side — the visible textbox will not update to reflect the new state, showing stale text while the actual filtered results (server-rendered from the real `search` param) change underneath it.
**Fix:** Make the input controlled against the nuqs state:
```tsx
<Input
  placeholder="Search companies..."
  value={search}
  onChange={(e) => setSearch(e.target.value || null, { limitUrlUpdates: ... })}
/>
```

### WR-05: `seed.ts` deletes and inserts are not transactional, contradicting the code's own "never a partial insert" comment

**File:** `src/scripts/seed.ts:75-157`
**Issue:** The comment at lines 75-78 states "a malformed row anywhere fails the whole run with a descriptive error, never a partial insert or a raw Postgres exception surfacing to the caller." CSV shape/enum validation (via Zod) does happen up front for all four files, but cross-file referential integrity (a `company_name` in `signals.csv` or `company_persona_roles.csv` that doesn't match any row in `companies.csv`) is only checked inside the insert loops (lines 119-125, 136-148), which run *after* all `company` and `persona` rows have already been inserted (lines 93-117). If `signals.csv` references an unknown company, the thrown error leaves `company`/`persona` rows committed with no `signal`/`company_persona_role` rows — a real partial insert, exactly what the comment claims cannot happen. None of the deletes or inserts are wrapped in a transaction.
**Fix:** Wrap the delete+insert sequence in a single `db.transaction(async (tx) => { ... })` so a thrown error anywhere rolls back the entire run, or move the FK-reference validation (company_name/persona_name existence) into the up-front validation pass before any DB write begins.

### WR-06: `humanizeEnum` is duplicated verbatim across three files

**File:** `src/components/companies/company-detail.tsx:11-17`, `src/components/companies/company-filters.tsx:16-21`, `src/components/companies/company-list.tsx:18-24`
**Issue:** The identical slug-to-title-case helper is copy-pasted in three components. This is exactly the kind of drift risk `src/lib/utils.ts` exists to prevent — a future change to the humanization rule (e.g. handling an acronym like "GBS" specially) has to be applied in three places, and it's easy to update two and miss the third.
**Fix:** Move the function to `src/lib/utils.ts` and import it in all three call sites:
```ts
// src/lib/utils.ts
export function humanizeEnum(value: string | null | undefined): string {
  if (!value) return '—';
  return value.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
```

## Info

### IN-01: `dateFormatter` in `CompanyDetail` doesn't pin a timezone for date-only values

**File:** `src/components/companies/company-detail.tsx:19-23,97`
**Issue:** `signal.detectedAt` is a Drizzle `date()` column (default string mode, `'YYYY-MM-DD'`). `new Date('2026-01-15')` parses as UTC midnight; formatting it with `Intl.DateTimeFormat` without an explicit `timeZone` uses the runtime's local timezone. On any host with a negative UTC offset (e.g. US timezones), this can display one calendar day earlier than the stored `detected_at` value. Currently low-impact if the deployment runtime's `TZ` is UTC, but it's environment-dependent and will silently misbehave if that assumption ever changes (e.g. local `next dev` on a US machine, a different hosting region).
**Fix:** `new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })`, or parse the date string manually instead of routing it through the local-timezone-sensitive `Date` constructor.

### IN-02: `getCompanyByName` is unused dead code

**File:** `src/lib/db/queries/companies.ts:52-55`
**Issue:** `getCompanyByName` is exported but has no callers anywhere in `src/` (verified via grep). `src/scripts/seed.ts` builds its own `companyNameToId` map from the freshly-inserted rows instead of calling it. It may be intended for a future phase, but as written it's unreferenced code.
**Fix:** Remove it if genuinely unused, or add a comment noting which upcoming phase/plan will consume it (matching the project's convention of explaining non-obvious decisions).

### IN-03: `sidebar_width` cookie is written without `SameSite`/`Secure` attributes

**File:** `src/components/layout/sidebar-resize-handle.tsx:45`
**Issue:** `document.cookie = \`${COOKIE_NAME}=${finalWidth}; path=/; max-age=${COOKIE_MAX_AGE}\`` sets a non-`HttpOnly` preference cookie with no `SameSite` or `Secure` attribute. The value itself is a bounds-checked number (`Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, ...))`) so there's no injection surface here, and impact is minimal since this is only a layout preference, not an auth/session cookie — but it's inconsistent with `src/components/ui/sidebar.tsx:85`'s own `sidebar_state` cookie, which has the same gap, and best practice is to set `SameSite=Lax` explicitly rather than rely on browser defaults.
**Fix:** `document.cookie = \`${COOKIE_NAME}=${finalWidth}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax\`;`

---

_Reviewed: 2026-07-23T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
