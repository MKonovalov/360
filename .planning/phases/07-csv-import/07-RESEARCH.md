# Phase 7: CSV Import - Research

**Researched:** 2026-07-30
**Domain:** CSV bulk-import wizard (upload → map → validate/preview → confirm → commit) with dedup/upsert and rollback, on Next.js 16 App Router + Drizzle + Neon Postgres, zero prior Route Handlers/file-upload/multi-step-wizard precedent in this codebase
**Confidence:** HIGH for codebase-integration findings (all read directly from source), HIGH for Next.js/Postgres/Drizzle platform facts (verified against current official docs + WebSearch), MEDIUM for the specific column/enum-value alias dictionaries (necessarily a project-specific judgment call, not verifiable against any external source)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Dedup key & domain field**
- D-01: Add `company.domain` as a **nullable** text column (new migration). Existing 9 seed companies stay `domain = null` — no backfill required, no migration risk.
- D-02: Domain matching is **normalized** (lowercase, strip protocol, strip `www.`, strip trailing slash) before comparison — not raw string equality.
- D-03: A Company CSV row with a **blank domain cell always inserts as a new company** — no dedup fallback to name matching.
- D-04: A Persona CSV row with a **blank email cell always inserts as a new persona** — same no-fallback-key rule as D-03.

**Import file scope**
- D-05: One upload = one entity type. Company-list Import accepts only a Companies CSV; Persona-list Import accepts only a Personas CSV. No auto-detection, no combined-file mode.
- D-06: Persona CSV rows **cannot** create or update `company_persona_role` links in this phase.
- D-07: The wizard accepts **exactly one file per import run**. No multi-file batch upload.
- D-08: Column mapping is **not persisted** across imports. Auto-map by header-name match every run; no mapping-profile storage.

