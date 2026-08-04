---
phase: 21-settings-ui
plan: 03
subsystem: ui
tags: [settings, page, props, server-component, provider-aware, anti-pattern-1, t17-09]

# Dependency graph
requires:
  - phase: 19-provider-registry
    provides: catalog.ts provider-scoped helpers (getServableIdsForProvider, getUnionServableIds, getProviderForModelId, SERVABLE_PROVIDERS, ModelProviderId) + modelFactory PROVIDER_DEFAULT_MODELS (D-07)
  - phase: 21-settings-ui
    provides: 21-02's ServableModel six-field shared prop type (model-picker-logic.ts, type-only import)
provides:
  - src/app/(dashboard)/settings/page.tsx widened server props: providers (SET-01), servableByProvider (SET-02), unionServableModels (SET-04), defaults from PROVIDER_DEFAULT_MODELS (SET-03 source), savedChain with server-resolved provider identity (SET-05)
  - Provider-scoped trimRow (Anti-Pattern 1 lock: mm.id === id && mm.providerID === provider) — the single correctness gate for all 337 trimmed rows
  - The model-settings-form re-pointed to the new props (Rule 3 auto-fix) so the tree stays green until 21-05 lands the provider dimension
affects: [Plan 21-04 model-picker.tsx wrapper (consumes the trimmed shapes), Plan 21-05 form provider dimension + ModelPicker swap (receives the new props; replaces the const provider + re-pointed Select sources), Phase 22 verification gate, SET-01/02/04/05]

# Tech tracking
tech-stack:
  added: [] (no new dependencies — pure server-side computation over existing modules)
  patterns: [provider-scoped trim helper over catalog.json (Anti-Pattern 1), props-only boundary extended to provider-aware shapes (T-17-09), server-side defaults from PROVIDER_DEFAULT_MODELS (D-07)]

key-files:
  created: []
  modified:
    - src/app/(dashboard)/settings/page.tsx
    - src/components/settings/model-settings-form.tsx

key-decisions:
  - "The five new props (providers, servableByProvider, unionServableModels, defaults, savedChain) are all server-computed per 21-UI-SPEC §Props & Data Contract — catalog.json (1131 rows incl. costs) never crosses into a client bundle (T-17-09)"
  - "Every trimRow row lookup is provider-scoped (mm.id === id && mm.providerID === provider) — the snapshot dual-lists ids (claude-sonnet-5 as opencode AND anthropic; anthropic/claude-sonnet-5 as openrouter AND vercel) and a bare find returns the opencode/vercel gateway row with cost 0 / wrong family / wrong provider (Anti-Pattern 1)"
  - "FAST_MODEL_ID dropped from the page import — its only consumer (defaultPrimary) was deleted; the empty-state prefill now reads defaults['anthropic'] via the defaults prop (REG-05 default chain head)"
  - "Rule 3 auto-fix: model-settings-form re-pointed to the new props in this plan (type-only imports, union staleness gate, union option sources, sonnet-only branch removed) — required for the plan's own `npx tsc --noEmit` gate; the provider selector dimension stays in 21-05 Task 1"
  - "ModelProviderId imported type-only from @/lib/models/catalog in the form (its canonical source) — model-picker-logic imports but does NOT re-export it, so the 21-05 plan's literal import spec would hit TS2459"

patterns-established:
  - "Pattern: provider-scoped trimRow with the explicit ServableModel return type — the page's single row-trimming choke point; all five prop computations funnel through it so Anti-Pattern 1 is enforced once, not per-prop"
  - "Pattern: wave-2 props plumb while the consumer still has the old signature → Rule 3 re-point is the executor's obligation to keep the tree green at every commit (21-05 Task 1 then lands the new UI on top of the re-pointed data sources)"

# NOTE: requirements-completed is deliberately [] — this plan ships the props
# plumbing (the server half of SET-01/02/04/05) but the requirement acceptance
# criteria are UI-visible behavior (selector renders, picker refresh, badges on
# rows + saved chain) landing in 21-04/21-05. Same rationale as 21-01 (SET-06)
# and 21-02 (SET-03/04/06/07/08) leaving requirements open.
requirements-completed: []

