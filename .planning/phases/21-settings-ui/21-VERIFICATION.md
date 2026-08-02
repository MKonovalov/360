---
phase: 21-settings-ui
verified: 2026-08-03T01:55:00Z
status: gaps_found
score: 20/22 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Trigger shows the selected model with a provider badge so same-name models are disambiguated at a glance (plan 21-04 must-have, SET-05, UI-SPEC §Row Anatomy l.137)"
    status: failed
    reason: "CR-01 (review-critical, confirmed in code): the primary picker receives options={optionsForSlot(primary, fallbacks, -1, servableByProvider[provider])} and optionsForSlot with slotIndex=-1 unconditionally filters m.id !== primary — so ModelPicker's trigger lookup `options.find((m) => m.id === value)` (model-picker.tsx:55) is ALWAYS undefined for a valid primary, and the trigger falls to the raw-value branch `{value ? selected?.name ?? value : placeholder}` (model-picker.tsx:88), rendering the raw model id (e.g. `claude-sonnet-4-6`) instead of the display name. UI-SPEC l.137 explicitly contracts '{provider badge} {selected model name}'. The badge still renders (disambiguation via badge works), but the name-resolution path is unreachable for the phase's flagship component."
    artifacts:
      - path: "src/components/settings/model-picker.tsx"
        issue: "Line 55 `selected = options.find((m) => m.id === value)` can never match for the primary slot because the primary id is excluded from its own options; line 88 falls back to raw `value`."
      - path: "src/components/settings/model-settings-form.tsx"
        issue: "Line 228 passes optionsForSlot(primary, fallbacks, -1, ...) — the -1 direction excludes the primary id by design (dup-chain prevention), breaking the trigger name lookup."
      - path: "src/components/settings/model-picker-logic.ts"
        issue: "optionsForSlot (l.97-99) filters m.id !== primary for slotIndex -1 — correct for dedupe, but the wrapper has no separate name-resolution source."
    missing:
      - "Pass the resolved display name into ModelPicker (e.g. a valueName prop resolved from unionServableModels/savedChain in the form) and prefer it in the trigger, per the review's recommended fix (21-REVIEW.md CR-01)."
  - truth: "Every model slot renders as the classic Popover+Command Combobox with check state on the selected row (plan 21-04 must-have, SET-06)"
    status: failed
    reason: "Same root cause as CR-01: `data-checked={value === m.id}` (model-picker.tsx:111) can never be true for the primary slot because the primary id is absent from its own options — the checkmark never appears on the current primary. Additionally (WR-02), the anthropic primary picker opens to an empty list ('No models found.'): the anthropic servable set is exactly 1 model (claude-sonnet-4-6) and optionsForSlot(-1) excludes it, so the default-state picker renders zero rows with no explanation."
    artifacts:
      - path: "src/components/settings/model-picker.tsx"
        issue: "data-checked can never be true for the primary slot (id excluded from options); CommandEmpty shows 'No models found.' with no explanation in the single-model anthropic case."
    missing:
      - "When options is empty but the slot holds a valid value, render a non-selectable 'current selection' row with an explanation (review WR-02 fix); once the trigger-name fix lands, data-checked on the primary row should also compare against a name-resolvable source (review CR-01 alternative)."
deferred: []
human_verification: []
---

# Phase 21: Settings UI Verification Report