**Update-on-match semantics**
- D-09: When a CSV row matches an existing record, mapped fields **fully overwrite** the existing value (staff-authoritative — different trust tier from Phase 8's enrichment policy).
- D-10: A **blank cell in a mapped column on a matched row leaves the existing field untouched** — the one exception to D-09's full overwrite.
- D-11: No `data_source`/provenance column is added in this phase (Phase 8's responsibility).
- D-12: The preview/validate step (before commit) shows counts of rows that will be **created vs. updated vs. errored** — not just an after-the-fact summary.

**Rollback mechanics**
- D-13: Rollback **undoes creates only** — deletes rows this batch created. Rows the batch *updated* keep their new values; no field-level revert, no before/after snapshots stored.
- D-14: If a created row now has dependent data (a Signal or `company_persona_role` pointing at it), rollback **skips that row**, reporting "not rolled back — has dependent data."
- D-15: Staff can roll back **any past import batch** from logged history, not just the most recent. Rollback only affects rows from that batch still in original created-and-untouched state.
- D-16: Rollback requires an explicit **confirmation step** showing what will be affected before executing.

### Claude's Discretion
- Exact wizard step count/UI flow (upload → map → preview/validate → confirm → commit shape is established; exact component composition is this research/planning's call).
- `import_batch`/`import_log` schema shape (columns, indexes) needed to support D-15's per-row created-and-untouched tracking.
- Whether `csv-parse` moves from `devDependencies` to `dependencies` (must be verified/fixed regardless).
- Exact Zod schema reuse/extension from `src/lib/validation/seed.ts` for partial-commit validation (new aggregation function, not a full rewrite).
- Error-report format for invalid rows (inline table vs. downloadable CSV) — left to planning.

### Deferred Ideas (OUT OF SCOPE)
- Persona-to-Company role/career-history import via CSV (D-06) — future phase/enhancement.
- Persisted column-mapping profiles (D-08) — possible v2 refinement.
- Multi-file batch import (D-07) — possible future convenience.
- Fuzzy/probabilistic dedup matching (project-wide anti-feature, per REQUIREMENTS.md Out of Scope table) — exact-match on normalized key only.
- In-wizard CSV transformation/formula engine — CSV shape is controllable at the source.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IMPT-01 | Staff can upload a CSV file for Companies or Personas via Menu → Import | See "File Upload Architecture" (Server Action + FormData, no Route Handler needed) and "Wizard Entry Point" (dedicated route page, `ExplorerMenu` `href` extension) |
| IMPT-02 | Import wizard auto-detects column-to-field mapping with manual override, including enum-value mapping | See "Column & Enum-Value Auto-Mapping" — alias-dictionary approach, concrete code shape |
| IMPT-03 | Import validates rows before commit and supports partial commit — valid rows imported, invalid rows reported with row number and reason | See "CSV Parsing/Validation Extension" — new `partitionRows` function alongside (not replacing) `seed.ts`'s `validateRows` |
| IMPT-04 | Import dedups against existing records using a stable key (`company.domain`; `persona.email`) | See "Dedup Key & Upsert Semantics" — normalization functions, `onConflictDoUpdate` precedent, unique-constraint-with-nullable-column verification |
| IMPT-05 | Import shows a summary on completion — counts created, updated, skipped/errored | See "Wizard State & Data Flow" — `import_batch` row carries these counts, computed at validate time and finalized at commit time |
| IMPT-06 | Staff can download a CSV template pre-filled with valid enum values, generated from the schema | See "CSV Template Generation" — `csv-stringify`, reads directly from `*Enum.enumValues` |
| IMPT-07 | Import history is logged (who imported what, when) with rollback capability | See "`import_batch`/`import_log` Schema Design" and "Rollback Mechanics" — concrete table shape, dependent-row check, FK-constraint-as-defense-in-depth |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

**Important discrepancy to flag for the planner:** `CLAUDE.md`'s `## Technology Stack` / `## Conventions` / `## Architecture` sections describe the **pre-migration Astro + Sanity codebase** (references `.astro` files, `@astrojs/vercel`, `@sanity/client`, Node 20 pinned adapter runtime, etc.). This is stale — `.planning/STATE.md` and `.planning/PROJECT.md` confirm the Astro→Next.js/Sanity→Neon migration described in `CLAUDE.md`'s top-level `## Project` → `### Constraints` section has **already shipped** (v1.0). Direct codebase inspection this session confirms: Next.js 16.2.11 App Router, Drizzle ORM 0.45.2, Neon Postgres via `@neondatabase/serverless`, Clerk via `@clerk/nextjs` 7.5.22, zero `.astro` files anywhere. **Follow the verified current codebase state (this document, `.planning/research/ARCHITECTURE.md`, `.planning/PROJECT.md`), not `CLAUDE.md`'s Technology Stack narrative, which is a leftover artifact from before the migration.**

Directives from `CLAUDE.md` that ARE still current and binding for this phase:
- **Node 22.x** engine pin (`package.json` `engines.node: "22.x"`) — no adapter-runtime mismatch exists anymore (that was Astro/Vercel-adapter-specific and no longer applies).
- **Reuse existing Clerk integration** — `requireStaffAccess()` (`src/lib/auth/requireStaffAccess.ts`) is the single gating function; every new Server Action this phase adds must call it first, unconditionally (established belt-and-suspenders convention, confirmed live in `src/app/actions.ts`, `src/app/companies/page.tsx`).
- **Same Vercel project/domain** — no new deployment target for this phase.
- **GSD Workflow Enforcement** — all implementation must go through `/gsd-execute-phase`, not direct edits.
- **camelCase, named exports only** (no default exports except Next.js page/layout/route files), **`interface` over `type`** for object shapes, **single quotes + semicolons + 2-space indent**, **comments explain why not what** — all confirmed still actively followed in every file read this session (`schema.ts`, `companies.ts`, `seed.ts`, `explorer-menu.tsx`).
- **Fail-safe/fail-silent for read paths, but this phase is a deliberate exception** — `ARCHITECTURE.md` (already-authoritative research) explicitly calls out that Import is a staff-initiated *write* path and must surface structured per-row errors, not swallow them silently like `arcpedia.ts`. Confirmed still correct against current code.

## Summary

This phase adds a five-step wizard (upload → map → validate/preview → confirm/commit → done) plus a rollback-capable import-history view, reusing this codebase's existing Zod row schemas (`src/lib/validation/seed.ts`) and Drizzle query-layer conventions rather than inventing new patterns. Three genuinely new architectural elements land in this phase: (1) the first CSV **upload** to reach production code (Server Action + `FormData`, not a Route Handler — verified against current Next.js 16 docs, default 1MB body limit needs raising via `experimental.serverActions.bodySizeLimit`); (2) the first multi-step client wizard with state that must survive across several Server Action round-trips (resolved by making the DB row — a new `import_batch` table — the source of truth between steps, not by round-tripping large payloads through client state); (3) the first `onConflictDoUpdate` **read-modify-write with partial-field semantics** (D-09/D-10's "full overwrite except blank leaves untouched" cannot be expressed as a single SQL `ON CONFLICT` clause and needs an explicit select-then-conditionally-merge step).

Everything else is a direct, low-risk extension of already-proven patterns in this exact codebase: `onConflictDoUpdate` already has a working precedent (`recordView` in `src/lib/db/queries/recentlyViewed.ts`, Phase 6), the polymorphic `recordId` (no-FK, integer + discriminator enum) pattern used by `recentlyViewed` is directly reusable for `import_log`'s row tracking, and Postgres's own well-documented "NULL is never equal to NULL" unique-index semantics mean `company.domain`'s nullable-with-unique-constraint requirement (D-01/D-03) needs no special partial-index trick — a plain `unique()` constraint (exactly like `recentlyViewed`'s existing composite one) does the right thing for free.

**Primary recommendation:** Build the wizard as a dedicated route (`/companies/import`, `/personas/import`) rather than a dialog/sheet overlay — the wizard's mapping table + preview table + error report need real page real estate, and this matches every other master-detail navigation pattern already in the app (`Link`-based, not overlay-based). Store per-batch wizard state (raw CSV text, finalized mapping, validated rows, counts) in a new `import_batch` DB row keyed by a `batchId`, so client-side state only needs to carry the batch id and small UI-only selections between steps — never re-round-tripping the full parsed dataset through the 1MB-capped Server Action body on every step.

## Architectural Responsibility Map

This app has no separate API/Backend tier — Server Actions *are* the backend (confirmed: zero `app/api/**/route.ts` Route Handlers exist). The table below maps to this app's actual three-tier shape: Client Component (browser), Server Action (mutation/orchestration), Query Layer (Drizzle, talks to Neon).

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| File selection + wizard step UI/navigation | Browser/Client | — | `'use client'` component holds only `step`, `batchId`, and small UI-only state (selected mapping overrides before submit) — no parsed CSV data ever lives client-side beyond a small preview slice |
| CSV parsing (`csv-parse`) | Server Action | — | Runs server-side only, same as `seed.ts` today; never ship `csv-parse` to the client bundle |
| Column/enum-value auto-mapping suggestion | Server Action | Query Layer (reads enum values from `schema.ts`) | Suggestion logic is pure-function (no DB read needed beyond static enum arrays already imported at module scope) |
| Row validation partitioning (valid/invalid split) | Server Action | — | Zod schemas already live in `src/lib/validation/seed.ts`; this phase adds an aggregation function beside them, still server-only |
| Dedup key normalization (domain/email) | Server Action | Query Layer | Pure functions, callable from both the validate step (predicted counts) and the commit step (actual upsert) — same function, not reimplemented twice |
| Dedup/upsert commit | Query Layer | DB/Storage (unique constraint as enforcement backstop) | `onConflictDoUpdate`-based upsert per D-01–D-04; DB-level unique constraint makes a duplicate-creation bug fail loudly (Pitfall 2) |
| Import history + rollback | Server Action + Query Layer | DB/Storage (FK constraints as last-line-of-defense for D-14) | Rollback preview (dry-run) and rollback execute are two separate Server Action calls, mirroring the wizard's own preview-then-confirm shape |
| CSV template generation | Server Action | — | Reads `*Enum.enumValues` directly from `schema.ts` at request time — can never drift from schema by construction |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `csv-parse` | `^7.0.1` (installed, currently `devDependencies` only) | CSV → row-object parsing | Already the project's chosen CSV parser (`seed.ts`); **must move to `dependencies`** — it will run inside a production Server Action, not just a local `tsx` script [VERIFIED: npm registry, confirmed installed in this repo's `package.json`] |
| `csv-stringify` | `^6.8.1` (not yet installed — same maintainer/ecosystem as `csv-parse`) | Generate the downloadable CSV template (IMPT-06) and optional error-report CSV | Sibling package to `csv-parse` from the same `node-csv` project — consistent CSV-quoting/escaping behavior with the parser already in use, avoids hand-rolling CSV-escaping logic for the template [ASSUMED — package name/purpose from training knowledge, cross-checked against npm registry this session; confirmed to exist and resolve at the stated version, see Package Legitimacy Audit below] |
| `drizzle-orm` | `^0.45.2` (installed) | `onConflictDoUpdate` upsert, `jsonb` columns for `import_batch` | Already the project's ORM; `onConflictDoUpdate` has a working, verified-in-this-repo precedent (`recordView`, Phase 6) [VERIFIED: direct codebase inspection, `src/lib/db/queries/recentlyViewed.ts`] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | `^4.4.3` (installed) | Row validation schemas (already used) | Extend `companyRowSchema` with a `domain` field; add a new partition/aggregation function beside (not replacing) `validateRows` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Server Action + `FormData` for upload | A new Route Handler (`app/api/import/upload/route.ts`) with streaming | Route Handler streaming only pays off for very large files (tens of MB+) with true chunked processing; at this project's realistic CSV scale (low thousands of rows, well under a few MB) a Server Action reading `await file.text()` is simpler, matches `seed.ts`'s existing `readFileSync(...).toString()` approach, and avoids introducing this codebase's first Route Handler in this phase (deferred to Phase 9 per `ARCHITECTURE.md`'s Build Order) |
| Storing wizard state in the `import_batch` DB row between steps | Round-tripping full parsed rows through client `useState` and back to the server on every step call | Round-tripping is the more commonly documented pattern for *stateless, ephemeral* multi-step Server Action wizards, but it re-sends the full CSV payload (headers + all rows) on every one of 3-4 step calls, multiplying bytes against the same `bodySizeLimit` ceiling repeatedly; a DB-row-as-source-of-truth avoids this AND directly produces the persisted import-history record IMPT-07 needs anyway — one mechanism serves both needs |
| `csv-stringify` for template generation | Hand-built string concatenation (`headers.join(',') + '\n' + row.join(',')`) | Hand-rolling is viable for a template because the values are all schema-controlled (safe), but it reintroduces exactly the kind of ad hoc CSV-escaping logic this project has otherwise centralized in `csv-parse`'s options; using the sibling `csv-stringify` package keeps quoting/escaping behavior consistent with the parser already trusted for import |
| Dedicated route page for the wizard (`/companies/import`) | shadcn `Dialog`/`Sheet` overlay triggered from the Menu dropdown | An overlay is a smaller, more "in-context" change (no new route), but the wizard's mapping table + preview table + per-row error list need substantial screen space; a full page matches every other master-detail navigation pattern in this app (`Link`-based `/companies/[id]`) and avoids introducing a new `Dialog` primitive (not yet installed) purely for this one feature |

**Installation:**
```bash
npm install csv-stringify
# Move csv-parse from devDependencies to dependencies:
npm uninstall csv-parse --save-dev && npm install csv-parse
```

**Version verification:** Confirmed via `npm view csv-parse version` → `7.0.1` (matches installed) and `npm view csv-stringify version` → `6.8.1`, both this session.

## Package Legitimacy Audit

`slopcheck` (v0.6.1) was available and run this session (`pip3 install slopcheck --break-system-packages`, already present). **Caution for the planner:** `slopcheck install <pkg>` performs a REAL `npm install` as a side effect, not a dry-run check — this research session ran it, observed the result, and then reverted the resulting `package.json`/`package-lock.json` changes via `git checkout` to avoid making live repo changes during research. **When the planner/implementer runs this same command during actual implementation, that live install is the intended, correct outcome — no revert needed at that point.**

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `csv-parse` | npm | Long-established (part of the `node-csv` project) | High (already installed/trusted in this repo) | github.com/adaltas/node-csv | `[OK]` | Approved — already in use, only changing dependency tier |
| `csv-stringify` | npm | Long-established (same `node-csv` project as `csv-parse`) | High | github.com/adaltas/node-csv | `[OK]` | Approved |

**Packages removed due to slopcheck `[SLOP]` verdict:** none
**Packages flagged as suspicious `[SUS]`:** none

Both packages passed `slopcheck`'s registry-based check and are the same well-known `node-csv` project already trusted in this codebase for `csv-parse`. Per the package-name provenance rule, `csv-stringify`'s specific name/version was recalled from training knowledge and cross-checked via `npm view` (registry existence + version match) this session — tagged `[ASSUMED]` above in the Standard Stack table per protocol (registry existence alone doesn't upgrade an assumed package name to `[VERIFIED]`; it would need confirmation via the package's own official docs/README, which was not separately fetched this session).

## Architecture Patterns

### System Architecture Diagram

```
Browser                          Server Action layer                  Query/DB layer
────────                         ────────────────────                 ──────────────

[File input, step="upload"]
        │  <form action=uploadImportFile>
        ▼
                                  uploadImportFile(entityType, FormData)
                                       │ requireStaffAccess() first
                                       │ file.text() (no Route Handler)
                                       │ csv-parse (bom: true)
                                       │ suggestColumnMapping(headers)
                                       ▼
                                  INSERT import_batch
                                    (rawCsv, status='mapping') ──────►  import_batch row created
                                       │
        ◄──────────────────────────── returns { batchId, headers,
        │                                suggestedMapping, sampleRows }
        ▼
[step="map": mapping table,
 per-enum-column value pickers]
        │  onSubmit(batchId, mapping, valueMapping)
        ▼
                                  validateImportBatch(batchId, mapping,
                                                       valueMapping)
                                       │ requireStaffAccess() first
                                       │ re-read rawCsv from import_batch
                                       │ apply mapping → canonical rows
                                       │ partitionRows() (Zod, per-row)
                                       │ normalizeDomain/normalizeEmail
                                       │ per valid row: predict created
                                       │   vs. updated (SELECT existing
                                       │   dedup keys, IN-list check)
                                       ▼
                                  UPDATE import_batch
                                    (validatedRows jsonb, counts,
                                     errorReport jsonb,
                                     status='validated')
        ◄──────────────────────────── returns { counts, errorReport }
        ▼
[step="preview/confirm": counts,
 error table, "Commit" button]
        │  onClick(batchId)
        ▼
                                  commitImportBatch(batchId)
                                       │ requireStaffAccess() first
                                       │ read validatedRows from batch row
                                       │ per row: upsertCompanyByDomain /
                                       │   upsertPersonaByEmail
                                       │   (onConflictDoUpdate, D-09/D-10
                                       │   blank-untouched merge)
                                       ▼
                                  INSERT/UPDATE company|persona   ────►  company / persona tables
                                  INSERT import_log (per row,           import_log rows
                                    action='created'|'updated')
                                  UPDATE import_batch
                                    (status='committed', final counts)
        ◄──────────────────────────── returns { created, updated, errored }
        ▼
[step="done": summary,
 link to list, link to history]

──────────────────────────────────────────────────────────────────────────────

[Import History page]
        │  GET /companies/import/history
        ▼
                                  listImportBatches(entityType)  ────►  import_batch rows
        │  "Roll back" click on a past batch
        ▼
                                  previewRollback(batchId)
                                       │ import_log WHERE batchId AND
                                       │   action='created'
                                       │ per row: EXISTS dependent
                                       │   signal/companyPersonaRole?
                                       ▼
                                  (read-only — no writes)         ────►  reads signal, companyPersonaRole
        ◄──────────────────────────── returns { willDelete: N,
        │                                skipped: M }
        ▼
[Confirm dialog: "N will be
 deleted, M skipped — has
 dependent data"]
        │  Confirm click
        ▼
                                  executeRollback(batchId)
                                       │ requireStaffAccess() first
                                       │ re-check dependents (race-safe)
                                       │ DELETE company|persona rows
                                       │   with no dependents
                                       │ mark import_log.rolledBackAt
                                       ▼
                                  DELETE company|persona           ────►  company / persona tables
                                  UPDATE import_log, import_batch        (FK RESTRICT is the last-
                                                                          line defense if a row
                                                                          gained a dependent between
                                                                          preview and execute)
```

### Recommended Project Structure

```
src/
├── app/
│   ├── companies/
│   │   └── import/
│   │       ├── page.tsx              # dedicated wizard route, entityType="company"
│   │       └── history/page.tsx      # (or a shared cross-entity history page — planner's call)
│   ├── personas/
│   │   └── import/
│   │       ├── page.tsx              # dedicated wizard route, entityType="persona"
│   │       └── history/page.tsx
│   └── actions/
│       └── import.ts                 # 'use server' — new dedicated Server Action file for this phase
├── components/
│   └── import/
│       ├── import-wizard.tsx         # 'use client', step state machine
│       ├── column-mapping-step.tsx
│       ├── validation-preview-step.tsx
│       └── import-history-table.tsx
├── lib/
│   ├── db/
│   │   ├── schema.ts                 # + company.domain, persona.email unique, import_batch, import_log
│   │   └── queries/
│   │       ├── companies.ts          # + upsertCompanyByDomain
│   │       ├── personas.ts           # + upsertPersonaByEmail
│   │       └── importBatches.ts      # new — CRUD + rollback queries
│   ├── validation/
│   │   ├── seed.ts                   # extend companyRowSchema with domain field (existing file, minimal edit)
│   │   └── csvImport.ts              # new — partitionRows() partial-commit-aware aggregator
│   └── import/
│       ├── dedupKeys.ts              # new — normalizeDomain, normalizeEmail (pure functions)
│       ├── columnMapping.ts          # new — alias dictionaries, suggestColumnMapping/suggestValueMapping
│       └── csvTemplate.ts            # new — generateCompanyTemplate/generatePersonaTemplate (csv-stringify)
```

### Pattern 1: File Upload via Server Action + FormData (no Route Handler)

**What:** A `<form>` (or a Client Component building `FormData` manually) submits a `File` to a Server Action, which reads it with `await file.text()` — no multipart parsing library needed, Next.js handles the `multipart/form-data` boundary itself.

**When to use:** Any file under a few MB, no streaming requirement. This project's realistic CSV volume (per `PITFALLS.md`'s own "unpaginated list queries" performance-trap discussion, scale is currently ~10-20 records, growing to perhaps low hundreds/thousands) is comfortably in this range.

