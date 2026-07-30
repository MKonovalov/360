# Phase 7: CSV Import - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-30
**Phase:** 7-CSV Import
**Areas discussed:** Dedup key & domain field, Import file scope, Update-on-match semantics, Rollback mechanics

---

## Dedup key & domain field

| Option | Description | Selected |
|--------|-------------|----------|
| Nullable | Add domain as nullable text column, no backfill | ✓ |
| Required (NOT NULL) | Backfill all existing companies before making it NOT NULL | |

**User's choice:** Nullable

| Option | Description | Selected |
|--------|-------------|----------|
| Normalized match | Lowercase, strip protocol/www./trailing slash | ✓ |
| Exact string match | Raw eq() comparison | |

**User's choice:** Normalized match

| Option | Description | Selected |
|--------|-------------|----------|
| Always insert as new | No dedup key present → treat as new company | ✓ |
| Fall back to name match | Case-folded name as secondary key | |
| Reject the row | Domain required for Company rows | |

**User's choice:** Always insert as new (blank Company domain)

| Option | Description | Selected |
|--------|-------------|----------|
| Always insert as new | Consistent with Company no-domain behavior | ✓ |
| Fall back to name match | Case-folded name as secondary key | |
| Reject the row | Email required for Persona rows | |

**User's choice:** Always insert as new (blank Persona email)

---

## Import file scope

| Option | Description | Selected |
|--------|-------------|----------|
| One entity per upload | Company-list = Company CSV only, Persona-list = Persona CSV only | ✓ |
| Auto-detect from headers | Universal wizard inspects headers | |
| You decide | Claude picks | |

**User's choice:** One entity per upload

| Option | Description | Selected |
|--------|-------------|----------|
| Out of scope | No company_persona_role writes this phase | ✓ |
| In scope | Persona CSV can include company link column | |

**User's choice:** Out of scope (role linking deferred)

| Option | Description | Selected |
|--------|-------------|----------|
| One file per run | Import Companies, then separately Personas | ✓ |
| Multi-file batch | Multiple CSVs in one session | |

**User's choice:** One file per run

| Option | Description | Selected |
|--------|-------------|----------|
| Fresh each time | Auto-map by header match every upload, no persistence | ✓ |
| Persisted mapping profile | Save corrections for repeat imports | |

**User's choice:** Fresh each time

---

## Update-on-match semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Full overwrite | Every mapped column's CSV value replaces existing field | ✓ |
| Fill-blanks-only | Same conservative policy as Phase 8 enrichment | |
| You decide | Claude picks | |

**User's choice:** Full overwrite

| Option | Description | Selected |
|--------|-------------|----------|
| Leave untouched | Blank cell means "no new data," not "clear it" | ✓ |
| Clear to null | Blank cell deliberately nulls the field | |

**User's choice:** Leave untouched

| Option | Description | Selected |
|--------|-------------|----------|
| Defer to Phase 8 | Phase 8's Goal already covers per-field provenance (ENRC-03) | ✓ |
| Add it now | Resolve schema gap once, ahead of Phase 8 | |

**User's choice:** Defer to Phase 8

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, in preview step | Show "N new, M updates, X errors" before commit | ✓ |
| No, summary only after commit | Counts only on final summary screen | |

**User's choice:** Yes, in the preview step

---

## Rollback mechanics

| Option | Description | Selected |
|--------|-------------|----------|
| Undo creates only | Delete rows this batch created; updates keep new values | ✓ |
| Undo creates AND revert updates | Restore pre-import field values too, needs before-snapshots | |

**User's choice:** Undo creates only

| Option | Description | Selected |
|--------|-------------|----------|
| Skip rows with dependents | Report "not rolled back — has dependent data" | ✓ |
| Cascade-delete dependents too | Also delete Signals/role links | |
| Block the whole rollback | Refuse entire operation if any row has dependents | |

**User's choice:** Skip rows with dependents

| Option | Description | Selected |
|--------|-------------|----------|
| Any batch, rows-still-matching only | Roll back any past import, only untouched rows affected | ✓ |
| Most-recent import only | Restrict to latest batch | |

**User's choice:** Any batch, rows-still-matching only

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, show what will be affected | Explicit confirm screen with counts before executing | ✓ |
| No extra gate | Rollback executes immediately | |

**User's choice:** Yes, show what will be affected

---

## Claude's Discretion

- Exact wizard step count/UI flow composition
- `import_batch`/`import_log` schema shape (columns, indexes)
- Whether `csv-parse` moves from `devDependencies` to `dependencies`
- Exact Zod schema reuse/extension strategy from `src/lib/validation/seed.ts`
- Error-report format for invalid rows (inline table vs. downloadable CSV)

## Deferred Ideas

- Persona-to-Company role/career-history import via CSV (D-06)
- Persisted column-mapping profiles (D-08)
- Multi-file batch import (D-07)