**Phase Goal:** Staff can select an AI Provider (Anthropic + OpenRouter) above the Primary model in the AI Model Configuration card — the Primary picker refreshes from the selected provider's servable source, fallback pickers span the union with provider/family grouping and Command-pattern search, provider badges disambiguate same-name models, and `~latest`/`:free` rows carry their labels.
**Verified:** 2026-08-03T01:55:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth   | Status     | Evidence       |
| --- | ------- | ---------- | -------------- |
| 1   | Roadmap SC1: Always-valued AI Provider selector (Anthropic + OpenRouter) above the Primary model picker; choosing a provider refreshes the Primary picker from that provider's servable source | ✓ VERIFIED | `model-settings-form.tsx:197-210` — "AI provider" `<p>` label + shadcn `Select` with `providers` prop options, directly above the "Primary model" label (l.219); primary picker options = `servableByProvider[provider]` (l.228) |
| 2   | Roadmap SC2: Provider switch follows keep-if-valid → reset-to-provider-default; draft-only (D-07), fallbacks preserved, non-blocking hint | ✓ VERIFIED | `handleProviderChange` (l.145-165) calls `primaryAfterProviderSwitch` (keep-if-valid `.some(m.id === currentPrimary)`), sets `resetHint` with the exact UI-SPEC string in slate-600, never touches fallbacks; test-locked in `model-picker-logic.test.ts` |
| 3   | Roadmap SC3: Fallback pickers show the union of all providers' servable models grouped by provider + family, with provider badges on rows and saved chain entries | ✓ VERIFIED | Fallback options = `optionsForSlot(primary, fallbacks, i, unionServableModels)` (l.275), `grouped` renders provider CommandGroup sections via `groupByProvider`; family as muted subtitle (D-21-11); badges on rows (l.126-130) + saved-chain recap with per-model badges (l.345-362) |
| 4   | Roadmap SC4: OpenRouter picker (336 rows) usable via Command-pattern type-to-filter search + provider/family grouping | ✓ VERIFIED | `CommandInput placeholder="Search models…"` (model-picker.tsx:95) over composite searchValue (id+name+family); verified 336 openrouter servable rows in snapshot; grouping via groupByProvider |
| 5   | Roadmap SC5: `~latest` labeled "always the latest"; `:free` labeled rate-limited free tier; union-wide staleness gate; catalog freshness caption retained; high-cost warnings | ✓ VERIFIED | `suffixLabel` (11 `~latest` + 14 `:free` verified in snapshot); `computeStaleIds([primary,...fallbacks], unionIds)` (l.96); "Catalog synced {date}" caption (l.373-375); amber-700 cost captions via `isHighCost` (>= 50, o1-pro $150 trips) |
| 6   | 21-01: Command primitive + Popover shell exist, compile, importable | ✓ VERIFIED | `command.tsx`, `popover.tsx`, `input-group.tsx`, `textarea.tsx` exist; `from "cmdk"` at command.tsx:4; zero `@/app/(create`/`@/registry` dangling imports; lucide resolved; tsc clean |
| 7   | 21-01: cmdk in lockfile, no yarn.lock; select.tsx + 4 consumers untouched | ✓ VERIFIED | `"cmdk": "^1.1.1"` in package.json; cmdk in package-lock.json; no yarn.lock; `git status --porcelain` empty for select.tsx + 4 consumers |
| 8   | 21-02: Pure decisions unit-testable in node-env Vitest | ✓ VERIFIED | `model-picker-logic.test.ts` — 21/21 tests pass (searchValue round-trip, suffixLabel, isHighCost, primaryAfterProviderSwitch both branches, staleIds, groupByProvider, optionsForSlot both directions, providerName) |
| 9   | 21-02: Module client-safe — no catalog.json, no server-only imports, single type-only import | ✓ VERIFIED | Only `import type { ModelProviderId } from '@/lib/models/catalog'` (l.13); `grep -c "catalog.json"` → 0 |
| 10  | 21-02: Union servable set is 337 rows (336 openrouter + 1 anthropic), fixtures inline | ✓ VERIFIED | Verified 336 openrouter rows in catalog.json snapshot; anthropic allowlist = 1 (claude-sonnet-4-6); test fixture inline & decoupled |
| 11  | 21-03: Server passes every prop the form needs (providers, servableByProvider, unionServableModels, defaults, savedChain) | ✓ VERIFIED | `page.tsx:114-121` — all 5 props passed to ModelSettingsForm; grep gates pass (providers=, servableByProvider=, unionServableModels=, defaults=, savedChain=) |
| 12  | 21-03: catalog.json stays server-only — trimmed shapes only cross the boundary | ✓ VERIFIED | `trimRow` (page.tsx:53-63) trims to six-field ServableModel; client components grep `lib/models/catalog` → 0 (model-picker.tsx), `catalog.json` → 0 |
| 13  | 21-03: Every catalog row lookup is provider-scoped | ✓ VERIFIED | `mm.id === id && mm.providerID === provider` (page.tsx:54) — Anti-Pattern 1 lock; `getProviderForModelId` scoped to the two servable providerIDs |
| 14  | 21-04: Type-to-filter searches id + display name + family via composite; selecting writes the model ID | ✓ VERIFIED | `value={searchValue(m)}` (id-first composite) + reverse-lookup `options.find((o) => searchValue(o) === v)?.id` (l.120); test-locked uniqueness |
| 15  | 21-04: Rows carry row anatomy — provider badge (union pickers), name, ~latest/:free labels, cost caption amber variant, family subtitle | ✓ VERIFIED | model-picker.tsx:124-153 — badge, name, suffixLabel span, cost caption with isHighCost amber-700, family second line (flex-col wrapper, D-21-11) |
| 16  | 21-04: Stale saved values render as a disabled row | ✓ VERIFIED | `staleLabel` prop → disabled CommandItem (l.159-174); form passes savedChain-resolved name with raw-id fallback |
| 17  | 21-05: Submit contract unchanged ({primaryModel, fallbacks}); ERROR_COPY + D-13 draft preservation untouched | ✓ VERIFIED | `saveSettingsAction` import + payload `{ primaryModel: primary, fallbacks: fallbacks.filter(...) }` (l.104-107); ERROR_COPY exactly 3 keys (l.36-40); draft never reset on failure |
| 18  | 21-05: Saved-chain recap shows provider badges per model, hides on edit | ✓ VERIFIED | l.345-362 — "Saved chain:" + per-entry Badge (providerName via union lookup) + name, gated on lastSaved equality |
| 19  | 21-05: Union-wide client staleness gate; isStale union-wide | ✓ VERIFIED | `unionIds` Set (l.95), `computeStaleIds` (l.96), `isStale = id !== '' && !unionIds.has(id)` (l.167) |
| 20  | 21-04: Trigger shows the selected model with a provider badge (display name resolves for known rows) | ✗ FAILED | CR-01: primary id excluded from its own options → trigger shows raw id (`claude-sonnet-4-6`) instead of "Claude Sonnet 4.6"; name-resolution path unreachable for the primary slot |
| 21  | 21-04: Every model slot renders the classic Combobox with check state on the selected row | ✗ FAILED | `data-checked` can never be true for the primary slot; anthropic primary picker (default state) opens to empty list with no explanation (WR-02) |
| 22  | 21-04/21-05: Client-safe wiring — ModelPicker → command.tsx + model-picker-logic; form → model-picker + logic + action | ✓ VERIFIED | gsd-sdk verify.key-links: 2/2 verified (command.tsx, model-picker-logic); form imports ModelPicker, logic helpers, saveSettingsAction — all wired and used |