**Example:**
```typescript
// Source: verified against https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions (fetched this session, docs dated 2026-07-22, Next.js version 16.2.12)
// next.config.ts — required change, default body limit is 1MB
const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb', // realistic CSV volume + multipart overhead margin
    },
  },
  // ...existing turbopack root config unchanged
};
```
```typescript
// src/app/actions/import.ts (shape)
'use server';
import { parse } from 'csv-parse/sync';
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';

export async function uploadImportFile(entityType: 'company' | 'persona', formData: FormData) {
  await requireStaffAccess();
  const file = formData.get('file') as File;
  const rawCsv = await file.text();
  // bom: true — real-world staff-exported CSVs (Excel/Google Sheets) commonly
  // carry a UTF-8 BOM; seed.ts's CSVs don't need it but uploaded files might.
  const rows = parse(rawCsv, { columns: true, skip_empty_lines: true, trim: true, bom: true });
  // ...create import_batch row, return batchId + headers + suggested mapping
}
```

**Note on the `bodySizeLimit` config's scope:** this setting is **global to the whole app's Server Actions**, not scopable per-action. Raising it to `5mb` affects every Server Action in the codebase, not just Import's. This is a reasonable tradeoff at this app's scale but is worth flagging explicitly to the planner as a project-wide (not import-scoped) config change.

### Pattern 2: DB-row-as-wizard-state (batch row survives across steps)

**What:** Instead of round-tripping the full parsed CSV through client state on every step submission, the first Server Action call (`uploadImportFile`) persists the raw CSV text into a new `import_batch` row and returns only a `batchId` (plus small UI-facing data: headers, suggested mapping, a short sample-row preview). Every subsequent step (`validateImportBatch`, `commitImportBatch`) takes the `batchId` and re-reads/updates that same row — the client only ever holds `batchId` + the user's in-progress mapping selections, never the full dataset.

**When to use:** Multi-step Server Action flows in this codebase where the "session" data (parsed rows) is too large to comfortably round-trip repeatedly through the `bodySizeLimit` ceiling, and where the flow's persisted end-state (the batch record) is *already* a requirement (IMPT-07's import history) — one mechanism satisfies both needs.

**Example:**
```typescript
// Source: pattern is a synthesis grounded in this repo's existing db/queries
// conventions (src/lib/db/queries/recentlyViewed.ts, companies.ts) — this
// exact "DB row as multi-step session" shape has no prior precedent in this
// codebase or in the publicly-documented "round-trip via client state" Next.js
// wizard pattern (see Alternatives Considered above); flagged as this phase's
// own architectural decision, not a copied external reference.
export async function validateImportBatch(batchId: number, mapping: Record<string, string>, valueMapping: Record<string, Record<string, string>>) {
  await requireStaffAccess();
  const batch = await getImportBatchById(batchId);
  const rows = parse(batch.rawCsv, { columns: true, skip_empty_lines: true, trim: true, bom: true });
  const mappedRows = rows.map((r) => applyMapping(r, mapping, valueMapping));
  const { validRows, invalidRows } = partitionRows(mappedRows, companyRowSchema); // or personaRowSchema
  const predictedCounts = await predictCreatedVsUpdated(validRows, batch.entityType);
  await updateImportBatch(batchId, {
    validatedRows: validRows,
    errorReport: invalidRows,
    rowsTotal: rows.length,
    ...predictedCounts,
    status: 'validated',
  });
  return { counts: predictedCounts, errorReport: invalidRows };
}
```

### Pattern 3: Partial-commit-aware row validation (new function, `seed.ts` untouched)

**What:** A new `partitionRows` function that validates every row against the existing per-row Zod schemas but, unlike `seed.ts`'s `validateRows`, never throws — it returns a `{ validRows, invalidRows }` split with row numbers and reasons.

