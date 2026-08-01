# Plan 07-07 Summary — Wizard Screens 1 & 2 (Step Indicator, Upload, Column Mapping)

**Completed:** 2026-07-31
**Wave:** 4 (parallel with Plans 08 and 09)
**Depends on:** Plan 06 (`src/app/actions/import.ts`)

## Files Created

| File | Type | Exports |
|------|------|---------|
| `src/components/import/import-step-indicator.tsx` | Server Component | `ImportStepIndicator`, `ImportStep` (type) |
| `src/components/import/upload-step.tsx` | `'use client'` | `UploadStep`, `UploadedBatch` (interface) |
| `src/components/import/column-mapping-step.tsx` | `'use client'` | `ColumnMappingStep` |

No default exports. `src/components/import/` did not exist before this plan.

## What Was Built

### `ImportStepIndicator`

- Server Component (no hooks) — `Badge` is a client primitive, but importing a
  client component into a Server Component is a normal boundary, not a hook use.
- Renders `<ol>`/`<li>` with 4 pills in fixed order: Upload → Map →
  Validate & Confirm → Done, joined by `h-px w-8 bg-slate-200` connectors.
- Completed: `text-slate-500` + `CircleCheckIcon` (`text-slate-400`).
  Current: `text-indigo-600` + `border-b-2 border-b-indigo-600` + `aria-current="step"`.
  Upcoming: `text-slate-400`, no icon.
- Label typographic role enforced via `text-[12px] leading-[1.4] font-normal`,
  which overrides the `Badge` base's `text-xs font-medium` through `cn()`/tailwind-merge.
- `variant="ghost"` + `pointer-events-none`: ghost is the only Badge variant that
  contributes no base color (so the per-state text colors above win cleanly), and
  `pointer-events-none` suppresses its hover affordance — the pills are genuinely
  non-interactive in v1 (forward-only wizard), so a hover that changes nothing
  would be slop.

### `UploadStep`

- Dropzone is a real `<button type="button">` — free keyboard access, focus ring,
  and Enter/Space activation with zero ARIA gymnastics.
- Drag state tracked via `onDragEnter`/`onDragOver`/`onDragLeave`/`onDrop` +
  `useState`. The inner content carries `pointer-events-none`, so dragenter/dragleave
  only ever fire for the container — no child-crossing flicker, no drag-depth counter.
- Drag-active branch includes `hover:border-indigo-600` alongside
  `border-indigo-600 bg-indigo-50/50`, so the base `hover:border-slate-400` cannot
  win in browsers that keep `:hover` alive during an HTML5 drag.
- Hidden `<input type="file" accept=".csv" className="hidden">` triggered by
  `inputRef.current?.click()`. `onChange` clears `event.target.value` after reading
  the file so re-picking the SAME file after a failed parse still fires.
- Success path calls `onUploaded(result)` with the FULL action result — including
  `columnValues` and `suggestedValueMapping`. No step-navigation state lives here.
- Template download calls `downloadImportTemplate(entityType)` and assembles the
  file client-side: `Blob` → `URL.createObjectURL` → anchor `.click()` →
  `URL.revokeObjectURL`.
- Amber banner (`amber-200`/`amber-50`/`amber-800`) with `role="alert"` for errors.
  Heading is always the contract copy `"Couldn't read this CSV file"`; the body is
  the contract copy `"Check that it's a valid CSV export and try again."` ONLY when
  the action actually returned that parse-failure string. The other action errors
  (`'File has too many rows (max 5000)'`, `'No file provided'`) render their own
  message as the body — showing "is it a valid CSV?" for a 6000-row file would be
  actively misleading and unactionable.
- Uploading state swaps the primary copy to `"Reading your CSV…"` with
  `aria-busy` + `disabled` — a real state change, not decoration.

### `ColumnMappingStep`

- Full-width `p-8` shell, no `max-w` (Map step is a table screen).
- Local state: `mapping` (init from `suggestedMapping`), `valueMapping`
  (init from `suggestedValueMapping`), `expanded`, `isValidating`, `error`.
- Module-level `const ENUM_FIELD_NAMES = new Set(['revenue_band', 'ownership_type', 'seniority'])`
  — mirrors the same constant in `src/app/actions/import.ts`.
- **Enum-typed columns derived LIVE from current `mapping` state**, never from
  `suggestedMapping` at mount, so re-pointing a column at an enum field immediately
  surfaces its sub-table and immediately re-gates Continue.
- **Enum sub-mapping values always read from `columnValues[header]`** (the complete
  distinct set from the full CSV), never from the 5-row `sampleRows` preview.
