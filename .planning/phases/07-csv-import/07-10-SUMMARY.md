# Plan 07-10 Summary — Wizard Shell + Route Pages

**Status:** Complete
**Date:** 2026-07-31
**Wave:** 5 (depends on Plans 07 + 08)

## What Was Built

Assembled the four Wave-4 step components into a single client step-state machine and wired it into two dedicated routes.

### Files Created

| File | Purpose |
|------|---------|
| `src/components/import/import-wizard.tsx` | `'use client'` wizard shell — owns `step` + the three small result slices, renders page header + `ImportStepIndicator` + "Start over", delegates to the four step components |
| `src/app/companies/import/page.tsx` | Server Component route, `entityType="company"` |
| `src/app/personas/import/page.tsx` | Server Component route, `entityType="persona"` |

No new layout files — `src/app/companies/layout.tsx` / `src/app/personas/layout.tsx` already wrap these subtrees with `AppShellLayout` + `requireStaffAccess()`.

## Design Decisions

- **Pattern 2 honored exactly (07-RESEARCH.md).** Client state is `step` + `uploadResult` (`UploadedBatch`) + `validateResult` (`{ counts, errorReport }`) + `commitResult` (`ImportCounts`). No `rawCsv`, no parsed-row array, no validated-row set ever enters the browser — verified by grep. A 5000-row upload costs the client only its headers, a 5-row preview, and the distinct enum value sets.
- **Types imported, never re-declared.** `ImportStep` from `import-step-indicator.tsx`, `UploadedBatch` from `upload-step.tsx`, `ImportCounts` + `ImportRowError` from `validation-preview-step.tsx` — exactly as Plans 07 and 08 flagged. The only new local type is `ValidationResult`, which composes two of them.
- **Double-padding resolved with `[&>*]:p-0!`.** The route shell owns `p-8` (single source of page padding); `ColumnMappingStep`, `ValidationPreviewStep`, and `DoneStep` each ship their own `p-8` because they were built as standalone screens. The important modifier is required, not cosmetic: `[&>*]:p-0` and a child's `p-8` carry *equal* CSS specificity, so without `!` the winner is decided by Tailwind's emit order. Shape matches the vendored `badge.tsx`'s `[&>svg]:size-3!`. `mx-auto max-w-xl` on Upload/Done is left intact — that is layout, not padding, and the spec requires it.
- **Forward-only, one escape hatch.** "Start over" is a text link (indigo-600, 12px Label role) sitting right-aligned on the step-indicator row, visible on every step. It resets `step` to `'upload'` and nulls all three result slices — leaving `uploadResult` behind would let a second upload's Map screen render the first file's headers. No back buttons (07-UI-SPEC.md "Wizard shell").
- **Entity-specific page title via a lookup map.** `PAGE_TITLE = { company: 'Import Companies', persona: 'Import Personas' } as const` rather than `Import ${entityType}s` — 'company' + 's' is 'companys', the same trap `ROUTE_BY_RECORD_TYPE` and Plan 09's `ENTITY_NOUN` already closed.
- **Belt-and-suspenders auth.** Both route pages `await requireStaffAccess()` even though their layouts already do (02-RESEARCH.md Pitfall 4).
- **Spacing per 07-UI-SPEC.md.** `gap-4` (md) between title and step indicator (one header cluster); `gap-12` (2xl) between the indicator and step content — the spec's explicit "major section break".

## Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | clean |
| `npx eslint` (3 new files) | clean |
| `npm run build` | ✓ Compiled successfully in 4.2s |
| Routes registered | `ƒ /companies/import`, `ƒ /personas/import` |
| 12 plan grep checks | all pass |
| No `rawCsv`/`parsedRows`/`validatedRows` in wizard | confirmed |

## Notes for Downstream Work

- Plan 11 (menu wiring) should point the `/companies` and `/personas` `ExplorerMenu` "Import" item at `/companies/import` and `/personas/import` respectively, and drop its `disabled: true`.
- The build output confirms `/companies/import/history` and `/personas/import/history` now exist, so `DoneStep`'s "View import history" link resolves.
- The wizard has no top-right "Import history" link (07-UI-SPEC.md mentions one on every step). It was left out of this plan's scope; if added later it belongs on the same row as "Start over".