**When to use:** Any interactive upload UX where a single bad row must not block the rest (IMPT-03, Pitfall 3).

**Example:**
```typescript
// src/lib/validation/csvImport.ts (new file — imports schemas from ./seed, does not modify seed.ts's validateRows)
import { z } from 'zod';

export interface RowResult<T> {
  validRows: { row: number; data: T }[];
  invalidRows: { row: number; errors: string[] }[];
}

// CSV row 1 is the header; data rows start at row 2 — mirrors seed.ts's
// validateRows numbering convention exactly, so error messages/UI stay
// consistent between the CLI seed tool and the Import wizard.
export function partitionRows<T extends z.ZodTypeAny>(
  rows: Record<string, string>[],
  schema: T
): RowResult<z.infer<T>> {
  const validRows: { row: number; data: z.infer<T> }[] = [];
  const invalidRows: { row: number; errors: string[] }[] = [];
  rows.forEach((row, index) => {
    const result = schema.safeParse(row);
    if (result.success) {
      validRows.push({ row: index + 2, data: result.data });
    } else {
      invalidRows.push({
        row: index + 2,
        errors: result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
      });
    }
  });
  return { validRows, invalidRows };
}
```

### Pattern 4: Dedup normalization + upsert with blank-cell-untouched merge (D-01–D-04, D-09, D-10)

**What:** Store `company.domain`/dedup keys in **normalized form** (so the DB-level unique constraint is a plain column constraint, not an expression index), and implement the "full overwrite except blank leaves untouched" merge as an explicit select-then-conditionally-merge, since a single SQL `ON CONFLICT ... DO UPDATE SET x = EXCLUDED.x` cannot express "only overwrite if the incoming value is non-blank."

**Example:**
```typescript
// src/lib/import/dedupKeys.ts (new file, pure functions — easy to unit test)
export function normalizeDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}
```
```typescript
// src/lib/db/queries/companies.ts — new function, additive alongside existing exports
import { normalizeDomain } from '@/lib/import/dedupKeys';

export interface UpsertCompanyInput {
  name: string;
  domain?: string; // raw CSV value, undefined if blank cell (D-03)
  industry?: string;
  // ...other mapped fields, all optional (D-10: undefined = "no new data supplied")
}

export async function upsertCompanyByDomain(row: UpsertCompanyInput) {
  if (!row.domain) {
    // D-03: blank domain cell ALWAYS inserts new — no dedup fallback
    const [inserted] = await db.insert(company).values({ ...row, domain: undefined }).returning();
    return { record: inserted, action: 'created' as const };
  }
  const normalized = normalizeDomain(row.domain);
  const existing = (await db.select().from(company).where(eq(company.domain, normalized)))[0];
  if (!existing) {
    const [inserted] = await db.insert(company).values({ ...row, domain: normalized }).returning();
    return { record: inserted, action: 'created' as const };
  }
  // D-09/D-10: full overwrite EXCEPT fields where the incoming value is
  // blank/undefined — build the SET object from only the non-blank fields.
  const patch = Object.fromEntries(
    Object.entries(row).filter(([, value]) => value !== undefined && value !== '')
  );
  const [updated] = await db.update(company).set(patch).where(eq(company.id, existing.id)).returning();
  return { record: updated, action: 'updated' as const };
}
```
**Why not `onConflictDoUpdate` here despite the working Phase 6 precedent:** `recordView`'s upsert (`recentlyViewed.ts`) always overwrites `viewedAt` unconditionally on conflict — there's no "leave untouched if blank" requirement for that table. D-10's requirement is genuinely different (conditional per-field merge), so the select-then-branch shape above is the correct extension, not a deviation from convention for its own sake.

### Pattern 5: Rollback with dry-run preview + FK-constraint defense-in-depth (D-13–D-16)

**What:** Two separate Server Actions — `previewRollback(batchId)` (read-only, computes counts for the D-16 confirmation dialog) and `executeRollback(batchId)` (performs the actual deletes). Because `drizzle-orm/neon-http` has **no transaction support** (verified below), there is a real gap between "preview counted N deletable rows" and "execute deletes them" — a dependent row could be added in between. The existing `signal.companyId`/`companyPersonaRole.companyId`/`companyPersonaRole.personaId` foreign keys (all `.notNull().references(...)`, no `onDelete` override → Postgres default `NO ACTION`) serve as a hard backstop: a delete attempt against a company/persona that gained a dependent row in that window will raise a foreign-key-violation error (Postgres error code `23503`) rather than silently succeeding. Catch that specific error per-row during `executeRollback` and fold it into the same "skipped — has dependent data" outcome, rather than treating it as an unexpected failure.

**Example:**
```typescript
// src/lib/db/queries/importBatches.ts (shape)
export async function findRollbackableRows(batchId: number) {
  const createdRows = await db
    .select()
    .from(importLog)
    .where(and(eq(importLog.batchId, batchId), eq(importLog.action, 'created'), isNull(importLog.rolledBackAt)));

  const deletable: typeof createdRows = [];
  const skipped: typeof createdRows = [];
  for (const row of createdRows) {
    const hasDependents =
      row.entityType === 'company'
        ? await hasCompanyDependents(row.recordId)
        : await hasPersonaDependents(row.recordId);
    (hasDependents ? skipped : deletable).push(row);
  }
  return { deletable, skipped };
}

async function hasCompanyDependents(companyId: number) {
  const [signalRow] = await db.select({ one: sql`1` }).from(signal).where(eq(signal.companyId, companyId)).limit(1);
  const [roleRow] = await db.select({ one: sql`1` }).from(companyPersonaRole).where(eq(companyPersonaRole.companyId, companyId)).limit(1);
  return Boolean(signalRow || roleRow);
}
```

### Anti-Patterns to Avoid

- **Reusing `seed.ts`'s `validateRows` (throw-on-first-batch-of-errors) directly in the Import Server Action.** Already flagged in `PITFALLS.md` Pitfall 3 — this phase's whole partial-commit requirement (IMPT-03) is incompatible with that function's throw behavior. Use the new `partitionRows` instead.
- **Reusing `seed.ts`'s delete-then-reinsert pattern for commit.** Already flagged in `PITFALLS.md` Pitfall 2 — Import must be additive/upsert-based, never a wipe.
- **A single SQL `onConflictDoUpdate` with `set: { ...allFields }` for the company/persona upsert.** This would silently violate D-10 (blank cells would overwrite existing data with empty values) — must be the explicit conditional-merge shape in Pattern 4.
- **Storing full parsed rows in React state and re-submitting them on every wizard step.** Works for small files but multiplies bytes against the (raised, but still finite) Server Action body limit on every step call; the `import_batch`-row-as-state pattern avoids this entirely.
- **Round-tripping `userId` as a Server Action argument for `createdBy`/`rolledBackBy` fields.** Must be derived from `requireStaffAccess()`'s return value inside the action, exactly like `recordView`'s established convention — never accepted as a client-supplied parameter.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV parsing (quoting, escaping, embedded commas/newlines) | A regex-based or `.split(',')` CSV reader | `csv-parse` (already installed, already trusted for `seed.ts`) | RFC 4180 CSV quoting/escaping is genuinely tricky (quoted fields containing commas, newlines, escaped quotes); this project already has a working, tested dependency for it |
| CSV template generation (quoting/escaping for the output file) | Manual `.join(',')` string building | `csv-stringify` (sibling package to `csv-parse`) | Even schema-controlled template values benefit from consistent escaping behavior with the parser that will later re-read them |
| Multi-step form state management | A hand-rolled reducer/state-machine library, or a third-party form-wizard package | Plain `useState` for `step`/`batchId` + the `import_batch` DB row for the actual data (Pattern 2 above) | The wizard has exactly 4-5 linear steps with no branching complexity that would justify a state-machine library; this app has zero precedent for any client-state library beyond `nuqs` (URL params) and plain `useState` |
| Fuzzy/duplicate-name matching | A Levenshtein-distance or similarity-scoring dedup library | Exact match on the normalized `domain`/`email` key (D-01–D-04) | Explicitly out of scope per `REQUIREMENTS.md`'s Out of Scope table ("Fuzzy/probabilistic dedup matching for Import... false positives cost more staff attention than they save") |
| FK-dependent-row detection for rollback | A generic "cascade check" ORM plugin | Two direct `EXISTS`-style queries against `signal`/`companyPersonaRole`, mirroring the `EXISTS` subquery shape already used in `companies.ts`/`personas.ts` | The dependency graph is exactly two tables, two columns — a generic cascade-detection library is overkill and this codebase already has the exact query shape to copy |

**Key insight:** Every "don't hand-roll" item above already has either an installed library or an established in-repo pattern to extend — this phase introduces almost no genuinely novel *mechanism*, only novel *composition* of existing mechanisms (Server Action + FormData + DB-row-as-session + conditional-merge upsert).

## Common Pitfalls