- Main table: CSV Column (Body/slate-900) · Sample Value (Label/slate-500, in a
  `block max-w-48 truncate` span — a bare `max-w-48` on a `<td>` is ignored without
  `table-layout: fixed`) · Maps To (`Select` + `Badge variant="outline"` "Unmapped").
- Field options derived from `COMPANY_FIELD_ALIASES` / `PERSONA_FIELD_ALIASES` keys —
  the same dictionaries the server used to suggest the mapping, so the two can never drift.
- Enum-mapped rows get a `ChevronDownIcon` toggle button (`rotate-180` when expanded,
  matching `company-list.tsx`'s accordion chevron) plus the contract's
  `"{N} values need mapping"` outline badge when any value is unmapped.
- Expanded row renders a nested 2-column mini-table (`CSV Value` → `Select` of
  canonical enum values, `Unmapped` badge while unset) on a
  `border-t border-slate-200 bg-slate-50 p-4` surface.
- Continue (`Button variant="default"`, "Continue to Validation") is disabled until
  every enum-mapped column has an explicit `valueMapping` entry for every value in
  `columnValues[header]`; a Label-role hint explains the disabled state so the button
  is never mute.
- On Continue: `validateImportBatch(batchId, mapping, valueMapping)` → `onValidated(result)`.
  No step-navigation state lives here.

## Key Decisions

1. **`result.error !== undefined`, not `'error' in result`.** TypeScript normalizes
   a multi-return Server Action's union so BOTH members declare `error` — optional
   `error?: undefined` on the success member. Confirmed by probe:
   `{ error: string; batchId?: undefined; ... } | { batchId: number; ...; error?: undefined }`.
   The `in` operator therefore does not discriminate and `result.error` resolves to
   `string | undefined`. Comparing against `undefined` narrows both branches correctly.
   **This applies to every Server Action in `src/app/actions/import.ts`** — Plans 08
   and 09 will hit the same wall with `commitImportBatch`, `previewRollback`, and
   `executeRollback`. A comment recording this is in both files so it is not
   "simplified" back and broken.

2. **Re-mapping a column clears its `valueMapping`, except when reverting to the
   server's original suggestion.** A `seniority` value can never be a valid
   `revenue_band` value, so stale entries must go. But returning a column to the
   field `suggestedMapping` originally proposed restores `suggestedValueMapping[header]`
   — otherwise an accidental mis-click would permanently destroy the auto-suggestions
   and force fully manual value mapping.

3. **`NO_IMPORT_VALUE = '__no_import__'` sentinel.** Radix `Select` forbids an
   empty-string item value, so the contract's `"— Don't import —"` option needs a
   sentinel translated back to `null` before it reaches the action.

4. **Enum values imported from `@/lib/db/schema` into a client component.** This
   pulls `drizzle-orm/pg-core` enum objects into the client bundle, but
   `company-filters.tsx` (also `'use client'`) already does exactly this, and
   07-PATTERNS.md's enum-values-as-single-source-of-truth rule forbids hardcoding
   the lists a second time. Consistency with the shipped precedent wins.

5. **`FIELD_LABEL_OVERRIDES` for field display names.** `humanizeEnum`'s naive
   slug-capitalization yields "Hq Location" and "Linkedin Url". Three fields get an
   explicit label (`HQ Location`, `LinkedIn URL`, `Employee Count`) matching the
   copy already shipped on `/companies` and the detail panes; everything else falls
   through to `humanizeEnum`. Enum *values* still use `humanizeEnum` unchanged, same
   as the rest of the app.

## Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | clean |
| `npx eslint src/components/import` | clean |
| 13 plan grep checks | 13/13 PASS |
| `grep -c "export default"` on all three files | 0 / 0 / 0 |

## Notes for Downstream Plans

- **Plan 10 (wizard shell)** should import `ImportStep` from
  `import-step-indicator.tsx` and `UploadedBatch` from `upload-step.tsx` rather than
  re-declaring those shapes. `UploadedBatch` is exactly the prop surface
  `ColumnMappingStep` needs (minus `entityType`/`onValidated`).
- `ColumnMappingStep` owns its own `p-8`; `UploadStep` owns its own
  `mx-auto max-w-xl`. The shell should NOT add a second layer of page padding
  around the step content.
- The step-indicator pills are non-interactive by design. If back-navigation is ever
  added, remove `pointer-events-none` and give the completed pills a real button/link
  affordance — do not add hover styling without the navigation behind it.
