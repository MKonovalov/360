---
phase: 07-csv-import
plan: 08
status: complete
requirements-completed: ["IMPT-03", "IMPT-05"]
---

# Plan 07-08 Summary — Wizard Steps 3 & 4 (Validate & Confirm, Done)

**Completed:** 2026-07-31
**Wave:** 4 (parallel with Plans 07 and 09)
**Depends on:** Plan 06 (`src/app/actions/import.ts`)

## Files Created

| File | Role | Notes |
|------|------|-------|
| `src/components/import/validation-preview-step.tsx` | `'use client'` component | Counts row + error report + Commit action. Also exports the shared `ImportCounts` / `ImportRowError` types. |
| `src/components/import/done-step.tsx` | Presentational component (no `'use client'`) | Success summary + entity-scoped navigation links. |

`src/components/import/` did not exist before this plan — it is created here.

## ValidationPreviewStep

**Props:** `{ batchId, counts, errorReport, entityType, onCommitted }`

- Full-width `p-8` shell, `flex flex-col gap-12` (2xl section break between counts row and error section, per `07-UI-SPEC.md` Spacing Scale).
- **Counts row:** three `StatCard` elements (reused verbatim from `src/components/dashboard/stat-card.tsx` — no new stat component created) in `grid grid-cols-1 gap-4 sm:grid-cols-3`, captions "Will create" / "Will update" / "Errors".
- **Amber banner** (only when `counts.errored > 0`): `rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800`, matching the `company-list.tsx` "selected row missing" pattern. Heading copy pluralizes `row`/`rows` so `errored === 1` never renders "1 rows will be skipped"; the `> 1` string is character-identical to the Copywriting Contract.
- **Error table** (only when `counts.errored > 0`): `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell` inside the app's standard `rounded-lg border border-slate-200 bg-white` table card. Row cell `text-slate-900` (Body), Reason cell `text-slate-600` (Body) with `whitespace-normal` so multi-issue reasons wrap instead of forcing horizontal scroll.
- **Download error report:** `Button variant="outline"` + `DownloadIcon`, right-aligned above the table. CSV is built client-side from the `errorReport` prop (already in memory — a Server Action round-trip would only re-serialize data the browser holds) and delivered via `Blob` → `URL.createObjectURL` → programmatic anchor click → `revokeObjectURL`.
- **Commit:** `Button variant="default"` reading "Commit Import".
  - Enabled when `counts.created + counts.updated > 0`, **even when `errored > 0`** (IMPT-03 partial commit — a bad row never blocks the rest).
  - Disabled when `created + updated === 0`, with helper text "Fix the errors above before importing."
  - Also disabled while the commit transition is pending.
  - Calls `commitImportBatch(batchId)`; on success calls `onCommitted(result)`.
- **No step-navigation state** lives in this component. It owns only `isPending` (via `useTransition`) and `commitFailed`; the parent wizard (Plan 10) owns `step`.

## DoneStep

**Props:** `{ result, entityType }`

- Centered `mx-auto max-w-xl` container, mirroring the Upload step's framing (bookends the wizard).
- `CircleCheckIcon` `size-8 text-slate-900` above the "Import complete" Heading-role line.
- Counts line in the Display typographic role (`text-[24px] font-semibold leading-[1.2]`): `{created} created · {updated} updated · {errored} skipped — errored`.
- Two stacked `space-y-2` indigo-600 `next/link` links, both derived from `entityType` (never hardcoded):
  - "View imported companies" / "View imported personas" → `/companies` | `/personas`
  - "View import history" → `/companies/import/history` | `/personas/import/history`
- No data fetching, no state — every number is threaded down from `commitImportBatch`'s **actual** write results, never the validate step's predicted counts (`07-RESEARCH.md` Pitfall 5).

## Decisions

1. **`ImportCounts` / `ImportRowError` exported from `validation-preview-step.tsx`.** `DoneStep` imports `ImportCounts` as a type rather than redeclaring the shape, so the validate→commit→done chain shares one definition. The wizard shell (Plan 10) can import both from the same module.
2. **Outbound CSV-injection guard.** `guardCsvCell` prefixes any error-report cell starting with `= + - @ \t \r` with an apostrophe — the output-side counterpart to `safeCsvString`'s inbound guard in `src/lib/validation/seed.ts`, since staff open this report in Excel/Sheets.
3. **`entityType` drives the error-report filename** (`companies-import-errors.csv` / `personas-import-errors.csv`) — the prop's only use on this step, and it keeps the download self-describing when both entity types are imported in one session.
4. **Commit-failure state.** `commitImportBatch` returns `{ error }` on a missing/unvalidated batch. Narrowed with `'error' in result` and surfaced as an inline amber banner ("Couldn't commit this import" / "Something went wrong writing these rows. Try again.") rather than a thrown 500, matching the codebase's fail-toward-known-good-UI convention.
5. **`useTransition` for the commit.** React 19 async transitions keep the button disabled for the duration without a hand-rolled loading boolean (`rendering-usetransition-loading`).

## Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | clean (no output) |
| `npx eslint src/components/import/` | clean (no output) |
| `grep "'use client'"` in validation-preview-step | PASS |
| `grep "commitImportBatch("` in validation-preview-step | PASS |
| `grep "StatCard"` in validation-preview-step | PASS |
| `grep "Commit Import"` in validation-preview-step | PASS |
| `grep "export function DoneStep"` in done-step | PASS |
| `grep "Import complete"` in done-step | PASS |
| `grep "import/history"` in done-step | PASS |
| No default exports in `src/components/import/` | PASS |

## Unblocks

Plan 10 (wizard shell) — `ValidationPreviewStep` and `DoneStep` are ready to be mounted as steps 3 and 4. The wizard must supply `batchId` + `counts` + `errorReport` from `validateImportBatch`'s return value, and thread `onCommitted`'s result straight into `DoneStep`'s `result` prop.
