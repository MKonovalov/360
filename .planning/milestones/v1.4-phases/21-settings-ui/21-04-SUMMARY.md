---
phase: 21-settings-ui
plan: 04
subsystem: ui
tags: [combobox, cmdk, shadcn, popover, model-picker, data-checked, composite-round-trip, sett4, sett5, sett6, sett7]

# Dependency graph
requires:
  - phase: 21-settings-ui
    provides: 21-01's vendored Command/Popover primitives (cmdk 1.1.1 wrapper with auto-rendered CheckIcon gated on data-checked) + 21-02's pure logic module (searchValue/suffixLabel/isHighCost/groupByProvider/providerName + ServableModel type)
provides:
  - src/components/settings/model-picker.tsx — the single reusable Combobox wrapper (D-21-05/06): Popover + Button trigger (selected value + provider badge + chevron) + Command list with type-to-filter search, provider CommandGroup sections, per-row check state via data-checked, badges, suffix labels, cost warnings, family subtitles, and a stale-row disabled rendering path
  - The two silent-failure traps structurally locked: data-checked={value === m.id} per row (Pitfall 1) and the composite→id reverse-lookup in onSelect (Pitfall 3)
  - Client-safe wrapper: props + pure logic module only, zero catalog imports (T-17-09)
affects: [Plan 21-05 form swap (ModelPicker consumption for all three model slots), Phase 22 verification gate, SET-04/05/06/07 completion (UI-visible — lands in 21-05)]

# Tech tracking
tech-stack:
  added: [] (no new dependencies — consumes cmdk@^1.1.1 shipped in 21-01)
  patterns: [classic shadcn searchable-select Combobox over vendored Command+Popover; data-checked per CommandItem to drive the vendored auto-rendered CheckIcon; composite→id reverse-lookup before onChange; indexed-access type derivation (ServableModel['providerID']) to avoid a second type import that would trip the client-safety canary]

key-files:
  created:
    - src/components/settings/model-picker.tsx

key-decisions:
  - "No Check icon import: the vendored v4 CommandItem auto-renders its CheckIcon (command.tsx:164, gated on group-data-[checked=true]) — a manual Check import would be dead code; the plan's own verification instruction (verify against the vendored anatomy) confirms omission"
  - "ModelProviderId deliberately NOT imported: the plan's import spec is self-contradictory (importing from the canonical source trips the mandatory lib/models/catalog→0 canary; importing from model-picker-logic fails tsc TS2459 — the module imports but does not re-export it, per the 21-03 decision flag). Resolved via ServableModel['providerID'] indexed access — same union, cannot drift, canary stays 0"
  - "Trigger label uses {value ? selected?.name ?? value : placeholder} (PATTERNS skeleton form) instead of the plan's literal {selected?.name ?? value ?? placeholder} — the literal renders a BLANK trigger for value='' (the in-progress fallback-row sentinel); the placeholder must show instead"
  - "Row anatomy wrapped in a flex flex-col container so the family subtitle renders as an actual second line (UI-SPEC §Row Anatomy, D-21-11) — the plan's literal block span as a direct flex child of the vendored CommandItem (flex items-center) would sit inline after the cost caption"
  - "cn() used for the cost-caption conditional (justifies the plan-mandated cn import; tailwind-merge output identical to the plan's template literal)"

patterns-established:
  - "Pattern: v4 Combobox check-state — pass data-checked={value === m.id} on every CommandItem with a why-comment; the vendored CheckIcon (group-data-[checked=true]/command-item:opacity-100) never shows otherwise (cmdk 1.1.1 emits only data-selected/aria-selected/data-disabled)"
  - "Pattern: composite round-trip — CommandItem value = searchValue(m) (id-first composite); onSelect receives the composite, reverse-lookup to the id (options.find((o) => searchValue(o) === v)?.id ?? '') before onChange, or the draft stores the composite and Save fails invalid_model"
  - "Pattern: indexed-access type derivation for client-safety canaries — ServableModel['providerID'] instead of importing the union from its canonical path, keeping grep canaries clean while the type cannot drift"
  - "Pattern: two-line CommandItem rows need a flex-col wrapper (badge+name+suffix+cost line 1, family line 2) — block display on a direct flex child does not wrap in the vendored flex CommandItem"

