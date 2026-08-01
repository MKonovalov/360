---
phase: 07-csv-import
plan: 09
status: complete
requirements-completed: ["IMPT-07"]
---

# Plan 07-09 Summary — Import History Table + Rollback Dialog

**Status:** Complete
**Date:** 2026-07-31
**Wave:** 4 (parallel with Plans 07, 08)

## What was built

### 1. `src/components/ui/dialog.tsx` (NEW — vendored)

Installed via `npx shadcn@latest add dialog --yes`. This is the app's first `Dialog`
primitive — the existing overlay (`sheet.tsx`) is a slide-over panel, not a centered
confirm/cancel surface. Exports `Dialog`, `DialogClose`, `DialogContent`,
`DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogOverlay`, `DialogPortal`,
`DialogTitle`, `DialogTrigger`.

The installer also touched `button.tsx` — it reported "Skipped 1 file (files might be
identical)", so the existing vendored Button is unchanged.

### 2. `src/components/import/rollback-dialog.tsx` (NEW — `'use client'`)

Named export `RollbackDialog({ batchId, entityType })`.

- Trigger: `Button variant="destructive" size="sm"` reading **"Roll back"**.
- `previewRollback(batchId)` is called from `handleOpenChange` **only when the dialog
  opens** — never from a `useEffect` on mount. A 50-row history page would otherwise
  fire 50 read-only pre-checks (each walking every `import_log` row for dependents)
  before staff expressed any intent.
- Loading state: two `Skeleton` bars in the dialog body. `DialogTitle`
  ("Roll back this import?") renders unconditionally — Radix requires it for the
  dialog's accessible name, and the copy is static anyway.
- Ready state body: `"{N} companies will be deleted. {M} rows skipped — has dependent
  data. This can't be undone."` with singular/plural and company/persona substitution.
- Footer: `DialogClose asChild` → `Button variant="outline"` "Cancel", plus
  `Button variant="destructive"` reading "Roll back {N} records" (disabled until the
  preview resolves and while executing).
- On confirm success: stores `executeRollback`'s **actual** `{ deleted, skipped }`,
  closes the dialog, and renders the inline confirmation
  `"Rolled back {N} records. {M} skipped — has dependent data."` in place of the trigger.
  The previewed counts are never re-displayed (Pitfall 4/5 — no transaction spans the
  preview→execute gap on `neon-http`, so the numbers can legitimately differ).
- Preview/execute failures fall back to a `"Something went wrong checking this import."`
  description rather than throwing — matches the app's fail-safe-fail-toward-known-good-UI
  convention.

### 3. `src/components/import/import-history-table.tsx` (NEW — server component)

Named export `ImportHistoryTable({ batches, entityType })`, typed against
`Awaited<ReturnType<typeof listImportBatchesWithRollbackStatus>>`.

- Empty state: standard app empty-state card
  (`min-h-48 rounded-lg border border-slate-200 bg-white p-8 text-center`) with
  heading "No imports yet" and body "Run your first CSV import from Menu → Import on
  the Company or Persona list."
- Populated: `rounded-lg border border-slate-200 bg-white` wrapper around a `Table`
  with columns **Date · Entity · Uploaded by · Created · Updated · Status · Actions**.
- `Date` uses the shared `dateFormatter` from `explorer-format.tsx` (no new formatter).
- `Uploaded by` (raw Clerk userId, no FK) truncates on an inner `span`
  (`block max-w-48 truncate`) — `TableCell` is `whitespace-nowrap`, so `max-w` on the
  `<td>` alone would overflow the row.
- `Created`/`Updated` read `actualCreated`/`actualUpdated` with an `—` fallback
  (nullable until the batch is committed).
- Status: `Badge variant="secondary"` "Committed" / `Badge variant="destructive"`
  "Rolled back", branching on `batch.isFullyRolledBack` read **directly off the row** —
  never re-derived client-side.
- Actions: `RollbackDialog` is **omitted entirely** (not disabled) when
  `batch.isFullyRolledBack` is true.

## Key decisions

**No `router.refresh()` after a successful rollback.** The parent table omits
`RollbackDialog` once a batch reads `isFullyRolledBack`, so refreshing would unmount
the component mid-render and destroy the actual-count confirmation — the one piece of
information Pitfall 4/5 says staff must see, because it can differ from the preview.
Staff stays on the history page with no navigation (per D-15); the Status badge
reflects the new state on the next load. Documented inline in the component.

**Explicit `ENTITY_NOUN` / `ENTITY_LABEL` maps.** Naive `${entityType}s` pluralization
turns 'company' into 'companys' — the same Pitfall 3 the dashboard's
`ROUTE_BY_RECORD_TYPE` map already closed. Both maps are `as const` lookups.

**`entityType` prop used for the dialog, `batch.entityType` for the Entity cell.**
`listImportBatchesWithRollbackStatus(entityType)` filters by entity type, so the two
are equal by construction; using the page-scope prop for the dialog copy matches D-05's
"one entity type per flow".

## Verification

| Check | Result |
|-------|--------|
| `test -f src/components/ui/dialog.tsx` | PASS |
| `npx tsc --noEmit` | PASS (clean, no output) |
| `npm run build` | PASS (✓ Compiled, TypeScript finished in 3.7s) |
| `grep "export function ImportHistoryTable"` | PASS |
| `grep "No imports yet"` | PASS |
| `grep 'variant="destructive"'` (history table) | PASS |
| `grep "isFullyRolledBack"` (history table) | PASS |
| `grep "'use client'"` (rollback dialog) | PASS |
| `grep "previewRollback("` | PASS |
| `grep "executeRollback("` | PASS |
| `grep "Roll back this import?"` | PASS |
| No `export default` in `src/components/import/` | PASS |
| No `useEffect` call (only a comment mentioning it) | PASS |

## Unblocks

Plan 11 (menu wiring) and the `/companies/import/history` + `/personas/import/history`
route pages, which render `ImportHistoryTable` with
`listImportBatchesWithRollbackStatus(entityType)` output.