### Pitfall 1: Reusing `validateRows`'s throw-on-error aggregation for the interactive wizard
**What goes wrong:** One bad row (e.g., a typo'd `revenue_band` value) rejects the entire uploaded file with a wall-of-text thrown error, exactly the UX `PITFALLS.md` Pitfall 3 already documents.
**Why it happens:** `validateRows` already exists, is already proven via `npm run seed`, and reusing it is the path of least resistance.
**How to avoid:** Use the new `partitionRows` function (Pattern 3) — validate all rows, split into valid/invalid, never throw.
**Warning signs:** Import Server Action's error handling is a single `try { validateRows(...) } catch { ... }`.

### Pitfall 2: Excel-exported CSVs carrying a UTF-8 BOM that `seed.ts`'s parse options don't handle
**What goes wrong:** A CSV exported from Excel/Google Sheets (the realistic staff-upload source, unlike the hand-authored `data/seed/*.csv` files) often begins with a UTF-8 byte-order-mark (`EF BB BF`). Without `bom: true`, `csv-parse` will include the BOM as part of the first header's name (e.g. the header literally becomes `U+FEFF` + `name` instead of plain `name`), silently breaking the header-to-field auto-mapping for that one column on every affected file.
**Why it happens:** `seed.ts`'s `readCsv` (existing code) doesn't set `bom: true` because its own hand-authored seed CSVs never had one — there's no existing precedent in this codebase for handling BOM-prefixed input. [CITED: csv-parse's own `bom` option documentation, confirmed via WebSearch this session — "it is recommended to always activate this option when working with UTF-8 files"]
**How to avoid:** Always pass `bom: true` in the Import wizard's `csv-parse` call (does not need to be added to `seed.ts`'s own `readCsv`, since that's a separate, unaffected code path).
**Warning signs:** The mapping step shows the CSV's first header as unmatched/unmappable even though it looks correct in a text editor.

