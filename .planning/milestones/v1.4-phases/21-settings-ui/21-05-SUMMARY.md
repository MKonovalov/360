---
phase: 21-settings-ui
plan: 05
subsystem: ui
tags: [settings, provider-aware, model-picker, combobox, cmdk, staleness-gate, saved-chain-recap, sett1-sett8]

# Dependency graph
requires:
  - phase: 21-settings-ui
    provides: 21-02's pure decision module (primaryAfterProviderSwitch/staleIds/optionsForSlot/providerName), 21-03's provider-aware page props (providers/servableByProvider/unionServableModels/defaults/savedChain), 21-04's ModelPicker Combobox wrapper
provides:
  - The complete provider-aware Settings AI Model Configuration card: always-valued 'AI provider' Select above the Primary label (SET-01), keep-if-valid → reset-to-provider-default switch with non-blocking slate-600 hint (SET-03, D-21-01), fallbacks preserved verbatim across switches (D-21-02), union-wide staleness gate via computeStaleIds (SET-08, D-21-14), Command Combobox pickers on all model slots (SET-06, D-21-06) with provider grouping + trigger badges + ~latest/:free suffixes + amber high-cost captions (SET-04/05/07), and the saved-chain recap with per-model provider badges (SET-05, D-21-10)
  - The submit contract unchanged ({primaryModel, fallbacks} → saveSettingsAction), ERROR_COPY three-key map + D-13 draft preservation intact — the phase's visible deliverable and the milestone goal's UI half
affects: [Phase 22 verification gate (VER-01..05), REQUIREMENTS.md SET-01..08 now complete, human-verify settings UI, LEARNINGS extraction]

# Tech tracking
tech-stack:
  added: [] (no new dependencies — consumes cmdk shipped in 21-01, logic from 21-02, props from 21-03, wrapper from 21-04)
  patterns: [provider dimension layered on a re-pointed form (the 21-03 Rule-3 re-point provided the data sources; 21-05 added state + selector + reducer + hint on top — zero double-application), non-blocking informational hint (slate-600, never red) for a draft-only reset (D-07), union-wide client staleness gate delegated to the pure computeStaleIds, saved-chain recap gated on a lastSaved snapshot equality check]

key-files:
  created: []
  modified:
    - src/components/settings/model-settings-form.tsx

key-decisions:
  - "Initial provider = savedChain[0].providerID (the saved primary's provider, server-resolved) else 'anthropic' (REG-05 fast path) — the provider state starts where the user's chain actually lives (UI-SPEC Interaction Contract initial state)"
  - "handleProviderChange is a function declaration (house style, matching handleSave/moveFallback) calling the 21-02 pure reducer; the hint is set ONLY when resetToDefault — keep-if-valid shows no hint (UI-SPEC switch sequence step 2)"
  - "aria-label='AI provider' placed on the SelectTrigger (the real button), not the Select root — radix Select.Root renders no DOM node, so a Root-level aria-label would be dropped; the visible <p> label + trigger aria-label are the two exact 'AI provider' occurrences the acceptance grep locks"
  - "Primary ModelPicker options = optionsForSlot(primary, fallbacks, -1, servableByProvider[provider]) — slotIndex -1 excludes the primary id AND all fallback ids (Open Question 3) so Save can never hit duplicate_model; the onChange also clears resetHint (hint lifecycle RESOLVED)"
  - "Fallback ModelPickers pass grouped (provider CommandGroup sections, D-21-08) and badge={unionServableModels.find(...)?.providerID ?? undefined} — trigger badges required on every picker (UI-SPEC §Row Anatomy); a stale id absent from the union yields no badge"
  - "Saved-chain recap entries resolve provider via unionServableModels lookup and name via savedChain with raw-id fallback — both server-computed props rendered as React text (T-21-14/T-21-15); recap hides as soon as any slot is edited (lastSaved equality check fails)"

patterns-established:
  - "Pattern: plan-verify grep conflicts with comment prose — the literal 'AI provider' string must appear exactly twice (visible label + aria-label), so comments must NOT echo the checked string; reworded the JSX why-comment to 'provider selector' (same lesson as 21-02's catalog.json canary)"
  - "Pattern: provider-switch reducer consumption — call the pure reducer, then drive BOTH setPrimary and setResetHint from its return; fallbacks never touched (D-21-02) and the draft-only reset needs no persistence until Save (D-07)"
  - "Pattern: recap-after-save gate — persist a lastSaved snapshot at save success and render the recap only while the draft still equals it; the recap self-hides on any subsequent edit without extra state"