requirements-completed: []  # NOTE: deliberately empty — this plan ships the wrapper; SET-04/05/06/07 acceptance is UI-visible behavior (rendered pickers, badges, search UX, labels, stale-row rendering) which lands in the 21-05 form swap. Same rationale as 21-01/21-02/21-03.

# Metrics
duration: 20min
completed: 2026-08-02
---

# Phase 21 Plan 4: model-picker.tsx Combobox Wrapper Summary

**Reusable shadcn searchable-select Combobox wrapper (Popover + Button trigger with provider badge + Command type-to-filter list with provider CommandGroup sections) that locks the two phase-critical silent-failure traps — data-checked per-row check state (Pitfall 1) and composite→id reverse-lookup before onChange (Pitfall 3) — as the single picker component all three model slots consume in 21-05**

## Performance

- **Duration:** 20 min
- **Started:** 2026-08-02T23:11:00Z
- **Completed:** 2026-08-02T23:31:32Z
- **Tasks:** 1 (type="auto", no checkpoints)
- **Files modified:** 1 (created)

## Accomplishments
- `src/components/settings/model-picker.tsx` implements the full Combobox contract per PATTERNS skeleton + RESEARCH Pattern 1: `Popover` + `PopoverTrigger asChild` → `Button variant="outline" role="combobox"` showing `{provider badge} {selected name}` (raw-value fallback keeps stale saved ids visible) + chevron; `PopoverContent` at `w-(--radix-popover-trigger-width) p-0` (Pitfall 5 — dropdown matches trigger width); `Command` → `CommandInput placeholder="Search models…" autoFocus` → `CommandList` → `CommandEmpty>No models found.</CommandEmpty`
- **data-checked lock (Pitfall 1, the #1 failure point):** every selectable row passes `data-checked={value === m.id}` with the required why-comment — cmdk 1.1.1 never sets `data-checked`, and the vendored v4 CommandItem's auto-rendered CheckIcon (`command.tsx:164`, gated on `group-data-[checked=true]/command-item:opacity-100`) shows nothing without it. Ground-truth-verified with a tsc probe before authoring (the plan's verify chain alone would not have caught a type error).
- **Composite round-trip lock (Pitfall 3):** `value={searchValue(m)}` (id-first composite, unique per row) + `onSelect` reverse-lookup `options.find((o) => searchValue(o) === v)?.id ?? ''` before `onChange` — the draft can never store the composite (which would fail Save with `invalid_model`); `?? ''` mirrors the in-progress-fallback-row convention.
- **Provider grouping (D-21-08):** `grouped=true` renders one `CommandGroup heading={providerName(p)}` per present provider (insertion order from `groupByProvider`); the primary (provider-scoped, SET-02) renders a single section header from `options[0]?.providerID ?? 'anthropic'`. Both modes share one row-rendering path via a precomputed `groups` array.
- **Row anatomy per UI-SPEC:** provider badge (grouped/union pickers only), name, `~latest`/`:free` suffix labels (D-21-12), cost caption `· $X / $Y per MTok` with `amber-700` when `isHighCost(m.costInput)` else `slate-500` (D-21-13), and the family subtitle as a true second line (D-21-11).
- **Stale-row rendering (D-10/D-11):** non-null `staleLabel` appends a disabled `CommandItem` (provider badge when known + stale label) — the D-10/D-11 stale-saved-value marker; the red "no longer runnable" hint stays in the form.
- **Client-safe (T-17-09):** value imports limited to the pure logic module + UI primitives; `ServableModel` is type-only (erased at compile); `lib/models/catalog` grep → 0 and `catalog.json` grep → 0 (canaries clean). Wrapper is dumb — grouping/labels/prices all derive from passed options + logic helpers.
- All plan gates green: 5 acceptance greps (data-checked=1, reverse-lookup=1, popover-width=1, no-catalog-import=0, no-catalog.json=0), full `npx tsc --noEmit` exit 0, and the 21-02 logic suite still 21/21 (no regression).

## Task Commits

Each task was committed atomically:

1. **Task 1: model-picker.tsx — the Combobox wrapper with data-checked + composite round-trip** - `e7bb710c` (feat)

**Plan metadata:** (final docs commit follows — SUMMARY + STATE/ROADMAP)

## Files Created/Modified
- `src/components/settings/model-picker.tsx` - The reusable Combobox wrapper: named export `ModelPicker`, `'use client'`, props `{ id, ariaLabel, value, options, onChange, placeholder, badge?, grouped?, staleLabel? }`; Popover+Button trigger, Command list with grouped/un-grouped provider sections, data-checked rows, composite round-trip, suffix/high-cost/family row anatomy, disabled stale-row path. Single quotes + semicolons + 2-space house style (only vendored files use double quotes). No imports modified.

## Decisions Made
- No manual `Check` icon — the vendored CommandItem auto-renders its CheckIcon; importing it would be dead code (plan's own "verify against the vendored anatomy" instruction confirms).
- `ModelProviderId` resolved by indexed access (`ServableModel['providerID']`) instead of a second type import — resolves the plan's self-contradictory import spec (see Deviation 2).
- Trigger label uses the PATTERNS skeleton's truthy-value form so `''` (in-progress fallback row) shows the placeholder instead of a blank trigger (see Deviation 1).
- Two-line row anatomy via a `flex flex-col` wrapper so the family subtitle actually renders on line 2 (see Deviation 3).
- `cn()` for the cost-caption conditional — identical rendered classes, justifies the plan-mandated `cn` import.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Blank trigger when value='' (in-progress fallback-row sentinel)**
- **Found during:** Task 1 (trigger label authoring)
- **Issue:** The plan's literal `{selected?.name ?? value ?? placeholder}` renders an EMPTY string when `value=''` — `''` is not nullish, so the `?? placeholder` branch never runs. Fallback slots with no chosen model (v1.3 behavior: Select placeholder) would show a blank button. The plan's own PATTERNS skeleton uses the truthy form `{value ? options.find(...)?.name ?? value : placeholder}`.
- **Fix:** Trigger label = `{value ? selected?.name ?? value : placeholder}` — stale raw id still visible when truthy-and-unknown; `''` falls through to the placeholder. Preserves the plan's stated raw-value-fallback intent (UI-SPEC §Row Anatomy).
- **Files modified:** src/components/settings/model-picker.tsx (trigger span only)
- **Verification:** tsc clean; placeholder path exercised by the `''` branch in the label expression
- **Committed in:** e7bb710c (Task 1 commit)

**2. [Rule 3 - Blocking] ModelProviderId import spec is self-contradictory — resolved via indexed access**
- **Found during:** Task 1 (imports authoring)
- **Issue:** The plan's action text says `import type { ServableModel, ModelProviderId }` from './model-picker-logic' while ALSO mandating `grep -c "lib/models/catalog" → 0` in both acceptance criteria and verify chain. Importing `ModelProviderId` from its canonical source (`@/lib/models/catalog`) trips the canary (the path string contains `lib/models/catalog`); importing from './model-picker-logic' fails tsc with TS2459 — that module imports the type but does NOT re-export it (explicitly flagged in the 21-03 decision log). Either choice breaks a hard gate.
- **Fix:** Drop the `ModelProviderId` import entirely; type the `badge` prop as `ServableModel['providerID']` (indexed access — identical union, cannot drift from the canonical source) and cast group keys as `ServableModel['providerID'][]`. Canary stays 0, tsc passes, client-safety rationale documented in a header why-comment (phrased to never trip the canary — the 21-02 lesson).
- **Files modified:** src/components/settings/model-picker.tsx (imports + props type + group-key cast)
- **Verification:** `grep -c "lib/models/catalog"` → 0; `npx tsc --noEmit` exit 0
- **Committed in:** e7bb710c (Task 1 commit)

**3. [Rule 1 - Bug] Family subtitle would not render as a second line**
- **Found during:** Task 1 (row anatomy authoring)
- **Issue:** The plan's literal row markup puts the family `<span className="block ...">` as a DIRECT child of `CommandItem`, which is `flex items-center` (vendored command.tsx:158). A `block` span in a flex container is still a flex item laid out horizontally — the family would sit inline after the cost caption, violating UI-SPEC §Row Anatomy ("rendered as a second line under the model name", D-21-11), which the task brief names as authoritative.
- **Fix:** Wrapped the row content in `<div className="flex min-w-0 flex-1 flex-col">` — line 1 (badge + name + suffix + cost caption) in an inline span, family as the block span below it; the vendored `ml-auto` CheckIcon stays right-aligned on the outer flex row.
- **Files modified:** src/components/settings/model-picker.tsx (row markup only)
- **Verification:** tsc clean; markup review against UI-SPEC §Row Anatomy
- **Committed in:** e7bb710c (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (2 Rule 1 — markup/label correctness against the authoritative UI-SPEC; 1 Rule 3 — blocking import conflict resolved)
**Impact on plan:** All three fixes were required for correctness (blank trigger, missing line-2 family, tsc/canary conflict). Zero scope creep, no architectural change — the component still implements the exact props contract, grouping modes, and row anatomy the plan specifies.

## Issues Encountered
- **`data-checked` typecheck uncertainty (resolved by probe):** cmdk 1.1.1's ItemProps is a closed set over `keyof React.HTMLAttributes` and @types/react 19.2.17's `HTMLAttributes` has no `data-*` index signature — it was not obvious that `data-checked` compiles. Verified with a throwaway probe component (`npx tsc --noEmit` exit 0, probe deleted) before authoring the real file. No code impact; documented so future executors know the pattern is type-safe.
- **Planned-grep count expectations:** my extended presence-grep chain expected exact counts (e.g. `suffixLabel(m.id)` → 1) but the file legitimately contains 2 (condition + render). The plan's own verify greps are exact-count and all passed; the acceptance criteria only require presence for these symbols.

## User Setup Required
None - no external service configuration required (no env changes, no new npm dependencies — cmdk shipped in 21-01).

## Next Phase Readiness
- Plan 21-05 (form swap) consumes `ModelPicker` for all three model slots with the verified props contract: primary (`grouped=false`, `badge={provider}`, options from `servableByProvider[provider]`, `staleLabel` from the saved primary when stale) and fallbacks (`grouped=true`, union options via `optionsForSlot`, per-slot badges, stale rows via `savedChain`-resolved labels). The composite round-trip means the form's `onChange` receives model IDs — no downstream parsing needed.
- **Flag for 21-05:** import `ModelProviderId` from `@/lib/models/catalog` (canonical source) in the FORM if needed — this wrapper deliberately avoided the import (canary + TS2459); the form's own canary greps must account for its type imports.
- SET-04/05/06/07 remain open in REQUIREMENTS.md by design — the wrapper's visible behavior (badges, search UX, labels, stale rows) completes when 21-05's form swap renders it.

---

*Phase: 21-settings-ui*
*Completed: 2026-08-02*

## Self-Check: PASSED

- Files: `src/components/settings/model-picker.tsx`, `.planning/phases/21-settings-ui/21-04-SUMMARY.md` — both FOUND
- Commits: `e7bb710c` (Task 1 feat), `c2e7051d` (SUMMARY docs), `0c38db2d` (STATE/ROADMAP docs) — all present in git log
- Gates: 5 plan acceptance greps pass (data-checked=1, `searchValue(o) === v`=1, `w-(--radix-popover-trigger-width)`=1, `lib/models/catalog`=0, `catalog.json`=0); `npx tsc --noEmit` exit 0; 21-02 logic suite 21/21 no regression
