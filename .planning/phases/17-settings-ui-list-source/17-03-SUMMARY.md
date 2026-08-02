---
phase: 17-settings-ui-list-source
plan: 03
subsystem: ui
tags: [nextjs, server-components, client-components, radix-select, settings, staleness]

# Dependency graph
requires:
  - phase: 17-settings-ui-list-source
    provides: saveSettingsAction (gate → zod → servable-set → dedupe → atomic upsert → revalidate; never throws), ANTHROPIC_ALLOWLIST ∩ snapshot servable source, D-01 verdict 2026-08-02 (sonnet-only, D-02)
  - phase: 15-model-registry-foundation-persistence
    provides: getModelSettingsForUser(userId) row query, upsertModelSettings atomic full-value upsert, catalog.json committed snapshot with generatedAt + anthropic cost entries
  - phase: 09-reviews
    provides: page template (gate + per-widget error card) and client draft-staging pattern (useState + useTransition + ERROR_COPY + inline status)
provides:
  - /settings server page (Reviews pattern): requireStaffAccess first, getModelSettingsForUser fetch with error-card fallback, server-computed servableModels ({ id, name, costInput, costOutput } from allowlist ∩ snapshot anthropic entries), defaultPrimary prop, saved-config props
  - ModelSettingsForm client component: draft-staged primary + ordered fallbacks, servable-only pickers with cost captions, D-08/D-09 option filtering, D-02-gated fallback section (add/remove/up-down reorder), D-10/D-11 staleness gates, full save lifecycle (Saving… → Saved. / error with draft preserved)