**Score:** 20/22 truths verified

### Deferred Items

None. Phase 22 is the verification gate (VER-01..05), not a fix phase — CR-01's trigger-name resolution is not claimed by any later phase's goal or success criteria, so it remains an actionable gap for this phase.

### Required Artifacts

| Artifact | Expected    | Status | Details |
| -------- | ----------- | ------ | ------- |
| `src/components/ui/command.tsx` | Vendored shadcn Command (cmdk wrapper) | ✓ VERIFIED | Exists, `from "cmdk"`, zero dangling imports, lucide SearchIcon/CheckIcon resolved, max-h-72, data-slot anatomy |
| `src/components/ui/popover.tsx` | Vendored shadcn Popover | ✓ VERIFIED | Exists, radix-ui imports, PopoverTrigger/Content |
| `src/components/ui/input-group.tsx`, `textarea.tsx` | Auto-registry dependencies | ✓ VERIFIED | Both exist |
| `package.json` / `package-lock.json` | cmdk@^1.1.1 | ✓ VERIFIED | Dependency recorded; lockfile entry present; no yarn.lock |
| `src/components/settings/model-picker-logic.ts` | Pure decision module (8 exports + ServableModel) | ✓ VERIFIED | All exports present; single type-only import; catalog.json → 0 |
| `src/components/settings/model-picker-logic.test.ts` | 21-test Vitest suite | ✓ VERIFIED | 21/21 pass; 8 describe blocks |
| `src/app/(dashboard)/settings/page.tsx` | Provider-aware props + provider-scoped trimRow | ✓ VERIFIED | All 5 props; Anti-Pattern 1 lock; defaultPrimary removed |
| `src/components/settings/model-picker.tsx` | Combobox wrapper | ✓ VERIFIED (1 defect) | data-checked, composite round-trip, grouping, badges, labels, cost, stale row — but trigger name-resolution broken for primary (CR-01) |
| `src/components/settings/model-settings-form.tsx` | Provider-aware form | ✓ VERIFIED (1 defect) | Select above Primary, reset reducer + hint, union gate, ModelPicker swaps, recap — but feeds primary picker the id-excluding options (CR-01) |