# Metrics
duration: 11min
completed: 2026-08-02
---

# Phase 21 Plan 3: Provider-Aware Settings Page Props Summary

**Server-computed provider-aware props (providers, servableByProvider, unionServableModels, defaults, savedChain) plumbed through settings/page.tsx via a single provider-scoped trimRow — the T-17-09 props-only boundary widened to 337 trimmed rows with every lookup locked to its servable provider (Anti-Pattern 1), plus the form re-pointed to the new props (Rule 3) so the tree stays green for 21-05**

## Performance

- **Duration:** 11 min
- **Started:** 2026-08-02T23:12:00Z
- **Completed:** 2026-08-02T23:22:43Z
- **Tasks:** 1 (type="auto", no checkpoints)
- **Files modified:** 2

## Accomplishments
- `settings/page.tsx` now delivers the full 21-UI-SPEC §Props & Data Contract: `providers` (SET-01 — the 2-choice selector options), `servableByProvider` (SET-02 — anthropic 1 row, openrouter 336 rows), `unionServableModels` (SET-04 — 337 rows, the fallback pickers' union), `defaults` (D-07 reset source from `PROVIDER_DEFAULT_MODELS`, SET-03's data half), and `savedChain` (SET-05 — saved primary + fallbacks with `getProviderForModelId`-resolved provider identity, null on catalog drift for the raw-id fallback path)
- **Anti-Pattern 1 enforced once, at the choke point:** every one of the 337+ trimmed rows flows through `trimRow`, whose find is `mm.id === id && mm.providerID === provider` — a bare id find would read the dual-listed opencode/vercel gateway row (sorts first) with cost 0 / wrong family / wrong provider (T-21-07 mitigated; grep-locked in the acceptance chain)
- **T-17-09 boundary preserved:** catalog.json (1131 rows incl. per-model costs) and catalog.ts stay server-only; only the six-field `ServableModel` shapes (type-only imported from model-picker-logic) cross into the client; `PROVIDER_DEFAULT_MODELS` import into the server page is RESEARCH-A6-safe (module-scope `createOpenRouter` runs harmlessly at request time, never in a client bundle)
- `defaultPrimary` deleted — `defaults` subsumes it (empty-state prefill becomes `defaults[provider].id` in the form); `FAST_MODEL_ID` dropped from the page import (no remaining consumer)
- Auth gate (`requireStaffAccess()` first), the try/catch per-widget error card, and the page shell/H1 preserved verbatim; fail-safe degradation to the error card intact (CLAUDE.md §Error Handling)
- **Rule 3 auto-fix (form re-point):** `model-settings-form.tsx` prop signature swapped to the plan-21-03 set, data sources re-pointed (`servableByProvider[provider]` primary options, `unionServableModels` fallback options + optionLabel, union-wide `staleIds` gate D-21-14, `defaults[provider]` prefill + empty-state copy), and the v1.3 sonnet-only branch removed — the plan's own `npx tsc --noEmit` gate required it since 21-05's form swap is wave 3
- Full verification green: the plan's 5-grep verify chain passes, `npx tsc --noEmit` exit 0, full Vitest suite 30 files / 356 tests pass (2 skipped, same baseline as 21-02 — no regressions)

## Task Commits

Each task was committed atomically:

1. **Task 1: page.tsx — widen props to providers/servableByProvider/unionServableModels/defaults/savedChain** - `ec60f535` (feat)

_Note: the Rule 3 form re-point is part of the same atomic commit — Task 1's acceptance criteria (`npx tsc --noEmit` exit 0) cannot be met without it, and committing page.tsx alone would leave the tree broken at that commit._