affects: [phase-18-verification, 16-failover-orchestration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Server-computed props-only contract: the page computes servableModels + defaultPrimary server-side from catalog.json; the client form imports nothing from @/lib/models/catalog (grep-gated) so the 1131-row catalog.json never enters a client bundle (CAT-04/T-17-09)
    - Draft-derived staleness gate: staleIds derives from the current useState draft (not immutable props); a stale saved value blocks Save at mount and unblocks the moment the user replaces/removes it (D-10/D-11 "replacing the value re-enables Save")
    - Radix SelectItem span-gap row: `*:[span]:last:flex ... gap-2` renders name + cost caption (`· $3 / $15 per MTok`) on one row; stale ids append as disabled SelectItems labeled by raw id (D-06 fallback rule — the client cannot read the snapshot by design)

key-files:
  created:
    - src/app/(dashboard)/settings/page.tsx
    - src/components/settings/model-settings-form.tsx
  modified: []

key-decisions:
  - "Empty fallback rows are dropped before sending (fallbacks.filter(id => id !== '')) — an in-progress row is not a model selection; sending it verbatim would trip the action's invalid_model with misleading copy. Matches the plan's staleIds `id &&` guard ('' is not stale, so empty rows are saveable) and SET-04's 'empty fallback list is saveable'"
  - "Stale option label falls back to the raw id — the plan says 'stale display name', but the client has no snapshot access by design (client-bundle rule); raw id matches getModelDisplayName's D-06 fallback rule"
  - "isPending is destructured from useTransition (plan showed `const [, startTransition]` yet used isPending in saveDisabled and the button label — resolved to the plan's intended JSX, behavior identical)"
  - "The sonnet-only branch (servableModels.length === 1) still renders stale saved fallbacks as removable rows (Rule 2 fix) — a stale fallback would otherwise linger in the draft with no row to clear it, blocking Save forever (D-10/D-11 must-have truth)"

patterns-established:
  - "Pattern: client-side staleness as the primary D-10/D-11 gate, server invalid_model as backstop — the form blocks stale ids client-side and the action (17-02) re-validates every id against the servable set, so a bypassed client still cannot persist a non-runnable model"
  - "Pattern: draft-only staging (D-07) — reorder/remove/add mutate useState only; nothing persists until the explicit Save button; no router.refresh on success (the action's revalidatePath keeps the server cache fresh); no navigation guard (D-15)"

requirements-completed: [SET-02, SET-03, SET-04, SET-05, SET-06]

# Metrics
duration: 7min
completed: 2026-08-02
---

# Phase 17 Plan 03: Settings Page + Model Configuration Form Summary

**The Settings surface staff interact with: a Reviews-pattern server page at `/settings` (gate → fetch → server-computed servable models → render) feeding a client form that stages a draft primary + ordered-fallback chain with cost-captioned servable-only pickers, up/down reorder, and a full save lifecycle through the plan 17-02 Server Action — with the client-side staleness gate (D-10/D-11) as the primary mechanism keeping non-runnable models out of the DB. Sonnet-only today (D-02), so the fallback section renders the muted note; the branch structure is ready for a roster expansion.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-08-02T14:23:55Z
- **Completed:** 2026-08-02T14:30:50Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- **`/settings` server page** (`src/app/(dashboard)/settings/page.tsx`): `await requireStaffAccess()` first (T-17-07 belt-and-suspenders alongside the (dashboard) layout gate, reviews precedent), `getModelSettingsForUser(userId)` in try/catch → the established per-widget error card ("Couldn't load your settings"), and server-computed picker data — `getAllowlistedServableIds(catalogJson)` (allowlist ∩ snapshot, never raw catalog rows, SET-07) mapped to `{ id, name, costInput, costOutput }` reading `m.cost.input`/`m.cost.output` from the snapshot's **anthropic** entries (the dual opencode/anthropic entries make the provider filter load-bearing), `defaultPrimary` from `FAST_MODEL_ID`, and `catalogJson.generatedAt` for the D-04 footer.
- **`ModelSettingsForm` client component** (`src/components/settings/model-settings-form.tsx`): draft state (`primary` + ordered `fallbacks`) stages everything locally (D-07) with the empty-state callout when `saved === null` (SET-02); primary picker shows servable models with cost captions (D-03, e.g. `Claude Sonnet 4.6 · $3 / $15 per MTok`) plus a stale saved primary as a disabled item; the fallback section branches on `servableModels.length` — the sonnet-only muted note (D-02) today, full rows (add/remove/up-down reorder, Add disabled at 2) when ≥ 2 servable models exist (SET-04/SET-05, D-05/D-06); option filtering enforces D-08/D-09 (primary never a fallback option, a chosen model disappears from the other slots).
- **Staleness gates (D-10/D-11)**: `staleIds` derives from the current draft — a stale saved value blocks Save at mount and re-enables the moment the user replaces or removes it ("replacing the value re-enables Save"); stale values render as disabled `SelectItem`s with the verbatim red warning. The server action's `invalid_model` (17-02) remains the backstop (T-17-08).
- **Save lifecycle (D-12..D-15)**: `useTransition` wraps `saveSettingsAction({ primaryModel, fallbacks })`; button shows `Saving…` while pending and is disabled during pending/stale; `Saved.` inline confirmation on success (the action's `revalidatePath('/settings')` keeps the reload fresh); on failure the draft is preserved verbatim (D-13); no `router.refresh()` (D-15 no nav guard).
- **Zero new packages, zero shadcn installs, zero client imports of catalog.ts** — the form receives server-computed props only (T-17-09 grep-gated); the D-04 footer reuses the shared `dateFormatter`.
- Full-suite regression: **288 passed / 6 skipped / 0 failed** (30 test files); `npx tsc --noEmit` clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: settings/page.tsx — the server page (Reviews pattern)** - `cb47eaea` (feat)
2. **Task 2: model-settings-form.tsx — the client form** - `5869caee` (feat)
3. **[Rule 2 fix] Stale fallbacks removable in the sonnet-only branch** - `b8b7ba56` (fix)

**Plan metadata:** `9b3231a6` (docs: complete settings-ui plan) — see Final Commit section below.

_Note: Tasks 1 and 2 are a mutually-importing pair (the page renders the form), so tsc was verified on the combined tree before each task commit; each commit contains only its task's file._

## Files Created/Modified

- `src/app/(dashboard)/settings/page.tsx` - server component (no 'use client'); `requireStaffAccess` first, `getModelSettingsForUser` try/catch → error card, `servableModels` from `getAllowlistedServableIds(catalogJson)` mapped to `{ id, name, costInput, costOutput }` via the snapshot's anthropic entries, `defaultPrimary` prop, renders `<ModelSettingsForm saved={...} servableModels={...} defaultPrimary={...} catalogGeneratedAt={...} />` in a `gap-8 p-8` container with the Reviews h1 class
- `src/components/settings/model-settings-form.tsx` - 'use client'; `ModelSettingsForm` with draft state, `staleIds`/`saveDisabled`, `handleSave` (useTransition + `saveSettingsAction`, ERROR_COPY map with exactly `action_failed`/`invalid_model`/`duplicate_model`), D-02-branched fallback section (muted note | rows with ArrowUp/ArrowDown/X ghost icon buttons + Add fallback), stale disabled SelectItems + red warnings, footer `Catalog synced {date}` via shared `dateFormatter`

## Decisions Made

- Empty fallback rows are filtered out of the action payload (see Deviations — Rule 2)
- Stale option labels fall back to the raw id (D-06 rule; the client cannot read the snapshot)
- `isPending` destructured from `useTransition` (plan's intended JSX; the plan text itself discarded it)
- Sonnet-only branch keeps stale saved fallbacks removable (Rule 2 — see Deviations)
- Footer date and picker captions verified against live catalog data: `generatedAt: 2026-08-02T09:33:54.568Z` → `Catalog synced Aug 2, 2026`; sonnet anthropic entry `cost: { input: 3, output: 15 }` → `Claude Sonnet 4.6 · $3 / $15 per MTok`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] Empty fallback rows filtered before sending to the action**
- **Found during:** Task 2 — analyzing the save path against the action's validation
- **Issue:** The plan's verbatim `handleSave` sends `fallbacks` as-is. A freshly added, unfilled row (draft value `''`) passes zod (a string) then fails the servable-set check → `invalid_model` → misleading copy ("This model is no longer available.") for a perfectly normal in-progress state. The plan's own `staleIds` guard (`id &&`) deliberately treats `''` as non-blocking, so empty rows are saveable by design — but sending them verbatim makes every such save error.
- **Fix:** `fallbacks: fallbacks.filter((id) => id !== '')` in `handleSave` — an unfilled row carries no model, so it is dropped before send; the draft itself is untouched (on reload the row correctly disappears since it was never a real fallback). Matches SET-04 ("empty fallback list is allowed and saveable").
- **Files modified:** `src/components/settings/model-settings-form.tsx`
- **Commit:** `5869caee`

**2. [Rule 2 - Correctness] Stale saved fallbacks stuck blocking Save in the sonnet-only branch**
- **Found during:** Task 2 final review — the `servableModels.length === 1` branch renders only the muted note, hiding any stale saved fallback.
- **Issue:** If the roster ever expands (allowing a fallback to be saved) then contracts back to one servable model, the draft would hold a stale fallback id with no rendered row to remove it — Save blocked forever with no escape (violates the plan's own must-have truth: "a saved-but-stale model renders as a disabled option with an inline warning; Save is blocked until it is replaced"). Unreachable with today's sonnet-only allowlist (no fallback can ever be saved), but the standing roster-maintenance path makes it reachable later.
- **Fix:** The `=== 1` branch now renders stale saved fallbacks as removable rows — a disabled `Select` showing the stale id (raw-id label, D-06 rule), the verbatim red warning, and a ghost `X` "Remove fallback" button. Replacement is impossible with one servable model, so removal is the only exit. The muted note still renders above.
- **Files modified:** `src/components/settings/model-settings-form.tsx`
- **Commit:** `b8b7ba56`

### Plan-text corrections (no code behavior change)

- The plan's Task 2 spec showed both `const [, startTransition] = useTransition();` (discarding `isPending`) and later usage of `isPending` in `saveDisabled` and the button label. Resolved by destructuring `const [isPending, startTransition]` — the plan's clearly intended JSX, behavior identical.
- The plan says a stale option renders "with the stale display name"; the client has no snapshot access by design, so the label falls back to the raw id (consistent with `getModelDisplayName`'s D-06 fallback rule).

## Issues Encountered

- **Task-commit interdependency:** the page (Task 1) imports the form (Task 2), so `npx tsc --noEmit` cannot pass until both files exist. Both files were written and verified on the combined tree before each task's commit; each commit stages only its own task file (the Task 1 commit alone would not compile — standard for a mutually-importing file pair, same shape as 17-02's intentional RED commit).

## Stub Scan

No stubs: the `''` empty fallback row is a transient draft artifact (filtered at save), `saved === null` is the designed empty state (renders the callout), and `m?.cost?.input ?? 0` reads real snapshot data for allowlisted ids (the `?? 0` is a defensive guard for an absent anthropic entry, which cannot occur for allowlisted ids in practice). No placeholder/coming-soon/TODO copy anywhere in either file.

## Threat Flags

None — no new security-relevant surface beyond the plan's threat register. T-17-07 (gate first), T-17-08 (client disable + server re-validation backstop), T-17-09 (client-bundle grep gate: 0 hits in client files; the page's catalog imports are server-side), T-17-10 (accepted — public catalog data), T-17-SC (zero install surface) all in place.

## Verification

- `npx tsc --noEmit` — clean (run after each task and after the Rule 2 fix)
- `npx vitest run src/app/actions/settings.test.ts src/lib/models/catalog.test.ts src/lib/nav.test.ts src/lib/sidebar-collapse.test.ts` — 38 passed (4 files, no regressions)
- Full suite: `npx vitest run` — **288 passed / 6 skipped / 0 failed** (30 files)
- Task 1 grep gate: `getAllowlistedServableIds` present in page.tsx (3 hits)
- Task 2 grep gate: `grep -c "lib/models/catalog" src/components/settings/model-settings-form.tsx` → 0
- Client-bundle gate: `grep -rn "lib/models/catalog" src/components/settings/ src/app/(dashboard)/settings/` — the only hits are the **server** page's legitimate imports; zero client-file hits
- Copy contract: every string in both files matches the 17-UI-SPEC copywriting table verbatim (verified line-by-line against lines 104-135)
- <human-check> end-of-phase (deferred to Phase 18 VER-03): start `npm run dev`, sign in with a staff Clerk account, visit `/settings`, confirm config/empty-state rendering, servable-only pickers with cost captions, fallback add/remove/reorder, Save → "Saved." + persisted reload. Recorded for the phase gate; the full settings→Analyze→model_used UAT lives in Phase 18 VER-03.

## Next Phase Readiness

- SET-02..SET-06 delivered: the read side (current config + empty state), the write side (draft staging, D-08/D-09 option rules, save lifecycle with draft preservation), and the D-10/D-11 staleness gates that keep the DB free of non-runnable models before Phase 16's runAgent consumes it
- Phase 18 (VER-03) consumes the full loop: change settings → Analyze → `agent_run.model_used` matches — the milestone's core acceptance test, now with a complete UI surface to drive it
- Phase 16's runAgent consumes whatever this page saves via the `user_model_settings` row (decoupled via the DB, as designed)

---

*Phase: 17-settings-ui-list-source*
*Completed: 2026-08-02*

## Self-Check: PASSED

- [x] `src/app/(dashboard)/settings/page.tsx` exists — server component, `requireStaffAccess` first statement, error card, `getAllowlistedServableIds` mapping, `defaultPrimary`, renders the form
- [x] `src/components/settings/model-settings-form.tsx` exists — 'use client', `ModelSettingsForm` export, zero catalog imports, three-code ERROR_COPY, D-02 branch, stale gates, save lifecycle
- [x] Commits `cb47eaea`, `5869caee`, `b8b7ba56` present in git history
- [x] `npx tsc --noEmit` exit 0
- [x] Full vitest suite: 288 passed / 6 skipped / 0 failed
- [x] Client-bundle grep gate: 0 hits in client files

## Self-Check: PASSED (post-write verification)

All 3 files exist on disk and all 3 plan commits (`cb47eaea`, `5869caee`, `b8b7ba56`) are present in git history — confirmed via `git log --oneline --all`.