### Key Link Verification

| From | To  | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| model-picker.tsx | components/ui/command.tsx | Command imports | ✓ WIRED | gsd-sdk verified: "Pattern found in source" |
| model-picker.tsx | model-picker-logic.ts | searchValue/suffixLabel/isHighCost/groupByProvider/providerName | ✓ WIRED | gsd-sdk verified: "Pattern found in source" |
| model-settings-form.tsx | model-picker.tsx | ModelPicker on primary + fallback slots | ✓ WIRED | 2 `<ModelPicker` JSX sites (primary + fallback map); 1 `<Select` (provider selector, D-21-06) |
| model-settings-form.tsx | model-picker-logic.ts | primaryAfterProviderSwitch/staleIds/optionsForSlot/providerName | ✓ WIRED | All imported and used |
| model-settings-form.tsx | app/actions/settings.ts | saveSettingsAction submit contract | ✓ WIRED | Unchanged payload `{primaryModel, fallbacks}` |
| settings/page.tsx | lib/models/catalog.ts | getServableIdsForProvider/getUnionServableIds/getProviderForModelId | ✓ WIRED | Server-side only; 336+1 rows flow through trimRow |
| settings/page.tsx | ModelSettingsForm | props-only contract | ✓ WIRED | 5 provider-aware props + saved + catalogGeneratedAt |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| Primary ModelPicker | `options` | `optionsForSlot(primary, fallbacks, -1, servableByProvider[provider])` ← server trimRow over catalog.json | ✓ Real (336/1 rows, provider-scoped) | ✓ FLOWING (options); ⚠️ HOLLOW trigger-name resolution (CR-01) — `selected` always undefined for the primary slot |
| Fallback ModelPickers | `options` | `optionsForSlot(primary, fallbacks, i, unionServableModels)` | ✓ Real (337 rows) | ✓ FLOWING — slot's own id retained so trigger resolves |
| Provider Select | `providers` | SERVABLE_PROVIDERS map | ✓ Real (2 choices) | ✓ FLOWING |
| Saved-chain recap | `savedChain` + `unionServableModels` | server-resolved provider identity | ✓ Real | ✓ FLOWING |
| Staleness gate | `unionIds` | unionServableModels | ✓ Real | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| TypeScript compiles | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Logic suite | `npx vitest run src/components/settings/model-picker-logic.test.ts` | 21/21 pass | ✓ PASS |
| Full test suite | `npm test` | 356 passed / 6 skipped, 30 files | ✓ PASS |
| Production build | `npm run build` | exit 0 (settings route rendered) | ✓ PASS |
| Dangling-import scan | `grep -c '@/app/(create\|@/registry' command.tsx` | 0 | ✓ PASS |
| Client-safety canaries | `grep -c "catalog.json" model-picker-logic.ts` + model-picker.tsx | 0 / 0 | ✓ PASS |
| CR-01 trigger resolution | Trace: optionsForSlot(-1) excludes primary id → `selected` undefined → raw `value` rendered | Reproduces by code inspection | ✗ FAIL (confirmed defect) |

### Probe Execution