requirements-completed: [SET-01, SET-02, SET-03, SET-04, SET-05, SET-06, SET-07, SET-08]

# Metrics
duration: 5min
completed: 2026-08-02
---

# Phase 21 Plan 5: Provider-Aware Settings Form + ModelPicker Swap Summary

**The complete provider-aware Settings AI Model Configuration card — always-valued AI provider Select above the Primary label with keep-if-valid → reset-to-provider-default (non-blocking slate-600 hint, fallbacks preserved), union-wide computeStaleIds save gate, Command Combobox pickers (provider grouping + trigger badges + ~latest/:free suffixes + amber high-cost captions) on every model slot, and the saved-chain recap with per-model provider badges — consuming 21-02/03/04's props + logic + wrapper while the submit contract, ERROR_COPY, and D-13 draft preservation stay verbatim (the milestone goal's UI half)**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-02T23:37:03Z
- **Completed:** 2026-08-02T23:40:37Z
- **Tasks:** 2 (both `type="auto"`, no checkpoints)
- **Files modified:** 1

## Accomplishments
- **Provider dimension (Task 1):** `provider` state initializes from `savedChain[0].providerID` (the saved primary's provider) else `'anthropic'` (REG-05 fast path); the always-valued "AI provider" Select (shadcn, D-21-06 keeps Select for the 2-choice control) renders directly above the Primary model label (D-21-03, SET-01) with `value={provider}` / `onValueChange={handleProviderChange}`; the handler calls the 21-02 pure reducer `primaryAfterProviderSwitch` — keep-if-valid shows no hint, reset shows the exact UI-SPEC string "Primary model reset to {default} for {provider}." in `text-slate-600` (informational, never red, D-21-01). Fallbacks are never touched (D-21-02) — the chain may become cross-provider by design; the reset is draft-only (D-07) and Pitfall 6 (reset colliding with a preserved fallback id) is left to the server `duplicate_model` backstop per research
- **Union-wide staleness gate (SET-08, D-21-14):** `staleIds` now derives from `computeStaleIds([primary, ...fallbacks], unionIds)` — the pure 21-02 helper over the union servable set, keeping the D-10/D-11 why-comment verbatim (staleness from the CURRENT DRAFT, `''` = in-progress row, never stale); `saveDisabled = isPending || staleIds.length > 0` unchanged; `isStale(id)` = `id !== '' && !unionIds.has(id)`
- **ModelPicker swaps (Task 2, D-21-06):** the primary slot renders `ModelPicker` with `optionsForSlot(primary, fallbacks, -1, servableByProvider[provider])` (slotIndex -1 = primary direction — excludes primary + all fallback ids, Open Question 3), `badge={provider}`, `grouped={false}`; fallback slots render `ModelPicker` with union `optionsForSlot(primary, fallbacks, i, unionServableModels)`, `grouped` (provider CommandGroup sections, D-21-08) and per-row trigger badges from the union lookup (UI-SPEC §Row Anatomy — required on every picker). `staleLabel` on both resolves stale saved values via `savedChain` names with raw-id fallback (D-10/D-11, T-21-15); the red "no longer runnable" hints and the move-up/down/remove ghost buttons + aria-labels stay exactly as-is
- **Saved-chain recap (SET-05, D-21-10):** after a successful Save, "Saved chain:" renders one `Badge variant="secondary"` (providerName from the union lookup, `?? 'anthropic'` defensive fallback) + name (savedChain, raw-id fallback) per model in `[primary, ...fallbacks.filter(f => f !== '')]` joined by " → "; gated on a `lastSaved` snapshot so it hides the moment any slot is edited
- **Unchanged contract (SET-08 backstop):** ERROR_COPY keeps exactly its three keys; the submit payload stays `{ primaryModel: primary, fallbacks: fallbacks.filter((id) => id !== '') }`; D-13 preserves the draft verbatim on failure
- **All gates green:** Task 1 verify chain (8 greps + `npx tsc --noEmit`), Task 2 verify chain (5 greps + full `npm test` + `npm run build`), 21-02 logic suite 21/21, full suite 356 passed / 6 skipped — no regressions; `next build` exit 0 (the VALIDATION.md phase gate: vendored imports, RSC boundary, props wiring)

## Task Commits

Each task was committed atomically:

1. **Task 1: Form provider dimension — Select above Primary, provider state, reset reducer + hint, union staleness gate** - `09d06b61` (feat)
2. **Task 2: ModelPicker swaps + row anatomy + saved-chain recap + phase gate** - `bb2bdc65` (feat)

**Plan metadata:** (final docs commit follows — SUMMARY + STATE/ROADMAP)

## Files Created/Modified
- `src/components/settings/model-settings-form.tsx` - Extended in place (never rewritten): provider useState (savedChain-initialized), handleProviderChange reducer wiring + non-blocking reset hint, computeStaleIds union gate, provider Select block, ModelPicker on primary + fallback slots with row anatomy props, saved-chain recap; optionLabel helper removed (superseded by the wrapper's own label/cost rendering); ERROR_COPY/submit/D-13 verbatim

## Decisions Made
- **Provider state init follows the user's chain, not a hardcoded default** — `savedChain?.[0]?.providerID ?? 'anthropic'` matches UI-SPEC Interaction Contract "initial state: provider of the saved primary (from savedChain), else 'anthropic'"
- **All decision logic stays in the 21-02 pure module** — the form's handler is a thin call site (`primaryAfterProviderSwitch`, `computeStaleIds`, `optionsForSlot`) so SET-03/04/08 semantics remain unit-tested at the logic layer; no logic duplicated in the component
- **Recap name source = savedChain with raw-id fallback** (same resolution as staleLabel) rather than a union lookup — consistent with the T-21-15 mitigation (server-computed names only) and correct even if the union props lack the id
- **`aria-label="AI provider"` on SelectTrigger** — radix Root renders no DOM node; the trigger button is the real element needing the accessible name (UI-SPEC §Accessibility "Provider selector labeled 'AI provider'")

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] JSX comment echoed the acceptance-grep literal "AI provider"**
- **Found during:** Task 1 (verify chain — the plan's own exact-2 grep)
- **Issue:** The why-comment above the selector read "the always-valued AI provider selector…" — grep counted the literal and returned 3 instead of the locked 2 (visible `<p>` label + trigger aria-label)
- **Fix:** Reworded the comment to "the always-valued provider selector" — rationale intact, grep back to exactly 2 (same comment-prose-vs-canary lesson as 21-02's catalog.json canary)
- **Files modified:** src/components/settings/model-settings-form.tsx (comment only)
- **Verification:** Task 1 verify chain green (`grep -c "AI provider"` → 2)
- **Committed in:** `09d06b61` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 — comment-only fix, zero behavior change)
**Impact on plan:** Minimal — the fix was required for the plan's own acceptance grep to pass; no scope creep, no architectural change.

## Issues Encountered
- None beyond the grep-canary comment fix above. The handoff flags were honored: `ModelProviderId` kept imported from its canonical source `@/lib/models/catalog` (never from model-picker-logic — TS2459), and the 21-03 Rule-3 §G re-point (props signature, `servableByProvider[provider]` primary source, union optionLabel, sonnet-branch removal, `defaults[provider]` prefill) was verified present and NOT re-applied — Task 1's greps (`servableModels` → 0, `defaultPrimary` → 0, `servableByProvider[provider]` → 1) passed trivially on the existing state, confirming no double-application.

## User Setup Required
None - no external service configuration required (no env changes, no new npm dependencies — cmdk shipped in 21-01).

## Next Phase Readiness
- **Phase 22 (verification gate)** can now exercise the visible Settings UI: provider switch → primary picker refresh + reset hint, cross-provider chain Save → recap with badges, stale-id blocks Save, type-to-filter search on the 336-row OpenRouter picker, ~latest/:free labels, amber o1-pro caption
- **REQUIREMENTS.md:** SET-01..08 are all complete — this plan's `requirements-completed` lists all 8 (the UI-visible acceptance criteria 21-01/02/03/04 deliberately left open are now closed by the rendered form)
- **Known-good state for human UAT:** local `npm run dev` + sign-in → Settings renders the provider-aware card; the stale-chain legacy behavior (D-10/D-11), draft preservation (D-13), and the server action backstop (REG-07) all untouched

---

*Phase: 21-settings-ui*
*Completed: 2026-08-02*

## Self-Check: PASSED

- Files: `src/components/settings/model-settings-form.tsx`, `.planning/phases/21-settings-ui/21-05-SUMMARY.md` — both FOUND
- Commits: `09d06b61` (Task 1 feat), `bb2bdc65` (Task 2 feat) — both present in git log
- Gates: Task 1 chain (8 greps + `npx tsc --noEmit` exit 0); Task 2 chain (5 greps + `npm test` exit 0 + `npm run build` exit 0); 21-02 logic suite 21/21; full suite 356 passed / 6 skipped; no deletions in either task commit