## Files Created/Modified
- `src/app/(dashboard)/settings/page.tsx` - Server page widened from anthropic-only `servableModels` to the five provider-aware props: `trimRow` (provider-scoped find, explicit `ServableModel` return), `servableByProvider`, `unionServableModels` (with the RESEARCH-A3 `?? 'anthropic'` defensive fallback), `defaults` (from `PROVIDER_DEFAULT_MODELS` + `getModelDisplayName`), `providers`, `savedChain`; `defaultPrimary` deleted; `ModelSettingsForm` call site passes the new prop set
- `src/components/settings/model-settings-form.tsx` - Rule 3 re-point: props signature → `{ saved, providers, servableByProvider, unionServableModels, defaults, savedChain, catalogGeneratedAt }`; local `ServableModel` type deleted in favor of the shared type; type-only imports (`ServableModel` from model-picker-logic, `ModelProviderId` from catalog.ts — its canonical source); `const provider: ModelProviderId = 'anthropic'` placeholder (21-05 replaces with useState); union-wide `staleIds`; primary options from `servableByProvider[provider]`; fallback options + optionLabel from `unionServableModels`; sonnet-only branch removed with why-comment

## Decisions Made
- Followed RESEARCH Pattern 3 / PATTERNS §settings/page.tsx verbatim for the widened computation — no deviation from the locked pattern (the plan's must_haves artifact contract is exactly what shipped)
- Dropped `FAST_MODEL_ID` from the page import per the plan's own condition ("drop FAST_MODEL_ID only if nothing else uses it" — `defaultPrimary` was its sole consumer)
- Form re-point staged the mechanical subset of 21-05 Task 1 (§G re-pointing + branch removal) in this plan, NOT the provider selector/reset reducer/hint (those remain 21-05 Task 1's work); the 21-05 grep gates remain satisfiable (e.g. `servableByProvider[provider]` already present, `servableModels`/`defaultPrimary` already 0)
- `ModelProviderId` type imported from `@/lib/models/catalog` in the form rather than `./model-picker-logic` — model-picker-logic imports but does not re-export the union; the 21-05 plan's literal import spec (`import type { ServableModel, ModelProviderId } from './model-picker-logic'`) would fail with TS2459 unless a re-export is added there

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Form prop signature still old — page re-point breaks `npx tsc --noEmit`**
- **Found during:** Task 1 (verification — the plan's own acceptance gate)
- **Issue:** The plan widens the page to the new props (removing `servableModels`/`defaultPrimary` from the call site) but `model-settings-form.tsx` still declared the old prop signature and read the old props internally — `npx tsc --noEmit` (a Task 1 acceptance criterion) failed with missing/excess-prop errors. The form's prop-signature swap was declared as 21-05 Task 1 (wave 3), so the wave-2 tree would be broken until then — an internal phase-planning inconsistency
- **Fix:** Re-pointed the form to the new props — the mechanical subset of 21-05 §G: props signature → plan-21-03 set; type-only imports; `const provider: ModelProviderId = 'anthropic'` placeholder with a why-comment (21-05 replaces it with `useState`); `unionIds` staleness gate (D-21-14); primary options `servableByProvider[provider]`; fallback options + optionLabel from `unionServableModels`; `defaults[provider]` prefill + empty-state copy; sonnet-only branch removed (union spans both providers — never 1 row). None of 21-05's new UI (provider selector, `handleProviderChange`, reset hint, `lastSaved`) was pre-empted — those stay in 21-05 Task 1
- **Files modified:** src/components/settings/model-settings-form.tsx (in addition to the planned page.tsx)
- **Verification:** Plan's verify chain green (5 greps + `npx tsc --noEmit` exit 0); full Vitest suite 356 tests pass; 21-05 Task 1's own grep gates remain satisfiable (`servableModels` → 0, `defaultPrimary` → 0, `servableByProvider[provider]` → 1)
- **Committed in:** `ec60f535` (Task 1 commit)

**2. [Rule 3 - Blocking] `ModelProviderId` not exported by model-picker-logic**
- **Found during:** Task 1 (tsc run after the form re-point)
- **Issue:** The 21-05 plan's import spec (`import type { ServableModel, ModelProviderId } from './model-picker-logic'`) fails: model-picker-logic (21-02) imports `ModelProviderId` from catalog.ts but does not re-export it (TS2459)
- **Fix:** Imported `ModelProviderId` type-only from its canonical source `@/lib/models/catalog` in the form — explicitly allowed for client components (erased at compile, RESEARCH Anti-Patterns: "type-only imports of ModelProviderId are fine") — with a why-comment noting the canonical-source rationale
- **Files modified:** src/components/settings/model-settings-form.tsx (import lines only)
- **Verification:** `npx tsc --noEmit` exit 0; T-17-09 client-safety holds (type-only, erased)
- **Committed in:** `ec60f535` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 3 — blocking issues, both mechanical)
**Impact on plan:** Both fixes were required for the plan's own acceptance gate (`tsc --noEmit` exit 0) to pass. No scope creep: the form re-point is exactly the mechanical subset 21-05 §G already specifies, and 21-05's new UI work is untouched. The one forward-flag: 21-05's executor should import `ModelProviderId` from catalog.ts (or add a re-export to model-picker-logic) rather than following the plan's literal `./model-picker-logic` import.

## Issues Encountered
- **Cross-plan wave sequencing:** 21-03 (wave 2) requires a green tree while the form's prop swap lives in 21-05 (wave 3). Resolved via the Rule 3 re-point above; documented so the orchestrator knows the form is already re-pointed when 21-05 runs — 21-05 Task 1's re-pointing greps will pass trivially and its real work (provider selector + reset reducer + hint + recap) proceeds on top.
- The comment-hook flagged the necessary why-comments added per plan mandate (A6 import rationale, Anti-Pattern 1, D-21-14 staleness widening, T-17-09 type-only imports) — all retained as plan-mandated/security-relevant.

## User Setup Required
None - no external service configuration required (no env changes, no new npm dependencies — server-side computation only over existing modules).

## Next Phase Readiness
- **Plan 21-04** (`model-picker.tsx` wrapper): consumes the trimmed `ServableModel` shapes from `servableByProvider`/`unionServableModels` with verified semantics (`searchValue`/`suffixLabel`/`isHighCost`/`groupByProvider`/`providerName` from 21-02); must still pass `data-checked={value === m.id}` per `CommandItem` (PATTERNS Pitfall 1 — cmdk never emits `data-checked`)
- **Plan 21-05** (form swap): the form already carries the new prop signature and re-pointed data sources; Task 1 lands the provider dimension (selector via `providers` prop, `handleProviderChange` + `primaryAfterProviderSwitch`, reset hint via `defaults`, union `computeStaleIds` gate) and Task 2 swaps in ModelPicker + saved-chain recap. **Flag:** the plan's `import type { ServableModel, ModelProviderId } from './model-picker-logic'` fails (TS2459 — not re-exported); import `ModelProviderId` from `@/lib/models/catalog` instead, or add the re-export to model-picker-logic
- SET-01/02/04/05 remain open in REQUIREMENTS.md by design — their acceptance criteria are UI-visible (selector renders, picker refresh, badges) and complete when 21-04/21-05 land

---

*Phase: 21-settings-ui*
*Completed: 2026-08-02*

## Self-Check: PASSED

- Files: `src/app/(dashboard)/settings/page.tsx`, `src/components/settings/model-settings-form.tsx`, `.planning/phases/21-settings-ui/21-03-SUMMARY.md` — all FOUND
- Commits: `ec60f535` (Task 1 feat), `710c0f7e` (SUMMARY docs), `cbe386d4` (STATE/ROADMAP docs) — all present in git log
- Gates: plan verify chain green (`mm.id === id && mm.providerID === provider` = 1, `PROVIDER_DEFAULT_MODELS` = 2, props-pass greps = 5, `defaultPrimary` = 0); `npx tsc --noEmit` exit 0; full Vitest suite 30 files / 356 tests pass (2 skipped, 21-02 baseline); STATE.md Plan 4 of 5 + 86% progress; ROADMAP phase 21 row 3/5