Step 7c: SKIPPED — this is a UI phase with no migration/tooling probe scripts. No `scripts/*/tests/probe-*.sh` exist and no PLAN declares probes. The phase gates (tsc, vitest, next build) were run directly above.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| SET-01 | 21-03, 21-05 | AI Provider selector renders above the Primary model picker — always-valued, Anthropic + OpenRouter options | ✓ SATISFIED | "AI provider" Select above "Primary model" label; `providers` prop from SERVABLE_PROVIDERS |
| SET-02 | 21-03, 21-05 | Selecting a provider refreshes the Primary model picker from that provider's servable source | ✓ SATISFIED | `servableByProvider[provider]` drives primary options (l.228) |
| SET-03 | 21-02, 21-05 | Provider switch keep-if-valid → reset-to-provider-default; draft-only; fallbacks preserved; non-blocking hint | ✓ SATISFIED | `primaryAfterProviderSwitch` reducer + resetHint; fallbacks never touched; test-locked |
| SET-04 | 21-02, 21-03, 21-04, 21-05 | Fallback pickers show union of all providers' servable models, grouped by provider + family | ✓ SATISFIED | `optionsForSlot(..., unionServableModels)`, `grouped` provider CommandGroups + family subtitles (D-21-11 locked) |
| SET-05 | 21-03, 21-04, 21-05 | Provider badges on picker rows and saved chain entries (disambiguates same-name models) | ⚠️ PARTIAL | Badges render on rows, triggers, and recap — disambiguation works; but primary trigger shows raw id not display name (CR-01) |
| SET-06 | 21-01, 21-02, 21-04, 21-05 | Command-pattern type-to-filter search + provider/family grouping in the OpenRouter picker (336 rows usable) | ✓ SATISFIED | CommandInput + composite searchValue + groupByProvider; 336 rows verified |
| SET-07 | 21-02, 21-04, 21-05 | `~latest` aliases labeled "always the latest"; `:free` variants labeled rate-limited free tier | ✓ SATISFIED | `suffixLabel` order-locked; 11 ~ / 14 :free verified; labels render in rows |
| SET-08 | 21-02, 21-05 | Staleness gate covers union-wide servable set; catalog freshness caption retained; cost captions incl. high-cost warnings | ✓ SATISFIED | `computeStaleIds` over unionIds; "Catalog synced" caption; amber-700 `isHighCost` |

Requirement traceability: All 8 SET IDs appear in PLAN frontmatter (21-01: SET-06; 21-02: SET-03/04/06/07/08; 21-03: SET-01/02/04/05; 21-04: SET-04/05/06/07; 21-05: SET-01..08) — union covers all 8, no orphaned requirements. REQUIREMENTS.md marks all 8 Complete; this verification confirms 7 fully satisfied and SET-05 partially (badge disambiguation works, display-name resolution does not — CR-01).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| model-picker.tsx | 55, 88 | Trigger name-lookup seam unpinned — `selected` lookup over the deduped options list makes the display-name path unreachable for the primary slot | 🛑 Blocker (CR-01) | Flagship component shows raw model id instead of display name on every load; check state never renders on primary |
| model-settings-form.tsx | 99-124, 335-366 | `status`/`errorMsg` never reset on draft edits (WR-01) | ⚠️ Warning | After a failed save, the red errorMsg stays while the user edits; after a successful save, "Saved." persists on a dirty draft |
| model-settings-form.tsx | 228 | Primary picker options degenerate to empty list in the anthropic default state (WR-02) | ⚠️ Warning | Anthropic servable set = 1 model = the primary itself, so the picker opens to "No models found." with no explanation |

No TBD/FIXME/XXX/TODO/HACK markers found in any phase-modified file.

### Human Verification Required

No automated-test-blocking items remain for status determination (status is already gaps_found). However, for the eventual UAT pass (Phase 22 VER-05), these need human eyes once CR-01 is fixed:

### Gaps Summary

**2 must-have truths fail, both from the same root cause (CR-01):** the primary model picker's trigger never resolves the display name (raw model id shown instead) and never shows a checkmark on the current primary, because `optionsForSlot` with `slotIndex = -1` excludes the primary id from its own options while `ModelPicker`'s trigger lookup (`selected = options.find(m => m.id === value)`) and check-state (`data-checked={value === m.id}`) both depend on that id being present. The review's fix (pass a resolved `valueName` into `ModelPicker` from the form, or keep a name-resolvable lookup source separate from the deduped options) is small and contained. WR-02 (empty anthropic primary list) is a consequence of the same design and should be addressed in the same rework (render a non-selectable "current selection" row when options is empty). WR-01 (stale status/errorMsg on draft edits) is a standalone polish item — no must-have truth is violated, but it degrades feedback accuracy.

Everything else verified: all 5 roadmap success criteria functionally met, 8/8 SET requirements implemented (7 fully, SET-05 partially via CR-01), all artifacts exist/substantive/wired, key links verified, client-safety (T-17-09) and Anti-Pattern 1 provider-scoping locks hold, full test suite (356) and production build pass.

---

_Verified: 2026-08-03T01:55:00Z_
_Verifier: Claude (gsd-verifier)_