### Pitfall 3: `bodySizeLimit` is a global config, not scoped to the Import action
**What goes wrong:** Raising `experimental.serverActions.bodySizeLimit` to accommodate CSV uploads raises the limit for **every** Server Action in the app, including `recordView`, `refreshCompanyCount`, and any future Server Actions — a much larger attack surface for a body-size-based resource-exhaustion attempt than "just the Import feature."
**Why it happens:** Next.js's `serverActions.bodySizeLimit` is a single top-level config value with no per-action override mechanism [VERIFIED: nextjs.org/docs, fetched this session].
**How to avoid:** Choose a conservative value (`5mb` is generous for realistic CSV volumes at this project's scale — hundreds to low thousands of rows of Company/Persona data is typically well under 1MB of plain text) rather than an oversized one "just in case." Pair with an explicit row-count cap inside the upload Server Action itself (e.g., reject with a clear error if `rows.length > 5000`) as a second, feature-scoped guard that doesn't depend on the global config.
**Warning signs:** No row-count or file-size sanity check anywhere in the upload action beyond the framework's own body-size rejection.

### Pitfall 4: Race condition between rollback preview and rollback execute (no transactions available)
**What goes wrong:** `previewRollback` reports "N rows will be deleted, M skipped." Between that response and the staff member clicking "Confirm," another staff member could add a Signal to one of the N companies, making that company no longer safely deletable. Because `drizzle-orm/neon-http` (this project's driver, confirmed in `src/lib/db/index.ts`) has **no transaction support** [VERIFIED via WebSearch: "No transactions support in neon-http driver... if you need session or interactive transaction support, use the WebSocket-based neon-serverless driver" — cross-referenced against this repo's actual driver choice], there is no way to hold a lock across the preview-then-confirm gap.
**Why it happens:** The HTTP-based Neon driver trades transaction support for lower per-query latency — a deliberate tradeoff this project already made for its query layer, not something Import can opt out of without switching drivers project-wide.
**How to avoid:** Rely on the existing FK constraints (`signal.companyId`, `companyPersonaRole.companyId`/`personaId`, all `NOT NULL REFERENCES ... ` with Postgres's default `NO ACTION` behavior) as the actual safety backstop — catch the FK-violation error (Postgres code `23503`) during `executeRollback` and report that row as "skipped — has dependent data," same as a row caught by the pre-check. Never assume the pre-check count and the execute-time outcome will always match exactly; design the execute step to tolerate the mismatch gracefully rather than treating it as an unexpected error.
**Warning signs:** `executeRollback` throws an unhandled Postgres error instead of a structured per-row result when a dependent row appears mid-flight.

### Pitfall 5: Treating "predicted" created/updated counts (from the validate step) as guaranteed to match the actual commit outcome
**What goes wrong:** The preview step (D-12) predicts created-vs-updated counts by checking current DB state at validate time. If two staff members run overlapping imports (or a single staff member leaves a validated-but-uncommitted batch open for a while), the actual commit could produce slightly different counts than what was previewed (e.g., a row predicted as "create" actually becomes an "update" because someone else's import created that company first).
**Why it happens:** No transaction/lock spans the validate-to-commit gap, same root cause as Pitfall 4.
**How to avoid:** Compute the *actual* created/updated/errored counts from what really happened during commit (not by re-displaying the predicted counts) for the final summary (IMPT-05) — the preview counts are a best-effort estimate for the confirm dialog, the commit-time counts are the authoritative summary. Document this distinction in the UI copy if the two ever visibly differ (rare at this project's low-concurrency, small-team scale, but the code should not assume they're always identical).
**Warning signs:** The "Import complete" summary screen just echoes the numbers from the validate step instead of tallying actual `insert`/`update` outcomes during commit.

### Pitfall 6: Forgetting the second dedup key (persona.email) needs its own unique constraint
**What goes wrong:** D-04's persona dedup key is `email`, exactly parallel to `company.domain` — it's easy to add the `company.domain` migration (explicitly called out in CONTEXT.md D-01) while forgetting `persona.email` needs the identical treatment (nullable-but-unique column) since CONTEXT.md's decisions section discusses `domain` at length but only mentions `email` in passing as "the dedup key for Personas."
**Why it happens:** `persona.email` already exists in the schema today (unlike `domain`, which is entirely new), making it easy to assume "the column's already there, nothing to migrate" and skip adding the unique constraint that makes upsert-by-email safe at the DB level.
**How to avoid:** Add a `unique()` constraint on `persona.email` in the same schema-migration pass as `company.domain`. Verified safe against current seed data this session: all 8 non-blank emails in `data/seed/personas.csv` are distinct — no pre-existing duplicate would block the constraint from being added via `drizzle-kit push`.
**Warning signs:** `upsertPersonaByEmail` relies purely on an application-level `SELECT ... WHERE email = ...` check with no DB-level constraint backing it — exactly the "silently succeeds with two rows" failure mode `PITFALLS.md` Pitfall 2 warns about for `company.name`.

## Code Examples

### CSV Template Generation (IMPT-06), reading directly from schema enums

```typescript
// src/lib/import/csvTemplate.ts (new file)
// Source: csv-stringify sync API (github.com/adaltas/node-csv), same
// maintainer/ecosystem as the already-installed csv-parse.
import { stringify } from 'csv-stringify/sync';
import { revenueBandEnum, ownershipTypeEnum, seniorityEnum } from '@/lib/db/schema';

const COMPANY_HEADERS = [
  'name', 'domain', 'industry', 'employee_count_band', 'hq_location',
  'revenue_band', 'ownership_type', 'tech_stack',
];

export function generateCompanyTemplate(): string {
  // One example row demonstrating the shape; enum columns use the FIRST
  // canonical value so the file is immediately valid if re-imported as-is.
  // The FULL set of valid enum values is surfaced as wizard helper copy
  // (read from the same enumValues arrays), not crammed into one CSV cell.
  const exampleRow = {
    name: 'Acme Example Co',
    domain: 'acme-example.com',
    industry: 'Manufacturing',
    employee_count_band: '201-1000',
    hq_location: 'Chicago, USA',
    revenue_band: revenueBandEnum.enumValues[0],
    ownership_type: ownershipTypeEnum.enumValues[0],
    tech_stack: 'SAP ERP|Excel',
  };
  return stringify([exampleRow], { header: true, columns: COMPANY_HEADERS });
}

// Helper copy shown near the download link in the wizard UI — generated
// from the same arrays, so it can never drift from the DB schema:
export function enumHelpText() {
  return {
    revenue_band: `Valid values: ${revenueBandEnum.enumValues.join(', ')}`,
    ownership_type: `Valid values: ${ownershipTypeEnum.enumValues.join(', ')}`,
    seniority: `Valid values: ${seniorityEnum.enumValues.join(', ')}`,
  };
}
```

### Column & Enum-Value Auto-Mapping (IMPT-02)

```typescript
// src/lib/import/columnMapping.ts (new file)
// Alias dictionaries are a project-specific judgment call (no external
// registry for "what will staff name a revenue column") — flagged in the
// Assumptions Log below. Exact match after normalization, no fuzzy/
// Levenshtein matching (consistent with the project's explicit anti-feature
// stance against fuzzy dedup — the same reasoning applies to column
// matching: manual override (D-08) is the safety net, not a smarter guesser).
const COMPANY_FIELD_ALIASES: Record<string, string[]> = {
  name: ['name', 'company', 'company name', 'company_name', 'account name'],
  domain: ['domain', 'website', 'url', 'company domain', 'web site'],
  industry: ['industry', 'sector', 'vertical'],
  employee_count_band: ['employee count', 'employees', 'headcount', 'company size'],
  hq_location: ['hq', 'hq location', 'headquarters', 'location', 'city'],
  revenue_band: ['revenue', 'revenue band', 'annual revenue'],
  ownership_type: ['ownership', 'ownership type'],
  tech_stack: ['tech stack', 'technologies', 'tools'],
};

function normalizeHeader(raw: string): string {
  return raw.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

export function suggestColumnMapping(
  headers: string[],
  aliases: Record<string, string[]>
): Record<string, string | null> {
  const mapping: Record<string, string | null> = {};
  for (const header of headers) {
    const normalized = normalizeHeader(header);
    const match = Object.entries(aliases).find(([, candidates]) =>
      candidates.some((c) => normalizeHeader(c) === normalized)
    );
    mapping[header] = match ? match[0] : null; // null = unmapped, requires manual pick (D-08's override)
  }
  return mapping;
}

// Enum VALUE mapping — shown per distinct raw value found in a
// column mapped to an enum-typed field, defaulting to an alias guess,
// always overridable before commit (IMPT-02's "manual override").
const REVENUE_BAND_ALIASES: Record<string, string> = {
  'under 50m': 'under_50m', '<50m': 'under_50m', '0-50m': 'under_50m',
  '50-250m': '50m_250m', '50m-250m': '50m_250m', '$50-250m': '50m_250m',
  '250m-1b': '250m_1b', '250-1000m': '250m_1b',
  '1b-5b': '1b_5b', '$1-5b': '1b_5b',
  '5b+': '5b_plus', '>5b': '5b_plus',
};

export function suggestValueMapping(rawValues: string[], aliases: Record<string, string>) {
  const normalize = (v: string) => v.trim().toLowerCase();
  return Object.fromEntries(rawValues.map((v) => [v, aliases[normalize(v)] ?? null]));
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `z.string().email()` (deprecated chained form) | Top-level `z.email()` (Zod v4) | Zod v4 (already in use in this repo's `seed.ts`) | Already followed correctly in the existing codebase — new `domain`/email-adjacent validators in this phase should keep using the top-level form, not the deprecated chained one |
| Server Actions with implicit/unconfigured body limits | Explicit `experimental.serverActions.bodySizeLimit` in `next.config.ts` | Confirmed still under `experimental` as of Next.js 16.2.12 docs (fetched 2026-07-30) — **not yet graduated out of `experimental`**, contrary to `ARCHITECTURE.md`'s earlier "MEDIUM confidence, verify" flag from Phase-level milestone research | This phase can now state with HIGH confidence (re-verified this session) that the config path is `experimental.serverActions.bodySizeLimit` — no change needed to the milestone research's guess, but confidence upgraded from MEDIUM to HIGH |

**Deprecated/outdated:** None specific to this phase beyond the Zod v4 note above (already correctly followed in this codebase).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `csv-stringify` (sibling package to `csv-parse`, same `node-csv` maintainer) is the right choice for CSV template generation | Standard Stack, Code Examples | Low — if wrong/unwanted, a hand-rolled stringify function is a trivial fallback since template values are schema-controlled (no untrusted data to escape) |
| A2 | The column-header alias dictionaries (`COMPANY_FIELD_ALIASES`, etc.) are a reasonable starting guess for what staff's real-world CSV exports will name their columns | Code Examples | Low-Medium — worst case, more columns land "unmapped" than ideal on the first real import, requiring more manual mapping via the always-available override (D-08); does not block any row from importing correctly once manually mapped |
| A3 | The enum-value alias dictionaries (e.g. `REVENUE_BAND_ALIASES`) cover the most common real-world phrasings of revenue bands/ownership types/seniority levels | Code Examples | Low-Medium — same mitigation as A2; unmapped enum values are surfaced for manual per-value mapping in the wizard UI, never silently guessed wrong and committed |
| A4 | `normalizeEmail`'s case-insensitive comparison (lowercasing before dedup match) is the desired semantics for `persona.email` matching | Pattern 4 | Low — RFC 5321 technically allows case-sensitive local-parts, but virtually all real-world mail providers treat email case-insensitively; a wrong assumption here would cause two differently-cased emails for the same real person to be treated as duplicates when the team intended them distinct (unlikely to matter at this team's scale) |
| A5 | A dedicated route page (`/companies/import`, `/personas/import`) is preferable to a Dialog/Sheet overlay for the wizard | Architecture Patterns, Summary | Low — this is explicitly flagged as "Claude's Discretion" territory in CONTEXT.md; if the planner/product prefers an overlay, the wizard's internal logic (Patterns 2-5) is unaffected, only the top-level page/route wrapper changes |
| A6 | Import history is best shown as a shared or per-entity-type page reachable from the wizard's "done" step, exact routing left open | Recommended Project Structure | Low — explicitly flagged as an open composition detail, not a decision this research locks in |
| A7 | Vitest is the right minimal test framework to bootstrap for this phase's pure-function validation logic (vs. staying manual-only, or choosing Jest) | Validation Architecture | Low-Medium — if wrong, swapping to Jest later costs a config file and a `describe/it` syntax rewrite (nearly identical API); staying manual-only instead just means Wave 0's harness-install task is skipped and the phase's dedup/rollback logic ships with zero automated regression coverage, raising the risk of a silent break in a later phase's refactor |

**If this table is empty:** N/A — see rows above.

## Open Questions

1. **Should `import_batch.rawCsv` be retained indefinitely, or purged after a retention window?**
   - What we know: Storing the full uploaded CSV text in the batch row is the simplest way to make wizard steps resumable without re-uploading, and it directly enables re-deriving exactly what was imported for audit purposes.
   - What's unclear: At what row-count/frequency this becomes a meaningful storage cost concern for Neon's free/starter tier (not verified this session — no visibility into the project's current Neon plan/storage usage).
   - Recommendation: Ship without a retention policy for v1.1 (matches this project's "no stated need yet" pattern for similar low-urgency concerns elsewhere in the milestone); revisit only if storage becomes a measured problem, consistent with `PITFALLS.md`'s general "don't build for a need nobody has asked for" principle applied elsewhere in this milestone (Start Page anti-features).

2. **Should the "preview" step's created-vs-updated prediction be recomputed live if the staff member navigates back to the mapping step and changes something?**
   - What we know: The batch-row-as-state design (Pattern 2) makes each step's Server Action independently re-derivable from `rawCsv` + the currently-stored mapping — going "back" and resubmitting the mapping step naturally re-triggers `validateImportBatch` and overwrites the previous `validatedRows`/counts.
   - What's unclear: Whether the wizard UI should explicitly support a "back" navigation at all, or only forward progression with a "start over" option — this is a UI composition detail, not a data-model constraint (the data model supports either).
   - Recommendation: Leave as a planning-level UI decision; the underlying Server Actions work correctly either way since each is idempotent given the same `batchId` + inputs.

## Validation Architecture

> Included because `.planning/config.json` has `workflow.nyquist_validation: true`.

### Test Framework

**Current state:** Zero automated test infrastructure exists anywhere in this repo. Confirmed this session: no `jest.config.*`/`vitest.config.*`/`playwright.config.*`, no `*.test.*`/`*.spec.*` files (`find src -iname "*.test.*" -o -iname "*.spec.*"` returns nothing), no `test` script in `package.json` (`scripts` only has `dev`/`build`/`start`/`lint`/`seed`). All verification to date is `tsc`/`next build`/`eslint` plus manual browser UAT (`.planning/STATE.md`: "no automated test suite exists anywhere in the repo").

**Recommendation: bootstrap a minimal Vitest install, scoped strictly to this phase's pure functions.** [ASSUMED — see A7 in Assumptions Log]

Reasoning:
- This phase is the first in the codebase's history to introduce genuinely destructive, hard-to-manually-verify logic: conditional field-merge on upsert (D-09/D-10's "full overwrite except blank leaves untouched" — six-plus branching field cases per row), dedup-key normalization (D-01–D-04, D-02's protocol/`www.`/trailing-slash stripping has several edge cases), partial-commit row partitioning (IMPT-03), and rollback's dependent-row-skip branching (D-13/D-14). Every one of these is a **pure function** (no DB, no React, no Next.js runtime) — exactly the shape unit tests are cheapest and most valuable for.
- Manual UAT can exercise these paths, but only by constructing specific CSV fixtures and eyeballing results through the browser each time — slow, and easy to skip re-running after a later refactor (e.g. Phase 8's enrichment work will touch `company`/`persona` upsert logic again). A regression in `normalizeDomain` or the blank-cell-untouched merge would silently corrupt real data with no automated signal.
- The alternative — staying manual-only — is viable but strictly riskier: this is exactly the kind of logic where "worked when I tested it in the browser" and "still works after the next phase touches this file" diverge silently, and unlike a UI glitch, a bad merge/dedup bug corrupts live Company/Persona data with no visible symptom until someone notices stale or wrongly-duplicated records.
- Vitest (not Jest) is recommended because: (a) it needs no `babel`/`ts-jest` transform config to run plain TypeScript — works directly against `.ts` files with a one-line config; (b) it requires no `jsdom`/`happy-dom` environment for this phase's scope, since none of the functions being tested touch the DOM or React — plain Node environment is sufficient; (c) `vitest ^4.1.10` is confirmed to exist and resolve on the npm registry as of this session (`npm view vitest version` → `4.1.10`) [VERIFIED: npm registry]; the package name itself is well-known/training-data-recalled, so tagged per the provenance rule as the version-confirmation basis, not full `[VERIFIED]` status for the recommendation itself.
- Scope is deliberately narrow: **do not** attempt to unit-test anything that touches Drizzle/Neon (upsert commit, rollback execute, import_batch CRUD) or React component rendering (wizard steps, dropzone). No test-database, no DB-mocking library (`vitest-mock-extended` or similar), and no component-testing setup (`@testing-library/react`, `jsdom`) are introduced this phase — that would be a materially larger infrastructure investment than this phase's scope justifies, and the codebase's zero-test-history means even this minimal slice is already a meaningful precedent-setting step. DB-touching and UI-rendering behavior stays manual UAT (see below).

| Property | Value |
|----------|-------|
| Framework | Vitest `^4.1.10` (new — not yet installed) [VERIFIED: npm registry, `npm view vitest version`] |
| Config file | `vitest.config.ts` (new, Wave 0) — plain Node environment, no `jsdom`/`plugin-react` needed for this phase's pure-function scope |
| Quick run command | `npx vitest run src/lib/import src/lib/validation/csvImport.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IMPT-01 | Upload a CSV via Menu → Import (dropzone, FormData submit, Server Action round-trip) | manual-only | — (browser UAT: select a real CSV, confirm advance to Map step) | ❌ n/a — inherently interactive, no unit target |
| IMPT-01 | `uploadImportFile`'s parse-failure branch (malformed/binary file → clean error, not an unhandled exception) | unit (of the try/catch boundary, once extracted as a testable helper) + `tsc` | `npx vitest run src/lib/import/parseCsv.test.ts` (Wave 0 gap) + `npx tsc --noEmit` | ❌ Wave 0 |
| IMPT-02 | `suggestColumnMapping` header-alias matching | unit | `npx vitest run src/lib/import/columnMapping.test.ts` | ❌ Wave 0 |
| IMPT-02 | `suggestValueMapping` enum-value-alias matching | unit | `npx vitest run src/lib/import/columnMapping.test.ts` | ❌ Wave 0 |
| IMPT-02 | Manual override of a mapping in the UI (Select interaction, "Unmapped" badge behavior) | manual-only | — (browser UAT) | ❌ n/a |
| IMPT-03 | `partitionRows` valid/invalid split, row-numbering (header = row 1, data starts row 2), never-throws behavior | unit | `npx vitest run src/lib/validation/csvImport.test.ts` | ❌ Wave 0 |
| IMPT-03 | Partial-commit end-to-end (some rows commit, errored rows reported with reason, in the actual browser flow) | manual-only | — (browser UAT with a fixture CSV containing 1+ deliberately bad rows) | ❌ n/a |
| IMPT-04 | `normalizeDomain`/`normalizeEmail` (protocol/`www.`/trailing-slash stripping, case-folding, edge cases: bare domain, uppercase, trailing slash, `http://` vs `https://`) | unit | `npx vitest run src/lib/import/dedupKeys.test.ts` | ❌ Wave 0 |
| IMPT-04 | Blank-cell-untouched merge patch-building (the `Object.entries(row).filter(...)` logic in Pattern 4) | unit — **extract as its own pure function** (e.g. `buildUpdatePatch(row)`) so it's testable without a DB round-trip | `npx vitest run src/lib/import/dedupKeys.test.ts` | ❌ Wave 0 |
| IMPT-04 | Actual `upsertCompanyByDomain`/`upsertPersonaByEmail` DB round-trip (unique constraint enforcement, real insert-vs-update outcome) | manual-only (no test DB provisioned this phase) | — (manual UAT: import a CSV twice, inspect `/companies` list or run a SQL check) | ❌ n/a — DB integration testing out of scope this phase, see Wave 0 Gaps |
| IMPT-05 | Created/updated/errored count tallying from actual commit outcomes (not re-displaying predicted counts, Pitfall 5) | unit — if the tally step is extracted as a pure reducer over commit results | `npx vitest run src/lib/import/commitTally.test.ts` (optional, only if planner extracts this as a standalone function) | ❌ Wave 0 (optional) |
| IMPT-05 | Summary screen visual display of counts | manual-only | — (browser UAT) | ❌ n/a |
| IMPT-06 | `generateCompanyTemplate`/`generatePersonaTemplate` header order + enum-value correctness (never drifts from schema) | unit — snapshot/assert against `*Enum.enumValues` | `npx vitest run src/lib/import/csvTemplate.test.ts` | ❌ Wave 0 |
| IMPT-07 | `findRollbackableRows`'s deletable-vs-skipped partitioning logic (dependent-check branching) | unit, if the branching logic is isolated from the DB read (e.g. pass in pre-fetched dependent-flags rather than querying inline) — otherwise manual | `npx vitest run src/lib/import/rollbackPartition.test.ts` (Wave 0, only if planner extracts the branching as a pure function) | ❌ Wave 0 (recommended extraction) |
| IMPT-07 | Full rollback flow (preview dialog, confirm, actual DB deletes, FK-violation-as-skip fallback, Pitfall 4's race tolerance) | manual-only (no test DB, no way to deterministically trigger the race condition) | — (browser UAT: rollback a batch with and without dependent Signal/role rows attached) | ❌ n/a |

### Sampling Rate

- **Per task commit:** run `npx vitest run` against the specific new/changed pure-function file only (sub-second, e.g. `npx vitest run src/lib/import/dedupKeys.test.ts`), plus `npx tsc --noEmit` for any task touching typed interfaces (schema, query-layer signatures).
- **Per wave merge:** full `npx vitest run` (all unit tests across `src/lib/import/`, `src/lib/validation/`) + `next build` (or `tsc --noEmit` if a full build is too slow mid-wave) + a manual smoke pass of whichever wizard step(s) that wave delivered (e.g. Wave covering Upload+Map → manually upload a real CSV and confirm the mapping table renders correctly).
- **Phase gate (before `/gsd-verify-work`):** full `npx vitest run` green, `next build` green, and the complete manual UAT script below run once end-to-end (upload → map → validate/preview → commit → summary → rollback), covering both Companies and Personas entity types.

### Wave 0 Gaps

- [ ] Install Vitest: `npm install -D vitest` (verify version resolves per Standard Stack-style check: `npm view vitest version`)
- [ ] `vitest.config.ts` — minimal config, Node environment (no `jsdom`, no React plugin needed for this phase's pure-function scope):
  ```typescript
  import { defineConfig } from 'vitest/config';
  export default defineConfig({
    test: { environment: 'node', include: ['src/**/*.test.ts'] },
  });
  ```
- [ ] Add `"test": "vitest run"` to `package.json` `scripts` (alongside existing `dev`/`build`/`start`/`lint`/`seed`)
- [ ] First stub test file, `src/lib/import/dedupKeys.test.ts`, covering `normalizeDomain`/`normalizeEmail` — proves the harness runs correctly before task-specific test files are written; this file's test cases become the actual IMPT-04 coverage once `dedupKeys.ts` exists (not a throwaway stub to delete later)
- [ ] Explicitly **not** installed/configured this phase: any DB-mocking library, test-database provisioning, or component-testing setup (`@testing-library/react`, `jsdom`, Playwright). DB-touching and UI-rendering verification stays manual UAT per the Test Map above — introducing that infrastructure is a larger investment better justified by a phase where it directly pays for itself (revisit if Phase 8/9 introduces DB-heavy logic that would benefit from an actual test-database).

### Manual-Only Verifications

Behaviors that cannot reasonably be automated given this phase's scope (no test DB, no component-testing harness) and must be verified via manual UAT:

- **Dropzone visual states** (drag-active accent tint, hover border, hidden-input click-to-browse) — inherently visual/interactive, no automation target.
- **The actual browser → Server Action upload round-trip** (`FormData` submission, `bodySizeLimit` enforcement at real request size, BOM-prefixed file from a real Excel/Google Sheets export) — needs a real browser and a real multipart request; a unit test of `csv-parse`'s `bom: true` option in isolation is a reasonable *addition* but doesn't replace verifying the full upload path with a real Excel-exported fixture file.
- **Column-mapping table UI** (Select pre-population from `suggestColumnMapping`'s output, enum sub-mapping row expand/collapse, "Unmapped" badge rendering, Continue button's disabled-until-all-enum-values-mapped gating) — visual/interactive; the underlying mapping-suggestion *logic* is unit-tested, but the UI wiring is not.
- **Actual DB writes from `upsertCompanyByDomain`/`upsertPersonaByEmail`** (real `onConflictDoUpdate`/select-then-merge execution against Neon Postgres, unique-constraint enforcement on `company.domain`/`persona.email`) — no test database is provisioned this phase; verify by importing a known fixture CSV and inspecting the resulting rows via `/companies`/`/personas` or a direct SQL check.
- **Re-import idempotency** (uploading the identical CSV a second time and confirming it reports 0 created / N updated, not N duplicate creates) — would be an ideal integration-test candidate if a test database existed; without one, this is manual UAT: run the same fixture file twice, compare counts.
- **Full rollback flow against real dependent data** (`previewRollback` dialog showing correct N/M counts, `executeRollback` actually deleting rows, FK-violation-as-skip fallback triggering correctly when a row has a real Signal or `company_persona_role` attached) — requires real DB state with real dependent rows; manual UAT with at least one fixture batch that has a dependent and one that doesn't.
- **Pitfall 4/5's race-condition tolerance** (preview-vs-execute count mismatch when a dependent row is added mid-flight) — cannot be deterministically triggered without a concurrency-simulation harness this phase doesn't build; accept as a code-review check of the catch-`23503` pattern (Pattern 5) rather than a runnable test, consistent with this phase's minimal-footprint testing scope.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes (inherited) | `requireStaffAccess()` — already established, called first in every new Server Action this phase adds (upload, map, validate, commit, preview-rollback, execute-rollback) |
| V3 Session Management | Yes (inherited) | Clerk-managed session, unchanged by this phase |
| V4 Access Control | Yes | No roles/permissions system exists (ACCS-01 deferred to v2, per `REQUIREMENTS.md`) — any authenticated staff member can import/rollback any batch, matching the project's existing binary access model; explicitly accepted, not a gap introduced by this phase |
| V5 Input Validation | Yes | Zod schemas (`companyRowSchema`/`personaRowSchema`, extended with `domain`), reusing the existing `safeCsvString`/formula-injection guard (`startsWithDangerousPrefix`) for every new free-text field |
| V6 Cryptography | No | No new cryptographic operations in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| CSV/formula injection via a cell value that later gets re-opened in a spreadsheet (leading `=`, `+`, `-`, `@`) | Tampering | Already covered by `safeCsvString`'s `startsWithDangerousPrefix` guard — reuse unchanged; must be applied to the new `domain` field too (use the existing `optionalSafeCsvString` shape, not a bespoke unvalidated string) |
| Resource exhaustion via a very large or very-many-row CSV upload | Denial of Service | `bodySizeLimit` (framework-level, but global — Pitfall 3) plus an explicit row-count cap inside `uploadImportFile` itself (feature-scoped, not relying on the global config alone) |
| Spoofed `userId` on `createdBy`/`reviewedBy`-style audit fields | Spoofing | `userId` must come exclusively from `requireStaffAccess()`'s return value inside the Server Action, never accepted as a client-supplied argument — exactly the established `recordView` convention |
| A malicious/malformed CSV causing an unhandled exception mid-parse that leaks a stack trace or crashes the request | Information Disclosure / DoS | Wrap `csv-parse`'s `parse()` call itself in a try/catch distinct from the Zod row-validation try/catch — a fundamentally malformed file (unparseable, wrong delimiter, binary garbage) should produce a clean "couldn't parse this file" error, not an unhandled exception; this is a new failure mode not covered by `seed.ts` today since its input files are trusted/hand-authored |
| Rollback deleting a row that's since accumulated real business data (Signal/role) | Tampering / data-loss | D-14's dependent-row check + FK-constraint backstop (Pattern 5) — never a bare `DELETE` without a preceding dependent-check |

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection (2026-07-30): `src/lib/db/schema.ts`, `src/lib/db/queries/companies.ts`, `src/lib/db/queries/personas.ts`, `src/lib/db/queries/recentlyViewed.ts`, `src/lib/db/queries/signals.ts`, `src/lib/db/index.ts`, `src/lib/validation/seed.ts`, `src/scripts/seed.ts`, `src/lib/auth/requireStaffAccess.ts`, `src/app/actions.ts`, `src/app/companies/page.tsx`, `src/components/explorer/explorer-menu.tsx`, `next.config.ts`, `src/lib/env.ts`, `package.json`, `drizzle.config.ts`, `data/seed/personas.csv`, `data/seed/companies.csv`, `.planning/phases/06-shared-menu-component-start-page/06-01-PLAN.md` and `-SUMMARY.md` (confirms `drizzle-kit push`-only workflow, no migration files), `.planning/phases/06-shared-menu-component-start-page/06-PATTERNS.md`.
- [next.config.js: serverActions | Next.js docs](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions) — fetched this session (docs dated 2026-07-22, version 16.2.12), confirms `bodySizeLimit` default (1MB) and config path (still under `experimental`).
- [PostgreSQL 11.6 Unique Indexes documentation](https://www.postgresql.org/docs/current/indexes-unique.html) — confirmed via WebSearch this session: NULL values are never considered equal for UNIQUE constraint purposes, multiple NULLs are permitted by default.
- Direct verification this session (2026-07-30): `package.json` scripts inspected — no `test` script exists; `find` for `*.test.*`/`*.spec.*` returns nothing; `npm view vitest version` → `4.1.10`.

### Secondary (MEDIUM confidence)
- WebSearch: "No transactions support in neon-http driver" — corroborated across multiple sources (GitHub issues, Neon community forum, Drizzle team Discord archive via Answer Overflow) that `drizzle-orm/neon-http` has no `db.transaction()` support; cross-checked against this repo's actual driver import (`drizzle-orm/neon-http`, confirmed in `src/lib/db/index.ts`) — HIGH confidence on the codebase-specific applicability, MEDIUM on the general driver-behavior claim (not independently verified against Neon's own official docs directly, only community/GitHub sources).
- WebSearch: csv-parse `bom` option — [CSV Parse - Option bom | csv.js.org](https://csv.js.org/parse/options/bom/), official `node-csv` project docs, MEDIUM-HIGH confidence.
- WebSearch: Next.js multi-step Server Action wizard pattern (client-state round-trip vs. server-persisted state) — general community guidance (Hassan Raza's blog, MakerKit, Robin Wieruch), MEDIUM confidence; this research's actual recommendation (DB-row-as-state) diverges from the most commonly documented pattern (full client round-trip) for reasons specific to this project's body-size constraints and existing history-table requirement, explicitly flagged as this phase's own synthesis rather than a copied external pattern.

### Tertiary (LOW confidence)
- None flagged separately — all WebSearch findings above were cross-verified against either official docs or direct codebase behavior.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `csv-parse` already installed/verified; `csv-stringify` version-confirmed via `npm view` and passed `slopcheck`; `drizzle-orm` upsert pattern already proven live in this exact repo (Phase 6)
- Architecture: HIGH — all integration points (Server Actions, no Route Handlers, `requireStaffAccess()` convention, `drizzle-kit push` workflow, no-transactions neon-http driver) verified by direct codebase read or current official docs, not inferred
- Pitfalls: HIGH for codebase-specific pitfalls (BOM handling, race condition from no-transactions, dedup-constraint gap on `persona.email`), MEDIUM for the column/enum alias-dictionary completeness (inherently a judgment call, mitigated by mandatory manual override per D-08)
- Validation architecture: MEDIUM — the "zero test infra exists" fact is HIGH confidence (directly verified this session), but the recommendation to bootstrap Vitest specifically (vs. Jest, vs. staying manual-only) is a judgment call flagged in the Assumptions Log (A7) — the planner/user should confirm this direction before Wave 0 tasks are written, since it is this codebase's first-ever automated test, a precedent-setting decision beyond this phase's immediate scope

**Research date:** 2026-07-30
**Valid until:** 30 days (stable stack; Next.js Server Actions config path is the one item worth re-checking if implementation is delayed past a Next.js major/minor bump, since `ARCHITECTURE.md`'s own milestone-level research already flagged this exact config as worth re-verifying at implementation time)

---
*Phase: 7-CSV Import*
*Researched: 2026-07-30*
